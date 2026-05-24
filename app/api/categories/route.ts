import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/data-service';

export async function GET() {
  const categories = await getCategories();
  return NextResponse.json(categories, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
  });
}
