import { NextRequest, NextResponse } from 'next/server';
import { restAddDocument, restGetDocument, restSetDocument } from '@/lib/firestore-rest';
import type { BidOutcome, BidOutcomeType, ContributorStats } from '@/lib/types';
export const dynamic = 'force-dynamic';

const VALID_OUTCOMES: BidOutcomeType[] = ['won', 'lost', 'no_bid', 'pending'];
const NO_BID_REASONS = ['too_competitive', 'margin_too_low', 'spec_issues', 'other'];

function generateId(): string {
  return `bo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function incrementOutcomeCount() {
  try {
    const existing = await restGetDocument<ContributorStats>('_meta', 'contributor_stats');
    const current = existing ?? {
      outcome_reports: 0, community_reports: 0,
      agencies_improved: 0, anomalies_verified: 0, last_updated: '',
    };
    await restSetDocument('_meta', 'contributor_stats', {
      ...current,
      outcome_reports: (current.outcome_reports ?? 0) + 1,
      last_updated: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
  } catch (err) {
    console.error('[bid-outcome] stats increment failed:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<BidOutcome> & { submitter_email?: string };

    if (!body.outcome_type || !VALID_OUTCOMES.includes(body.outcome_type)) {
      return NextResponse.json({ error: 'Invalid outcome_type' }, { status: 400 });
    }

    const outcome_id = generateId();
    const doc: Omit<BidOutcome, 'id'> = {
      outcome_id,
      session_id:       String(body.session_id ?? '').slice(0, 64),
      timestamp:        new Date().toISOString(),
      outcome_type:     body.outcome_type,
      project_type:     body.project_type ? String(body.project_type).slice(0, 100) : undefined,
      agency:           body.agency ? String(body.agency).slice(0, 150) : undefined,
      submitted_price:  body.submitted_price != null ? Math.max(0, Number(body.submitted_price)) : undefined,
      winner_price:     body.winner_price != null ? Math.max(0, Number(body.winner_price)) : undefined,
      competitor_count: body.competitor_count != null ? Math.max(0, Math.floor(Number(body.competitor_count))) : undefined,
      no_bid_reason:    body.no_bid_reason && NO_BID_REASONS.includes(body.no_bid_reason)
                          ? body.no_bid_reason : undefined,
      verified:         false,
      source:           body.source ?? 'simulator_prompt',
    };

    await restAddDocument('bid_outcomes', doc as unknown as Record<string, unknown>);

    // Increment stats counter in background
    incrementOutcomeCount().catch(() => {});

    return NextResponse.json({ ok: true, outcome_id });
  } catch (err) {
    console.error('[bid-outcome] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
