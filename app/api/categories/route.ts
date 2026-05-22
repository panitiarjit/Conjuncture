import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/data-service';

export async function GET() {
  return NextResponse.json(await getCategories());
}
