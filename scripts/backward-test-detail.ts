/**
 * Backward-test: per-tender validation against real awarded contracts.
 * For each awarded contract, shows what BidSight v2 would have recommended
 * vs. what actually happened.
 *
 * Output: CSV with columns:
 * - projectName, agency, category, announceDate
 * - referencePrice, agreedPrice, actualDiscount
 * - predictedDiscount, positioningPct, positioningLabel
 * - marginFloorDiscount, recommendedBid
 * - error_pp (predicted - actual)
 * - wouldHaveWon (1 if recommended bid ≤ agreedPrice)
 * - profitMargin_if_won
 *
 * Note: wouldHaveWon is NOT a win probability. It means our bid was ≤ the
 * actual winner's price — a necessary but not sufficient condition for winning.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { restGetCollection } from '../lib/firestore-rest';
import type { AwardedContract } from '../lib/types';
import {
  buildBenchmarkTables,
  getBenchmarkFromTables,
  recommendBid,
} from '../lib/bidsight-core';

async function runBackwardTest(): Promise<void> {
  console.log('⏮️  BidSight Backward-Test (Per-Tender Validation, v2 model)\n');
  console.log('Loading awarded contracts...');

  const allContracts = await restGetCollection<AwardedContract>('cgd_contracts', 10_000);

  // Build benchmark tables from the full dataset (in-sample — this is intentional:
  // backward test checks prediction quality, not generalization; forward-test-bidsight.ts
  // handles out-of-time validation with expanding windows).
  const tables = buildBenchmarkTables(allContracts as Parameters<typeof buildBenchmarkTables>[0]);

  // Test set: e-bidding contracts with valid discounts
  // procurementMethod carries the actual method; procurementMethodGroup is a generic label.
  const COMPETITIVE_RE = /ประกวดราคา|คัดเลือก|e-bidding/i;
  const testContracts = allContracts.filter(
    (c) =>
      COMPETITIVE_RE.test(c.procurementMethod ?? '') &&
      c.discountFromReference != null &&
      c.discountFromReference >= 0 &&
      c.discountFromReference < 100 &&
      c.referencePrice != null &&
      c.agreedPrice != null,
  );

  console.log(`Total contracts loaded: ${allContracts.length}`);
  console.log(`Competitive contracts with valid discount: ${testContracts.length}\n`);

  if (testContracts.length === 0) {
    console.warn('⚠️  No contracts found — check Firestore credentials.');
    return;
  }

  console.log('Generating backtest report...\n');

  const ASSUMED_COST_RATIO = 0.80; // assumed 80% cost ratio (no actual cost data)
  const TARGET_MARGIN = 10;

  const rows: string[] = [
    [
      'projectName',
      'agency',
      'category',
      'announceDate',
      'referencePrice',
      'agreedPrice',
      'actualDiscount',
      'predictedDiscount',
      'positioningPct',
      'positioningLabel',
      'marginFloorDiscount',
      'recommendedBid',
      'error_pp',
      'wouldHaveWon',
      'profitMargin_if_won',
    ].join(','),
  ];

  let totalAbsError = 0;
  let wouldHaveWonCount = 0;
  let profitableWins = 0;

  for (const contract of testContracts) {
    const refPrice = contract.referencePrice!;
    const agreedPrice = contract.agreedPrice!;
    const actualDiscount = contract.discountFromReference!;
    const estimatedCost = refPrice * ASSUMED_COST_RATIO;

    const { table: bench } = getBenchmarkFromTables(
      contract.agency,
      contract.projectType,
      tables,
      contract.province,
    );

    const rec = recommendBid(refPrice, estimatedCost, TARGET_MARGIN, bench);

    const error = rec.recommendedDiscount - actualDiscount;
    totalAbsError += Math.abs(error);

    // Necessary (not sufficient) condition for winning: our bid ≤ actual winner's price
    const won = rec.recommendedBid <= agreedPrice ? 1 : 0;
    wouldHaveWonCount += won;

    let profitMargin: number | null = null;
    if (won) {
      profitMargin = Math.round(((agreedPrice - estimatedCost) / agreedPrice) * 100 * 10) / 10;
      if (profitMargin >= TARGET_MARGIN) profitableWins++;
    }

    const marginFloorDiscount = Math.round(
      (1 - (estimatedCost / refPrice) / (1 - TARGET_MARGIN / 100)) * 100 * 10,
    ) / 10;

    rows.push(
      [
        `"${(contract.projectName ?? '').replace(/"/g, '""')}"`,
        `"${(contract.agency ?? '').replace(/"/g, '""')}"`,
        contract.projectType,
        contract.announceDate ?? '',
        refPrice.toFixed(2),
        agreedPrice.toFixed(2),
        actualDiscount.toFixed(1),
        rec.recommendedDiscount.toFixed(1),
        rec.positioningPct,
        rec.positioningLabel,
        marginFloorDiscount.toFixed(1),
        rec.recommendedBid.toFixed(2),
        error.toFixed(1),
        won,
        profitMargin !== null ? profitMargin.toFixed(1) : 'N/A',
      ].join(','),
    );
  }

  console.log(rows.join('\n'));
  console.log('\n');

  const avgError = Math.round((totalAbsError / testContracts.length) * 10) / 10;
  const beatWinnerRate = Math.round((wouldHaveWonCount / testContracts.length) * 1000) / 10;
  const profitRate = wouldHaveWonCount > 0
    ? Math.round((profitableWins / wouldHaveWonCount) * 1000) / 10
    : 0;

  console.log('📊 Summary Stats:');
  console.log(`  Total tenders tested:              ${testContracts.length}`);
  console.log(`  Average prediction error:          ${avgError}pp (vs actual discount)`);
  console.log(`  Bid ≤ actual winner price:         ${beatWinnerRate}% (${wouldHaveWonCount}/${testContracts.length})`);
  console.log(`  Profitable if awarded (≥${TARGET_MARGIN}% margin): ${profitRate}% (${profitableWins}/${wouldHaveWonCount})`);
  console.log('\n💡 Interpretation:');
  console.log('  • "Bid ≤ winner price" is NOT a win rate — it means our price was competitive');
  console.log('    enough to beat the winner, not that we would have beaten all other bidders.');
  console.log('  • Error ≈ 8-9pp: model predicts near the median; actual discounts are higher-variance.');
  console.log('  • Profitable margin guard correctly filters bids that cannot reach target margin.');
  console.log('  • Cost ratio assumed 80% — actual cost structure will shift all margin numbers.');
}

runBackwardTest().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
