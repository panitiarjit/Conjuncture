/**
 * Stress test for contractor flagging logic.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/test-contractor-flags.ts
 * No Firestore needed — pure unit tests on the analysis functions.
 */

// ── Inline the logic under test (no imports from analyze-contractors.ts) ──────

interface ContractRow {
  winnerName: string | null;
  winnerBusinessId: string | null;
  agency: string;
  referencePrice: number | null;
  discountFromReference: number | null;
  fiscalYear: number;
}

interface ContractorSignal {
  winnerName: string;
  winnerBusinessId: string | null;
  win_count: number;
  total_value_thb: number;
  fiscal_years: number[];
  agencies: { agency: string; count: number }[];
  top_agency: string;
  top_agency_pct: number;
  median_discount: number;
  near_ceiling_rate: number;
  flags: { single_agency_lock: boolean; near_ceiling: boolean; high_volume: boolean };
  flag_count: number;
  computed_at: string;
}

const MIN_WINS = 5;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

const DATE_ARTIFACT = /^\d{1,2}\s\S+\s\d{2}$/;

function analyzeContractors(rows: ContractRow[]): ContractorSignal[] {
  const groups = new Map<string, ContractRow[]>();

  for (const row of rows) {
    if (!row.winnerName) continue;
    if (DATE_ARTIFACT.test(row.winnerName.trim())) continue;
    const key = row.winnerBusinessId ?? row.winnerName.trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const results: ContractorSignal[] = [];

  for (const [, contracts] of groups) {
    if (contracts.length < MIN_WINS) continue;

    const winnerName = contracts[0].winnerName!;
    const winnerBusinessId = contracts[0].winnerBusinessId ?? null;

    const agencyCounts = new Map<string, number>();
    for (const c of contracts) {
      agencyCounts.set(c.agency, (agencyCounts.get(c.agency) ?? 0) + 1);
    }
    const agenciesSorted = [...agencyCounts.entries()]
      .map(([agency, count]) => ({ agency, count }))
      .sort((a, b) => b.count - a.count);

    const topAgency = agenciesSorted[0].agency;
    const topAgencyPct = Math.round((agenciesSorted[0].count / contracts.length) * 100);

    const discounts = contracts
      .map(c => c.discountFromReference)
      .filter((d): d is number => d !== null && d >= 0 && d <= 100);

    const medianDiscount = Math.round(median(discounts) * 100) / 100;
    const nearCeilingCount = discounts.filter(d => d < 0.5).length;
    const nearCeilingRate = discounts.length > 0
      ? Math.round((nearCeilingCount / discounts.length) * 100)
      : 0;

    const totalValue = contracts.reduce((sum, c) => sum + (c.referencePrice ?? 0), 0);
    const fiscalYears = [...new Set(contracts.map(c => c.fiscalYear))].sort();

    const flags = {
      single_agency_lock: topAgencyPct >= 70,
      near_ceiling:       nearCeilingRate >= 60,
      high_volume:        contracts.length >= 50,
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
      flags,
      flag_count: flagCount,
      computed_at: new Date().toISOString(),
    });
  }

  return results.sort((a, b) => b.flag_count - a.flag_count || b.win_count - a.win_count);
}

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

function expectTrue(label: string, value: boolean) {
  expect(label, value, true);
}

function row(
  name: string | null,
  agency: string,
  discount: number | null,
  businessId: string | null = null,
  referencePrice: number | null = 1_000_000,
  fiscalYear = 2567,
): ContractRow {
  return { winnerName: name, winnerBusinessId: businessId, agency, referencePrice, discountFromReference: discount, fiscalYear };
}

function repeat(r: ContractRow, n: number): ContractRow[] {
  return Array(n).fill(r);
}

// ── median() ─────────────────────────────────────────────────────────────────

console.log('\n── median() ─────────────────────────────────────────────────────────');
expect('empty array returns 0', median([]), 0);
expect('single value', median([5]), 5);
expect('two values average', median([2, 4]), 3);
expect('odd count picks middle', median([1, 3, 9]), 3);
expect('even count averages middle pair', median([1, 2, 3, 4]), 2.5);
expect('unsorted input handled', median([9, 1, 5, 3]), 4);
expect('all same value', median([3, 3, 3]), 3);
expect('fractional values', median([0.1, 0.2, 0.3, 0.4]), 0.25);

