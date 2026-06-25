import { NextRequest, NextResponse } from 'next/server';
import { restAddDocument } from '@/lib/firestore-rest';
import type { SimulatorInput } from '@/lib/types';

export const dynamic = 'force-dynamic';

const BUDGET_BUCKETS = ['<1M', '1-5M', '5-20M', '20-100M', '>100M'] as const;

function budgetBucket(refPriceM: number): string {
  if (refPriceM < 1) return '<1M';
  if (refPriceM < 5) return '1-5M';
  if (refPriceM < 20) return '5-20M';
  if (refPriceM < 100) return '20-100M';
  return '>100M';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<SimulatorInput> & { refPriceM?: number };

    // Minimal validation — this is passive telemetry, reject silently on bad input
    if (!body.session_id || typeof body.session_id !== 'string') {
      return NextResponse.json({ ok: true }); // silent ignore
    }

    const doc: Omit<SimulatorInput, 'id'> = {
      session_id:           String(body.session_id).slice(0, 64),
      timestamp:            new Date().toISOString(),
      project_type:         String(body.project_type ?? '').slice(0, 100),
      agency_category:      String(body.agency_category ?? '').slice(0, 100),
      budget_bucket:        BUDGET_BUCKETS.includes(body.budget_bucket as typeof BUDGET_BUCKETS[number])
                              ? (body.budget_bucket as string)
                              : budgetBucket(Number(body.refPriceM ?? 0)),
      cost_ratio:           Math.min(100, Math.max(0, Number(body.cost_ratio ?? 0))),
      min_margin:           Math.min(100, Math.max(0, Number(body.min_margin ?? 0))),
      market_position:      Math.min(100, Math.max(0, Number(body.market_position ?? 50))),
      recommended_bid:      Math.max(0, Number(body.recommended_bid ?? 0)),
      recommended_discount: Math.max(0, Number(body.recommended_discount ?? 0)),
    };

    // Fire-and-forget: don't await, respond immediately to avoid adding latency
    restAddDocument('simulator_inputs', doc as unknown as Record<string, unknown>).catch(
      (err) => console.error('[simulator-log] write failed:', err),
    );

    return NextResponse.json({ ok: true });
  } catch {
    // Never surface errors — logging should be invisible
    return NextResponse.json({ ok: true });
  }
}
