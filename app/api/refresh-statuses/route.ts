import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Status refresh runs in GitHub Actions (Playwright requires Node.js, not Cloudflare Workers).
// POST with Authorization: Bearer <SCRAPE_SECRET> to signal a completed status refresh.
// Cache is in-memory per Worker instance (6h TTL) — instances refresh naturally on next request.
export async function GET() {
  return NextResponse.json(
    { error: 'Status refresh is handled by GitHub Actions.' },
    { status: 405 },
  );
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.SCRAPE_SECRET}`;
  if (!process.env.SCRAPE_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
