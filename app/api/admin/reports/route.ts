import { NextRequest, NextResponse } from 'next/server';
import { restGetCollectionPage, restSetDocument } from '@/lib/firestore-rest';
import type { CommunityReport, CommunityReportStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

// 60s in-memory cache — admin dashboard doesn't need sub-minute freshness
let reportsCache: { docs: CommunityReport[]; expiresAt: number } | null = null;

const VALID_STATUSES: CommunityReportStatus[] = [
  'new', 'reviewing', 'verified', 'published', 'dismissed',
];

function isAuthorized(req: NextRequest): boolean {
  // Client sends the Firebase Auth user email in X-Admin-Email.
  // Server checks it against ADMIN_EMAIL env var (comma-separated for multiple admins).
  // This is MVP-level security: Firebase Auth gate on the client + email check here.
  const adminEmails = (process.env.ADMIN_EMAIL ?? '').split(',').map((e) => e.trim().toLowerCase());
  if (adminEmails.length === 0 || adminEmails[0] === '') return false;
  const reqEmail = (req.headers.get('x-admin-email') ?? '').toLowerCase();
  return adminEmails.includes(reqEmail);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const type   = url.searchParams.get('type') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;

  try {
    const now = Date.now();
    let allDocs: CommunityReport[];
    if (reportsCache && now < reportsCache.expiresAt) {
      allDocs = reportsCache.docs;
    } else {
      const { docs } = await restGetCollectionPage<CommunityReport>('community_reports', 200);
      allDocs = docs;
      reportsCache = { docs, expiresAt: now + 60_000 };
    }

    let filtered = allDocs;
    if (type)   filtered = filtered.filter((r) => r.report_type === type);
    if (status) filtered = filtered.filter((r) => r.status === status);

    // Sort newest first
    filtered.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return NextResponse.json(filtered);
  } catch (err) {
    console.error('[admin/reports] GET error:', err);
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { report_id, status, internal_notes } = await req.json() as {
      report_id: string;
      status?: CommunityReportStatus;
      internal_notes?: string;
    };

    if (!report_id) {
      return NextResponse.json({ error: 'report_id required' }, { status: 400 });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const update: Record<string, unknown> = { report_id };
    if (status)         update.status = status;
    if (internal_notes !== undefined) update.internal_notes = String(internal_notes).slice(0, 2000);

    await restSetDocument('community_reports', report_id, update);
    reportsCache = null; // invalidate so next GET reflects the update
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/reports] PATCH error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
