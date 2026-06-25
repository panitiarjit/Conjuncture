import { NextRequest, NextResponse } from 'next/server';
import { restAddDocument, restGetDocument, restSetDocument } from '@/lib/firestore-rest';
import type { CommunityReport, CommunityReportType, ContributorStats } from '@/lib/types';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const VALID_TYPES: CommunityReportType[] = [
  'suspicious', 'data_error', 'analysis_request', 'bid_outcome',
];
const VALID_ROLES = ['contractor', 'journalist', 'researcher', 'government', 'other'];
const FISCAL_YEARS = ['2561', '2562', '2563', '2564', '2565', '2566', '2567', '2568'];

function generateReportId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CR-${ts}-${rand}`;
}

async function incrementReportCount() {
  try {
    const existing = await restGetDocument<ContributorStats>('_meta', 'contributor_stats');
    const current = existing ?? {
      outcome_reports: 0, community_reports: 0,
      agencies_improved: 0, anomalies_verified: 0, last_updated: '',
    };
    await restSetDocument('_meta', 'contributor_stats', {
      ...current,
      community_reports: (current.community_reports ?? 0) + 1,
      last_updated: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
  } catch (err) {
    console.error('[community-report] stats increment failed:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      report_type: CommunityReportType;
      agency?: string;
      fiscal_year?: string;
      project_ref?: string;
      content: Record<string, unknown>;
      submitter_email?: string;
      submitter_role?: string;
    };

    if (!body.report_type || !VALID_TYPES.includes(body.report_type)) {
      return NextResponse.json({ error: 'Invalid report_type' }, { status: 400 });
    }
    if (!body.content || typeof body.content !== 'object') {
      return NextResponse.json({ error: 'content required' }, { status: 400 });
    }

    const report_id = generateReportId();
    const doc: Omit<CommunityReport, 'id'> = {
      report_id,
      report_type:     body.report_type,
      timestamp:       new Date().toISOString(),
      agency:          body.agency ? String(body.agency).slice(0, 200) : undefined,
      fiscal_year:     body.fiscal_year && FISCAL_YEARS.includes(body.fiscal_year)
                         ? body.fiscal_year : undefined,
      project_ref:     body.project_ref ? String(body.project_ref).slice(0, 200) : undefined,
      content:         sanitizeContent(body.content),
      submitter_email: body.submitter_email && isEmail(body.submitter_email)
                         ? body.submitter_email : undefined,
      submitter_role:  body.submitter_role && VALID_ROLES.includes(body.submitter_role)
                         ? body.submitter_role : undefined,
      status:          'new',
    };

    await restAddDocument('community_reports', doc as unknown as Record<string, unknown>);

    // Increment stats + notify admin in background
    incrementReportCount().catch(() => {});
    notifyAdmin(doc, report_id).catch(() => {});

    return NextResponse.json({ ok: true, report_id });
  } catch (err) {
    console.error('[community-report] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function sanitizeContent(content: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(content)) {
    if (typeof v === 'string') out[k] = v.slice(0, 1000);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

async function notifyAdmin(report: Omit<CommunityReport, 'id'>, reportId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const resend = new Resend(apiKey);
  const typeLabel: Record<CommunityReportType, string> = {
    suspicious: 'พบสัญญาน่าสงสัย',
    data_error: 'ข้อมูลไม่ถูกต้อง',
    analysis_request: 'ขอให้วิเคราะห์',
    bid_outcome: 'รายงานผลประมูล',
  };
  await resend.emails.send({
    from: 'Conjuncture Reports <noreply@conjuncture.work>',
    to: 'panitiarjit@gmail.com',
    subject: `[รายงานใหม่] ${typeLabel[report.report_type]} — ${reportId}`,
    html: `
      <p><strong>ประเภท:</strong> ${typeLabel[report.report_type]}</p>
      <p><strong>ID:</strong> ${reportId}</p>
      ${report.agency ? `<p><strong>หน่วยงาน:</strong> ${report.agency}</p>` : ''}
      ${report.fiscal_year ? `<p><strong>ปีงบประมาณ:</strong> ${report.fiscal_year}</p>` : ''}
      ${report.project_ref ? `<p><strong>โครงการ:</strong> ${report.project_ref}</p>` : ''}
      <p><strong>รายละเอียด:</strong></p>
      <pre>${JSON.stringify(report.content, null, 2)}</pre>
      ${report.submitter_email ? `<p><strong>ติดต่อกลับ:</strong> ${report.submitter_email}</p>` : ''}
      <p><a href="https://conjuncture.work/admin/reports">ดูใน Admin Dashboard →</a></p>
    `,
  });
}
