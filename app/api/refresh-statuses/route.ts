import { NextRequest, NextResponse } from 'next/server';
import { runStatusRefresh } from '../../../lib/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Called daily by Vercel Cron (GET with Authorization: Bearer <CRON_SECRET>).
// Can also be triggered manually via POST with Authorization: Bearer <SCRAPE_SECRET>.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runStatusRefresh();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[refresh-statuses route] failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.SCRAPE_SECRET}`;
  if (!process.env.SCRAPE_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runStatusRefresh();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[refresh-statuses route] failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
