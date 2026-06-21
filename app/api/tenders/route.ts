import { NextRequest, NextResponse } from 'next/server';
import { getTenders } from '@/lib/data-service';

export async function GET(req: NextRequest) {
  const cfCache = typeof caches !== 'undefined' ? (caches as any).default : null;
  if (cfCache) {
    try {
      const cached = await cfCache.match(req.url);
      if (cached) return cached;
    } catch { /* cache unavailable, fall through */ }
  }

  const tenders = await getTenders();
  const response = NextResponse.json(tenders, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600' },
  });

  if (cfCache) {
    try {
      await cfCache.put(req.url, response.clone());
    } catch { /* non-critical */ }
  }
  return response;
}
