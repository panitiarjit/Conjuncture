import { getTurnstileToken, validateTurnstileToken, searchAnnouncements } from './egp-client';
import { mapToTender } from './egp-mapper';
import { upsertTender, pruneExpiredTenders } from '../firestore-admin';
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
        try {
          const tender = mapToTender(raw);
          if (process.env.DRY_RUN === 'true') {
            pageNewCount++;
            result.inserted++;
            console.log(`[egp-scraper] [DRY] would upsert: ${tender.id} — ${tender.title.slice(0, 60)}`);
          } else {
            const { wasNew } = await upsertTender(tender);
            if (wasNew) { result.inserted++; pageNewCount++; }
            else result.updated++;
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

  if (process.env.DRY_RUN !== 'true') {
    const pruned = await pruneExpiredTenders();
    if (pruned > 0) console.log(`[egp-scraper] pruned ${pruned} expired tenders`);
  }

  result.durationMs = Date.now() - start;
  console.log('[egp-scraper] done:', result);
  return result;
}
