import { NextRequest, NextResponse } from 'next/server';
import { getTenders } from '@/lib/data-service';

export async function GET(req: NextRequest) {
  const cfCache = typeof caches !== 'undefined' ? caches.default : null;
  if (cfCache) {
    const cached = await cfCache.match(req.url);
    if (cached) return cached;
  }

  const tenders = await getTenders();
  const response = NextResponse.json(tenders, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600' },
  });

  if (cfCache) await cfCache.put(req.url, response.clone());
  return response;
}
