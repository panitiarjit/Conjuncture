#!/usr/bin/env ts-node
/**
 * Targeted status refresh for already-scraped open/unknown tenders.
 * Reads the current open tenders from Firestore, derives the date range they
 * span, and re-scrapes only that window — skipping new records.
 *
 * Usage:
 *   npx ts-node scripts/refresh-statuses.ts
 *   npx ts-node scripts/refresh-statuses.ts --dry
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { runStatusRefresh } from '../lib/scraper';

const isDry = process.argv.includes('--dry');
if (isDry) {
  process.env.DRY_RUN = 'true';
  console.warn('[refresh-statuses] DRY RUN — Firestore writes are disabled');
}

(async () => {
  try {
    const result = await runStatusRefresh();
    console.log('\n=== Refresh complete ===');
    console.table(result);
    process.exit(0);
  } catch (err) {
    console.error('[refresh-statuses] fatal error:', err);
    process.exit(1);
  }
})();
