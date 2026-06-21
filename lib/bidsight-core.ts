/**
 * BidSight core bid-recommendation logic (corrected model).
 * CDF-based win probability, quantile benchmarks, no bidder-count dependence.
 * Out-of-time R² ≈ 0.03 (correct, not a bug: bidder count unknowable pre-bid).
 */

// Empirical benchmarks from 29,750 e-bidding tenders (FY2559–2568)
export const GLOBAL_MEDIAN = 18.5;  // median discount
export const GLOBAL_SIGMA = 12.0;   // stdev
export const CALIB = 0.875;         // calibration shrink (0.70/0.80 coverage gap)

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
 */
export function recommendBid(
  refPrice: number,
  costM: number,
  targetMarginPct: number = 10,
  targetWinProbPct: number = 60,
): BidRecommendation {
  const costRatio = costM / refPrice;

  // Margin guard: largest discount that preserves target margin
  const marginMaxDiscount = (1 - costRatio / (1 - targetMarginPct / 100)) * 100;

  const benchDiscount = GLOBAL_MEDIAN;
  const sigma = Math.max(GLOBAL_SIGMA, 1);

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
    benchmarkSource: 'global',
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
