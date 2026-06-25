/**
 * Network Effect Loops — pure computation, no Firestore I/O.
 * Scripts supply the raw data; these functions return what to write back.
 */

export interface RawOutcome {
  outcome_type: 'won' | 'lost' | 'no_bid' | 'pending';
  submitted_price?: number;
  winner_price?: number;
  agency?: string;
  project_type?: string;
  session_id?: string;
  verified?: boolean;
}

export interface RawSimInput {
  session_id: string;
  recommended_discount: number;
  agency_category?: string;
  project_type?: string;
}

export interface AgencyBenchmark {
  agency: string;
  project_type: string;
  n_behavioral: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  computed_at: string;
  source: 'behavioral_only' | 'blended';
}

export interface WinModel {
  agency_category: string;
  project_type: string;
  n_pairs: number;
  intercept: number;
  discount_coef: number;
  computed_at: string;
}

export interface CrowdAnomalyResult {
  agency: string;
  project_type: string;
  pattern: 'consistent_winner' | 'price_clustering' | 'bid_suppression';
  report_count: number;
  first_reported: string;
  last_reported: string;
  status: 'monitoring' | 'flagged' | 'verified';
}

// ── Helpers ────────────────────────────────────────────────────────────────

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function discountPct(ref: number, bid: number): number {
  if (!ref || ref <= 0) return 0;
  return Math.max(0, Math.round(((ref - bid) / ref) * 1000) / 10);
}

// ── Loop 1: Agency discount distribution refinement ────────────────────────
// Gate: n ≥ 20 outcomes per agency × project_type bucket.
// Blend: 70% e-GP benchmark median + 30% behavioral, only when both exist.

export function loop1AgencyBenchmarks(
  outcomes: RawOutcome[],
  egpBenchmarks: Record<string, { median: number; p10: number; p25: number; p75: number; p90: number }>,
): AgencyBenchmark[] {
  const GATE = 20;
  const BEHAVIORAL_WEIGHT = 0.30;
  const EGP_WEIGHT = 0.70;

  // Group won outcomes that have both submitted_price — discount is relative
  // to winner_price being close to submitted_price when won.
  // For won outcomes: discount = (1 - submitted_price / ref). We don't have
  // the ref price directly, so we use winner_price as a proxy when available,
  // otherwise skip. For behavioral data we store the raw submitted/winner ratio.
  const groups: Record<string, number[]> = {};

  for (const o of outcomes) {
    if (o.outcome_type !== 'won' && o.outcome_type !== 'lost') continue;
    if (!o.submitted_price || !o.winner_price) continue;
    const agency = o.agency ?? '__unknown__';
    const ptype = o.project_type ?? '__unknown__';
    const key = `${agency}||${ptype}`;
    if (!groups[key]) groups[key] = [];
    // Express as discount % from winner price
    const disc = discountPct(o.winner_price, o.submitted_price);
    if (disc >= 0 && disc < 50) groups[key].push(disc);
  }

  const results: AgencyBenchmark[] = [];

  for (const [key, discs] of Object.entries(groups)) {
    if (discs.length < GATE) continue;
    const [agency, project_type] = key.split('||');
    const sorted = [...discs].sort((a, b) => a - b);
    const behavioral = {
      p10:    Math.round(quantile(sorted, 0.10) * 10) / 10,
      p25:    Math.round(quantile(sorted, 0.25) * 10) / 10,
      median: Math.round(quantile(sorted, 0.50) * 10) / 10,
      p75:    Math.round(quantile(sorted, 0.75) * 10) / 10,
      p90:    Math.round(quantile(sorted, 0.90) * 10) / 10,
    };

    const egp = egpBenchmarks[project_type];
    let blended = behavioral;
    let source: AgencyBenchmark['source'] = 'behavioral_only';

    if (egp) {
      source = 'blended';
      blended = {
        p10:    Math.round((EGP_WEIGHT * egp.p10    + BEHAVIORAL_WEIGHT * behavioral.p10)    * 10) / 10,
        p25:    Math.round((EGP_WEIGHT * egp.p25    + BEHAVIORAL_WEIGHT * behavioral.p25)    * 10) / 10,
        median: Math.round((EGP_WEIGHT * egp.median + BEHAVIORAL_WEIGHT * behavioral.median) * 10) / 10,
        p75:    Math.round((EGP_WEIGHT * egp.p75    + BEHAVIORAL_WEIGHT * behavioral.p75)    * 10) / 10,
        p90:    Math.round((EGP_WEIGHT * egp.p90    + BEHAVIORAL_WEIGHT * behavioral.p90)    * 10) / 10,
      };
    }

    results.push({
      agency,
      project_type,
      n_behavioral: discs.length,
      ...blended,
      computed_at: new Date().toISOString(),
      source,
    });
  }

  return results;
}

// ── Loop 2: Win probability logistic model ─────────────────────────────────
// Gate: n ≥ 30 matched pairs (session_id in both simulator_inputs + bid_outcomes).
// Fits logistic regression: P(win) = sigmoid(intercept + discount_coef * discount).

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export interface MatchedPair {
  discount: number;
  won: boolean;
  agency_category?: string;
  project_type?: string;
}

