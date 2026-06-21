/**
 * BidSight core bid-recommendation logic (corrected model v2).
 *
 * Key corrections from v1:
 * 1. No "win probability" — data is winner-only (every row won), so P(win)
 *    cannot be estimated. Replaced with positioning percentile.
 * 2. No normal distribution assumption. Discounts are right-skewed and
 *    zero-inflated — the empirical CDF speaks for itself.
 * 3. Calibration retained but re-derived. The old 0.875 was a single-point
 *    shrink with no theoretical basis. Replaced with Bayesian Beta prior
 *    (additive smoothing): add CALIB_ALPHA pseudo-observations on each side,
 *    shrinking extreme percentile claims toward 50 with small n. Effect
 *    vanishes naturally as n grows — no magic constant.
 * 4. Output is a competitiveness band (p10–p90) + percentile + label.
 *
 * Out-of-time R² ≈ 0.03 (correct: bidder count unknowable pre-bid).
 */

import type { AwardedContract } from './types';

// Global fallback constants (from 29,750 e-bidding tenders FY2559–2568)
export const GLOBAL_MEDIAN  = 18.5;
export const GLOBAL_SIGMA   = 12.0;
export const MIN_N          = 8;    // minimum bucket size before falling back
// Beta prior pseudo-count per side. CALIB_ALPHA=2 adds 4 pseudo-observations
// (2 below, 2 above), strongly shrinking tiny buckets toward 50th pct while
// having negligible effect at n≥100. Equivalent to a Beta(2,2) prior.
export const CALIB_ALPHA    = 2;

// ─── Quantile Table ─────────────────────────────────────────────────────────

export interface QuantileTable {
  discounts: number[];  // sorted raw values — for empirical CDF lookups
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  sigma: number;
  n: number;
  source: string;
}