// ── date artifact filter ──────────────────────────────────────────────────────

console.log('\n── date artifact filter ─────────────────────────────────────────────');
const dateRows = [
  row('31 ธ.ค. 70', 'กรมชลประทาน', 0),
  row('1 ม.ค. 68', 'กรมชลประทาน', 0),
  row('15 ก.พ. 67', 'กรมชลประทาน', 0),
  row('5 มิ.ย. 66', 'กรมชลประทาน', 0),
  row('28 ส.ค. 65', 'กรมชลประทาน', 0),
];
// None should appear — all are date artifacts; repeating 5x to pass MIN_WINS
const dateResult = analyzeContractors([...dateRows, ...dateRows, ...dateRows, ...dateRows, ...dateRows]);
expect('date artifacts produce 0 contractors', dateResult.length, 0);

// Valid name that looks almost like a date but isn't
const almostDate = repeat(row('31 ธ.ค.', 'กรมชลประทาน', 0), 5);
const almostDateResult = analyzeContractors(almostDate);
expect('non-matching pattern not filtered (no trailing year)', almostDateResult.length, 1);

// ── null winnerName filtered ──────────────────────────────────────────────────

console.log('\n── null/empty winnerName ────────────────────────────────────────────');
const nullRows = repeat(row(null, 'กรมชลประทาน', 0), 5);
expect('null winnerName → 0 contractors', analyzeContractors(nullRows).length, 0);

// ── MIN_WINS threshold ────────────────────────────────────────────────────────

console.log('\n── MIN_WINS threshold ───────────────────────────────────────────────');
const below = repeat(row('บริษัท ทดสอบ จำกัด', 'กรมชลประทาน', 0), MIN_WINS - 1);
expect(`${MIN_WINS - 1} wins → excluded`, analyzeContractors(below).length, 0);

const exact = repeat(row('บริษัท ทดสอบ จำกัด', 'กรมชลประทาน', 0), MIN_WINS);
expect(`${MIN_WINS} wins → included`, analyzeContractors(exact).length, 1);

// ── grouping: winnerBusinessId as primary key ─────────────────────────────────

console.log('\n── winnerBusinessId grouping ────────────────────────────────────────');
// Same businessId, two different names (name changed over time)
const sameId = [
  ...repeat(row('บริษัท เก่า จำกัด', 'กรมชลประทาน', 0, '1234567890123'), 3),
  ...repeat(row('บริษัท ใหม่ จำกัด', 'กรมชลประทาน', 0, '1234567890123'), 3),
];
const sameIdResult = analyzeContractors(sameId);
expect('same businessId merges despite different names → 1 contractor', sameIdResult.length, 1);
expect('win_count is sum of both groups', sameIdResult[0]?.win_count, 6);

// Two different businessIds should remain separate
const diffId = [
  ...repeat(row('บริษัท A จำกัด', 'กรมชลประทาน', 0, 'ID_AAA'), 5),
  ...repeat(row('บริษัท B จำกัด', 'กรมชลประทาน', 0, 'ID_BBB'), 5),
];
expect('different businessIds stay separate → 2 contractors', analyzeContractors(diffId).length, 2);

// null businessId falls back to name
const noId = [
  ...repeat(row('บริษัท ก จำกัด', 'กรมชลประทาน', 0, null), 5),
  ...repeat(row('บริษัท ข จำกัด', 'กรมชลประทาน', 0, null), 5),
];
expect('null businessId groups by name → 2 contractors', analyzeContractors(noId).length, 2);

// ── single_agency_lock flag ───────────────────────────────────────────────────

console.log('\n── single_agency_lock ───────────────────────────────────────────────');

// Exactly 70% threshold (7 of 10)
const agency70 = [
  ...repeat(row('หจก. ทดสอบ', 'กรมชลประทาน', 5), 7),
  ...repeat(row('หจก. ทดสอบ', 'กรมทางหลวง', 5), 3),
];
const r70 = analyzeContractors(agency70)[0];
expect('70% at one agency → single_agency_lock TRUE', r70?.flags.single_agency_lock, true);
expect('top_agency_pct = 70', r70?.top_agency_pct, 70);

