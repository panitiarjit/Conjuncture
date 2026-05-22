import { NextResponse } from 'next/server';
import { getTenders } from '@/lib/data-service';

export async function GET() {
  return NextResponse.json(await getTenders());
}
