import { NextResponse } from 'next/server';
import { getProjects } from '@/lib/data-service';

export async function GET() {
  return NextResponse.json(await getProjects());
}
