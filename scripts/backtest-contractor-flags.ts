/**
 * Leave-one-out backtest for contractor flagging logic.
 *
 * Temporal split cannot work on this dataset: 94% of contractors appear in
 * only one fiscal year, so flagged training contractors have no test-period
 * wins to re-test. This script uses a within-contractor random split instead.
 *
 * Method:
 *   For each contractor with enough wins per category:
 *     1. Randomly split their wins 70/30 (K=20 repetitions).
 *     2. For each split:
 *        a. Run the flag test on the 70% training split vs the market baseline.
 *        b. If the flag fires, run the same test on the 30% test split.
 *        c. Record whether the test split also fires (stable) or not (noise).
 *     3. Stability for this contractor = fraction of repetitions where both
 *        train AND test fire (conditional: given train fires, does test fire?).
 *   Aggregate across all contractors at each minCategoryWins threshold.
 *
 * What this answers:
 *   "Given a contractor's pattern is flagged on 70% of their history,
 *    does the same signal appear in the remaining 30%?"
 *   The minimum N where this stability plateaus is the empirically justified
 *   minimum threshold.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/backtest-contractor-flags.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/backtest-contractor-flags.ts --limit 50000
 *   npx ts-node --project tsconfig.scripts.json scripts/backtest-contractor-flags.ts --reps 50
 *
 * Firestore cost = --limit reads (same as a manual analyze-contractors run).
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ── CLI args ──────────────────────────────────────────────────────────────────

const cliArgs = process.argv.slice(2);
const limitArg  = cliArgs.indexOf('--limit');
const repsArg   = cliArgs.indexOf('--reps');
const LIMIT     = limitArg !== -1 ? Number(cliArgs[limitArg + 1]) : 20_000;
const K_REPS    = repsArg  !== -1 ? Number(cliArgs[repsArg  + 1]) : 20;   // random splits per contractor
const TRAIN_PCT = 0.7;
const ALPHA     = 0.05;
const MIN_WINS  = 5; // minimum total wins to include a contractor at all

// Sweep range for MIN_CATEGORY_WINS
// Contractor needs >= MIN_CAT_WINS in BOTH train and test splits,
// so we only attempt split if total category wins >= 2 * MIN_CAT_WINS.
const CATEGORY_WIN_SWEEP = [3, 5, 8, 10, 15];

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

// ── Statistical helpers ───────────────────────────────────────────────────────

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - 0.398942280 * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? p : 1 - p;
}

function lowerBound(sorted: number[], val: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < val) lo = mid + 1; else hi = mid; }
  return lo;
}

function upperBound(sorted: number[], val: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= val) lo = mid + 1; else hi = mid; }
  return lo;
}

function mannWhitneyPValue(
  contractorDiscounts: number[],
  sortedMarket: number[],
  minCategoryWins: number,
): number {
  const m = contractorDiscounts.length;
  const n = sortedMarket.length;
  if (m < minCategoryWins || n < 10) return 1;

  let u = 0;
  for (const cd of contractorDiscounts) {
    u += (n - upperBound(sortedMarket, cd))
       + (upperBound(sortedMarket, cd) - lowerBound(sortedMarket, cd)) * 0.5;
  }

  const meanU = (m * n) / 2;
  const varU  = (m * n * (m + n + 1)) / 12;
  if (varU === 0) return 1;
  return 1 - normalCDF((u - meanU) / Math.sqrt(varU));
}

function logBinomCoeff(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  let r = 0;
  for (let i = 0; i < k; i++) r += Math.log(n - i) - Math.log(i + 1);
  return r;
}

function binomialPValue(k: number, n: number, p0: number): number {
  if (k <= 0) return 1;
  if (p0 <= 0) return 0;
  if (p0 >= 1) return 1;
  if (n <= 50) {
    let cum = 0;
    for (let i = 0; i < k; i++) {
      const lp = logBinomCoeff(n, i) + i * Math.log(p0) + (n - i) * Math.log(1 - p0);
      cum += Math.exp(lp);
    }
    return Math.max(0, Math.min(1, 1 - cum));
  }
  const std = Math.sqrt(n * p0 * (1 - p0));
  if (std === 0) return 1;
  return 1 - normalCDF((k - 0.5 - n * p0) / std);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── Random split ──────────────────────────────────────────────────────────────

// Seeded LCG for reproducible but varied splits across reps
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xFFFFFFFF;
  };
}

function randomSplit<T>(arr: T[], trainPct: number, rand: () => number): [T[], T[]] {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  const splitAt = Math.ceil(shuffled.length * trainPct);
  return [shuffled.slice(0, splitAt), shuffled.slice(splitAt)];
}

// ── Grouping ──────────────────────────────────────────────────────────────────

const DATE_ARTIFACT = /^\d{1,2}\s\S+\s\d{2}$/;

function groupByContractor(rows: ContractRow[]): Map<string, ContractRow[]> {
  const groups = new Map<string, ContractRow[]>();
  for (const row of rows) {
    if (!row.winnerName) continue;
    if (DATE_ARTIFACT.test(row.winnerName.trim())) continue;
    const key = row.winnerBusinessId ?? row.winnerName.trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return groups;
}

// ── Market baselines ──────────────────────────────────────────────────────────

const WIN_TIERS = [
  { min: 5,  max: 9   },
  { min: 10, max: 19  },
  { min: 20, max: 49  },
  { min: 50, max: Infinity },
];

function getTieredBaseline(winCount: number, tieredBaselines: Map<number, number>, globalFallback: number): number {
  const tier = WIN_TIERS.find(t => winCount >= t.min && winCount <= t.max);
  return tier ? (tieredBaselines.get(tier.min) ?? globalFallback) : globalFallback;
}

function buildMarketBaselines(rows: ContractRow[], groups: Map<string, ContractRow[]>): {
  sortedByCategory: Map<string, number[]>;
  tieredBaselines: Map<number, number>;
  globalFallback: number;
} {
  const byCategory = new Map<string, number[]>();
  for (const row of rows) {
    const d = row.discountFromReference;
    if (d === null || d < 0 || d > 100) continue;
    const cat = row.projectType ?? 'other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(d);
  }
  const sortedByCategory = new Map<string, number[]>();
  for (const [cat, ds] of byCategory) {
    sortedByCategory.set(cat, [...ds].sort((a, b) => a - b));
  }

  // Build size-stratified baselines
  const tieredFractions = new Map<number, number[]>();
  for (const t of WIN_TIERS) tieredFractions.set(t.min, []);

  for (const [, contracts] of groups) {
    if (contracts.length < MIN_WINS) continue;
    const tier = WIN_TIERS.find(t => contracts.length >= t.min && contracts.length <= t.max);
    if (!tier) continue;
    const counts = new Map<string, number>();
    for (const c of contracts) counts.set(c.agency, (counts.get(c.agency) ?? 0) + 1);
    tieredFractions.get(tier.min)!.push(Math.max(...counts.values()) / contracts.length);
  }

  const allFracs = [...tieredFractions.values()].flat();
  const globalFallback = allFracs.length > 0 ? median(allFracs) : 0.5;

  const tieredBaselines = new Map<number, number>();
  for (const t of WIN_TIERS) {
    const fracs = tieredFractions.get(t.min)!;
    tieredBaselines.set(t.min, fracs.length >= 5 ? median(fracs) : globalFallback);
  }

  return { sortedByCategory, tieredBaselines, globalFallback };
}

// ── LOO backtest core ─────────────────────────────────────────────────────────

interface ContractorLOOResult {
  winnerName: string;
  key: string;
  // near_ceiling per category
  nc: Array<{
    cat: string;
    totalWins: number;
    // across K_REPS: how many times did train fire? how many of those had test also fire?
    trainFired: number;
    testStable: number;
    stabilityRate: number; // testStable / trainFired (NaN if trainFired=0)
  }>;
  // single_agency_lock
  al: {
    totalWins: number;
    trainFired: number;
    testStable: number;
    stabilityRate: number;
  };
}

function looContractor(
  contracts: ContractRow[],
  sortedMarketByCategory: Map<string, number[]>,
  tieredBaselines: Map<number, number>,
  globalFallback: number,
  minCategoryWins: number,
  key: string,
): ContractorLOOResult {
  const winnerName = contracts[0].winnerName!;

  // ── near_ceiling LOO per category ─────────────────────────────────────────
  const byCategory = new Map<string, number[]>();
  for (const c of contracts) {
    const d = c.discountFromReference;
    if (d === null || d < 0 || d > 100) continue;
    const cat = c.projectType ?? 'other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(d);
  }

  const ncResults: ContractorLOOResult['nc'] = [];

  for (const [cat, discounts] of byCategory) {
    // Need enough wins that both train and test splits meet MIN_CATEGORY_WINS
    if (discounts.length < 2 * minCategoryWins) continue;
    const mkt = sortedMarketByCategory.get(cat);
    if (!mkt || mkt.length < 10) continue;

    let trainFired = 0;
    let testStable = 0;

    for (let rep = 0; rep < K_REPS; rep++) {
      const rand = lcg(rep * 997 + key.length * 31 + cat.length * 7);
      const [trainDs, testDs] = randomSplit(discounts, TRAIN_PCT, rand);

      if (trainDs.length < minCategoryWins || testDs.length < minCategoryWins) continue;

      const pTrain = mannWhitneyPValue(trainDs, mkt, minCategoryWins);
      if (pTrain >= ALPHA) continue;

      trainFired++;
      const pTest = mannWhitneyPValue(testDs, mkt, minCategoryWins);
      if (pTest < ALPHA) testStable++;
    }

    ncResults.push({
      cat,
      totalWins: discounts.length,
      trainFired,
      testStable,
      stabilityRate: trainFired > 0 ? testStable / trainFired : NaN,
    });
  }

  // ── single_agency_lock LOO ────────────────────────────────────────────────
  // Use size-stratified baseline: compare train/test splits against the baseline
  // for contractors of SIMILAR SIZE (not the global median).
  const agencyWins = contracts.map(c => c.agency);
  let alTrainFired = 0;
  let alTestStable = 0;

  if (contracts.length >= 2 * MIN_WINS) {
    for (let rep = 0; rep < K_REPS; rep++) {
      const rand = lcg(rep * 997 + key.length * 31);
      const [trainAgencies, testAgencies] = randomSplit(agencyWins, TRAIN_PCT, rand);

      if (trainAgencies.length < MIN_WINS || testAgencies.length < MIN_WINS) continue;

      // Baseline is looked up by SPLIT SIZE, not full contractor size, so we compare
      // against what contractors of that many wins normally look like.
      const trainBaseline = getTieredBaseline(trainAgencies.length, tieredBaselines, globalFallback);
      const testBaseline  = getTieredBaseline(testAgencies.length,  tieredBaselines, globalFallback);

      const trainCounts = new Map<string, number>();
      for (const a of trainAgencies) trainCounts.set(a, (trainCounts.get(a) ?? 0) + 1);
      const trainTop = Math.max(...trainCounts.values());
      if (binomialPValue(trainTop, trainAgencies.length, trainBaseline) >= ALPHA) continue;

      alTrainFired++;

      const testCounts = new Map<string, number>();
      for (const a of testAgencies) testCounts.set(a, (testCounts.get(a) ?? 0) + 1);
      const testTop = Math.max(...testCounts.values());
      if (binomialPValue(testTop, testAgencies.length, testBaseline) < ALPHA) alTestStable++;
    }
  }

  return {
    winnerName,
    key,
    nc: ncResults,
    al: {
      totalWins: contracts.length,
      trainFired: alTrainFired,
      testStable: alTestStable,
      stabilityRate: alTrainFired > 0 ? alTestStable / alTrainFired : NaN,
    },
  };
}

// ── Aggregate across all contractors at one threshold ─────────────────────────

interface SweepResult {
  minCategoryWins: number;
  // near_ceiling
  ncContractorsTestable: number;   // had at least one category with enough wins to test
  ncTrainFiredTotal: number;
  ncTestStableTotal: number;
  ncStabilityRate: number;         // aggregate: testStable / trainFired across all contractors+categories
  // single_agency_lock
  alContractorsTestable: number;
  alTrainFiredTotal: number;
  alTestStableTotal: number;
  alStabilityRate: number;
}

function aggregateSweep(
  groups: Map<string, ContractRow[]>,
  sortedMarketByCategory: Map<string, number[]>,
  tieredBaselines: Map<number, number>,
  globalFallback: number,
  minCategoryWins: number,
): SweepResult {
  let ncContractorsTestable = 0;
  let ncTrainTotal = 0, ncStableTotal = 0;
  let alContractorsTestable = 0;
  let alTrainTotal = 0, alStableTotal = 0;

  for (const [key, contracts] of groups) {
    if (contracts.length < MIN_WINS) continue;

    const result = looContractor(contracts, sortedMarketByCategory, tieredBaselines, globalFallback, minCategoryWins, key);

    // near_ceiling: sum across all testable categories for this contractor
    const testableCategories = result.nc.filter(r => r.trainFired > 0 || r.totalWins >= 2 * minCategoryWins);
    if (testableCategories.length > 0) ncContractorsTestable++;
    for (const r of result.nc) {
      ncTrainTotal  += r.trainFired;
      ncStableTotal += r.testStable;
    }

    // single_agency_lock
    if (contracts.length >= 2 * MIN_WINS) {
      alContractorsTestable++;
      alTrainTotal  += result.al.trainFired;
      alStableTotal += result.al.testStable;
    }
  }

  return {
    minCategoryWins,
    ncContractorsTestable,
    ncTrainFiredTotal:  ncTrainTotal,
    ncTestStableTotal:  ncStableTotal,
    ncStabilityRate:    ncTrainTotal > 0 ? Math.round((ncStableTotal / ncTrainTotal) * 100) : 0,
    alContractorsTestable,
    alTrainFiredTotal:  alTrainTotal,
    alTestStableTotal:  alStableTotal,
    alStabilityRate:    alTrainTotal > 0 ? Math.round((alStableTotal / alTrainTotal) * 100) : 0,
  };
}

// ── Firestore read ────────────────────────────────────────────────────────────

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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  initFirebase();
  const db = admin.firestore();

  console.log(`Reading up to ${LIMIT.toLocaleString()} contracts...`);
  const rows = await readContracts(db, LIMIT);

  const groups = groupByContractor(rows);
  const { sortedByCategory, tieredBaselines, globalFallback } = buildMarketBaselines(rows, groups);

  console.log(`\n${groups.size} unique contractors`);
  console.log(`${[...groups.values()].filter(c => c.length >= MIN_WINS).length} with ≥${MIN_WINS} wins`);
  console.log('Size-stratified agency baselines:');
  for (const t of WIN_TIERS) {
    const b = tieredBaselines.get(t.min);
    if (b !== undefined) {
      const label = t.max === Infinity ? `${t.min}+` : `${t.min}-${t.max}`;
      console.log(`  wins ${label}: baseline = ${(b * 100).toFixed(1)}%`);
    }
  }
  console.log(`Market categories: ${[...sortedByCategory.keys()].join(', ')}`);
  console.log(`K_REPS = ${K_REPS} random splits per contractor\n`);

  // ── Per-contractor detail at default threshold ────────────────────────────
  const DEFAULT_MIN = 5;
  console.log(`── Per-contractor LOO detail (minCategoryWins=${DEFAULT_MIN}) ─────────────────`);

  const details: ContractorLOOResult[] = [];
  for (const [key, contracts] of groups) {
    if (contracts.length < MIN_WINS) continue;
    const r = looContractor(contracts, sortedByCategory, tieredBaselines, globalFallback, DEFAULT_MIN, key);
    const hasAnything = r.nc.some(c => c.trainFired > 0) || r.al.trainFired > 0;
    if (hasAnything) details.push(r);
  }

  if (details.length === 0) {
    console.log('  No contractors had enough wins per category to run the LOO test.');
    console.log('  This means no contractor has >= 2 × minCategoryWins wins in any category.');
    console.log('  Try --limit 50000 or lower minCategoryWins in the sweep.\n');
  } else {
    for (const r of details.slice(0, 15)) {
      console.log(`\n  ${r.winnerName}`);
      for (const c of r.nc) {
        if (c.trainFired === 0) continue;
        console.log(`    near_ceiling [${c.cat}]: wins=${c.totalWins}  train_fired=${c.trainFired}/${K_REPS}  stable=${c.testStable}/${c.trainFired}  stability=${(c.stabilityRate * 100).toFixed(0)}%`);
      }
      if (r.al.trainFired > 0) {
        console.log(`    agency_lock: wins=${r.al.totalWins}  train_fired=${r.al.trainFired}/${K_REPS}  stable=${r.al.testStable}/${r.al.trainFired}  stability=${(r.al.stabilityRate * 100).toFixed(0)}%`);
      }
    }
  }

  // ── Sweep ─────────────────────────────────────────────────────────────────
  console.log('\n── Sweep: stability vs minCategoryWins ──────────────────────────────');
  console.log('(Each entry: how often does a flag on 70% of a contractor\'s wins\n repeat on the held-out 30%?)\n');

  const sweepResults: SweepResult[] = [];
  for (const mcw of CATEGORY_WIN_SWEEP) {
    sweepResults.push(aggregateSweep(groups, sortedByCategory, tieredBaselines, globalFallback, mcw));
  }

  // near_ceiling table
  console.log('── near_ceiling ─────────────────────────────────────────────────────');
  console.log('minCatWins | testable_contractors | train_fired | stable | stability%');
  console.log('─'.repeat(72));
  for (const r of sweepResults) {
    console.log(
      `${String(r.minCategoryWins).padStart(10)} | ` +
      `${String(r.ncContractorsTestable).padStart(20)} | ` +
      `${String(r.ncTrainFiredTotal).padStart(11)} | ` +
      `${String(r.ncTestStableTotal).padStart(6)} | ` +
      `${String(r.ncStabilityRate).padStart(10)}%`
    );
  }

  // agency lock table
  console.log('\n── single_agency_lock ───────────────────────────────────────────────');
  console.log('minCatWins | testable_contractors | train_fired | stable | stability%');
  console.log('─'.repeat(72));
  for (const r of sweepResults) {
    console.log(
      `${String(r.minCategoryWins).padStart(10)} | ` +
      `${String(r.alContractorsTestable).padStart(20)} | ` +
      `${String(r.alTrainFiredTotal).padStart(11)} | ` +
      `${String(r.alTestStableTotal).padStart(6)} | ` +
      `${String(r.alStabilityRate).padStart(10)}%`
    );
  }

  // ── Recommendation ────────────────────────────────────────────────────────
  console.log('\n── recommendation ───────────────────────────────────────────────────');

  let prevStability = -1;
  let recommendedNc = CATEGORY_WIN_SWEEP[0];
  for (const r of sweepResults) {
    const gain = r.ncStabilityRate - prevStability;
    const plateau = prevStability >= 0 && gain < 5;
    const note = r.ncTrainFiredTotal === 0
      ? '  ← no contractors testable at this threshold'
      : plateau
        ? '  ← diminishing returns (< 5pp gain)'
        : '';
    console.log(`  minCategoryWins=${r.minCategoryWins}: nc_stability=${r.ncStabilityRate}%  train_fired=${r.ncTrainFiredTotal}${note}`);
    if (!plateau && r.ncTrainFiredTotal > 0) recommendedNc = r.minCategoryWins;
    prevStability = r.ncStabilityRate;
  }

  const alRow = sweepResults[0];
  console.log(`\n  single_agency_lock: ${alRow.alStabilityRate}% stability across ${alRow.alContractorsTestable} testable contractors`);
  console.log(`  (Agency lock is not category-dependent — minCategoryWins doesn't affect it)\n`);

  if (sweepResults.every(r => r.ncTrainFiredTotal === 0)) {
    console.log('  ⚠ No contractor had enough wins per category to run the LOO test.');
    console.log('  The 20k dataset has too few repeat winners within a single category.');
    console.log('  To get meaningful results, re-run with: --limit 50000');
    console.log('  (50k reads = within the free-tier buffer if done manually once)');
  } else {
    console.log(`  Recommended MIN_CATEGORY_WINS: ${recommendedNc}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
