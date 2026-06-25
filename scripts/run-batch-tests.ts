/**
 * Daily batch tester for BidSight model.
 *
 * Each run:
 * 1. Loads one 10k batch from Firestore (same window production uses)
 * 2. Builds benchmark tables from that batch
 * 3. Forward test  — within-batch, time-separated (5 expanding folds)
 * 4. Backward test — within-batch, in-sample (optimistic baseline)
 * 5. Cross-batch test — trains on PREVIOUS batch's saved tables, tests on
 *    current batch docs. Genuinely out-of-sample. No extra Firestore reads:
 *    previous tables are loaded from scripts/test-results/benchmark-tables-latest.json
 * 6. Saves current tables as the new benchmark-tables-latest.json for next run
 *
 * Page tokens are stored in .batch-state.json so each run jumps directly to
 * the next 10k window without re-scanning prior pages.
 *
 * Cycle: batch 0 → 1 → … → N → reset to 0 (~21 batches for 201k contracts).
 * GitHub Actions (daily-batch-test.yml) commits results back to the repo.
 *
 * Firestore cost: 10k reads/run × 1 run/day = 10k reads/day.
 * Combined with app's 27k reads/day = 37k total — within 50k/day free tier.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { restGetCollectionPage } from '../lib/firestore-rest';
import type { AwardedContract } from '../lib/types';
import {
  buildBenchmarkTables,
  getBenchmarkFromTables,
  recommendBid,
  type QuantileTable,
} from '../lib/bidsight-core';

const BATCH_SIZE = 10_000;
const STATE_FILE   = path.join(process.cwd(), '.batch-state.json');
const RESULTS_DIR  = path.join(process.cwd(), 'scripts', 'test-results');
const TABLES_FILE  = path.join(RESULTS_DIR, 'benchmark-tables-latest.json');
const COMPETITIVE_RE = /ประกวดราคา|คัดเลือก|e-bidding/i;

// ── Batch state ───────────────────────────────────────────────────────────────

interface BatchState {
  currentBatch: number;
  pageTokens: Record<number, string>;
}

function loadState(): BatchState {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as BatchState; }
  catch { return { currentBatch: 0, pageTokens: {} }; }
}

function saveState(state: BatchState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Benchmark table serialization (Maps → plain objects for JSON) ─────────────

type Tables = ReturnType<typeof buildBenchmarkTables>;

function serializeTables(tables: Tables): object {
  return {
    agencyCategory:   Object.fromEntries(tables.agencyCategory),
    provinceCategory: Object.fromEntries(tables.provinceCategory),
    category:         Object.fromEntries(tables.category),
    categoryBudgetTier: Object.fromEntries(
      [...tables.categoryBudgetTier.entries()].map(([k, v]) => [k, { boundaries: v.boundaries, tiers: v.tiers }]),
    ),
    global: tables.global,
  };
}

function deserializeTables(data: ReturnType<typeof serializeTables>): Tables {
  const d = data as Record<string, unknown>;
  type TierRaw = { boundaries: [number, number, number]; tiers: QuantileTable[] };
  const rawTier = (d['categoryBudgetTier'] ?? {}) as Record<string, TierRaw>;
  return {
    agencyCategory:   new Map(Object.entries(d['agencyCategory'] as Record<string, QuantileTable>)),
    provinceCategory: new Map(Object.entries(d['provinceCategory'] as Record<string, QuantileTable>)),
    category:         new Map(Object.entries(d['category'] as Record<string, QuantileTable>)),
    categoryBudgetTier: new Map(
      Object.entries(rawTier).map(([k, v]) => [
        k,
        { boundaries: v.boundaries, tiers: v.tiers as [QuantileTable, QuantileTable, QuantileTable, QuantileTable] },
      ]),
    ),
    global: d['global'] as QuantileTable,
  };
}

function saveTables(tables: Tables): void {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(TABLES_FILE, JSON.stringify(serializeTables(tables), null, 2));
}

function loadPreviousTables(): Tables | null {
  try {
    const data = JSON.parse(fs.readFileSync(TABLES_FILE, 'utf-8'));
    return deserializeTables(data);
  } catch { return null; }
}

// ── Forward test (within-batch, time-separated) ───────────────────────────────

function computeQuantiles(discounts: number[]) {
  if (discounts.length === 0) return { median: 0, q25: 0, q75: 0 };
  const sorted = [...discounts].sort((a, b) => a - b);
  const len = sorted.length;
  const median = len % 2 === 0
    ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
    : sorted[Math.floor(len / 2)];
  return { median, q25: sorted[Math.floor(len * 0.25)], q75: sorted[Math.floor(len * 0.75)] };
}

interface ForwardResult {
  competitiveCount: number;
  folds?: Array<{ fold: number; trainSize: number; testSize: number; mae: number; r2: number; coverage: number }>;
  avgMae?: number;
  avgR2?: number;
  avgCoverage?: number;
  note?: string;
}

function runForwardTest(contracts: AwardedContract[]): ForwardResult {
  const eligible = contracts.filter(
    (c) =>
      COMPETITIVE_RE.test(c.procurementMethod ?? '') &&
      c.discountFromReference != null &&
      c.discountFromReference >= 0 &&
      c.discountFromReference < 100 &&
      c.announceDate,
  );
  if (eligible.length < 50) return { competitiveCount: eligible.length, note: 'insufficient data' };

  eligible.sort((a, b) => new Date(a.announceDate).getTime() - new Date(b.announceDate).getTime());

  const foldResults: NonNullable<ForwardResult['folds']> = [];
  const numFolds = 5;
  const foldSize = Math.floor(eligible.length / numFolds);

  for (let fold = 0; fold < numFolds; fold++) {
    const testStart = fold * foldSize;
    const testEnd   = fold === numFolds - 1 ? eligible.length : (fold + 1) * foldSize;
    const trainData = eligible.slice(0, testStart);
    const testData  = eligible.slice(testStart, testEnd);
    if (trainData.length < 8) continue;

    const trainDiscounts = trainData.map((c) => c.discountFromReference!);
    const trainCategoryMap = new Map<string, number[]>();
    for (const c of trainData) {
      if (!trainCategoryMap.has(c.projectType)) trainCategoryMap.set(c.projectType, []);
      trainCategoryMap.get(c.projectType)!.push(c.discountFromReference!);
    }
    const globalBench = computeQuantiles(trainDiscounts);

    const predictions = testData.map((c) => {
      const cat = trainCategoryMap.get(c.projectType) ?? [];
      const bench = cat.length >= 8 ? computeQuantiles(cat) : globalBench;
      return { actual: c.discountFromReference!, predicted: bench.median };
    });

    const mae    = predictions.reduce((s, p) => s + Math.abs(p.actual - p.predicted), 0) / predictions.length;
    const ssRes  = predictions.reduce((s, p) => s + (p.actual - p.predicted) ** 2, 0);
    const mean   = predictions.reduce((s, p) => s + p.actual, 0) / predictions.length;
    const ssTot  = predictions.reduce((s, p) => s + (p.actual - mean) ** 2, 0);
    const r2     = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    const cov    = predictions.filter((p) => p.actual <= p.predicted + 5).length / predictions.length;

    foldResults.push({
      fold: fold + 1, trainSize: trainData.length, testSize: testData.length,
      mae: Math.round(mae * 10) / 10,
      r2:  Math.round(r2 * 1000) / 1000,
      coverage: Math.round(cov * 1000) / 1000,
    });
  }

  if (foldResults.length === 0) return { competitiveCount: eligible.length, note: 'all folds skipped' };

  return {
    competitiveCount: eligible.length,
    folds: foldResults,
    avgMae:      Math.round(foldResults.reduce((s, f) => s + f.mae, 0) / foldResults.length * 10) / 10,
    avgR2:       Math.round(foldResults.reduce((s, f) => s + f.r2, 0)  / foldResults.length * 1000) / 1000,
    avgCoverage: Math.round(foldResults.reduce((s, f) => s + f.coverage, 0) / foldResults.length * 1000) / 1000,
  };
}

// ── Backward / cross-batch test (shared logic) ────────────────────────────────

interface BackwardResult {
  competitiveCount: number;
  avgAbsError?: number;
  beatWinnerRate?: number;
  profitableRate?: number;
  note?: string;
}

function runBackwardTestWithTables(contracts: AwardedContract[], tables: Tables): BackwardResult {
  const testContracts = contracts.filter(
    (c) =>
      COMPETITIVE_RE.test(c.procurementMethod ?? '') &&
      c.discountFromReference != null &&
      c.discountFromReference >= 0 &&
      c.discountFromReference < 100 &&
      c.referencePrice != null &&
      c.agreedPrice != null,
  );
  if (testContracts.length === 0) return { competitiveCount: 0, note: 'no eligible contracts' };

  const ASSUMED_COST_RATIO = 0.80;
  const TARGET_MARGIN = 10;
  let totalAbsError = 0, wouldHaveWonCount = 0, profitableWins = 0;

  for (const c of testContracts) {
    const refPrice      = c.referencePrice!;
    const agreedPrice   = c.agreedPrice!;
    const estimatedCost = refPrice * ASSUMED_COST_RATIO;
    const { table: bench } = getBenchmarkFromTables(c.agency, c.projectType, tables, c.province, refPrice);
    const rec = recommendBid(refPrice, estimatedCost, TARGET_MARGIN, bench);
    totalAbsError += Math.abs(rec.recommendedDiscount - c.discountFromReference!);
    if (rec.recommendedBid <= agreedPrice) {
      wouldHaveWonCount++;
      if (((agreedPrice - estimatedCost) / agreedPrice) * 100 >= TARGET_MARGIN) profitableWins++;
    }
  }

  const n = testContracts.length;
  return {
    competitiveCount: n,
    avgAbsError:   Math.round((totalAbsError / n) * 10) / 10,
    beatWinnerRate: Math.round((wouldHaveWonCount / n) * 1000) / 10,
    profitableRate: wouldHaveWonCount > 0
      ? Math.round((profitableWins / wouldHaveWonCount) * 1000) / 10
      : 0,
  };
}

// ── Naive baseline ────────────────────────────────────────────────────────────
// Same table lookup as BidSight but always bids at the benchmark median — no
// cost/margin optimisation. Answers: how much does BidSight's margin floor logic
// and positioning add over simply submitting the market median price every time?

function runNaiveBaseline(contracts: AwardedContract[], tables: Tables): BackwardResult {
  const testContracts = contracts.filter(
    (c) =>
      COMPETITIVE_RE.test(c.procurementMethod ?? '') &&
      c.discountFromReference != null &&
      c.discountFromReference >= 0 &&
      c.discountFromReference < 100 &&
      c.referencePrice != null &&
      c.agreedPrice != null,
  );
  if (testContracts.length === 0) return { competitiveCount: 0, note: 'no eligible contracts' };

  const ASSUMED_COST_RATIO = 0.80;
  const TARGET_MARGIN      = 10;
  let totalAbsError = 0, wouldHaveWonCount = 0, profitableWins = 0;

  for (const c of testContracts) {
    const refPrice      = c.referencePrice!;
    const agreedPrice   = c.agreedPrice!;
    const estimatedCost = refPrice * ASSUMED_COST_RATIO;
    // Full fallback chain (same as BidSight) but ignore tier — naive has no budget awareness
    const { table: bench } = getBenchmarkFromTables(c.agency, c.projectType, tables, c.province);
    const naiveDiscount = bench.median;
    const naiveBid      = refPrice * (1 - naiveDiscount / 100);

    totalAbsError += Math.abs(naiveDiscount - c.discountFromReference!);
    if (naiveBid <= agreedPrice) {
      wouldHaveWonCount++;
      if (((naiveBid - estimatedCost) / naiveBid) * 100 >= TARGET_MARGIN) profitableWins++;
    }
  }

  const n = testContracts.length;
  return {
    competitiveCount: n,
    avgAbsError:    Math.round((totalAbsError / n) * 10) / 10,
    beatWinnerRate: Math.round((wouldHaveWonCount / n) * 1000) / 10,
    profitableRate: wouldHaveWonCount > 0
      ? Math.round((profitableWins / wouldHaveWonCount) * 1000) / 10
      : 0,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

function printResult(label: string, r: ForwardResult | BackwardResult): void {
  console.log(`\n📊 ${label}:`);
  console.log(`  Competitive contracts: ${'competitiveCount' in r ? r.competitiveCount : '?'}`);
  if ('avgMae' in r && r.avgMae != null) {
    console.log(`  Avg MAE:      ${r.avgMae}pp`);
    console.log(`  Avg R²:       ${r.avgR2}`);
    console.log(`  Avg coverage: ${r.avgCoverage}`);
  } else if ('beatWinnerRate' in r && r.beatWinnerRate != null) {
    console.log(`  Avg abs error:  ${r.avgAbsError}pp`);
    console.log(`  Beat winner:    ${r.beatWinnerRate}%`);
    console.log(`  Profitable:     ${r.profitableRate}% of wins`);
  } else if ('note' in r) {
    console.log(`  Note: ${r.note}`);
  }
}

async function main(): Promise<void> {
  const state     = loadState();
  const batch     = state.currentBatch;
  const pageToken = state.pageTokens[batch] as string | undefined;

  console.log(`🧪 BidSight batch test — batch ${batch} (cursor: ${pageToken ? 'stored' : 'start of collection'})`);

  const { docs, nextPageToken } = await restGetCollectionPage<AwardedContract>(
    'cgd_contracts',
    BATCH_SIZE,
    pageToken,
  );

  console.log(`Loaded ${docs.length} contracts`);

  if (docs.length === 0) {
    console.log('No docs returned — resetting to batch 0');
    state.currentBatch = 0;
    saveState(state);
    return;
  }

  // Build tables from current batch (used for within-batch tests + saved for next run)
  const currentTables = buildBenchmarkTables(docs as Parameters<typeof buildBenchmarkTables>[0]);

  // Load previous batch's tables for cross-batch test (zero extra Firestore reads)
  const prevTables = loadPreviousTables();

  const forward      = runForwardTest(docs);
  const backward     = runBackwardTestWithTables(docs, currentTables);
  const crossBatch   = prevTables
    ? runBackwardTestWithTables(docs, prevTables)
    : null;
  const naiveBaseline = runNaiveBaseline(docs, currentTables);

  printResult('Forward (within-batch, time-separated)', forward);
  printResult('Backward (within-batch, in-sample)', backward);
  if (crossBatch) {
    printResult('Cross-batch (trained on prev batch — genuine out-of-sample)', crossBatch);
  } else {
    console.log('\n📊 Cross-batch: skipped (no previous tables — will run from batch 1 onwards)');
  }
  printResult('Naive baseline (always bid at benchmark median — dumb rule)', naiveBaseline);
  if (crossBatch && naiveBaseline.beatWinnerRate != null) {
    const lift = Math.round(((crossBatch.beatWinnerRate ?? 0) - naiveBaseline.beatWinnerRate) * 10) / 10;
    console.log(`\n  BidSight lift over naive: ${lift > 0 ? '+' : ''}${lift}pp beat-winner rate`);
  }

  // Save results
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const resultFile = path.join(RESULTS_DIR, `batch-${String(batch).padStart(3, '0')}-${date}.json`);
  fs.writeFileSync(resultFile, JSON.stringify({
    batch,
    date,
    contractsLoaded: docs.length,
    forward,
    backward,
    ...(crossBatch ? { crossBatch } : {}),
    naiveBaseline,
  }, null, 2));

  // Save current tables for next run's cross-batch test
  saveTables(currentTables);

  // Advance state
  if (nextPageToken) {
    state.pageTokens[batch + 1] = nextPageToken;
    state.currentBatch = batch + 1;
  } else {
    console.log('\nEnd of collection — resetting to batch 0 for next sweep.');
    state.currentBatch = 0;
    state.pageTokens = {}; // re-derive page tokens each sweep
  }
  saveState(state);

  console.log(`\n✅ Results → ${resultFile}`);
  console.log(`   Tables  → ${TABLES_FILE}`);
  console.log(`   Next run: batch ${state.currentBatch}`);
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
