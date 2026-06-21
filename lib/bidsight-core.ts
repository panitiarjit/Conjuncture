/**
 * BidSight core bid-recommendation logic (corrected model).
 * CDF-based win probability, quantile benchmarks, no bidder-count dependence.
 * Out-of-time R² ≈ 0.03 (correct, not a bug: bidder count unknowable pre-bid).
 */

import type { AwardedContract } from './types';

// Empirical benchmarks from 29,750 e-bidding tenders (FY2559–2568)
export const GLOBAL_MEDIAN = 18.5;  // median discount
export const GLOBAL_SIGMA = 12.0;   // stdev
export const CALIB = 0.875;         // calibration shrink (0.70/0.80 coverage gap)

export interface QuantileTable {
  median: number;
  sigma: number;
  q25: number;
  q75: number;
  n: number;
  source: string;
}

// Standard normal CDF using Abramowitz–Stegun approximation
export function phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const ans = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - ans : ans;
}

export interface BidRecommendation {
  recommendedBid: number;
  recommendedDiscount: number;
  marketMedianDiscount: number;
  predictedWinProb: number;
  expectedMargin: number;
  marginFloorBreached: boolean;
  cannotMeetMargin: boolean;
  benchmarkSource: string;
}

/**
 * Core calculation: given profile, cost, reference price, margin target,
 * recommend a bid and discount.
 * Optionally pass a benchmark table for category-specific predictions.
 */
export function recommendBid(
  refPrice: number,
  costM: number,
  targetMarginPct: number = 10,
  targetWinProbPct: number = 60,
  benchmark?: QuantileTable,
): BidRecommendation {
  const costRatio = costM / refPrice;

  // Margin guard: largest discount that preserves target margin
  const marginMaxDiscount = (1 - costRatio / (1 - targetMarginPct / 100)) * 100;

  const benchDiscount = benchmark?.median ?? GLOBAL_MEDIAN;
  const sigma = Math.max(benchmark?.sigma ?? GLOBAL_SIGMA, 1);
  const source = benchmark?.source ?? 'global';

  // Target discount: market benchmark, capped by margin floor
  const targetDiscount = Math.min(benchDiscount, marginMaxDiscount);

  // Recommended bid anchored on reference price
  const bid = refPrice * (1 - targetDiscount / 100);

  // Win probability: CDF-based, monotonic, calibrated
  const z = (targetDiscount - benchDiscount) / sigma;
  const phiZ = phi(z);
  const winProb = phiZ * CALIB + 0.5 * (1 - CALIB);
  const winProbPct = Math.max(3, Math.min(97, Math.round(winProb * 100)));

  // Actual margin on revenue
  const actualMargin = (bid - costM) / bid * 100;

  const marginFloorBreached = marginMaxDiscount > 0 && targetDiscount > marginMaxDiscount;
  const cannotMeetMargin = marginMaxDiscount <= 0;

  return {
    recommendedBid: Math.round(bid * 10) / 10,
    recommendedDiscount: Math.round(targetDiscount * 10) / 10,
    marketMedianDiscount: benchDiscount,
    predictedWinProb: winProbPct,
    expectedMargin: Math.round(actualMargin * 10) / 10,
    marginFloorBreached,
    cannotMeetMargin,
    benchmarkSource: source,
  };
}

/**
 * Generate the win-probability curve for visualization.
 * Maps discount % → win probability % along the CDF.
 */
export function generateWinCurve(): Array<{ bid: string; disc: number; winProb: number }> {
  const benchDiscount = GLOBAL_MEDIAN;
  const sigma = Math.max(GLOBAL_SIGMA, 1);
  const maxDisc = Math.min(55, benchDiscount * 2.5 + sigma);

  return Array.from({ length: 17 }, (_, i) => {
    const discPct = (maxDisc * i) / 16;
    const z = (discPct - benchDiscount) / sigma;
    const phiZ = phi(z);
    const probRaw = phiZ * CALIB + 0.5 * (1 - CALIB);
    const probPct = Math.max(3, Math.min(97, Math.round(probRaw * 100)));

    return {
      bid: `${Math.round(100 - discPct)}%`,
      disc: Math.round(discPct * 10) / 10,
      winProb: probPct,
    };
  });
}

