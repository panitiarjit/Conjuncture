/**
 * Contractor signal analysis.
 *
 * Reads cgd_contracts, groups by winner, computes concentration and pricing
 * signals, and writes flagged contractors to the contractor_intel collection.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/analyze-contractors.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/analyze-contractors.ts --limit 50000
 *   npx ts-node --project tsconfig.scripts.json scripts/analyze-contractors.ts --dry-run
 *
 * Reads in 500-doc pages up to --limit (default 20k). Firestore cost = limit reads + contractor writes.
 * Do not schedule — run manually when you want to refresh contractor_intel.
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.indexOf('--limit');
const LIMIT = limitArg !== -1 ? Number(args[limitArg + 1]) : 20_000;
const MIN_WINS = 5;

// ── Firebase ──────────────────────────────────────────────────────────────────

function initFirebase() {
  if (admin.apps.length) return admin.app();
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey,
    }),
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContractRow {
  winnerName: string | null;
  winnerBusinessId: string | null;
  agency: string;
  referencePrice: number | null;
  discountFromReference: number | null;
  fiscalYear: number;
}

import type { ContractorSignal } from '../lib/contractor-intel-types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function slugify(name: string): string {
  return name.trim().replace(/\s+/g, '_').replace(/[^฀-๿a-zA-Z0-9_]/g, '').slice(0, 80);
}

// ── Analysis ──────────────────────────────────────────────────────────────────

function analyzeContractors(rows: ContractRow[]): ContractorSignal[] {
  // Group by winnerBusinessId when available, else winnerName
  const groups = new Map<string, ContractRow[]>();

  // Same date-artifact filter as agency-intel route: "31 ธ.ค. 70" etc stored as winnerName
  const dateArtifact = /^\d{1,2}\s\S+\s\d{2}$/;

  for (const row of rows) {
    if (!row.winnerName) continue;
    if (dateArtifact.test(row.winnerName.trim())) continue;
    const key = row.winnerBusinessId ?? row.winnerName.trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const results: ContractorSignal[] = [];

  for (const [key, contracts] of groups) {
    if (contracts.length < MIN_WINS) continue;

    const winnerName = contracts[0].winnerName!;
    const winnerBusinessId = contracts[0].winnerBusinessId ?? null;

    // Agency concentration
    const agencyCounts = new Map<string, number>();
    for (const c of contracts) {
      agencyCounts.set(c.agency, (agencyCounts.get(c.agency) ?? 0) + 1);
    }
    const agenciesSorted = [...agencyCounts.entries()]
      .map(([agency, count]) => ({ agency, count }))
      .sort((a, b) => b.count - a.count);

    const topAgency = agenciesSorted[0].agency;
    const topAgencyPct = Math.round((agenciesSorted[0].count / contracts.length) * 100);

    // Discount distribution
    const discounts = contracts
      .map(c => c.discountFromReference)
      .filter((d): d is number => d !== null && d >= 0 && d <= 100);

    const medianDiscount = Math.round(median(discounts) * 100) / 100;
    const nearCeilingCount = discounts.filter(d => d < 0.5).length;
    const nearCeilingRate = discounts.length > 0
      ? Math.round((nearCeilingCount / discounts.length) * 100)
      : 0;

    // Value
    const totalValue = contracts.reduce((sum, c) => sum + (c.referencePrice ?? 0), 0);

    // Fiscal years
    const fiscalYears = [...new Set(contracts.map(c => c.fiscalYear))].sort();

    // Flags
    const flags = {
      single_agency_lock: topAgencyPct >= 70,
      near_ceiling:       nearCeilingRate >= 60,
      high_volume:        contracts.length >= 50,
    };
    const flagCount = Object.values(flags).filter(Boolean).length;

    results.push({
      winnerName,
      winnerBusinessId,
      win_count: contracts.length,
      total_value_thb: Math.round(totalValue),
      fiscal_years: fiscalYears,
      agencies: agenciesSorted.slice(0, 10),
      top_agency: topAgency,
      top_agency_pct: topAgencyPct,
      median_discount: medianDiscount,
      near_ceiling_rate: nearCeilingRate,
      flags,
      flag_count: flagCount,
      computed_at: new Date().toISOString(),
    });
  }

  return results.sort((a, b) => b.flag_count - a.flag_count || b.win_count - a.win_count);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function readContracts(db: admin.firestore.Firestore, limit: number): Promise<ContractRow[]> {
  const PAGE_SIZE = 500;
  const all: ContractRow[] = [];
  let last: admin.firestore.QueryDocumentSnapshot | null = null;

  const base = db.collection('cgd_contracts')
    .select('winnerName', 'winnerBusinessId', 'agency', 'referencePrice', 'discountFromReference', 'fiscalYear');

  do {
    const remaining = limit - all.length;
    const q = last
      ? base.startAfter(last).limit(Math.min(PAGE_SIZE, remaining))
      : base.limit(Math.min(PAGE_SIZE, remaining));
    const snap = await q.get();
    all.push(...snap.docs.map(d => d.data() as ContractRow));
    last = snap.docs[snap.docs.length - 1] ?? null;
    process.stdout.write(`\r  ${all.length.toLocaleString()} / ${limit.toLocaleString()} contracts read...`);
    if (snap.docs.length < PAGE_SIZE || all.length >= limit) break;
  } while (true);

  process.stdout.write('\n');
  return all;
}

async function main() {
  initFirebase();
  const db = admin.firestore();

  console.log(`Reading up to ${LIMIT.toLocaleString()} contracts from cgd_contracts (500/page)...`);
  const rows = await readContracts(db, LIMIT);
  const withWinner = rows.filter(r => r.winnerName);
  console.log(`  ${rows.length.toLocaleString()} contracts read, ${withWinner.length.toLocaleString()} have a winner`);

  const signals = analyzeContractors(rows);
  const flagged = signals.filter(s => s.flag_count > 0);
  console.log(`\n${signals.length} contractors with ≥${MIN_WINS} wins`);
  console.log(`${flagged.length} with at least one flag\n`);

  // Print top 20
  console.log('── Top flagged contractors ──────────────────────────────');
  for (const s of flagged.slice(0, 20)) {
    const flagNames = [
      s.flags.single_agency_lock ? 'SINGLE_AGENCY' : null,
      s.flags.near_ceiling       ? 'NEAR_CEILING'  : null,
      s.flags.high_volume        ? 'HIGH_VOLUME'   : null,
    ].filter(Boolean).join(' ');
    console.log(`${s.winnerName}`);
    console.log(`  wins=${s.win_count}  top_agency=${s.top_agency} (${s.top_agency_pct}%)  median_discount=${s.median_discount}%  near_ceiling=${s.near_ceiling_rate}%`);
    console.log(`  FLAGS: ${flagNames}`);
    console.log();
  }

  if (DRY_RUN) {
    console.log('[dry-run] Skipping Firestore writes.');
    return;
  }

  // Write to contractor_intel (batch writes, 500 per batch)
  console.log(`Writing ${signals.length} contractors to contractor_intel...`);
  const BATCH_SIZE = 400;
  for (let i = 0; i < signals.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = signals.slice(i, i + BATCH_SIZE);
    for (const s of chunk) {
      const docId = s.winnerBusinessId ?? slugify(s.winnerName);
      const ref = db.collection('contractor_intel').doc(docId);
      batch.set(ref, s as unknown as Record<string, unknown>, { merge: true });
    }
    await batch.commit();
    console.log(`  wrote ${Math.min(i + BATCH_SIZE, signals.length)} / ${signals.length}`);
  }

  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
