import { NextResponse } from 'next/server';
import { restGetDocument } from '@/lib/firestore-rest';
import type { ContributorStats } from '@/lib/types';

export const dynamic = 'force-dynamic';

// In-memory cache — 1 hour TTL. Stats display doesn't need to be perfectly fresh.
let cache: { data: ContributorStats; expiresAt: number } | null = null;

const DEFAULT_STATS: ContributorStats = {
  outcome_reports: 0,
  community_reports: 0,
  agencies_improved: 0,
  anomalies_verified: 0,
  last_updated: '',
};

export async function GET() {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    return NextResponse.json(cache.data);
  }

  try {
    const stats = await restGetDocument<ContributorStats>('_meta', 'contributor_stats');
    const data = stats ?? DEFAULT_STATS;
    cache = { data, expiresAt: now + 60 * 60 * 1000 };
    return NextResponse.json(data);
  } catch (err) {
    console.error('[contributor-stats] read failed:', err);
    return NextResponse.json(DEFAULT_STATS);
  }
}
