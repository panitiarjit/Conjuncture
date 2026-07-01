/**
 * Contractor signal analysis.
 *
 * Reads cgd_contracts, groups by winner, computes concentration and pricing
 * signals, and writes flagged contractors to the contractor_intel collection.
 *
 * Flagging methodology:
 *   near_ceiling     — one-sided Mann-Whitney U per projectType category,
 *                      Benjamini-Hochberg corrected across categories.
 *                      H1: contractor discounts are stochastically closer to
 *                      the reference price ceiling than the market baseline.
 *   single_agency_lock — one-sided Binomial test vs empirical market baseline
 *                      top-agency concentration rate.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/analyze-contractors.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/analyze-contractors.ts --limit 50000
 *   npx ts-node --project tsconfig.scripts.json scripts/analyze-contractors.ts --dry-run
 *
 * Reads in 500-doc pages up to --limit (default 20k). Firestore cost = limit reads + contractor writes.
 * Do not schedule — run manually when you want to refresh contractor_intel.
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.indexOf('--limit');
const LIMIT = limitArg !== -1 ? Number(args[limitArg + 1]) : 20_000;
const MIN_WINS = 5;           // minimum total wins to include a contractor
const MIN_CATEGORY_WINS = 5;  // minimum wins in a category to run Mann-Whitney
const MIN_MARKET_N = 10;      // minimum market records in a category to use as baseline
const ALPHA = 0.05;           // significance threshold (after BH correction)

// ── Firebase ──────────────────────────────────────────────────────────────────

function initFirebase() {
  if (admin.apps.length) return admin.app();
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey,
    }),
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContractRow {
  winnerName: string | null;
  winnerBusinessId: string | null;
  agency: string;
  projectType: string | null;
  referencePrice: number | null;
  discountFromReference: number | null;
  fiscalYear: number;
}

import type { ContractorSignal } from '../lib/contractor-intel-types';

// ── Statistical helpers ───────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Abramowitz & Stegun approximation, accurate to ~7 decimal places.
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - 0.398942280 * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? p : 1 - p;
}

function lowerBound(sorted: number[], val: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < val) lo = mid + 1; else hi = mid;
  }
  return lo;
}

function upperBound(sorted: number[], val: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= val) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/**
 * One-sided Mann-Whitney U p-value.
 * H1: contractor discounts are stochastically SMALLER than market (closer to 0% ceiling).
 * Uses normal approximation with tie correction.
 * Returns 1 (no evidence) when samples are too small to be reliable.
 */
export function mannWhitneyPValue(contractorDiscounts: number[], sortedMarket: number[]): number {
  const m = contractorDiscounts.length;
  const n = sortedMarket.length;
  if (m < MIN_CATEGORY_WINS || n < MIN_MARKET_N) return 1;

  // U = Σ (market discounts strictly above contractor_i) + 0.5 * (ties)
  // Large U → contractor bids closer to ceiling than market
  let u = 0;
  for (const cd of contractorDiscounts) {
    const above = n - upperBound(sortedMarket, cd);
    const ties  = upperBound(sortedMarket, cd) - lowerBound(sortedMarket, cd);
    u += above + ties * 0.5;
  }

  const meanU = (m * n) / 2;
  const varU  = (m * n * (m + n + 1)) / 12;
  if (varU === 0) return 1;

  const z = (u - meanU) / Math.sqrt(varU);
  // Large positive z → evidence for H1 → small p-value
  return 1 - normalCDF(z);
}

function logBinomCoeff(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  let result = 0;
  for (let i = 0; i < k; i++) result += Math.log(n - i) - Math.log(i + 1);
  return result;
}

function logBinomPMF(k: number, n: number, p: number): number {
  if (p <= 0) return k === 0 ? 0 : -Infinity;
  if (p >= 1) return k === n ? 0 : -Infinity;
  return logBinomCoeff(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p);
}

/**
 * One-sided Binomial p-value: P(X >= k | X ~ Bin(n, p0)).
 * H1: contractor's top-agency win rate > market baseline.
 * Exact for n <= 50, normal approximation with continuity correction otherwise.
 */
