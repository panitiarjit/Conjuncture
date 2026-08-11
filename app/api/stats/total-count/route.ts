import { NextResponse } from 'next/server';
import { getTotalContractCount } from '@/lib/data-service';

export const dynamic = 'force-dynamic';

// Combined live count across cgd_contracts (awarded contracts) + tenders
// (e-GP central) + soe_tenders (BMA/MEA/PEA/PWA/EGAT/MRTA/PTT). Cached 24h
// server-side in data-service.ts — this route just exposes it to client
// components, which can't import server-only Firestore code directly.
export async function GET() {
  const total = await getTotalContractCount();
  return NextResponse.json({ total });
}
