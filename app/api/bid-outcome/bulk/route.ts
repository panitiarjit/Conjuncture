import { NextRequest, NextResponse } from 'next/server';
import { restAddDocument, restGetDocument, restSetDocument } from '@/lib/firestore-rest';
import type { BidOutcome, BidOutcomeType, ContributorStats } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_OUTCOMES: BidOutcomeType[] = ['won', 'lost', 'no_bid', 'pending'];

interface CsvRow {
  outcome_type: string;
  agency?: string;
  project_type?: string;
  submitted_price?: string;
  winner_price?: string;
  competitor_count?: string;
  no_bid_reason?: string;
}

function parseRow(row: CsvRow, idx: number): { doc: Omit<BidOutcome, 'id'> | null; error?: string } {
  const outcome_type = row.outcome_type?.trim().toLowerCase() as BidOutcomeType;
  if (!VALID_OUTCOMES.includes(outcome_type)) {
    return { doc: null, error: `Row ${idx + 1}: invalid outcome_type "${row.outcome_type}"` };
  }

  const doc: Omit<BidOutcome, 'id'> = {
    outcome_id:      `bulk_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    session_id:      '',
    timestamp:       new Date().toISOString(),
    outcome_type,
    agency:          row.agency?.trim().slice(0, 150) || undefined,
    project_type:    row.project_type?.trim().slice(0, 100) || undefined,
    submitted_price: row.submitted_price ? Math.max(0, parseFloat(row.submitted_price)) : undefined,
    winner_price:    row.winner_price ? Math.max(0, parseFloat(row.winner_price)) : undefined,
    competitor_count: row.competitor_count ? Math.max(0, parseInt(row.competitor_count, 10)) : undefined,
    no_bid_reason:   row.no_bid_reason?.trim() || undefined,
    verified:        false,
    source:          'bulk_import',
  };

  return { doc };
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row as unknown as CsvRow;
  });
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found' }, { status: 400 });
    }
    if (rows.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 rows per import' }, { status: 400 });
    }

    const docs: Omit<BidOutcome, 'id'>[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const { doc, error } = parseRow(rows[i], i);
      if (error) errors.push(error);
      else if (doc) docs.push(doc);
    }

    // Write valid rows
    await Promise.all(
      docs.map((doc) =>
        restAddDocument('bid_outcomes', doc as unknown as Record<string, unknown>),
      ),
    );

    // Update stats counter
    if (docs.length > 0) {
      try {
        const existing = await restGetDocument<ContributorStats>('_meta', 'contributor_stats');
        const current = existing ?? { outcome_reports: 0, community_reports: 0, agencies_improved: 0, anomalies_verified: 0, last_updated: '' };
        await restSetDocument('_meta', 'contributor_stats', {
          ...current,
          outcome_reports: (current.outcome_reports ?? 0) + docs.length,
          last_updated: new Date().toISOString(),
        } as unknown as Record<string, unknown>);
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      imported: docs.length,
      skipped: errors.length,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error('[bid-outcome/bulk] error:', err);
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 });
  }
}