export function matchPairs(
  outcomes: RawOutcome[],
  simInputs: RawSimInput[],
): MatchedPair[] {
  const simBySession = new Map(simInputs.map((s) => [s.session_id, s]));
  const pairs: MatchedPair[] = [];

  for (const o of outcomes) {
    if (!o.session_id) continue;
    if (o.outcome_type !== 'won' && o.outcome_type !== 'lost') continue;
    const sim = simBySession.get(o.session_id);
    if (!sim) continue;
    pairs.push({
      discount:       sim.recommended_discount,
      won:            o.outcome_type === 'won',
      agency_category: sim.agency_category ?? o.agency,
      project_type:   sim.project_type ?? o.project_type,
    });
  }
  return pairs;
}

export function loop2WinModels(pairs: MatchedPair[]): WinModel[] {
  const GATE = 30;
  const MAX_ITER = 200;
  const LR = 0.01;

  // Group by agency_category × project_type, fall back to global
  const groups: Record<string, MatchedPair[]> = {};
  for (const p of pairs) {
    const key = `${p.agency_category ?? '__all__'}||${p.project_type ?? '__all__'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  // Also add global pool
  groups['__all__||__all__'] = pairs;

  const results: WinModel[] = [];

  for (const [key, kPairs] of Object.entries(groups)) {
    if (kPairs.length < GATE) continue;
    const [agency_category, project_type] = key.split('||');

    // Gradient descent logistic regression
    let intercept = 0;
    let coef = 0;
    for (let iter = 0; iter < MAX_ITER; iter++) {
      let dI = 0, dC = 0;
      for (const p of kPairs) {
        const pred = sigmoid(intercept + coef * p.discount);
        const err = (p.won ? 1 : 0) - pred;
        dI += err;
        dC += err * p.discount;
      }
      intercept += LR * dI / kPairs.length;
      coef      += LR * dC / kPairs.length;
    }

    results.push({
      agency_category,
      project_type,
      n_pairs:      kPairs.length,
      intercept:    Math.round(intercept * 10000) / 10000,
      discount_coef: Math.round(coef * 10000) / 10000,
      computed_at:  new Date().toISOString(),
    });
  }

  return results;
}

// ── Loop 3: Crowd-sourced anomaly detection ────────────────────────────────
// Groups community_reports of type 'suspicious' by agency × pattern keyword.
// Flags when ≥ 3 reports share the same agency.

export interface RawCommunityReport {
  report_type: string;
  agency?: string;
  project_type?: string;
  content: Record<string, unknown>;
  timestamp: string;
  status: string;
}

const PATTERN_KEYWORDS: Record<CrowdAnomalyResult['pattern'], string[]> = {
  consistent_winner: ['ชนะซ้ำ', 'ผู้ชนะเดิม', 'repeat', 'same winner', 'monopoly'],
  price_clustering:  ['ราคาใกล้กัน', 'clustering', 'similar price', 'ฮั้ว', 'bid rigging'],
  bid_suppression:   ['ไม่แข่งขัน', 'suppression', 'no competition', 'single bid', 'เดียว'],
};

function detectPattern(content: Record<string, unknown>): CrowdAnomalyResult['pattern'] {
  const text = JSON.stringify(content).toLowerCase();
  for (const [pattern, keywords] of Object.entries(PATTERN_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return pattern as CrowdAnomalyResult['pattern'];
    }
  }
  return 'consistent_winner'; // default
}

export function loop3AnomalyDetection(
  reports: RawCommunityReport[],
  existing: CrowdAnomalyResult[],
): CrowdAnomalyResult[] {
  const MONITORING_GATE = 2;
  const FLAGGED_GATE = 5;

  const suspicious = reports.filter(
    (r) => r.report_type === 'suspicious' && r.status !== 'dismissed',
  );

  // Group by agency
  const groups: Record<string, { reports: RawCommunityReport[]; pattern: CrowdAnomalyResult['pattern'] }> = {};
  for (const r of suspicious) {
    const agency = r.agency ?? '__unknown__';
    const pattern = detectPattern(r.content);
    const key = `${agency}||${pattern}`;
    if (!groups[key]) groups[key] = { reports: [], pattern };
    groups[key].reports.push(r);
  }

  const existingMap = new Map(
    existing.map((e) => [`${e.agency}||${e.pattern}`, e]),
  );

  const results: CrowdAnomalyResult[] = [];

  for (const [key, { reports: reps, pattern }] of Object.entries(groups)) {
    if (reps.length < MONITORING_GATE) continue;
    const [agency] = key.split('||');
    const sorted = [...reps].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const prev = existingMap.get(key);
    results.push({
      agency,
      project_type: reps[0].project_type ?? '__unknown__',
      pattern,
      report_count: reps.length,
      first_reported: prev?.first_reported ?? sorted[0].timestamp,
      last_reported:  sorted[sorted.length - 1].timestamp,
      status:
        reps.length >= FLAGGED_GATE ? 'flagged'
        : prev?.status === 'verified' ? 'verified'
        : 'monitoring',
    });
  }

  return results;
}

// ── Utility: evaluate win probability from a fitted model ──────────────────

export function predictWinProbability(
  discount: number,
  model: WinModel,
): number {
  return Math.round(sigmoid(model.intercept + model.discount_coef * discount) * 1000) / 10;
}
