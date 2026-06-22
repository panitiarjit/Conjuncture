import { NextRequest, NextResponse } from 'next/server';
import { getContractsForBenchmark } from '@/lib/data-service';
import { recommendBid, buildBenchmarkTables, getBenchmarkFromTables } from '@/lib/bidsight-core';

let cachedTables: ReturnType<typeof buildBenchmarkTables> | null = null;
let cachedTablesExpiry = 0;

async function getBenchmarkTables() {
  const now = Date.now();
  if (cachedTables && now < cachedTablesExpiry) return cachedTables;
  try {
    // Use the field-masked benchmark fetch — same source as benchmark-categories,
    // guaranteed to return all contracts. getAwardedContracts fetches full docs
    // and times out mid-pagination, leaving the category map mostly empty.
    const contracts = await getContractsForBenchmark();
    cachedTables = buildBenchmarkTables(contracts);
    cachedTablesExpiry = now + 60 * 60 * 1000;
    return cachedTables;
  } catch (err) {
    console.warn('[recommend-bid] Failed to build benchmark tables:', err);
    return null;
  }
}

/**
 * POST /api/recommend-bid
 * {
 *   refPriceM: number,         // reference price in millions
 *   costM: number,             // estimated cost in millions
 *   targetMarginPct?: number,  // default 10
 *   agency?: string,
 *   projectType?: string
 * }
 *
 * Response:
 * {
 *   recommendedBid, recommendedDiscount, marketMedianDiscount,
 *   expectedMargin, marginFloorBreached, cannotMeetMargin,
 *   positioningPct, positioningLabel, positioningLabelTh, positioningLabelEn,
 *   band: { p10, p25, median, p75, p90 },
 *   comparableN, scope, fallbackUsed, benchmarkSource, note
 * }
 *
 * NOTE: positioningPct is NOT win probability.
 * It shows where the bid sits vs comparable historical winners.
 * True win probability requires knowing bidder count — unknowable at bid time.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refPriceM, costM, targetMarginPct = 10, agency, projectType } = body;

    if (typeof refPriceM !== 'number' || refPriceM <= 0)
      return NextResponse.json({ error: 'refPriceM must be a positive number' }, { status: 400 });
    if (typeof costM !== 'number' || costM < 0)
      return NextResponse.json({ error: 'costM must be a non-negative number' }, { status: 400 });
    if (typeof targetMarginPct !== 'number' || targetMarginPct < 0 || targetMarginPct > 50)
      return NextResponse.json({ error: 'targetMarginPct must be 0–50' }, { status: 400 });

    const tables = await getBenchmarkTables();
    const benchmark = tables
      ? getBenchmarkFromTables(agency, projectType, tables).table
      : undefined;

    const rec = recommendBid(refPriceM, costM, targetMarginPct, benchmark);
    return NextResponse.json(rec);
  } catch (err) {
    console.error('[recommend-bid POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const refPriceM      = parseFloat(sp.get('refPriceM')      || '0');
    const costM          = parseFloat(sp.get('costM')          || '0');
    const targetMarginPct = parseFloat(sp.get('targetMarginPct') || '10');
    const agency         = sp.get('agency')      || undefined;
    const projectType    = sp.get('projectType') || undefined;

    if (isNaN(refPriceM) || refPriceM <= 0)
      return NextResponse.json({ error: 'refPriceM required and must be positive' }, { status: 400 });
    if (isNaN(costM) || costM < 0)
      return NextResponse.json({ error: 'costM must be non-negative' }, { status: 400 });

    const tables = await getBenchmarkTables();
    const benchmark = tables
      ? getBenchmarkFromTables(agency, projectType, tables).table
      : undefined;

    const rec = recommendBid(refPriceM, costM, targetMarginPct, benchmark);
    return NextResponse.json(rec);
  } catch (err) {
    console.error('[recommend-bid GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
