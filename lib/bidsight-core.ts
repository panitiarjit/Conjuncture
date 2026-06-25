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

// Global fallback constants — computed from 27,954 positive-discount e-bidding tenders.
// GLOBAL_MEDIAN is the empirical p50 (6.09%), NOT the p75 (18.23%).
// The old value of 18.5 was the 75th percentile, mislabelled as the median.
export const GLOBAL_MEDIAN  = 6.1;
export const GLOBAL_SIGMA   = 13.9;
export const MIN_N          = 8;    // minimum bucket size before falling back
// Beta prior pseudo-count per side (in weight units). CALIB_ALPHA=2 adds the
// equivalent of 4 pseudo-observations, shrinking tiny buckets toward 50th pct
// while having negligible effect at n≥100.
export const CALIB_ALPHA    = 2;
// Recency decay: each fiscal year further in the past gets this fraction of weight.
// 0.75 → contracts 4 years old carry ~32% weight of current-year contracts.
export const DECAY_FACTOR   = 0.75;

// ─── Quantile Table ─────────────────────────────────────────────────────────

export interface QuantileTable {
  discounts: number[];   // sorted raw values — for empirical CDF lookups
  weights?: number[];    // parallel to discounts; recency-decayed weights (sorted same order)
  totalWeight?: number;  // sum of weights (for weighted CDF normalisation)
  weightedN?: number;    // effective sample size: totalWeight² / Σ(w²) — Kish approximation
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  sigma: number;
  n: number;
  source: string;
  // 95% CI on median via order statistics (Conover nonparametric — no distributional assumption)
  medianCI?: { lo: number; hi: number };
  // Market concentration — HHI from winnerBusinessId (DOJ antitrust scale 0–10000)
  // eNoc = effective number of competitors = 10000 / HHI
  hhi?: number;
  eNoc?: number;
  marketConcentrationN?: number;
  // Competition density — only populated when CoST bidder data exists
  medianBidderCount?: number;
  bidderCountN?: number;
  // Q4 (July–Sept) seasonal stats — budget-burn quarter often shows higher discounts
  q4Median?: number;
  q4N?: number;
}

// Budget-tier lookup data: per-category CDF split by referencePrice quartile.
export interface CategoryBudgetTierData {
  boundaries: [number, number, number]; // 25th/50th/75th pct of refPrice in this category
  tiers: [QuantileTable, QuantileTable, QuantileTable, QuantileTable]; // small → large
}

// ─── Weighted CDF helpers ────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  const h = (sorted.length - 1) * p / 100;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

// Weighted percentile via linear interpolation on cumulative weight distribution.
function weightedPercentile(
  sortedDiscounts: number[],
  weights: number[],
  totalWeight: number,
  p: number,
): number {
  if (sortedDiscounts.length === 0) return 0;
  const target = p / 100 * totalWeight;
  let cumW = 0;
  for (let i = 0; i < sortedDiscounts.length; i++) {
    const prev = cumW;
    cumW += weights[i];
    if (cumW >= target) {
      if (i === 0 || prev === target) return sortedDiscounts[i];
      const frac = (target - prev) / weights[i];
      return sortedDiscounts[i - 1] + frac * (sortedDiscounts[i] - sortedDiscounts[i - 1]);
    }
  }
  return sortedDiscounts[sortedDiscounts.length - 1];
}

// Calibrated positioning percentile with Beta prior.
// Works for both weighted (supply weights + totalWeight) and unweighted (omit both).
// discounts must be sorted ascending and parallel to weights when provided.
function calibratedPct(
  discounts: number[],
  weights: number[] | undefined,
  totalWeight: number | undefined,
  targetDiscount: number,
): number {
  if (discounts.length === 0) return 50;
  if (weights && totalWeight) {
    let wBelow = 0;
    for (let i = 0; i < discounts.length; i++) {
      if (discounts[i] <= targetDiscount) wBelow += weights[i];
      else break; // sorted — early exit
    }
    return Math.round((wBelow + CALIB_ALPHA) / (totalWeight + 2 * CALIB_ALPHA) * 100);
  }
  return Math.round(
    (discounts.filter((d) => d <= targetDiscount).length + CALIB_ALPHA)
    / (discounts.length + 2 * CALIB_ALPHA)
    * 100,
  );
}

// ─── Core quantile table builder ─────────────────────────────────────────────

interface WeightedEntry { discount: number; weight: number }

