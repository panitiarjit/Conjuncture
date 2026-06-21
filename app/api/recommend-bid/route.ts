import { NextRequest, NextResponse } from 'next/server';
import { recommendBid } from '@/lib/bidsight-core';

/**
 * POST /api/recommend-bid
 *
 * Request body:
 * {
 *   "refPriceM": number,       // Reference price (millions)
 *   "costM": number,           // Estimated cost (millions)
 *   "targetMarginPct": number, // Target margin % (default 10)
 *   "targetWinProbPct": number // Target win prob % (default 60, informational)
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
    const { refPriceM, costM, targetMarginPct = 10, targetWinProbPct = 60 } = body;

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

    const recommendation = recommendBid(refPriceM, costM, targetMarginPct, targetWinProbPct);

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error('Error in /api/recommend-bid:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommend-bid?refPriceM=10&costM=8.2&targetMarginPct=10
 * Query params version for easy browser testing.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const refPriceM = parseFloat(searchParams.get('refPriceM') || '0');
    const costM = parseFloat(searchParams.get('costM') || '0');
    const targetMarginPct = parseFloat(searchParams.get('targetMarginPct') || '10');
    const targetWinProbPct = parseFloat(searchParams.get('targetWinProbPct') || '60');

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

    const recommendation = recommendBid(refPriceM, costM, targetMarginPct, targetWinProbPct);

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error('Error in /api/recommend-bid GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
