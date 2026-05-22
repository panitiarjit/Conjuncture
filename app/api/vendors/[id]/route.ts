import { NextResponse } from 'next/server';
import { getVendorById } from '@/lib/data-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendor = await getVendorById(id);
  if (!vendor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(vendor);
}