function computeWeightedQuantileTable(entries: WeightedEntry[], source: string): QuantileTable {
  if (entries.length === 0) {
    return {
      discounts: [], weights: [], totalWeight: 0, weightedN: 0,
      p10: 0, p25: 0, median: GLOBAL_MEDIAN, p75: 0, p90: 0, sigma: GLOBAL_SIGMA,
      n: 0, source,
    };
  }

  const sorted     = [...entries].sort((a, b) => a.discount - b.discount);
  const discounts  = sorted.map((e) => e.discount);
  const weights    = sorted.map((e) => e.weight);
  const n          = sorted.length;
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  // Kish effective sample size: (Σw)² / Σ(w²)
  const sumWSq    = weights.reduce((s, w) => s + w * w, 0);
  const weightedN = Math.round(totalWeight ** 2 / sumWSq);

  // Weighted mean and variance (for sigma)
  const mean     = sorted.reduce((s, e) => s + e.discount * e.weight, 0) / totalWeight;
  const variance = sorted.reduce((s, e) => s + e.weight * (e.discount - mean) ** 2, 0) / totalWeight;

  // 95% CI on median using effective N (Conover nonparametric approximation)
  let medianCI: { lo: number; hi: number } | undefined;
  if (weightedN >= 4) {
    const spread = 1.96 * Math.sqrt(weightedN) / 2;
    const jPct = Math.max(0, ((Math.floor(weightedN / 2 - spread) - 1) / weightedN) * 100);
    const kPct = Math.min(100, ((Math.ceil(weightedN  / 2 + spread) - 1) / weightedN) * 100);
    medianCI = {
      lo: Math.round(weightedPercentile(discounts, weights, totalWeight, jPct) * 10) / 10,
      hi: Math.round(weightedPercentile(discounts, weights, totalWeight, kPct) * 10) / 10,
    };
  }

  return {
    discounts,
    weights,
    totalWeight,
    weightedN,
    p10:    Math.round(weightedPercentile(discounts, weights, totalWeight, 10)  * 10) / 10,
    p25:    Math.round(weightedPercentile(discounts, weights, totalWeight, 25)  * 10) / 10,
    median: Math.round(weightedPercentile(discounts, weights, totalWeight, 50)  * 10) / 10,
    p75:    Math.round(weightedPercentile(discounts, weights, totalWeight, 75)  * 10) / 10,
    p90:    Math.round(weightedPercentile(discounts, weights, totalWeight, 90)  * 10) / 10,
    sigma:  Math.round(Math.sqrt(variance) * 10) / 10,
    n,
    source,
    medianCI,
  };
}

// ─── Market Intelligence Helpers ─────────────────────────────────────────────

// HHI (Herfindahl-Hirschman Index) from unique juristic IDs.
// Uses winnerBusinessId — no name-normalisation assumption needed.
// DOJ/FTC thresholds: < 1500 competitive, 1500–2500 moderate, > 2500 concentrated.
// eNoc (effective number of competitors) = 10000 / HHI.
function computeHHI(
  ids: (string | null | undefined)[],
): { hhi: number; eNoc: number; n: number } | undefined {
  const valid = ids.filter(Boolean) as string[];
  if (valid.length < 10) return undefined;
  const counts = new Map<string, number>();
  for (const id of valid) counts.set(id.trim(), (counts.get(id.trim()) ?? 0) + 1);
  const hhi = Math.round(
    [...counts.values()].reduce((s, c) => s + (c / valid.length) ** 2, 0) * 10000,
  );
  const eNoc = Math.round((10000 / hhi) * 10) / 10;
  return { hhi, eNoc, n: valid.length };
}

function computeDensity(
  bidderCounts: number[],
): { median: number; n: number } | undefined {
  const valid = bidderCounts.filter((c) => c > 0);
  if (valid.length < 5) return undefined;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return { median, n: valid.length };
}

// ─── Benchmark Tables ────────────────────────────────────────────────────────

// Minimal contract shape needed for benchmark computation.
// AwardedContract satisfies this; so does the field-masked BenchmarkContract.
type ContractRow = {
  procurementMethod?: string | null;
  procurementMethodGroup?: string | null;
  discountFromReference: number | null;
  projectType: string;
  agency?: string;
  province?: string;
  winnerBusinessId?: string | null; // for HHI — unique juristic ID, no name-variant noise
  bidders?: string[];               // for competition density (CoST subset only)
  fiscalYear?: number;              // for recency weighting
  referencePrice?: number | null;   // for budget-tier segmentation
  announceDate?: string;            // for Q4 seasonal stats
};

