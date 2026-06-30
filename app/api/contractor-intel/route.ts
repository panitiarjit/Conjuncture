import { NextRequest, NextResponse } from 'next/server';
import { getContractorIntel, getFlaggedContractors } from '@/lib/data-service';

export const dynamic = 'force-dynamic';

// GET /api/contractor-intel?name=ไทยเจริญ         → single contractor lookup
// GET /api/contractor-intel?flagged=1&min_flags=1  → all flagged contractors
export async function GET(req: NextRequest) {
  const name      = req.nextUrl.searchParams.get('name')?.trim();
  const flagged   = req.nextUrl.searchParams.get('flagged');
  const minFlags  = Number(req.nextUrl.searchParams.get('min_flags') ?? '1');

  if (flagged) {
    const results = await getFlaggedContractors(minFlags);
    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'private, max-age=3600' },
    });
  }

  if (!name) {
    return NextResponse.json({ error: 'name or flagged param required' }, { status: 400 });
  }

  const result = await getContractorIntel(name);
  if (!result) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, max-age=3600' },
  });
}