// 69% — just below threshold (6 of 10 + 4 others → 60%, try 7 of 11 = 63%)
// Use 6 of 10 = 60%
const agency60 = [
  ...repeat(row('หจก. ทดสอบ', 'กรมชลประทาน', 5), 6),
  ...repeat(row('หจก. ทดสอบ', 'กรมทางหลวง', 5), 4),
];
const r60 = analyzeContractors(agency60)[0];
expect('60% at one agency → single_agency_lock FALSE', r60?.flags.single_agency_lock, false);

// 100% concentration
const agency100 = repeat(row('หจก. ทดสอบ 100', 'กรมชลประทาน', 5), 10);
const r100 = analyzeContractors(agency100)[0];
expect('100% at one agency → single_agency_lock TRUE', r100?.flags.single_agency_lock, true);

// ── near_ceiling flag ─────────────────────────────────────────────────────────

console.log('\n── near_ceiling ─────────────────────────────────────────────────────');

// 60% at < 0.5pp discount (threshold = 60)
const nc60 = [
  ...repeat(row('บริษัท ราคาสูง จำกัด', 'กรมทางหลวง', 0.0), 6),   // near ceiling
  ...repeat(row('บริษัท ราคาสูง จำกัด', 'กรมทางหลวง', 5.0), 4),   // not near ceiling
];
const rnc60 = analyzeContractors(nc60)[0];
expect('60% near-ceiling → near_ceiling TRUE', rnc60?.flags.near_ceiling, true);
expect('near_ceiling_rate = 60', rnc60?.near_ceiling_rate, 60);

// 59% (5 of 10 near + 1 more not near)
// Actually 5 of 10 = 50% not enough; 6 of 10 = 60% exact is the threshold; let's test 59 = 5.9 of 10 → impossible integer, test 5 of 9 = 55%
const nc55 = [
  ...repeat(row('บริษัท ราคาสูง 2 จำกัด', 'กรมทางหลวง', 0.0), 5),
  ...repeat(row('บริษัท ราคาสูง 2 จำกัด', 'กรมทางหลวง', 5.0), 4),
];
const rnc55 = analyzeContractors(nc55)[0];
expect('55% near-ceiling → near_ceiling FALSE', rnc55?.flags.near_ceiling, false);

// Exactly 0.5 discount — boundary: 0.5 is NOT near ceiling (filter is d < 0.5)
const boundary = repeat(row('บริษัท ขอบเขต จำกัด', 'กรมทางหลวง', 0.5), 10);
const rboundary = analyzeContractors(boundary)[0];
expect('0.5pp discount is NOT near-ceiling (strict less-than)', rboundary?.near_ceiling_rate, 0);
expect('0.5pp → near_ceiling FALSE', rboundary?.flags.near_ceiling, false);

// 0.49 is near ceiling
const justBelow = repeat(row('บริษัท ใกล้เพดาน จำกัด', 'กรมทางหลวง', 0.49), 10);
const rjb = analyzeContractors(justBelow)[0];
expect('0.49pp → near_ceiling_rate 100', rjb?.near_ceiling_rate, 100);
expect('0.49pp → near_ceiling TRUE', rjb?.flags.near_ceiling, true);

// ── null/invalid discount filtering ──────────────────────────────────────────

console.log('\n── discount edge cases ──────────────────────────────────────────────');

// Null discounts: should not count as near-ceiling, nearCeilingRate should be 0
const nullDiscount = repeat(row('บริษัท ไม่มีส่วนลด จำกัด', 'กรมทางหลวง', null), 5);
const rnull = analyzeContractors(nullDiscount)[0];
expect('all null discounts → near_ceiling_rate 0', rnull?.near_ceiling_rate, 0);
expect('all null discounts → near_ceiling FALSE', rnull?.flags.near_ceiling, false);

// Negative discount (anomaly — bid above reference): filtered out (d >= 0 check)
const negDiscount = repeat(row('บริษัท เกินราคา จำกัด', 'กรมทางหลวง', -1), 5);
const rneg = analyzeContractors(negDiscount)[0];
expect('negative discount filtered out → near_ceiling_rate 0', rneg?.near_ceiling_rate, 0);

// Discount > 100: filtered out
const over100 = repeat(row('บริษัท ผิดปกติ จำกัด', 'กรมทางหลวง', 101), 5);
const rover = analyzeContractors(over100)[0];
expect('discount > 100 filtered out → near_ceiling_rate 0', rover?.near_ceiling_rate, 0);