// Competitive bidding methods: e-bidding (Thai) + selective + traditional auction.
// Sole-source (เฉพาะเจาะจง) is excluded — no competition means discount distribution is meaningless.
// We also accept the synthetic 'e-bidding' tag used in backward-test fixtures.
const COMPETITIVE_RE = /ประกวดราคา|คัดเลือก|e-bidding/i;

// Thai fiscal quarter from CE announce date:
//   Q1 Oct–Dec, Q2 Jan–Mar, Q3 Apr–Jun, Q4 Jul–Sep (budget-burn quarter).
function fiscalQ(announceDate: string): 1 | 2 | 3 | 4 | null {
  const d = new Date(announceDate);
  if (isNaN(d.getTime())) return null;
  const m = d.getMonth() + 1;
  if (m >= 10) return 1;
  if (m >= 7)  return 4;
  if (m >= 4)  return 3;
  return 2;
}

export function buildBenchmarkTables(
  contracts: ContractRow[],
  currentFY?: number,
): {
  agencyCategory:     Map<string, QuantileTable>;
  provinceCategory:   Map<string, QuantileTable>;
  category:           Map<string, QuantileTable>;
  categoryBudgetTier: Map<string, CategoryBudgetTierData>;
  global:             QuantileTable;
} {
  const ebidding = contracts.filter(
    (c) => {
      const method = c.procurementMethod ?? c.procurementMethodGroup ?? '';
      return (
        COMPETITIVE_RE.test(method) &&
        c.discountFromReference != null &&
        c.discountFromReference >= 0 &&   // include zero-discount awards; negatives are data errors
        c.discountFromReference < 100
      );
    },
  );

  // Derive current FY from data when not supplied (use max FY found in batch).
  // Fallback: 2569 BE = 2026 CE (current fiscal year).
  const maxFY = currentFY ?? (
    ebidding.reduce((m, c) => (c.fiscalYear != null && c.fiscalYear > m ? c.fiscalYear : m), 0) || 2569
  );

  // Per-contract recency weight: DECAY_FACTOR^(age in years), capped at 7 years.
  function weight(c: ContractRow): number {
    if (!c.fiscalYear) return 1;
    const age = Math.min(maxFY - c.fiscalYear, 7);
    return DECAY_FACTOR ** age;
  }

  // Accumulators
  const agCatMap         = new Map<string, WeightedEntry[]>();
  const provCatMap       = new Map<string, WeightedEntry[]>();
  const catMap           = new Map<string, WeightedEntry[]>();
  const catEbiddingMap   = new Map<string, ContractRow[]>();   // for tier building
  const catBusinessIds   = new Map<string, (string | null | undefined)[]>();
  const catBidderCounts  = new Map<string, number[]>();
  const catQ4Discounts   = new Map<string, number[]>();
  const catRefPrices     = new Map<string, number[]>();

  for (const c of ebidding) {
    const entry: WeightedEntry = { discount: c.discountFromReference!, weight: weight(c) };

    if (c.agency) {
      const key = `${c.agency}|${c.projectType}`;
      if (!agCatMap.has(key)) agCatMap.set(key, []);
      agCatMap.get(key)!.push(entry);
    }

    if (c.province) {
      const key = `${c.province}|${c.projectType}`;
      if (!provCatMap.has(key)) provCatMap.set(key, []);
      provCatMap.get(key)!.push(entry);
    }

    if (!catMap.has(c.projectType)) catMap.set(c.projectType, []);
    catMap.get(c.projectType)!.push(entry);

    if (!catEbiddingMap.has(c.projectType)) catEbiddingMap.set(c.projectType, []);
    catEbiddingMap.get(c.projectType)!.push(c);

    // HHI: use winnerBusinessId (juristic person ID — no name-variant noise)
    if (!catBusinessIds.has(c.projectType)) catBusinessIds.set(c.projectType, []);
    catBusinessIds.get(c.projectType)!.push(c.winnerBusinessId ?? null);

    // Competition density: only from CoST-tagged contracts where bidders[] is present
    if ((c.bidders?.length ?? 0) > 0) {
      if (!catBidderCounts.has(c.projectType)) catBidderCounts.set(c.projectType, []);
      catBidderCounts.get(c.projectType)!.push(c.bidders!.length);
    }

    // Q4 seasonal (July–Sept: budget-burn quarter, unweighted — Q4 contracts are current by definition)
    if (c.announceDate && fiscalQ(c.announceDate) === 4) {
      if (!catQ4Discounts.has(c.projectType)) catQ4Discounts.set(c.projectType, []);
      catQ4Discounts.get(c.projectType)!.push(c.discountFromReference!);
    }

    // Collect refPrices for tier boundary computation
    if (c.referencePrice != null && c.referencePrice > 0) {
      if (!catRefPrices.has(c.projectType)) catRefPrices.set(c.projectType, []);
      catRefPrices.get(c.projectType)!.push(c.referencePrice);
    }
  }

  // ── Agency × category ────────────────────────────────────────────────────────
  const agencyCategory = new Map<string, QuantileTable>();
  for (const [key, vals] of agCatMap) {
    if (vals.length >= MIN_N) {
      agencyCategory.set(key, computeWeightedQuantileTable(vals, 'agency×category'));
    }
  }

  // ── Province × category ──────────────────────────────────────────────────────
  const provinceCategory = new Map<string, QuantileTable>();
  for (const [key, vals] of provCatMap) {
    if (vals.length >= MIN_N) {
      provinceCategory.set(key, computeWeightedQuantileTable(vals, 'province×category'));
    }
  }

  // ── Category (with HHI, density, Q4) ─────────────────────────────────────────
  const category = new Map<string, QuantileTable>();
  for (const [cat, vals] of catMap) {
    const qt   = computeWeightedQuantileTable(vals, 'category');
    const conc = computeHHI(catBusinessIds.get(cat) ?? []);
    const dens = computeDensity(catBidderCounts.get(cat) ?? []);

    // Q4 median: simple unweighted percentile — Q4 contracts are recent by definition
    const q4Disc = catQ4Discounts.get(cat) ?? [];
    let q4Median: number | undefined;
    if (q4Disc.length >= 5) {
      const sortedQ4 = [...q4Disc].sort((a, b) => a - b);
      q4Median = Math.round(percentile(sortedQ4, 50) * 10) / 10;
    }

    category.set(cat, {
      ...qt,
      ...(conc ? { hhi: conc.hhi, eNoc: conc.eNoc, marketConcentrationN: conc.n } : {}),
      ...(dens ? { medianBidderCount: dens.median, bidderCountN: dens.n } : {}),
      ...(q4Median != null ? { q4Median, q4N: q4Disc.length } : {}),
    });
  }

  // ── Category × budget tier ────────────────────────────────────────────────────
  // Splits each category's CDF into 4 price-quartile buckets.
  // Requires ≥ 4×MIN_N contracts with a valid referencePrice AND all 4 tiers ≥ MIN_N.
  const categoryBudgetTier = new Map<string, CategoryBudgetTierData>();
  for (const [cat, refPrices] of catRefPrices) {
    if (refPrices.length < 4 * MIN_N) continue;

    const sortedRef = [...refPrices].sort((a, b) => a - b);
    const b1 = percentile(sortedRef, 25); // ≤ b1 → tier 1 (small)
    const b2 = percentile(sortedRef, 50); // ≤ b2 → tier 2 (medium-low)
    const b3 = percentile(sortedRef, 75); // ≤ b3 → tier 3 (medium-high); > b3 → tier 4 (large)

    const tierEntries: [WeightedEntry[], WeightedEntry[], WeightedEntry[], WeightedEntry[]] = [[], [], [], []];
    for (const c of catEbiddingMap.get(cat) ?? []) {
      if (c.referencePrice == null || c.referencePrice <= 0) continue;
      const rp = c.referencePrice;
      const entry: WeightedEntry = { discount: c.discountFromReference!, weight: weight(c) };
      const idx = rp <= b1 ? 0 : rp <= b2 ? 1 : rp <= b3 ? 2 : 3;
      tierEntries[idx].push(entry);
    }

    // Skip category if any tier is too sparse after the split
    if (tierEntries.some((t) => t.length < MIN_N)) continue;

    categoryBudgetTier.set(cat, {
      boundaries: [
        Math.round(b1 * 100) / 100,
        Math.round(b2 * 100) / 100,
        Math.round(b3 * 100) / 100,
      ],
      tiers: [
        computeWeightedQuantileTable(tierEntries[0], 'category×tier1'),
        computeWeightedQuantileTable(tierEntries[1], 'category×tier2'),
        computeWeightedQuantileTable(tierEntries[2], 'category×tier3'),
        computeWeightedQuantileTable(tierEntries[3], 'category×tier4'),
      ],
    });
  }

  // ── Global ────────────────────────────────────────────────────────────────────
  const allEntries = ebidding.map((c) => ({ discount: c.discountFromReference!, weight: weight(c) }));
  const global = allEntries.length > 0
    ? computeWeightedQuantileTable(allEntries, 'global')
    : computeWeightedQuantileTable([{ discount: GLOBAL_MEDIAN, weight: 1 }], 'global-fallback');

  return { agencyCategory, provinceCategory, category, categoryBudgetTier, global };
}

