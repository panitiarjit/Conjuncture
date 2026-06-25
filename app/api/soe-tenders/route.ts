import { NextRequest, NextResponse } from 'next/server';
import { getSoeTenders } from '@/lib/data-service';

export async function GET(_req: NextRequest) {
  const tenders = await getSoeTenders();
  return NextResponse.json(tenders, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600' },
  });
}