export function binomialPValue(k: number, n: number, p0: number): number {
  if (k <= 0) return 1;
  if (p0 <= 0) return 0;
  if (p0 >= 1) return 1;

  if (n <= 50) {
    let cumProb = 0;
    for (let i = 0; i < k; i++) cumProb += Math.exp(logBinomPMF(i, n, p0));
    return Math.max(0, Math.min(1, 1 - cumProb));
  }

  const mean = n * p0;
  const std = Math.sqrt(n * p0 * (1 - p0));
  if (std === 0) return 1;
  return 1 - normalCDF((k - 0.5 - mean) / std);
}

/**
 * Benjamini-Hochberg FDR correction.
 * Returns BH-adjusted p-values in the same order as input.
 */
export function benjaminiHochberg(pValues: number[]): number[] {
  const n = pValues.length;
  if (n === 0) return [];
  if (n === 1) return [Math.min(1, pValues[0])];

  // Sort descending by raw p-value
  const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
  const adjusted = new Array<number>(n);
  let minAdj = 1;
  for (let rank = 0; rank < n; rank++) {
    const { p, i } = indexed[rank];
    // BH adjusted p = p * m / (m - rank) where rank is 0-indexed from largest
    const adj = Math.min(1, p * n / (n - rank));
    minAdj = Math.min(minAdj, adj);
    adjusted[i] = minAdj;
  }
  return adjusted;
}

// ── Analysis ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.trim().replace(/\s+/g, '_').replace(/[^฀-๿a-zA-Z0-9_]/g, '').slice(0, 80);
}

const DATE_ARTIFACT = /^\d{1,2}\s\S+\s\d{2}$/;