// Mixed: valid 0 + null + negative + >100 — only the 0s count
const mixed = [
  ...repeat(row('บริษัท ผสม จำกัด', 'กรมทางหลวง', 0), 3),
  ...repeat(row('บริษัท ผสม จำกัด', 'กรมทางหลวง', null), 2),
  ...repeat(row('บริษัท ผสม จำกัด', 'กรมทางหลวง', -5), 2),
  ...repeat(row('บริษัท ผสม จำกัด', 'กรมทางหลวง', 150), 2),
  ...repeat(row('บริษัท ผสม จำกัด', 'กรมทางหลวง', 5), 5),
];
// valid discounts: 3×0 + 5×5 = 8 valid; 3 near ceiling → 3/8 = 37.5 → rounds to 38
const rmixed = analyzeContractors(mixed)[0];
expect('mixed null/invalid discounts: only valid ones counted', rmixed?.near_ceiling_rate, 38);

// ── high_volume flag ──────────────────────────────────────────────────────────

console.log('\n── high_volume ──────────────────────────────────────────────────────');
const hv49 = repeat(row('บริษัท ปริมาณน้อย จำกัด', 'กรมทางหลวง', 5), 49);
expect('49 wins → high_volume FALSE', analyzeContractors(hv49)[0]?.flags.high_volume, false);

const hv50 = repeat(row('บริษัท ปริมาณมาก จำกัด', 'กรมทางหลวง', 5), 50);
expect('50 wins → high_volume TRUE', analyzeContractors(hv50)[0]?.flags.high_volume, true);

// ── flag_count ────────────────────────────────────────────────────────────────

console.log('\n── flag_count aggregation ───────────────────────────────────────────');

// All 3 flags
const allFlags = repeat(row('บริษัท ทุกธง จำกัด', 'กรมทางหลวง', 0), 50);
const rAll = analyzeContractors(allFlags)[0];
expect('all 3 flags active → flag_count 3', rAll?.flag_count, 3);

// No flags: spread across agencies, moderate discount, low volume
const noFlags = [
  ...repeat(row('บริษัท ไม่มีธง จำกัด', 'กรมชลประทาน', 5), 2),
  ...repeat(row('บริษัท ไม่มีธง จำกัด', 'กรมทางหลวง', 5), 2),
  row('บริษัท ไม่มีธง จำกัด', 'กรมพัฒนาที่ดิน', 5),
];
const rNone = analyzeContractors(noFlags)[0];
expect('no flags → flag_count 0', rNone?.flag_count, 0);

// ── total_value_thb ───────────────────────────────────────────────────────────

console.log('\n── total_value_thb ──────────────────────────────────────────────────');
const valueRows = [
  row('บริษัท มูลค่า จำกัด', 'กรมทางหลวง', 0, null, 1_000_000),
  row('บริษัท มูลค่า จำกัด', 'กรมทางหลวง', 0, null, 2_500_000),
  row('บริษัท มูลค่า จำกัด', 'กรมทางหลวง', 0, null, null),
  row('บริษัท มูลค่า จำกัด', 'กรมทางหลวง', 0, null, 500_000),
  row('บริษัท มูลค่า จำกัด', 'กรมทางหลวง', 0, null, 0),
];
const rval = analyzeContractors(valueRows)[0];
expect('null referencePrice treated as 0 in sum', rval?.total_value_thb, 4_000_000);

// ── fiscal_years deduplication ────────────────────────────────────────────────

console.log('\n── fiscal_years ─────────────────────────────────────────────────────');
const fyRows = [
  row('บริษัท ปีงบ จำกัด', 'กรมทางหลวง', 0, null, 1_000_000, 2566),
  row('บริษัท ปีงบ จำกัด', 'กรมทางหลวง', 0, null, 1_000_000, 2567),
  row('บริษัท ปีงบ จำกัด', 'กรมทางหลวง', 0, null, 1_000_000, 2567),
  row('บริษัท ปีงบ จำกัด', 'กรมทางหลวง', 0, null, 1_000_000, 2566),
  row('บริษัท ปีงบ จำกัด', 'กรมทางหลวง', 0, null, 1_000_000, 2568),
];
const rfy = analyzeContractors(fyRows)[0];
expect('fiscal_years deduplicated and sorted', rfy?.fiscal_years, [2566, 2567, 2568]);

