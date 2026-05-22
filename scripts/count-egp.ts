/**
 * Fetches page 1 of the e-GP announcement search for a given date range
 * and prints the total record count from the API envelope.
 * Usage: ts-node --project tsconfig.scripts.json scripts/count-egp.ts [--days N]
 */
import { getTurnstileToken, validateTurnstileToken, searchAnnouncements } from '../lib/scraper/egp-client';
import { DEFAULT_CONFIG } from '../lib/scraper/types';

const args = process.argv.slice(2);
const daysIdx = args.indexOf('--days');
const days = daysIdx !== -1 ? parseInt(args[daysIdx + 1], 10) : 30;

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

(async () => {
  const config = DEFAULT_CONFIG;
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - days);
  const announceSDate = isoDate(from);
  const announceEDate = isoDate(today);

  console.log(`Date range: ${announceSDate} → ${announceEDate} (${days} days)`);

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'th-TH' });
  const page = await context.newPage();

  try {
    await page.goto(config.cfPageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    let csrfToken = '';
    const deadline = Date.now() + config.angularInitMs;
    while (Date.now() < deadline) {
      csrfToken = await page.evaluate(() => sessionStorage.getItem('csrf') ?? '');
      if (csrfToken) break;
      await new Promise<void>((r) => setTimeout(r, 1000));
    }
    if (!csrfToken) throw new Error('CSRF token not found');

    const rawToken = await getTurnstileToken(config);
    const announcementToken = await validateTurnstileToken(page, rawToken);

    const resp = await searchAnnouncements(page, config, {
      announceSDate,
      announceEDate,
      page: 1,
      announcementToken,
      csrfToken,
    });

    const envelope = resp.data;
    console.log('\n── API envelope ──────────────────────────────');
    console.log('recordsTotal:    ', envelope?.recordsTotal);
    console.log('recordsFiltered: ', envelope?.recordsFiltered);
    console.log('totoalElments:   ', envelope?.totoalElments);
    console.log('totalPages:      ', envelope?.totalPages);
    console.log('rows on page 1:  ', envelope?.data?.length ?? 0);
    console.log('──────────────────────────────────────────────');

    const total = envelope?.totoalElments ?? envelope?.recordsTotal ?? envelope?.recordsFiltered;
    if (total) {
      const perDay = Math.ceil(total / days);
      const daysNeeded = Math.ceil(total / 10); // pages × 10 rows each
      console.log(`\nTotal tenders in ${days} days: ${total}`);
      console.log(`≈ ${perDay} tenders/day`);
      console.log(`Pages needed to fetch all: ${daysNeeded} pages (${daysNeeded * 10} rows)`);
      console.log(`At 1.2s/page: ${Math.round(daysNeeded * 1.2 / 60)} min to scrape all`);
    }
  } finally {
    await browser.close();
  }
})();