function percentile(sorted: number[], p: number): number {
  const h = (sorted.length - 1) * p / 100;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

function computeQuantileTable(discounts: number[], source: string): QuantileTable {
  const sorted = [...discounts].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const variance = sorted.reduce((s, x) => s + (x - mean) ** 2, 0) / n;

  return {
    discounts: sorted,
    p10:    Math.round(percentile(sorted, 10)  * 10) / 10,
    p25:    Math.round(percentile(sorted, 25)  * 10) / 10,
    median: Math.round(percentile(sorted, 50)  * 10) / 10,
    p75:    Math.round(percentile(sorted, 75)  * 10) / 10,
    p90:    Math.round(percentile(sorted, 90)  * 10) / 10,
    sigma:  Math.round(Math.sqrt(variance)     * 10) / 10,
    n,
    source,
  };
}

// ─── Benchmark Tables ────────────────────────────────────────────────────────

export function buildBenchmarkTables(contracts: AwardedContract[]): {
  agencyCategory: Map<string, QuantileTable>;
  category:       Map<string, QuantileTable>;
  global:         QuantileTable;
} {
  const ebidding = contracts.filter(
    (c) =>
      c.procurementMethodGroup === 'e-bidding' &&
      c.discountFromReference != null &&
      c.discountFromReference > 0 &&
      c.discountFromReference < 100,
  );

  const agCatMap = new Map<string, number[]>();
  const catMap   = new Map<string, number[]>();

  for (const c of ebidding) {
    const key = `${c.agency}|${c.projectType}`;
    if (!agCatMap.has(key)) agCatMap.set(key, []);
    agCatMap.get(key)!.push(c.discountFromReference!);

    if (!catMap.has(c.projectType)) catMap.set(c.projectType, []);
    catMap.get(c.projectType)!.push(c.discountFromReference!);
  }

  const agencyCategory = new Map<string, QuantileTable>();
  for (const [key, vals] of agCatMap) {
    if (vals.length >= MIN_N) {
      agencyCategory.set(key, computeQuantileTable(vals, 'agency×category'));
    }
  }

  const category = new Map<string, QuantileTable>();
  for (const [cat, vals] of catMap) {
    category.set(cat, computeQuantileTable(vals, 'category'));
  }

  const allDiscounts = ebidding.map((c) => c.discountFromReference!);
  const global = allDiscounts.length > 0
    ? computeQuantileTable(allDiscounts, 'global')
    : computeQuantileTable([GLOBAL_MEDIAN], 'global-fallback');

  return { agencyCategory, category, global };
}

export function getBenchmarkFromTables(
  agency:   string | undefined,
  category: string | undefined,
  tables:   ReturnType<typeof buildBenchmarkTables>,
): { table: QuantileTable; fallbackUsed: boolean } {
  const key = `${agency}|${category}`;

  if (agency && category && tables.agencyCategory.has(key)) {
    return { table: tables.agencyCategory.get(key)!, fallbackUsed: false };
  }
  if (category && tables.category.has(category)) {
    return { table: tables.category.get(category)!, fallbackUsed: true };
  }
  return { table: tables.global, fallbackUsed: true };
}

// ─── Positioning Percentile (replaces "win probability") ────────────────────

export type PositioningLabel =
  | 'soft'        // < 25th pct — below most winners, safe margin, low competitiveness
  | 'conservative'// 25–50th
  | 'competitive' // 50–75th — around the typical winning range
  | 'aggressive'  // 75–90th — strong positioning, thinner margin
  | 'very_aggressive'; // > 90th — top decile, check margin floor

function positioningLabel(pct: number): PositioningLabel {
  if (pct < 25) return 'soft';
  if (pct < 50) return 'conservative';
  if (pct < 75) return 'competitive';
  if (pct < 90) return 'aggressive';
  return 'very_aggressive';
}

const LABEL_TH: Record<PositioningLabel, string> = {
  soft:           'ราคาสูง (อ่อน)',
  conservative:   'ต่ำกว่าตลาด',
  competitive:    'ระดับตลาด',
  aggressive:     'เชิงรุก',
  very_aggressive:'เชิงรุกมาก',
};

const LABEL_EN: Record<PositioningLabel, string> = {
  soft:           'Soft — below most winners, safe margin',
  conservative:   'Conservative — below median',
  competitive:    'Competitive — around the typical winning range',
  aggressive:     'Aggressive — strong positioning, thinner margin',
  very_aggressive:'Very aggressive — top decile, check margin',
};

// ─── Main Output Types ───────────────────────────────────────────────────────

export interface BidRecommendation {
  // Economics
  recommendedBid:           number;
  recommendedDiscount:      number;
  marketMedianDiscount:     number;
  expectedMargin:           number;
  marginFloorBreached:      boolean;
  cannotMeetMargin:         boolean;

  // Positioning (replaces "win probability")
  positioningPct:           number;      // 0–100, e.g. 53 = more aggressive than 53% of past winners
  positioningLabel:         PositioningLabel;
  positioningLabelTh:       string;
  positioningLabelEn:       string;
  band: {
    p10: number; p25: number; median: number; p75: number; p90: number;
  };
  comparableN:              number;
  scope:                    string;
  fallbackUsed:             boolean;
  benchmarkSource:          string;

  // Honesty flag — always shown
  note: string;
}

// ─── Core Recommendation ─────────────────────────────────────────────────────

export function recommendBid(
  refPrice:        number,
  costM:           number,
  targetMarginPct: number = 10,
  benchmark?:      QuantileTable,
): BidRecommendation {
  const costRatio = costM / refPrice;

  // Margin guard: largest discount that still preserves target margin
  const marginMaxDiscount = (1 - costRatio / (1 - targetMarginPct / 100)) * 100;
  const cannotMeetMargin  = marginMaxDiscount <= 0;

  const bench         = benchmark ?? null;
  const benchMedian   = bench?.median ?? GLOBAL_MEDIAN;
  const source        = bench?.source ?? 'global';

  // Target discount: market median OR margin floor, whichever is lower
  const targetDiscount    = cannotMeetMargin
    ? 0
    : Math.min(benchMedian, marginMaxDiscount);
  const marginFloorBreached = !cannotMeetMargin && benchMedian > marginMaxDiscount;

  // Recommended bid — anchored on reference price
  const bid = refPrice * (1 - targetDiscount / 100);

  // Actual margin on revenue
  const actualMargin = cannotMeetMargin ? 0 : (bid - costM) / bid * 100;

  // Positioning percentile — empirical CDF with Beta prior smoothing.
  // Raw count/(n) is unreliable at small n (e.g. n=8 can claim 100th pct).
  // Adding CALIB_ALPHA pseudo-observations per side shrinks toward 50 when n
  // is small, relaxing to the raw empirical value as n grows.
  const sorted = bench?.discounts ?? [];
  const positionPct = sorted.length > 0
    ? Math.round(
        (sorted.filter((d) => d <= targetDiscount).length + CALIB_ALPHA)
        / (sorted.length + 2 * CALIB_ALPHA)
        * 100,
      )
    : 50;

  const label = positioningLabel(positionPct);

  return {
    recommendedBid:       Math.round(bid * 10) / 10,
    recommendedDiscount:  Math.round(targetDiscount * 10) / 10,
    marketMedianDiscount: benchMedian,
    expectedMargin:       Math.round(actualMargin * 10) / 10,
    marginFloorBreached,
    cannotMeetMargin,

    positioningPct:     positionPct,
    positioningLabel:   label,
    positioningLabelTh: LABEL_TH[label],
    positioningLabelEn: LABEL_EN[label],
    band: {
      p10:    bench?.p10    ?? 0,
      p25:    bench?.p25    ?? 0,
      median: bench?.median ?? GLOBAL_MEDIAN,
      p75:    bench?.p75    ?? 0,
      p90:    bench?.p90    ?? 0,
    },
    comparableN:    bench?.n     ?? 0,
    scope:          source,
    fallbackUsed:   !benchmark,
    benchmarkSource: source,

    note: 'Positioning percentile is not a win probability. It shows where this bid sits relative to historical winners, not P(this bid wins). True win probability requires knowing how many firms will bid — which is unknowable at bid time.',
  };
}

// ─── Curve from Band Knots (display only, for when only quantiles are known) ──

export function buildCurveFromBand(
  band: { p10: number; p25: number; median: number; p75: number; p90: number },
  n: number = 17,
): Array<{ bid: string; disc: number; positionPct: number }> {
  const maxDisc = Math.max(band.p90 * 1.15, band.median * 2.5, 30);

  // Piecewise linear CDF through 5 empirical quantile knots
  const knots: [number, number][] = [
    [0,           1],
    [band.p10,   10],
    [band.p25,   25],
    [band.median,50],
    [band.p75,   75],
    [band.p90,   90],
    [maxDisc,    98],
  ];

  function piecewise(disc: number): number {
    if (disc <= 0) return 1;
    for (let i = 0; i < knots.length - 1; i++) {
      const [x0, y0] = knots[i];
      const [x1, y1] = knots[i + 1];
      if (disc <= x1) return y0 + (y1 - y0) * (disc - x0) / (x1 - x0);
    }
    return 98;
  }

  return Array.from({ length: n }, (_, i) => {
    const discPct = (maxDisc * i) / (n - 1);
    return {
      bid:         `${Math.round(100 - discPct)}%`,
      disc:        Math.round(discPct * 10) / 10,
      positionPct: Math.max(1, Math.min(99, Math.round(piecewise(discPct)))),
    };
  });
}

// ─── Win Curve for Chart (empirical, no normal assumption) ───────────────────

export function generateWinCurve(benchmark?: QuantileTable): Array<{
  bid: string; disc: number; positionPct: number;
}> {
  const sorted    = benchmark?.discounts ?? [];
  const median    = benchmark?.median ?? GLOBAL_MEDIAN;
  const maxDisc   = benchmark?.p90 ? benchmark.p90 * 1.1 : 45;

  return Array.from({ length: 17 }, (_, i) => {
    const discPct = (maxDisc * i) / 16;

    // Logistic sigmoid ≈ normal CDF shape, used only when no empirical data.
    // scale converts normal σ to logistic scale (same steepness).
    const logisticScale = GLOBAL_SIGMA / (Math.PI / Math.sqrt(3));
    const positionPct = sorted.length > 0
      ? Math.round(
          (sorted.filter((d) => d <= discPct).length + CALIB_ALPHA)
          / (sorted.length + 2 * CALIB_ALPHA)
          * 100,
        )
      : Math.round(100 / (1 + Math.exp(-(discPct - median) / logisticScale)));

    return {
      bid:         `${Math.round(100 - discPct)}%`,
      disc:        Math.round(discPct * 10) / 10,
      positionPct: Math.max(1, Math.min(99, positionPct)),
    };
  });
}
