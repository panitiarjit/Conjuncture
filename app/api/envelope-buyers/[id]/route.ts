/**
 * Envelope Buyers (ผู้ซื้อซอง/ผู้รับเอกสาร) — P7
 *
 * Returns companies that purchased spec documents for a given e-GP project.
 * Document purchasers are companies considering bidding — early competitor intel.
 *
 * Data source: e-GP portal individual announcement detail page.
 * The bidsight_scraper needs to be extended to fetch this per-tender data and
 * store it in Firestore under tenders/{projectId}.buyers[].
 *
 * Until then, this returns available:false so the UI shows the "data coming" state.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTenderByIdFromFirestore } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

export interface EnvelopeBuyer {
  name: string;
  businessId: string | null;
  purchaseDate: string | null;
}

export interface EnvelopeBuyersResponse {
  projectId: string;
  buyers: EnvelopeBuyer[];
  fetchedAt: string | null;
  available: boolean;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const tender = await getTenderByIdFromFirestore(id);
    // buyers[] will be populated by the scraper when it fetches individual detail pages
    const raw = tender as unknown as Record<string, unknown>;
    const buyers = (raw.buyers as EnvelopeBuyer[] | undefined) ?? [];
    const fetchedAt = (raw.buyersFetchedAt as string | undefined) ?? null;

    return NextResponse.json(
      { projectId: id, buyers, fetchedAt, available: buyers.length > 0 } satisfies EnvelopeBuyersResponse,
      { headers: { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=600' } },
    );
  } catch {
    return NextResponse.json(
      { projectId: id, buyers: [], fetchedAt: null, available: false } satisfies EnvelopeBuyersResponse,
    );
  }
}
