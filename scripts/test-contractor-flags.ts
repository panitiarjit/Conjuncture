/**
 * Tests for contractor flagging logic.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/test-contractor-flags.ts
 *
 * Covers: statistical helpers (Mann-Whitney, Binomial, BH), analyzeContractors
 * integration, and edge cases inherited from the previous test suite.
 */

import {
  mannWhitneyPValue,
  binomialPValue,
  benjaminiHochberg,
  analyzeContractors,
} from './analyze-contractors';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`      expected: ${JSON.stringify(expected)}`);
    console.error(`      actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function expectTrue(label: string, value: boolean) { expect(label, value, true); }
function expectFalse(label: string, value: boolean) { expect(label, value, false); }

function expectLt(label: string, actual: number, threshold: number) {
  if (actual < threshold) {
    console.log(`  ✓ ${label} (${actual} < ${threshold})`);
    passed++;
  } else {
    console.error(`  ✗ ${label}: expected < ${threshold}, got ${actual}`);
    failed++;
  }
}

function expectGte(label: string, actual: number, threshold: number) {
  if (actual >= threshold) {
    console.log(`  ✓ ${label} (${actual} >= ${threshold})`);
    passed++;
  } else {
    console.error(`  ✗ ${label}: expected >= ${threshold}, got ${actual}`);
    failed++;
  }
}

// ── ContractRow factory ───────────────────────────────────────────────────────

interface ContractRow {
  winnerName: string | null;
  winnerBusinessId: string | null;
  agency: string;
  projectType: string | null;
  referencePrice: number | null;
  discountFromReference: number | null;
  fiscalYear: number;
}

function row(
  name: string | null,
  agency: string,
  discount: number | null,
  projectType: string | null = 'construction',
  businessId: string | null = null,
  referencePrice: number | null = 1_000_000,
  fiscalYear = 2567,
): ContractRow {
  return { winnerName: name, winnerBusinessId: businessId, agency, projectType, referencePrice, discountFromReference: discount, fiscalYear };
}

function repeat(r: ContractRow, n: number): ContractRow[] {
  return Array(n).fill(r);
}

// ── mannWhitneyPValue ─────────────────────────────────────────────────────────

console.log('\n── mannWhitneyPValue ────────────────────────────────────────────────');

// Contractor always bids at 0% (ceiling), market bids at 5–15%
// Should be very significant
const marketHigh = Array.from({ length: 100 }, (_, i) => 5 + i * 0.1);
const contractorAtCeiling = Array(10).fill(0.1);
expectLt('contractor at ceiling vs high market → p < 0.01', mannWhitneyPValue(contractorAtCeiling, marketHigh.sort((a,b)=>a-b)), 0.01);

// Contractor bids at same level as market → not significant
const marketMid = Array.from({ length: 100 }, () => 6);
const contractorSame = Array(10).fill(6);
expectGte('contractor same as market → p >= 0.05', mannWhitneyPValue(contractorSame, marketMid.sort((a,b)=>a-b)), 0.05);

// Contractor bids MORE aggressively than market (higher discount) → not a near-ceiling signal
const contractorAggressive = Array(10).fill(15);
const marketLow = Array.from({ length: 100 }, () => 5);
expectGte('contractor more aggressive than market → p >= 0.05 (not near-ceiling)', mannWhitneyPValue(contractorAggressive, marketLow.sort((a,b)=>a-b)), 0.05);

// Too few contractor wins → returns 1
expectGte('contractor < MIN_CATEGORY_WINS → p = 1', mannWhitneyPValue([0.1, 0.2], marketHigh), 1);

// Too few market records → returns 1
expectGte('market < MIN_MARKET_N → p = 1', mannWhitneyPValue(contractorAtCeiling, [1, 2, 3]), 1);

// ── binomialPValue ────────────────────────────────────────────────────────────

console.log('\n── binomialPValue ───────────────────────────────────────────────────');

// Contractor wins 9/10 at top agency, baseline 40%
// Should be very significant
expectLt('9/10 at top agency vs 40% baseline → p < 0.01', binomialPValue(9, 10, 0.4), 0.01);

// Contractor wins 4/10 at top agency, baseline 40% → not significant
expectGte('4/10 at top agency vs 40% baseline → p >= 0.05', binomialPValue(4, 10, 0.4), 0.05);

// k=0 always returns 1
expectGte('k=0 → p = 1', binomialPValue(0, 10, 0.4), 1);

// k=n with p0 near 0 → very significant
expectLt('k=n=10 vs p0=0.1 → p < 0.001', binomialPValue(10, 10, 0.1), 0.001);

// Large n uses normal approximation — direction check
expectLt('70/100 at top agency vs 40% baseline (large n) → p < 0.001', binomialPValue(70, 100, 0.4), 0.001);
expectGte('40/100 at top agency vs 40% baseline (large n) → p >= 0.4', binomialPValue(40, 100, 0.4), 0.4);

// ── benjaminiHochberg ─────────────────────────────────────────────────────────

console.log('\n── benjaminiHochberg ────────────────────────────────────────────────');

// Single p-value: unchanged
expect('single p-value passes through', benjaminiHochberg([0.03]), [0.03]);

// All very small → all remain significant after correction
const allSmall = benjaminiHochberg([0.001, 0.002, 0.003]);
expectTrue('all small p-values remain < 0.05 after BH', allSmall.every(p => p < 0.05));

// Mixed: first very small, last near 1
const mixed = benjaminiHochberg([0.001, 0.04, 0.9]);
expectLt('smallest p stays significant after BH', mixed[0], 0.05);
expectGte('largest p stays non-significant after BH', mixed[2], 0.05);

// BH is monotone: adjusted p-values should be non-decreasing when sorted by original p
const raw = [0.01, 0.03, 0.05];
const adj = benjaminiHochberg(raw);
expectTrue('BH: lower raw p gets lower or equal adjusted p', adj[0] <= adj[1] && adj[1] <= adj[2]);

// Empty array
expect('empty array returns empty', benjaminiHochberg([]), []);

// ── analyzeContractors — filtering ────────────────────────────────────────────

console.log('\n── filtering ────────────────────────────────────────────────────────');

const dateRows = [
  row('31 ธ.ค. 70', 'กรมชลประทาน', 0),
  row('1 ม.ค. 68', 'กรมชลประทาน', 0),
];
const dateResult = analyzeContractors([...dateRows, ...dateRows, ...dateRows, ...dateRows, ...dateRows]);
expect('date artifacts produce 0 contractors', dateResult.length, 0);

const almostDate = repeat(row('31 ธ.ค.', 'กรมชลประทาน', 0), 5);
expect('non-matching pattern not filtered', analyzeContractors(almostDate).length, 1);

const nullRows = repeat(row(null, 'กรมชลประทาน', 0), 5);
expect('null winnerName → 0 contractors', analyzeContractors(nullRows).length, 0);

// ── analyzeContractors — MIN_WINS ─────────────────────────────────────────────

console.log('\n── MIN_WINS threshold ───────────────────────────────────────────────');

const below = repeat(row('บริษัท ทดสอบ จำกัด', 'กรมชลประทาน', 5), 4);
expect('4 wins → excluded', analyzeContractors(below).length, 0);

const exact = repeat(row('บริษัท ทดสอบ จำกัด', 'กรมชลประทาน', 5), 5);
expect('5 wins → included', analyzeContractors(exact).length, 1);

// ── analyzeContractors — grouping ────────────────────────────────────────────

console.log('\n── winnerBusinessId grouping ────────────────────────────────────────');

const sameId = [
  ...repeat(row('บริษัท เก่า จำกัด', 'กรมชลประทาน', 5, 'construction', '1234567890123'), 3),
  ...repeat(row('บริษัท ใหม่ จำกัด', 'กรมชลประทาน', 5, 'construction', '1234567890123'), 3),
];
const sameIdResult = analyzeContractors(sameId);
expect('same businessId merges → 1 contractor', sameIdResult.length, 1);
expect('win_count is combined', sameIdResult[0]?.win_count, 6);

const diffId = [
  ...repeat(row('บริษัท A จำกัด', 'กรมชลประทาน', 5, 'construction', 'ID_A'), 5),
  ...repeat(row('บริษัท B จำกัด', 'กรมชลประทาน', 5, 'construction', 'ID_B'), 5),
];
expect('different businessIds → 2 contractors', analyzeContractors(diffId).length, 2);

// ── analyzeContractors — near_ceiling statistical flag ────────────────────────

console.log('\n── near_ceiling (statistical) ───────────────────────────────────────');

// Build a dataset where market bids at 5–15% and contractor always bids at 0.1%
// Market needs to be large enough for Mann-Whitney to detect the signal
function buildNearCeilingDataset(contractorN: number, marketN: number): ContractRow[] {
  const market = Array.from({ length: marketN }, (_, i) =>
    row(`market_${i}`, `agency_${i % 5}`, 5 + (i % 10), 'construction', `mkt_${i}`)
  );
  const contractor = Array.from({ length: contractorN }, () =>
    row('บริษัท ใกล้เพดาน จำกัด', 'กรมทางหลวง', 0.1, 'construction', 'NC_TEST')
  );
  return [...market, ...contractor];
}

// Large contractor sample against large market — should detect near_ceiling
const ncLarge = buildNearCeilingDataset(20, 200);
const ncLargeResult = analyzeContractors(ncLarge).find(s => s.winnerBusinessId === 'NC_TEST');
expectTrue('near_ceiling: large contractor sample vs large market → flagged', ncLargeResult?.flags.near_ceiling ?? false);
expectTrue('near_ceiling_categories populated when flagged', (ncLargeResult?.near_ceiling_categories.length ?? 0) > 0);
expectTrue('near_ceiling_p_values populated when flagged', (ncLargeResult?.near_ceiling_p_values.length ?? 0) > 0);

// Contractor at same level as market — should NOT be flagged
function buildNormalDataset(contractorN: number, marketN: number): ContractRow[] {
  const market = Array.from({ length: marketN }, (_, i) =>
    row(`market_${i}`, `agency_${i % 5}`, 6, 'construction', `mkt_${i}`)
  );
  const contractor = Array.from({ length: contractorN }, () =>
    row('บริษัท ปกติ จำกัด', 'กรมทางหลวง', 6, 'construction', 'NORMAL_TEST')
  );
  return [...market, ...contractor];
}

const ncNormal = buildNormalDataset(20, 200);
const ncNormalResult = analyzeContractors(ncNormal).find(s => s.winnerBusinessId === 'NORMAL_TEST');
expectFalse('contractor at market level → near_ceiling NOT flagged', ncNormalResult?.flags.near_ceiling ?? true);

// Contractor with < MIN_CATEGORY_WINS in a category — near_ceiling should not fire
const ncTooFew = buildNearCeilingDataset(3, 200); // only 3 contractor wins
const ncTooFewResult = analyzeContractors(ncTooFew).find(s => s.winnerBusinessId === 'NC_TEST');
// Not included at all (< MIN_WINS=5)
expect('contractor < MIN_WINS → excluded entirely', ncTooFewResult, undefined);

// ── analyzeContractors — single_agency_lock statistical flag ──────────────────

console.log('\n── single_agency_lock (statistical) ────────────────────────────────');

// Build dataset where all contractors spread wins across agencies (low baseline)
// then one contractor concentrates all wins at one agency
function buildAgencyLockDataset(): ContractRow[] {
  // 20 market contractors each with 10 wins spread across 5 agencies (20% concentration)
  const market: ContractRow[] = [];
  for (let c = 0; c < 20; c++) {
    for (let w = 0; w < 10; w++) {
      market.push(row(`contractor_${c}`, `agency_${w % 5}`, 5, 'construction', `MKT_${c}`));
    }
  }
  // Target contractor: 10/10 wins at one agency
  const locked = repeat(row('บริษัท ล็อคหน่วยงาน จำกัด', 'กรมทางหลวง', 5, 'construction', 'LOCKED'), 10);
  return [...market, ...locked];
}

const alResult = analyzeContractors(buildAgencyLockDataset()).find(s => s.winnerBusinessId === 'LOCKED');
expectTrue('100% agency concentration vs ~20% market baseline → flagged', alResult?.flags.single_agency_lock ?? false);
expectTrue('single_agency_lock_p populated', alResult?.single_agency_lock_p !== null);

// Contractor with same concentration as market → should NOT fire
function buildNormalAgencyDataset(): ContractRow[] {
  const all: ContractRow[] = [];
  for (let c = 0; c < 20; c++) {
    for (let w = 0; w < 10; w++) {
      all.push(row(`contractor_${c}`, `agency_${w % 5}`, 5, 'construction', `MKT_${c}`));
    }
  }
  // Target: 2/10 at one agency (same ~20% as market)
  for (let w = 0; w < 10; w++) {
    all.push(row('บริษัท ปกติหน่วยงาน จำกัด', `agency_${w % 5}`, 5, 'construction', 'NORMAL_AGENCY'));
  }
  return all;
}

const alNormal = analyzeContractors(buildNormalAgencyDataset()).find(s => s.winnerBusinessId === 'NORMAL_AGENCY');
expectFalse('contractor at market agency concentration → NOT flagged', alNormal?.flags.single_agency_lock ?? true);

// ── analyzeContractors — discount edge cases ──────────────────────────────────

console.log('\n── discount edge cases ──────────────────────────────────────────────');

const nullDiscount = repeat(row('บริษัท ไม่มีส่วนลด จำกัด', 'กรมทางหลวง', null), 5);
const rnull = analyzeContractors(nullDiscount)[0];
expect('all null discounts → near_ceiling_rate 0', rnull?.near_ceiling_rate, 0);
expectFalse('all null discounts → near_ceiling FALSE', rnull?.flags.near_ceiling ?? true);

const negDiscount = repeat(row('บริษัท เกินราคา จำกัด', 'กรมทางหลวง', -1), 5);
expect('negative discount filtered → near_ceiling_rate 0', analyzeContractors(negDiscount)[0]?.near_ceiling_rate, 0);

const over100 = repeat(row('บริษัท ผิดปกติ จำกัด', 'กรมทางหลวง', 101), 5);
expect('discount > 100 filtered → near_ceiling_rate 0', analyzeContractors(over100)[0]?.near_ceiling_rate, 0);

// ── analyzeContractors — metadata fields ──────────────────────────────────────

console.log('\n── metadata fields ──────────────────────────────────────────────────');

const fyRows = [
  row('บริษัท ปีงบ จำกัด', 'กรมทางหลวง', 5, 'construction', null, 1_000_000, 2566),
  row('บริษัท ปีงบ จำกัด', 'กรมทางหลวง', 5, 'construction', null, 1_000_000, 2567),
  row('บริษัท ปีงบ จำกัด', 'กรมทางหลวง', 5, 'construction', null, 1_000_000, 2567),
  row('บริษัท ปีงบ จำกัด', 'กรมทางหลวง', 5, 'construction', null, 1_000_000, 2566),
  row('บริษัท ปีงบ จำกัด', 'กรมทางหลวง', 5, 'construction', null, 1_000_000, 2568),
];
expect('fiscal_years deduplicated and sorted', analyzeContractors(fyRows)[0]?.fiscal_years, [2566, 2567, 2568]);

const valueRows = [
  row('บริษัท มูลค่า จำกัด', 'กรมทางหลวง', 0, 'construction', null, 1_000_000),
  row('บริษัท มูลค่า จำกัด', 'กรมทางหลวง', 0, 'construction', null, 2_500_000),
  row('บริษัท มูลค่า จำกัด', 'กรมทางหลวง', 0, 'construction', null, null),
  row('บริษัท มูลค่า จำกัด', 'กรมทางหลวง', 0, 'construction', null, 500_000),
  row('บริษัท มูลค่า จำกัด', 'กรมทางหลวง', 0, 'construction', null, 0),
];
expect('null referencePrice treated as 0 in sum', analyzeContractors(valueRows)[0]?.total_value_thb, 4_000_000);

const manyAgencies = Array.from({ length: 15 }, (_, i) =>
  row('บริษัท หลายหน่วยงาน จำกัด', `หน่วยงาน ${i + 1}`, 5)
);
expect('agencies list capped at 10', analyzeContractors(manyAgencies)[0]?.agencies.length, 10);

// ── analyzeContractors — high_volume removed ──────────────────────────────────

console.log('\n── high_volume removed ──────────────────────────────────────────────');

const hv50 = repeat(row('บริษัท ปริมาณมาก จำกัด', 'กรมทางหลวง', 5), 50);
const hv50result = analyzeContractors(hv50)[0];
expectFalse('flags object no longer has high_volume key', 'high_volume' in (hv50result?.flags ?? {}));

// ── analyzeContractors — sort order ──────────────────────────────────────────

console.log('\n── sort order ───────────────────────────────────────────────────────');

// Build a clear dataset: one 2-flag contractor and one 0-flag contractor
// 2-flag: locked to one agency AND near-ceiling vs large market
function buildSortTestDataset(): ContractRow[] {
  // Market: large baseline with moderate discounts
  const market = Array.from({ length: 200 }, (_, i) =>
    row(`market_${i}`, `agency_${i % 10}`, 5 + (i % 10), 'construction', `MKT_SORT_${i}`)
  );
  // 2-flag contractor: near-ceiling + all at one agency
  const highFlag = Array.from({ length: 20 }, () =>
    row('บริษัท สองธง จำกัด', 'กรมทางหลวง', 0.1, 'construction', 'HIGH_FLAG')
  );
  // 0-flag contractor: moderate discount, spread agencies
  const noFlag = Array.from({ length: 10 }, (_, i) =>
    row('บริษัท ไม่มีธง จำกัด', `agency_${i % 5}`, 6, 'construction', 'NO_FLAG')
  );
  return [...market, ...highFlag, ...noFlag];
}

const sortResult = analyzeContractors(buildSortTestDataset());
const highFlagResult = sortResult.find(s => s.winnerBusinessId === 'HIGH_FLAG');
const noFlagResult = sortResult.find(s => s.winnerBusinessId === 'NO_FLAG');
expectTrue('2-flag contractor appears before 0-flag in sort',
  sortResult.indexOf(highFlagResult!) < sortResult.indexOf(noFlagResult!));

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