// ── agencies list capped at 10 ────────────────────────────────────────────────

console.log('\n── agencies list ────────────────────────────────────────────────────');
const manyAgencies = Array.from({ length: 15 }, (_, i) =>
  row('บริษัท หลายหน่วยงาน จำกัด', `หน่วยงาน ${i + 1}`, 5),
);
const rma = analyzeContractors(manyAgencies)[0];
expect('agencies list capped at 10 even with 15 agencies', rma?.agencies.length, 10);

// ── sort order: flag_count desc, then win_count desc ─────────────────────────

console.log('\n── sort order ───────────────────────────────────────────────────────');
const sortRows = [
  // 3 flags, 10 wins
  ...repeat(row('บริษัท ทุกธง จำกัด', 'กรมทางหลวง', 0), 50),
  // 1 flag (near_ceiling only), 20 wins, spread agencies
  ...repeat(row('บริษัท ธงเดียว จำกัด', 'กรมทางหลวง', 0, 'ID_B'), 3),
  ...repeat(row('บริษัท ธงเดียว จำกัด', 'กรมชลประทาน', 0, 'ID_B'), 3),
  ...repeat(row('บริษัท ธงเดียว จำกัด', 'กรมพัฒนาที่ดิน', 0, 'ID_B'), 3),
  ...repeat(row('บริษัท ธงเดียว จำกัด', 'กรมศิลปากร', 0, 'ID_B'), 3),
  ...repeat(row('บริษัท ธงเดียว จำกัด', 'กรมธนารักษ์', 0, 'ID_B'), 3),
  ...repeat(row('บริษัท ธงเดียว จำกัด', 'กรมสรรพากร', 0, 'ID_B'), 5),
  // 0 flags, 5 wins
  ...repeat(row('บริษัท ไม่มีธง จำกัด', 'กรมชลประทาน', 5, 'ID_C'), 2),
  ...repeat(row('บริษัท ไม่มีธง จำกัด', 'กรมทางหลวง', 5, 'ID_C'), 2),
  row('บริษัท ไม่มีธง จำกัด', 'กรมพัฒนาที่ดิน', 5, 'ID_C'),
];
const sorted = analyzeContractors(sortRows);
expect('sorted: most flags first', sorted[0]?.winnerName, 'บริษัท ทุกธง จำกัด');
expect('sorted: 0-flag contractor last', sorted[sorted.length - 1]?.winnerName, 'บริษัท ไม่มีธง จำกัด');

// ── median discount rounding ──────────────────────────────────────────────────

console.log('\n── median_discount rounding ─────────────────────────────────────────');
const roundingRows = repeat(row('บริษัท ปัดเศษ จำกัด', 'กรมทางหลวง', 3.456), 5);
const rround = analyzeContractors(roundingRows)[0];
expect('median_discount rounded to 2 decimal places', rround?.median_discount, 3.46);

// ── top_agency_pct rounding ───────────────────────────────────────────────────

console.log('\n── top_agency_pct rounding ──────────────────────────────────────────');
// 4 of 6 = 66.67% → rounds to 67
const pctRound = [
  ...repeat(row('หจก. ปัดเศษหน่วยงาน', 'กรมชลประทาน', 5), 4),
  ...repeat(row('หจก. ปัดเศษหน่วยงาน', 'กรมทางหลวง', 5), 2),
];
const rpct = analyzeContractors(pctRound)[0];
expect('4/6 = 66.67% rounds to 67', rpct?.top_agency_pct, 67);
// 67 < 70 → no lock
expect('67% → single_agency_lock FALSE', rpct?.flags.single_agency_lock, false);

// 7 of 10 = 70% exactly → lock
const pct70 = [
  ...repeat(row('หจก. เจ็ดในสิบ', 'กรมชลประทาน', 5), 7),
  ...repeat(row('หจก. เจ็ดในสิบ', 'กรมทางหลวง', 5), 3),
];
const r7in10 = analyzeContractors(pct70)[0];
expect('7/10 = 70% → single_agency_lock TRUE', r7in10?.flags.single_agency_lock, true);

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
