import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';

// Status refresh runs in GitHub Actions (Playwright requires Node.js, not Cloudflare Workers).
// POST with Authorization: Bearer <SCRAPE_SECRET> to bust the tenders cache after a refresh.
export async function GET() {
  return NextResponse.json(
    { error: 'Status refresh is handled by GitHub Actions — call POST to revalidate cache after a refresh.' },
    { status: 405 },
  );
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.SCRAPE_SECRET}`;
  if (!process.env.SCRAPE_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  revalidateTag('tenders');
  return NextResponse.json({ ok: true, revalidated: true });
}
