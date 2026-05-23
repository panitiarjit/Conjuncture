#!/usr/bin/env ts-node
/**
 * Checks the Firestore 'unknown_method_ids' collection for newly discovered
 * e-GP procurement method codes and patches lib/procurement.ts:METHOD_ID_MAP.
 *
 * Run at the start of a session (or anytime) to auto-apply known codes:
 *   npx ts-node scripts/sync-method-ids.ts
 *   npx ts-node scripts/sync-method-ids.ts --dry   # show changes only, no file writes
 *
 * Thai e-GP methodId reference (Comptroller-General's Dept, stable across agencies):
 *   '15' = วิธีคัดเลือก         (selection — price comparison, mid-tier)
 *   '16' = ประกวดราคาอิเล็กทรอนิกส์ (e-bidding — confirmed live 2026-05-24)
 *   '17' = ตลาดอิเล็กทรอนิกส์   (e-market — electronic market, mid-tier)
 *   '18' = ประกวดราคา           (traditional sealed-bid, pre-electronic)
 *   '19' = วิธีเฉพาะเจาะจง      (specific/direct award — confirmed live 2026-05-24)
 *   '20' = งานพัสดุ             (in-house supplies, usually internal)
 *
 * Codes marked UNCONFIRMED have not been observed in live API data.
 * They will be applied by this script only when seen in Firestore.
 * If a new code doesn't appear in KNOWN_CODES, it is printed for manual review.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { getUnknownMethodIds } from '../lib/firestore-admin';
import type { ProcurementMethod } from '../lib/procurement';

const isDry = process.argv.includes('--dry');

// ─── Known Thai e-GP method codes ──────────────────────────────────────────────
// Confirmed = seen in live API data. Unconfirmed = from public documentation only.

interface KnownCode {
  method: ProcurementMethod;
  thaiName: string;
  confirmed: boolean;
}

const KNOWN_CODES: Record<string, KnownCode> = {
  '15': { method: 'specific_compare', thaiName: 'วิธีคัดเลือก', confirmed: false },
  '17': { method: 'specific_compare', thaiName: 'ตลาดอิเล็กทรอนิกส์', confirmed: false },
  '18': { method: 'e_bidding',        thaiName: 'ประกวดราคา', confirmed: false },
  '20': { method: 'specific_simple',  thaiName: 'งานพัสดุ', confirmed: false },
  // '16' and '19' are already in METHOD_ID_MAP — skip them
};

// ─── Read current METHOD_ID_MAP entries ────────────────────────────────────────

const PROCUREMENT_PATH = path.join(__dirname, '../lib/procurement.ts');
const procurementSrc = fs.readFileSync(PROCUREMENT_PATH, 'utf8');

function currentMapEntries(): Set<string> {
  const match = procurementSrc.match(/const METHOD_ID_MAP[^{]*\{([^}]+)\}/s);
  if (!match) return new Set();
  const entries = [...match[1].matchAll(/'(\d+)':/g)];
  return new Set(entries.map((m) => m[1]));
}

// ─── Patch procurement.ts ──────────────────────────────────────────────────────

function patchMethodIdMap(toAdd: Array<{ id: string; known: KnownCode }>): void {
  // Insert new lines just before the closing brace of METHOD_ID_MAP
  const lines = toAdd
    .map(({ id, known }) => `  '${id}': '${known.method}', // ${known.thaiName}${known.confirmed ? '' : ' — auto-classified, verify'}`)
    .join('\n');

  const patched = procurementSrc.replace(
    /^(const METHOD_ID_MAP[^{]*\{[^}]+)(};)/ms,
    (_, body, closing) => `${body}${lines}\n${closing}`,
  );

  if (patched === procurementSrc) {
    console.error('[sync-method-ids] Could not locate METHOD_ID_MAP closing brace — no changes made.');
    return;
  }

  fs.writeFileSync(PROCUREMENT_PATH, patched, 'utf8');
  console.log(`[sync-method-ids] Patched lib/procurement.ts with ${toAdd.length} new entry/entries.`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('[sync-method-ids] Reading unknown_method_ids from Firestore...');
  const unknowns = await getUnknownMethodIds();

  if (unknowns.length === 0) {
    console.log('[sync-method-ids] No unknown methodIds in Firestore. Nothing to do.');
    process.exit(0);
  }

  console.log(`[sync-method-ids] Found ${unknowns.length} unknown methodId(s):`);
  console.table(unknowns.map((u) => ({ id: u.methodId, count: u.count, sample: u.sampleTitle?.slice(0, 60) })));

  const existing = currentMapEntries();
  const toAdd: Array<{ id: string; known: KnownCode }> = [];
  const needsManual: typeof unknowns = [];

  for (const u of unknowns) {
    if (existing.has(u.methodId)) {
      console.log(`[sync-method-ids] '${u.methodId}' already in METHOD_ID_MAP — skipping.`);
      continue;
    }
    const known = KNOWN_CODES[u.methodId];
    if (known) {
      toAdd.push({ id: u.methodId, known });
    } else {
      needsManual.push(u);
    }
  }

  if (toAdd.length > 0) {
    console.log('\n[sync-method-ids] Will add the following to METHOD_ID_MAP:');
    toAdd.forEach(({ id, known }) =>
      console.log(`  '${id}' → ${known.method} (${known.thaiName})${known.confirmed ? '' : ' [UNCONFIRMED — review after adding]'}`),
    );

    if (isDry) {
      console.log('\n[sync-method-ids] --dry mode: no file written.');
    } else {
      patchMethodIdMap(toAdd);
    }
  } else {
    console.log('[sync-method-ids] No auto-classifiable codes found.');
  }

  if (needsManual.length > 0) {
    console.log('\n[sync-method-ids] The following methodIds need manual classification:');
    console.table(
      needsManual.map((u) => ({
        methodId: u.methodId,
        count: u.count,
        sampleFlowName: u.sampleFlowName ?? '—',
        sampleTitle: u.sampleTitle?.slice(0, 50) ?? '—',
      })),
    );
    console.log(
      "  → Look up each methodId on the e-GP portal, then add it to KNOWN_CODES in this script\n" +
      "    and to METHOD_ID_MAP in lib/procurement.ts.",
    );
  }

  process.exit(0);
})().catch((err) => {
  console.error('[sync-method-ids] fatal:', err);
  process.exit(1);
});