export function analyzeContractors(rows: ContractRow[]): ContractorSignal[] {
  // ── Filter and group by contractor ───────────────────────────────────────────
  const groups = new Map<string, ContractRow[]>();
  for (const row of rows) {
    if (!row.winnerName) continue;
    if (DATE_ARTIFACT.test(row.winnerName.trim())) continue;
    const key = row.winnerBusinessId ?? row.winnerName.trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // ── Pass 1: market baselines ──────────────────────────────────────────────────

  // Per-category sorted market discount arrays (all valid discounts across ALL contracts)
  const marketByCategory = new Map<string, number[]>();
  for (const row of rows) {
    const d = row.discountFromReference;
    if (d === null || d < 0 || d > 100) continue;
    const cat = row.projectType ?? 'other';
    if (!marketByCategory.has(cat)) marketByCategory.set(cat, []);
    marketByCategory.get(cat)!.push(d);
  }
  const sortedMarketByCategory = new Map<string, number[]>();
  for (const [cat, discounts] of marketByCategory) {
    sortedMarketByCategory.set(cat, [...discounts].sort((a, b) => a - b));
  }

  // Size-stratified agency concentration baselines.
  // Concentration naturally scales with win count (small contractors are regionally
  // specialized; large ones accumulate wins at a single agency over time). A single
  // global baseline creates false positives for small contractors and never fires for
  // large ones. We compute the median top-agency fraction separately per win-count tier
  // and compare each contractor against their own tier's baseline.
  const WIN_TIERS = [
    { min: 5,  max: 9   },
    { min: 10, max: 19  },
    { min: 20, max: 49  },
    { min: 50, max: Infinity },
  ];
  const tieredFractions = new Map<number, number[]>(); // tier.min → fractions
  for (const t of WIN_TIERS) tieredFractions.set(t.min, []);

  for (const [, contracts] of groups) {
    if (contracts.length < MIN_WINS) continue;
    const tier = WIN_TIERS.find(t => contracts.length >= t.min && contracts.length <= t.max);
    if (!tier) continue;
    const agencyCounts = new Map<string, number>();
    for (const c of contracts) agencyCounts.set(c.agency, (agencyCounts.get(c.agency) ?? 0) + 1);
    const topCount = Math.max(...agencyCounts.values());
    tieredFractions.get(tier.min)!.push(topCount / contracts.length);
  }

  // Compute median per tier; fall back to adjacent tier if too sparse (< 5 contractors).
  const tieredBaselines = new Map<number, number>();
  for (const t of WIN_TIERS) {
    const fracs = tieredFractions.get(t.min)!;
    tieredBaselines.set(t.min, fracs.length >= 5 ? median(fracs) : NaN);
  }
  // Fill NaN tiers by borrowing from the nearest tier that has data.
  const globalFracs = [...tieredFractions.values()].flat();
  const globalFallback = globalFracs.length > 0 ? median(globalFracs) : 0.5;
  for (const t of WIN_TIERS) {
    if (isNaN(tieredBaselines.get(t.min)!)) tieredBaselines.set(t.min, globalFallback);
  }

  // ── Pass 2: per-contractor analysis ──────────────────────────────────────────
  const results: ContractorSignal[] = [];

  for (const [, contracts] of groups) {
    if (contracts.length < MIN_WINS) continue;

    const winnerName = contracts[0].winnerName!;
    const winnerBusinessId = contracts[0].winnerBusinessId ?? null;

    // Agency concentration
    const agencyCounts = new Map<string, number>();
    for (const c of contracts) agencyCounts.set(c.agency, (agencyCounts.get(c.agency) ?? 0) + 1);
    const agenciesSorted = [...agencyCounts.entries()]
      .map(([agency, count]) => ({ agency, count }))
      .sort((a, b) => b.count - a.count);
    const topAgency = agenciesSorted[0].agency;
    const topAgencyCount = agenciesSorted[0].count;
    const topAgencyPct = Math.round((topAgencyCount / contracts.length) * 100);

    // Discount summary (all categories combined, for display)
    const allDiscounts = contracts
      .map(c => c.discountFromReference)
      .filter((d): d is number => d !== null && d >= 0 && d <= 100);
    const medianDiscount = Math.round(median(allDiscounts) * 100) / 100;
    const nearCeilingCount = allDiscounts.filter(d => d < 0.5).length;
    const nearCeilingRate = allDiscounts.length > 0
      ? Math.round((nearCeilingCount / allDiscounts.length) * 100)
      : 0;

    const totalValue = contracts.reduce((sum, c) => sum + (c.referencePrice ?? 0), 0);
    const fiscalYears = [...new Set(contracts.map(c => c.fiscalYear))].sort();

    // ── Near-ceiling: Mann-Whitney U per category, BH corrected ──────────────
    const contractorByCategory = new Map<string, number[]>();
    for (const c of contracts) {
      const d = c.discountFromReference;
      if (d === null || d < 0 || d > 100) continue;
      const cat = c.projectType ?? 'other';
      if (!contractorByCategory.has(cat)) contractorByCategory.set(cat, []);
      contractorByCategory.get(cat)!.push(d);
    }

    const categoryTests: Array<{ cat: string; p: number }> = [];
    for (const [cat, cDiscounts] of contractorByCategory) {
      const mkt = sortedMarketByCategory.get(cat);
      if (!mkt) continue;
      const p = mannWhitneyPValue(cDiscounts, mkt);
      if (p < 1) categoryTests.push({ cat, p }); // p===1 means skipped (too few data)
    }

    const adjustedPValues = benjaminiHochberg(categoryTests.map(t => t.p));
    const nearCeilingCategories: string[] = [];
    const nearCeilingPValues: number[] = [];
    for (let i = 0; i < categoryTests.length; i++) {
      if (adjustedPValues[i] < ALPHA) {
        nearCeilingCategories.push(categoryTests[i].cat);
        nearCeilingPValues.push(Math.round(adjustedPValues[i] * 10000) / 10000);
      }
    }

    // ── Single agency lock: Binomial test vs size-stratified baseline ────────
    const contractorTier = WIN_TIERS.find(t => contracts.length >= t.min && contracts.length <= t.max);
    const agencyBaseline = contractorTier ? tieredBaselines.get(contractorTier.min)! : globalFallback;
    const agencyLockRaw = binomialPValue(topAgencyCount, contracts.length, agencyBaseline);
    const agencyLockP = Math.round(agencyLockRaw * 10000) / 10000;

    // ── Flags ─────────────────────────────────────────────────────────────────
    const flags = {
      near_ceiling:       nearCeilingCategories.length > 0,
      single_agency_lock: agencyLockRaw < ALPHA,
    };
    const flagCount = Object.values(flags).filter(Boolean).length;

    results.push({
      winnerName,
      winnerBusinessId,
      win_count: contracts.length,
      total_value_thb: Math.round(totalValue),
      fiscal_years: fiscalYears,
      agencies: agenciesSorted.slice(0, 10),
      top_agency: topAgency,
      top_agency_pct: topAgencyPct,
      median_discount: medianDiscount,
      near_ceiling_rate: nearCeilingRate,
      near_ceiling_categories: nearCeilingCategories,
      near_ceiling_p_values: nearCeilingPValues,
      single_agency_lock_p: agencyLockP,
      flags,
      flag_count: flagCount,
      computed_at: new Date().toISOString(),
    });
  }

  return results.sort((a, b) => b.flag_count - a.flag_count || b.win_count - a.win_count);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function readContracts(db: admin.firestore.Firestore, limit: number): Promise<ContractRow[]> {
  const PAGE_SIZE = 500;
  const all: ContractRow[] = [];
  let last: admin.firestore.QueryDocumentSnapshot | null = null;

  const base = db.collection('cgd_contracts')
    .select('winnerName', 'winnerBusinessId', 'agency', 'projectType', 'referencePrice', 'discountFromReference', 'fiscalYear');

  do {
    const remaining = limit - all.length;
    const q: admin.firestore.Query = last
      ? base.startAfter(last).limit(Math.min(PAGE_SIZE, remaining))
      : base.limit(Math.min(PAGE_SIZE, remaining));
    const snap = await q.get();
    all.push(...snap.docs.map((d: admin.firestore.QueryDocumentSnapshot) => d.data() as ContractRow));
    last = snap.docs[snap.docs.length - 1] ?? null;
    process.stdout.write(`\r  ${all.length.toLocaleString()} / ${limit.toLocaleString()} contracts read...`);
    if (snap.docs.length < PAGE_SIZE || all.length >= limit) break;
  } while (true);

  process.stdout.write('\n');
  return all;
}

async function main() {
  initFirebase();
  const db = admin.firestore();

  console.log(`Reading up to ${LIMIT.toLocaleString()} contracts from cgd_contracts (500/page)...`);
  const rows = await readContracts(db, LIMIT);
  const withWinner = rows.filter(r => r.winnerName);
  console.log(`  ${rows.length.toLocaleString()} contracts read, ${withWinner.length.toLocaleString()} have a winner`);

  const signals = analyzeContractors(rows);
  const flagged = signals.filter(s => s.flag_count > 0);
  console.log(`\n${signals.length} contractors with ≥${MIN_WINS} wins`);
  console.log(`${flagged.length} with at least one flag\n`);

  // Print top 20
  console.log('── Top flagged contractors ──────────────────────────────');
  for (const s of flagged.slice(0, 20)) {
    const flagNames = [
      s.flags.single_agency_lock ? `SINGLE_AGENCY(p=${s.single_agency_lock_p})` : null,
      s.flags.near_ceiling       ? `NEAR_CEILING(${s.near_ceiling_categories.join(',')})` : null,
    ].filter(Boolean).join(' ');
    console.log(`${s.winnerName}`);
    console.log(`  wins=${s.win_count}  top_agency=${s.top_agency} (${s.top_agency_pct}%)  median_discount=${s.median_discount}%  near_ceiling=${s.near_ceiling_rate}%`);
    console.log(`  FLAGS: ${flagNames}`);
    console.log();
  }

  if (DRY_RUN) {
    console.log('[dry-run] Skipping Firestore writes.');
    return;
  }

  console.log(`Writing ${signals.length} contractors to contractor_intel...`);
  const BATCH_SIZE = 400;
  for (let i = 0; i < signals.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = signals.slice(i, i + BATCH_SIZE);
    for (const s of chunk) {
      const docId = s.winnerBusinessId ?? slugify(s.winnerName);
      const ref = db.collection('contractor_intel').doc(docId);
      batch.set(ref, s as unknown as Record<string, unknown>, { merge: true });
    }
    await batch.commit();
    console.log(`  wrote ${Math.min(i + BATCH_SIZE, signals.length)} / ${signals.length}`);
  }

  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
