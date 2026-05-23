import { getTurnstileToken, validateTurnstileToken, searchAnnouncements } from './egp-client';
import { mapToTender, dateFromProjectId } from './egp-mapper';
import { getTendersFromFirestore, upsertTender, recordUnknownMethodId } from '../firestore-admin';
import { getMethodFromId } from '../procurement';
import type { ScrapeConfig, ScrapeResult } from './types';
import { DEFAULT_CONFIG } from './types';

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function runScrape(overrides: Partial<ScrapeConfig> = {}): Promise<ScrapeResult> {
  const config: ScrapeConfig = { ...DEFAULT_CONFIG, ...overrides };
  const start = Date.now();
  const result: ScrapeResult = { scraped: 0, inserted: 0, updated: 0, errors: 0, durationMs: 0 };

  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - config.dateFromDaysAgo);
  const isDryRun = process.env.DRY_RUN === 'true';
  // Collected during dry runs to build the methodId → ProcurementMethod mapping
  const methodIdsSeen = new Map<string, number>(); // methodId → count
  // Track unknown methodIds written to Firestore this run (avoid N writes for same ID)
  const unknownMethodIdsRecorded = new Set<string>();
  let rawSampleLogged = false;

  const announceSDate = isoDate(from);
  const announceEDate = isoDate(today);
  console.log(`[egp-scraper] date range: ${announceSDate} → ${announceEDate}`);

  // Playwright must be dynamically imported so it doesn't break Cloudflare Workers bundle
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'th-TH' });
  const page = await context.newPage();

  try {
    console.log('[egp-scraper] navigating to announcement page (Angular init + WAF session)...');
    await page.goto(config.cfPageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Poll for CSRF token — Angular sets it async; give up to angularInitMs
    let csrfToken = '';
    const deadline = Date.now() + config.angularInitMs;
    while (Date.now() < deadline) {
      csrfToken = await page.evaluate(() => sessionStorage.getItem('csrf') ?? '');
      if (csrfToken) break;
      await sleep(1000);
    }
    if (!csrfToken) {
      throw new Error('Angular CSRF token not found in sessionStorage after waiting — page may not have loaded correctly');
    }
    console.log('[egp-scraper] CSRF token obtained');

    console.log('[egp-scraper] requesting Turnstile token from CapSolver...');
    const rawTurnstileToken = await getTurnstileToken(config);
    console.log('[egp-scraper] validating Turnstile token with e-GP server...');
    const announcementToken = await validateTurnstileToken(page, rawTurnstileToken);
    console.log('[egp-scraper] announcement token obtained');

    let pageNum = 1;
    let consecutiveKnownPages = 0;

    while (pageNum <= config.maxPages) {
      const resp = await searchAnnouncements(page, config, {
        announceSDate,
        announceEDate,
        page: pageNum,
        announcementToken,
        csrfToken,
      });

      if (resp.validateCfTurnTile === false) {
        console.error('[egp-scraper] server rejected announcement token — stopping');
        break;
      }

      const rows = resp.data?.data ?? [];
      if (rows.length === 0) break;

      let pageNewCount = 0;
      for (const raw of rows) {
        result.scraped++;
        // Collect methodId frequency and dump full raw fields once per dry run
        if (isDryRun) {
          if (raw.methodId) methodIdsSeen.set(raw.methodId, (methodIdsSeen.get(raw.methodId) ?? 0) + 1);
          if (!rawSampleLogged) {
            console.log('[egp-scraper] [DRY] Full raw fields of first record (check for deadline/method fields):');
            console.log(JSON.stringify(raw, null, 2));
            rawSampleLogged = true;
          }
        }
        try {
          const tender = mapToTender(raw);
          if (isDryRun) {
            pageNewCount++;
            result.inserted++;
            console.log(`[egp-scraper] [DRY] would upsert: ${tender.id} — ${tender.title.slice(0, 60)}`);
          } else {
            // In refresh mode, skip tenders not in the filter set (don't insert new records)
            if (config.idFilter && !config.idFilter.has(tender.id)) {
              continue;
            }
            const { wasNew } = await upsertTender(tender);
            if (wasNew) { result.inserted++; pageNewCount++; }
            else result.updated++;
            // Record methodIds not yet in METHOD_ID_MAP so they can be classified later
            if (tender.methodId && getMethodFromId(tender.methodId) === null
                && !unknownMethodIdsRecorded.has(tender.methodId)) {
              unknownMethodIdsRecorded.add(tender.methodId);
              recordUnknownMethodId(tender.methodId, tender.title, raw.flowName ?? undefined)
                .catch((err) => console.warn(`[egp-scraper] recordUnknownMethodId failed: ${err}`));
            }
          }
        } catch (err) {
          result.errors++;
          console.error(`[egp-scraper] error on project ${raw.projectId}:`, err);
        }
      }

      console.log(`[egp-scraper] page ${pageNum}: rows=${rows.length} new=${pageNewCount}`);

      if (rows.length < 10) break;

      // Stop when 2 consecutive pages are entirely known records — we've reached
      // the overlap with the previous run; everything deeper is already in Firestore
      if (pageNewCount === 0) {
        consecutiveKnownPages++;
        if (consecutiveKnownPages >= 2) {
          console.log('[egp-scraper] 2 consecutive all-known pages — reached overlap, stopping early');
          break;
        }
      } else {
        consecutiveKnownPages = 0;
      }

      pageNum++;
      await sleep(config.rateLimitMs);
    }
  } finally {
    await browser.close();
  }

  if (isDryRun && methodIdsSeen.size > 0) {
    console.log('\n[egp-scraper] [DRY] methodId values seen (copy these to build the mapping):');
    console.table([...methodIdsSeen.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ methodId: id, count })));
  }

  result.durationMs = Date.now() - start;
  console.log('[egp-scraper] done:', result);
  return result;
}

/**
 * Re-check the status of all currently open/unknown tenders already in Firestore.
 * Reads their project IDs, derives the announcement date range they span,
 * re-scrapes only that window, and updates only tenders already in the set.
 * New tenders discovered along the way are skipped.
 */
export async function runStatusRefresh(overrides: Partial<ScrapeConfig> = {}): Promise<ScrapeResult> {
  const allTenders = await getTendersFromFirestore(2000);
  const toRefresh = allTenders.filter((t) => t.status === 'open' || t.status === 'unknown');

  if (toRefresh.length === 0) {
    console.log('[egp-scraper] runStatusRefresh: no open/unknown tenders to refresh');
    return { scraped: 0, inserted: 0, updated: 0, errors: 0, durationMs: 0 };
  }

  const idFilter = new Set(toRefresh.map((t) => t.id));

  const dates = toRefresh
    .map((t) => dateFromProjectId(t.id))
    .filter((d): d is string => d !== null)
    .sort();

  const daysAgo =
    dates.length > 0
      ? Math.ceil((Date.now() - new Date(dates[0]).getTime()) / 86_400_000) + 2
      : 90;

  console.log(`[egp-scraper] runStatusRefresh: ${toRefresh.length} tenders, ${daysAgo} days back`);
  return runScrape({ ...overrides, dateFromDaysAgo: daysAgo, idFilter });
}
