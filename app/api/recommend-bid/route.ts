import { NextRequest, NextResponse } from 'next/server';
import { getAwardedContracts } from '@/lib/data-service';
import { recommendBid, buildBenchmarkTables, getBenchmarkFromTables, type QuantileTable } from '@/lib/bidsight-core';

// Module-level cache for benchmark tables (1 hour TTL)
let cachedTables: ReturnType<typeof buildBenchmarkTables> | null = null;
let cachedTablesExpiry = 0;

async function getBenchmarkTables() {
  const now = Date.now();
  if (cachedTables && now < cachedTablesExpiry) {
    return cachedTables;
  }

  try {
    const contracts = await getAwardedContracts(undefined, 10_000);
    cachedTables = buildBenchmarkTables(contracts);
    cachedTablesExpiry = now + 60 * 60 * 1000; // 1h
    return cachedTables;
  } catch (err) {
    console.warn('[recommend-bid] Failed to build benchmark tables:', err);
    // Return null; caller will fall back to global
    return null;
  }
}

/**
 * POST /api/recommend-bid
 *
 * Request body:
 * {
 *   "refPriceM": number,       // Reference price (millions)
 *   "costM": number,           // Estimated cost (millions)
 *   "targetMarginPct": number, // Target margin % (default 10)
 *   "targetWinProbPct": number, // Informational (default 60)
 *   "agency": string,          // Optional: agency name for category-specific benchmarks
 *   "projectType": string      // Optional: project type/category
 * }
 *
 * Response:
 * {
 *   "recommendedBid": number,
 *   "recommendedDiscount": number,
 *   "marketMedianDiscount": number,
 *   "predictedWinProb": number,
 *   "expectedMargin": number,
 *   "marginFloorBreached": boolean,
 *   "cannotMeetMargin": boolean,
 *   "benchmarkSource": string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      refPriceM,
      costM,
      targetMarginPct = 10,
      targetWinProbPct = 60,
      agency,
      projectType,
    } = body;

    // Validate inputs
    if (typeof refPriceM !== 'number' || refPriceM <= 0) {
      return NextResponse.json(
        { error: 'refPriceM must be a positive number' },
        { status: 400 }
      );
    }
    if (typeof costM !== 'number' || costM < 0) {
      return NextResponse.json(
        { error: 'costM must be a non-negative number' },
        { status: 400 }
      );
    }
    if (typeof targetMarginPct !== 'number' || targetMarginPct < 0 || targetMarginPct > 50) {
      return NextResponse.json(
        { error: 'targetMarginPct must be 0-50' },
        { status: 400 }
      );
    }

    // Get benchmark table (category-specific if available)
    let benchmark: QuantileTable | undefined;
    if (agency || projectType) {
      const tables = await getBenchmarkTables();
      if (tables) {
        benchmark = getBenchmarkFromTables(agency, projectType, tables);
      }
    }

    const recommendation = recommendBid(refPriceM, costM, targetMarginPct, targetWinProbPct, benchmark);

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error('Error in /api/recommend-bid POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommend-bid?refPriceM=10&costM=8.2&targetMarginPct=10&agency=...&projectType=...
 * Query params version for easy browser testing.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const refPriceM = parseFloat(searchParams.get('refPriceM') || '0');
    const costM = parseFloat(searchParams.get('costM') || '0');
    const targetMarginPct = parseFloat(searchParams.get('targetMarginPct') || '10');
    const targetWinProbPct = parseFloat(searchParams.get('targetWinProbPct') || '60');
    const agency = searchParams.get('agency') || undefined;
    const projectType = searchParams.get('projectType') || undefined;

    if (isNaN(refPriceM) || refPriceM <= 0) {
      return NextResponse.json(
        { error: 'refPriceM required and must be positive' },
        { status: 400 }
      );
    }
    if (isNaN(costM) || costM < 0) {
      return NextResponse.json(
        { error: 'costM must be non-negative' },
        { status: 400 }
      );
    }

    // Get benchmark table (category-specific if available)
    let benchmark: QuantileTable | undefined;
    if (agency || projectType) {
      const tables = await getBenchmarkTables();
      if (tables) {
        benchmark = getBenchmarkFromTables(agency, projectType, tables);
      }
    }

    const recommendation = recommendBid(refPriceM, costM, targetMarginPct, targetWinProbPct, benchmark);

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error('Error in /api/recommend-bid GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
