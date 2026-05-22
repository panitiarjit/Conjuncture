import { getTurnstileToken, validateTurnstileToken, searchAnnouncements } from './egp-client';
import { mapToTender } from './egp-mapper';
import { upsertTender } from '../firestore-admin';
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
    await sleep(config.angularInitMs);

    const csrfToken = await page.evaluate(() => sessionStorage.getItem('csrf') ?? '');
    if (!csrfToken) {
      throw new Error('Angular CSRF token not found in sessionStorage — page may not have loaded correctly');
    }
    console.log('[egp-scraper] CSRF token obtained');

    console.log('[egp-scraper] requesting Turnstile token from CapSolver...');
    const rawTurnstileToken = await getTurnstileToken(config);
    console.log('[egp-scraper] validating Turnstile token with e-GP server...');
    const announcementToken = await validateTurnstileToken(page, rawTurnstileToken);
    console.log('[egp-scraper] announcement token obtained');

    let pageNum = 1;
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
      console.log(`[egp-scraper] page ${pageNum}: rows=${rows.length}`);
      if (rows.length === 0) break;

      for (const raw of rows) {
        result.scraped++;
        try {
          const tender = mapToTender(raw);
          if (process.env.DRY_RUN === 'true') {
            result.inserted++;
            console.log(`[egp-scraper] [DRY] would upsert: ${tender.id} — ${tender.title.slice(0, 60)}`);
          } else {
            const { wasNew } = await upsertTender(tender);
            if (wasNew) result.inserted++;
            else result.updated++;
          }
        } catch (err) {
          result.errors++;
          console.error(`[egp-scraper] error on project ${raw.projectId}:`, err);
        }
      }

      // API does not return a reliable totalPages — paginate until we get an empty page
      if (rows.length < 10) break;
      pageNum++;
      await sleep(config.rateLimitMs);
    }
  } finally {
    await browser.close();
  }

  result.durationMs = Date.now() - start;
  console.log('[egp-scraper] done:', result);
  return result;
}
