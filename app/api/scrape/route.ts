import { NextRequest, NextResponse } from 'next/server';
import { runScrape } from '../../../lib/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.SCRAPE_SECRET}`;
  if (!process.env.SCRAPE_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let overrides: Record<string, unknown> = {};
  try {
    overrides = (await req.json().catch(() => ({}))) ?? {};
  } catch {
    // No body — use defaults.
  }

  try {
    const result = await runScrape(overrides);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[scrape route] failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
