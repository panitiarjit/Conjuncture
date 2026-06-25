import { NextRequest, NextResponse } from 'next/server';
import { getContractsForBenchmark } from '@/lib/data-service';
import { recommendBid, buildBenchmarkTables, getBenchmarkFromTables, type BidRecommendation, type QuantileTable } from '@/lib/bidsight-core';

let cachedTables: ReturnType<typeof buildBenchmarkTables> | null = null;
let cachedTablesExpiry = 0;

async function getBenchmarkTables() {
  const now = Date.now();
  if (cachedTables && now < cachedTablesExpiry) return cachedTables;
  try {
    const contracts = await getContractsForBenchmark();
    cachedTables = buildBenchmarkTables(contracts);
    cachedTablesExpiry = now + 60 * 60 * 1000;
    return cachedTables;
  } catch (err) {
    console.warn('[recommend-bid] Failed to build benchmark tables:', err);
    return null;
  }
}

function marketIntel(
  _rec: BidRecommendation,
  _fallbackUsed: boolean,
  bench?: QuantileTable,
  catBench?: QuantileTable,
) {
  // medianCI: 95% CI on the median computed in bidsight-core via order statistics.
  // No assumptions — width reflects actual sample uncertainty.
  const medianCI = bench?.medianCI;

  // HHI-derived market concentration. DOJ/FTC thresholds, not arbitrary cutoffs.
  // Prefer category-level bench for concentration (tier tables don't carry HHI).
  const concSource = catBench ?? bench;
  const concentration =
    concSource?.hhi != null
      ? { hhi: concSource.hhi, eNoc: concSource.eNoc ?? 0, n: concSource.marketConcentrationN ?? 0 }
      : undefined;

  // Competition density from CoST bidder data (sparse — present only when --all-bidders was run).
  const competitionDensity =
    concSource?.medianBidderCount != null
      ? { median: concSource.medianBidderCount, n: concSource.bidderCountN ?? 0 }
      : undefined;

  // Q4 seasonal context (July–Sept, budget-burn quarter).
  // Always sourced from category-level bench so it's present even when a tier table was selected.
  const q4Source = catBench ?? bench;
  const seasonal =
    q4Source?.q4Median != null
      ? { q4Median: q4Source.q4Median, q4N: q4Source.q4N ?? 0 }
      : undefined;

  return { medianCI, concentration, competitionDensity, ...(seasonal ? { seasonal } : {}) };
}

/**
 * POST /api/recommend-bid
 * {
 *   refPriceM: number,         // reference price in millions
 *   costM: number,             // estimated cost in millions
 *   targetMarginPct?: number,  // default 10
 *   agency?: string,
 *   projectType?: string,
 *   province?: string          // optional — enables province×category fallback tier
 * }
 *
 * Fallback chain: agency×category → province×category → category → global
 *
 * NOTE: positioningPct is NOT win probability.
 * It shows where the bid sits vs comparable historical winners.
 * True win probability requires knowing bidder count — unknowable at bid time.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refPriceM, costM, targetMarginPct = 10, targetPositionPct = 50, agency, projectType, province } = body;

    if (typeof refPriceM !== 'number' || refPriceM <= 0)
      return NextResponse.json({ error: 'refPriceM must be a positive number' }, { status: 400 });
    if (typeof costM !== 'number' || costM < 0)
      return NextResponse.json({ error: 'costM must be a non-negative number' }, { status: 400 });
    if (typeof targetMarginPct !== 'number' || targetMarginPct < 0 || targetMarginPct > 50)
      return NextResponse.json({ error: 'targetMarginPct must be 0–50' }, { status: 400 });

    const tables = await getBenchmarkTables();
    let benchmarkTable: ReturnType<typeof getBenchmarkFromTables>['table'] | undefined;
    let fallbackUsed = true;
    if (tables) {
      // refPriceM is in millions; tier boundaries are in raw THB — convert for comparison
      const result = getBenchmarkFromTables(agency, projectType, tables, province, refPriceM * 1_000_000);
      benchmarkTable = result.table;
      fallbackUsed   = result.fallbackUsed;
    }
    // Category-level bench for context fields that tier tables don't carry (HHI, Q4)
    const catBench = tables && projectType ? tables.category.get(projectType) : undefined;

    const rec = recommendBid(refPriceM, costM, targetMarginPct, benchmarkTable, targetPositionPct);
    return NextResponse.json({ ...rec, fallbackUsed, ...marketIntel(rec, fallbackUsed, benchmarkTable, catBench) });
  } catch (err) {
    console.error('[recommend-bid POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const refPriceM          = parseFloat(sp.get('refPriceM')          || '0');
    const costM              = parseFloat(sp.get('costM')              || '0');
    const targetMarginPct    = parseFloat(sp.get('targetMarginPct')    || '10');
    const targetPositionPct  = parseFloat(sp.get('targetPositionPct') || '50');
    const agency             = sp.get('agency')      || undefined;
    const projectType        = sp.get('projectType') || undefined;
    const province           = sp.get('province')    || undefined;

    if (isNaN(refPriceM) || refPriceM <= 0)
      return NextResponse.json({ error: 'refPriceM required and must be positive' }, { status: 400 });
    if (isNaN(costM) || costM < 0)
      return NextResponse.json({ error: 'costM must be non-negative' }, { status: 400 });

    const tables = await getBenchmarkTables();
    let benchmarkTable: ReturnType<typeof getBenchmarkFromTables>['table'] | undefined;
    let fallbackUsed = true;
    if (tables) {
      const result = getBenchmarkFromTables(agency, projectType, tables, province, refPriceM * 1_000_000);
      benchmarkTable = result.table;
      fallbackUsed   = result.fallbackUsed;
    }
    const catBench = tables && projectType ? tables.category.get(projectType) : undefined;

    const rec = recommendBid(refPriceM, costM, targetMarginPct, benchmarkTable, targetPositionPct);
    return NextResponse.json({ ...rec, fallbackUsed, ...marketIntel(rec, fallbackUsed, benchmarkTable, catBench) });
  } catch (err) {
    console.error('[recommend-bid GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
