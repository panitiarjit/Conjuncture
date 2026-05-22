#!/usr/bin/env ts-node
/**
 * Standalone CLI runner for the e-GP scraper.
 *
 * Usage:
 *   npx ts-node scripts/scrape-egp.ts
 *   npx ts-node scripts/scrape-egp.ts --days 7          # pull last 7 days
 *   npx ts-node scripts/scrape-egp.ts --days 1 --dry    # parse only, no Firestore writes
 *
 * Required env vars (copy from Firebase Console → Project Settings → Service Accounts):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

// Load .env.local for local runs
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { runScrape } from '../lib/scraper';

const args = process.argv.slice(2);

function getFlag(flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const daysAgo = parseInt(getFlag('--days', '1'), 10);
const maxPages = parseInt(getFlag('--pages', '50'), 10);
const isDry = args.includes('--dry');

if (isDry) {
  console.warn('[scrape-egp] DRY RUN — Firestore writes are disabled');
  process.env.DRY_RUN = 'true';
}

(async () => {
  try {
    const result = await runScrape({ dateFromDaysAgo: daysAgo, maxPages });
    console.log('\n=== Scrape complete ===');
    console.table(result);
    process.exit(0);
  } catch (err) {
    console.error('[scrape-egp] fatal error:', err);
    process.exit(1);
  }
})();