/**
 * Compute quantile table from a list of discount values.
 */
function computeQuantiles(discounts: number[]): QuantileTable {
  if (discounts.length === 0) {
    return { median: GLOBAL_MEDIAN, sigma: GLOBAL_SIGMA, q25: 0, q75: 0, n: 0, source: 'empty' };
  }

  const sorted = [...discounts].sort((a, b) => a - b);
  const len = sorted.length;

  const median = len % 2 === 0
    ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
    : sorted[Math.floor(len / 2)];

  const q25Idx = Math.floor(len * 0.25);
  const q75Idx = Math.floor(len * 0.75);
  const q25 = sorted[q25Idx];
  const q75 = sorted[q75Idx];

  // Stdev
  const mean = discounts.reduce((a, b) => a + b, 0) / len;
  const variance = discounts.reduce((sum, x) => sum + (x - mean) ** 2, 0) / len;
  const sigma = Math.sqrt(variance);

  return { median: Math.round(median * 10) / 10, sigma: Math.round(sigma * 10) / 10, q25: Math.round(q25 * 10) / 10, q75: Math.round(q75 * 10) / 10, n: len, source: 'computed' };
}

/**
 * Build benchmark tables from awarded contracts.
 * Returns { agency_category, category, global }
 */
export function buildBenchmarkTables(contracts: AwardedContract[]): {
  agencyCategory: Map<string, QuantileTable>;
  category: Map<string, QuantileTable>;
  global: QuantileTable;
} {
  // Filter: only e-bidding (procurementMethodGroup), only those with valid discount
  const ebidding = contracts.filter(
    (c) =>
      c.procurementMethodGroup === 'e-bidding' &&
      c.discountFromReference != null &&
      c.discountFromReference > 0 &&
      c.discountFromReference < 100
  );

  const agencyCategory = new Map<string, number[]>();
  const category = new Map<string, number[]>();

  // Group by agency×category and category
  for (const contract of ebidding) {
    const key = `${contract.agency}|${contract.projectType}`;
    if (!agencyCategory.has(key)) agencyCategory.set(key, []);
    agencyCategory.get(key)!.push(contract.discountFromReference!);

    if (!category.has(contract.projectType)) category.set(contract.projectType, []);
    category.get(contract.projectType)!.push(contract.discountFromReference!);
  }

  // Compute quantiles
  const agencyCategoryTables = new Map<string, QuantileTable>();
  for (const [key, discounts] of agencyCategory) {
    if (discounts.length >= 8) {
      const qt = computeQuantiles(discounts);
      qt.source = 'agency×category';
      agencyCategoryTables.set(key, qt);
    }
  }

  const categoryTables = new Map<string, QuantileTable>();
  for (const [cat, discounts] of category) {
    const qt = computeQuantiles(discounts);
    qt.source = 'category';
    categoryTables.set(cat, qt);
  }

  const globalQt = computeQuantiles(ebidding.map((c) => c.discountFromReference!));
  globalQt.source = 'global';

  return { agencyCategory: agencyCategoryTables, category: categoryTables, global: globalQt };
}

/**
 * Get benchmark for a tender profile (agency, category).
 * Fall back: agency×category (n≥8) → category → global
 */
export function getBenchmarkFromTables(
  agency: string | undefined,
  category: string | undefined,
  tables: ReturnType<typeof buildBenchmarkTables>
): QuantileTable {
  const key = `${agency}|${category}`;
  if (agency && category && tables.agencyCategory.has(key)) {
    return tables.agencyCategory.get(key)!;
  }
  if (category && tables.category.has(category)) {
    return tables.category.get(category)!;
  }
  return tables.global;
}