// Fallback chain (most → least specific):
//   agency×category → province×category → category×tier → category → global
// refPrice (in the same unit as referencePrice on contracts, typically THB millions)
// enables the category×tier lookup; omit to skip it.
export function getBenchmarkFromTables(
  agency:   string | undefined,
  category: string | undefined,
  tables:   ReturnType<typeof buildBenchmarkTables>,
  province?: string | undefined,
  refPrice?: number | undefined,
): { table: QuantileTable; fallbackUsed: boolean } {
  if (agency && category) {
    const t = tables.agencyCategory.get(`${agency}|${category}`);
    if (t) return { table: t, fallbackUsed: false };
  }
  if (province && category) {
    const t = tables.provinceCategory.get(`${province}|${category}`);
    if (t) return { table: t, fallbackUsed: true };
  }
  if (refPrice != null && category) {
    const tierData = tables.categoryBudgetTier?.get(category);
    if (tierData) {
      const { boundaries, tiers } = tierData;
      const idx = refPrice <= boundaries[0] ? 0 : refPrice <= boundaries[1] ? 1 : refPrice <= boundaries[2] ? 2 : 3;
      const t = tiers[idx];
      if (t && t.n >= MIN_N) return { table: t, fallbackUsed: true };
    }
  }
  if (category) {
    const t = tables.category.get(category);
    if (t) return { table: t, fallbackUsed: true };
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

export function positioningLabel(pct: number): PositioningLabel {
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

// ─── Bid Score ───────────────────────────────────────────────────────────────

export interface BidScore {
  // score and recommendation removed — cannot calibrate thresholds without loser data.
  // cgd_contracts is winner-only; any bid/no-bid cutoff would be uncalibrated theater.
  signals: {
    marginViability: number;  // actual margin / target margin (pure math, 0–100 scale)
    competitiveness: number;  // positioningPct — empirical CDF position vs past winners
    marketVolume:    number;  // n mapped to 0–100 (richness of benchmark)
  };
  rationale: string;
}

function _volumeSignal(n: number): number {
  if (n >= 200) return 100;
  if (n >= 50)  return Math.round(70 + (n - 50)  / 150 * 30);
  if (n >= 20)  return Math.round(50 + (n - 20)  / 30  * 20);
  if (n >= 8)   return Math.round(30 + (n - 8)   / 12  * 20);
  return 20;
}

export function computeBidScore(
  cannotMeetMargin:   boolean,
  marginFloorBreached:boolean,
  expectedMargin:     number,
  positioningPct:     number,
  comparableN:        number,
  targetMarginPct:    number,
  eNoc?: number,   // effective number of competitors from HHI; undefined = unknown
): BidScore {
  // Signal 1: Margin viability — actual margin vs target (pure math).
  const marginViability = cannotMeetMargin
    ? 0
    : Math.min(100, Math.round(expectedMargin / Math.max(targetMarginPct, 1) * 100));

  // Signal 2: Competitiveness — where our bid sits vs. past winners.
  const competitiveness = marginFloorBreached
    ? Math.round(positioningPct * 0.4)
    : positioningPct;

  // Signal 3: Market volume — richness of the benchmark
  const marketVolume = _volumeSignal(comparableN);

  let rationale: string;
  if (cannotMeetMargin) {
    rationale = 'Cost structure cannot support a profitable bid at any competitive discount.';
  } else if (marginFloorBreached) {
    rationale = `Margin floor is below market median — bid sits above ${100 - positioningPct}% of past winners. Winning requires an incumbency or technical advantage price cannot compensate for.`;
  } else if (competitiveness < 30) {
    rationale = `Bid sits below ${positioningPct}% of past winners — pricing is soft. If this reflects your true cost floor, winning requires a non-price advantage.`;
  } else {
    rationale = `Margin viable at ${positioningPct}th-pct positioning against ${comparableN} comparable contracts.`;
  }

  // Concentration rider: eNoc < 4 means effectively 1–3 dominant players
  // who likely bid near the top of the discount range.
  if (eNoc != null && eNoc < 4 && !cannotMeetMargin) {
    rationale += ` Market is concentrated (eNoc ${eNoc} — effectively ${Math.round(eNoc)} dominant player${Math.round(eNoc) === 1 ? '' : 's'}); expect at least one aggressive bidder near the top of the discount range.`;
  }

  return { signals: { marginViability, competitiveness, marketVolume }, rationale };
}

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

  // Signals (raw — no composite score; calibrating weights requires loser data we don't have)
  bidSignals:               BidScore;

  // Honesty flag — always shown
  note: string;
}


// ─── Core Recommendation ─────────────────────────────────────────────────────

export function recommendBid(
  refPrice:           number,
  costM:              number,
  targetMarginPct:    number = 10,
  benchmark?:         QuantileTable,
  targetPositionPct:  number = 50,   // where in the CDF to aim (default = market median)
): BidRecommendation {
  const costRatio = costM / refPrice;

  // Margin guard: largest discount that still preserves target margin
  const marginMaxDiscount = (1 - costRatio / (1 - targetMarginPct / 100)) * 100;
  const cannotMeetMargin  = marginMaxDiscount <= 0;

  const bench         = benchmark ?? null;
  const benchMedian   = bench?.median ?? GLOBAL_MEDIAN;
  const source        = bench?.source ?? 'global';

  // Pick discount at the user's target position (or fall back to median)
  const sorted  = bench?.discounts ?? [];
  const weights = bench?.weights;
  const totalW  = bench?.totalWeight;

  const benchTarget = sorted.length > 0
    ? (weights && totalW
        ? weightedPercentile(sorted, weights, totalW, targetPositionPct)
        : percentile(sorted, targetPositionPct))
    : benchMedian;

  // Target discount: aggression target OR margin floor, whichever is lower
  const targetDiscount      = cannotMeetMargin ? 0 : Math.min(benchTarget, marginMaxDiscount);
  const marginFloorBreached = !cannotMeetMargin && benchTarget > marginMaxDiscount;

  // Recommended bid — anchored on reference price
  const bid = refPrice * (1 - targetDiscount / 100);

  // Actual margin on revenue
  const actualMargin = cannotMeetMargin ? 0 : (bid - costM) / bid * 100;

  // Positioning percentile — empirical CDF with Beta prior smoothing (weighted-aware)
  const positionPct = calibratedPct(sorted, weights, totalW, targetDiscount);

  const label      = positioningLabel(positionPct);
  const roundedMargin = Math.round(actualMargin * 10) / 10;
  const comparableN   = bench?.n ?? 0;
  const bidSignals = computeBidScore(
    cannotMeetMargin,
    marginFloorBreached,
    roundedMargin,
    positionPct,
    comparableN,
    targetMarginPct,
    bench?.eNoc,
  );

  return {
    recommendedBid:       Math.round(bid * 10) / 10,
    recommendedDiscount:  Math.round(targetDiscount * 10) / 10,
    marketMedianDiscount: benchMedian,
    expectedMargin:       roundedMargin,
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
    comparableN,
    scope:          source,
    fallbackUsed:   !benchmark,
    benchmarkSource: source,
    bidSignals,

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

// ─── Win Curve for Chart (empirical, weighted-aware) ─────────────────────────

export function generateWinCurve(benchmark?: QuantileTable): Array<{
  bid: string; disc: number; positionPct: number;
}> {
  const sorted  = benchmark?.discounts ?? [];
  const weights = benchmark?.weights;
  const totalW  = benchmark?.totalWeight;
  const median  = benchmark?.median ?? GLOBAL_MEDIAN;
  const maxDisc = benchmark?.p90 ? benchmark.p90 * 1.1 : 45;

  return Array.from({ length: 17 }, (_, i) => {
    const discPct = (maxDisc * i) / 16;

    // Logistic sigmoid ≈ normal CDF shape, used only when no empirical data.
    const logisticScale = GLOBAL_SIGMA / (Math.PI / Math.sqrt(3));
    const positionPct = sorted.length > 0
      ? calibratedPct(sorted, weights, totalW, discPct)
      : Math.round(100 / (1 + Math.exp(-(discPct - median) / logisticScale)));

    return {
      bid:         `${Math.round(100 - discPct)}%`,
      disc:        Math.round(discPct * 10) / 10,
      positionPct: Math.max(1, Math.min(99, positionPct)),
    };
  });
}
