import { NextResponse } from 'next/server';
import { getTenders } from '@/lib/data-service';

export async function GET() {
  const tenders = await getTenders();
  return NextResponse.json(tenders, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
  });
}
