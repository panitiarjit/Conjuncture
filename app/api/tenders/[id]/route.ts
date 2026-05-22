import { NextResponse } from 'next/server';
import { getTenderById } from '@/lib/data-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tender = await getTenderById(id);
  if (!tender) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tender);
}
