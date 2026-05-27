import { getTurnstileToken, validateTurnstileToken, searchAnnouncements } from './egp-client';
import { mapToTender, dateFromProjectId } from './egp-mapper';
import { getTendersFromFirestore, getOpenOrUnknownTenders, upsertTender, recordUnknownMethodId, forceCloseTenders } from '../firestore-admin';
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

  // playwright-extra + stealth plugin patches fingerprinting vectors (navigator.webdriver,
  // window.chrome, WebGL, canvas, etc.) so Cloudflare auto-completes the Turnstile challenge
  // from within the browser (GitHub Actions IP), bypassing the CapSolver IP-mismatch problem.
  // require() is used instead of dynamic import because playwright-extra's "typings" field
  // is not resolved by ts-node under moduleResolution:node. The scraper only runs in GitHub
  // Actions (never in Cloudflare Workers), so require() here doesn't affect the CF bundle.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { chromium } = require('playwright-extra') as typeof import('playwright');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const StealthPlugin = require('puppeteer-extra-plugin-stealth') as () => unknown;
  (chromium as any).use(StealthPlugin());
  const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      ...(headless ? [] : ['--disable-gpu-sandbox', '--use-gl=swiftshader']),
    ],
  });
const context = await browser.newContext({
  locale: 'th-TH',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
});
  const page = await context.newPage();

  try {
    // Intercept Angular's own Turnstile validation call BEFORE navigating.
    // Angular auto-validates Turnstile on page load from within the browser (GitHub Actions IP).
    // If we capture that token instead of using CapSolver (which solves from CapSolver's IP),
    // the announcement token will be bound to the same IP as the search requests.
    let nativeAnnouncementToken: string | null = null;
    await page.route(/cfturnstile\/validate/, async (route: import('playwright').Route) => {
      console.log('[egp-scraper] intercepted Angular native Turnstile validation call');
      const response = await route.fetch();
      const body = await response.json() as { data?: string };
      console.log(`[egp-scraper] native validate response: data=${body.data ? body.data.slice(0, 30) + '...' : 'null'}`);
      if (body.data) nativeAnnouncementToken = body.data;
      await route.fulfill({ response });
    });

    // No init script needed — Angular uses implicit Turnstile rendering via
    // data-callback HTML attribute (not window.turnstile.render), so Cloudflare
    // calls window[callbackName](token) directly. We read the attribute after
    // Angular bootstraps and call that function with the CapSolver token.

    console.log('[egp-scraper] navigating to announcement page (Angular init + WAF session)...');
    await page.goto(config.cfPageUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    console.log(`[egp-scraper] page loaded: ${page.url()}`);

    // Wait for Angular to bootstrap — JS bundles are hosted in Thailand and can take
    // 60-90s to download from GitHub Actions (US/EU). app-root starts empty and gets
    // children once Angular executes. Without this wait, the CSRF poll burns its entire
    // budget before Angular has even started.
    console.log('[egp-scraper] waiting for Angular to bootstrap...');
    await page.waitForFunction(
      () => {
        const root = document.querySelector('app-root');
        return root !== null && root.children.length > 0;
      },
      undefined,
      { timeout: 120_000 },
    );
    console.log('[egp-scraper] Angular bootstrapped, polling for CSRF token...');

    // Poll for CSRF token — Angular sets it async after bootstrap; give up to angularInitMs
    let csrfToken = '';
    const deadline = Date.now() + config.angularInitMs;
    while (Date.now() < deadline) {
      csrfToken = await page.evaluate(() => sessionStorage.getItem('csrf') ?? '');
      if (csrfToken) break;
      await sleep(1000);
    }
    if (!csrfToken) {
      throw new Error(`Angular CSRF token not found after bootstrap — URL: ${page.url()}`);
    }
    console.log('[egp-scraper] CSRF token obtained');

    // ── Turnstile strategy ────────────────────────────────────────────────────
    // The headless browser can't pass Cloudflare Turnstile natively, so CapSolver
    // solves it. The IP problem: e-GP binds the announcement token to the IP that
    // calls the validate endpoint. We need both the validate call AND the search
    // calls to come from the same IP (GitHub Actions).
    //
    // Solution: inject the CapSolver token into Angular's own Turnstile callback.
    // Angular then calls validate FROM WITHIN the browser (GitHub Actions IP),
    // and our route interceptor captures the announcement token it receives.
    // This keeps all e-GP requests on one IP.
    let announcementToken: string;

    if (nativeAnnouncementToken) {
      // Angular auto-validated on page load (non-headless env)
      console.log('[egp-scraper] using pre-captured native announcement token');
      announcementToken = nativeAnnouncementToken;
    } else {
      // Angular uses implicit Turnstile rendering — the widget is a <div class="cf-turnstile"
      // data-sitekey="..." data-callback="functionName"> element. Cloudflare calls
      // window.functionName(token) directly; window.turnstile.render is never invoked.
      // Read the callback name from the DOM so we can trigger it ourselves with a CapSolver token.
      const turnstileCallbackName = await page.evaluate(() => {
        const el = document.querySelector('[data-sitekey], .cf-turnstile');
        return el?.getAttribute('data-callback') ?? null;
      });
      console.log(`[egp-scraper] turnstile data-callback attribute: ${turnstileCallbackName}`);

      console.log('[egp-scraper] requesting CapSolver Turnstile token...');
      const rawTurnstileToken = await getTurnstileToken(config);

      if (turnstileCallbackName) {
        console.log(`[egp-scraper] injecting CapSolver token via window.${turnstileCallbackName}()...`);
        const injectResult = await page.evaluate(([name, token]: [string, string]) => {
          const fn = (window as any)[name];
          if (typeof fn !== 'function') return `window.${name} is not a function`;
          fn(token);
          return 'called';
        }, [turnstileCallbackName, rawTurnstileToken] as [string, string]);
        console.log(`[egp-scraper] data-callback inject result: ${injectResult}`);

        // Give Angular's validate call up to 30s to complete and be intercepted
        const tokenWait = Date.now() + 30_000;
        while (!nativeAnnouncementToken && Date.now() < tokenWait) await sleep(500);
        if (nativeAnnouncementToken) {
          console.log('[egp-scraper] native token captured via data-callback injection');
        } else {
          console.log('[egp-scraper] data-callback fired but validate returned no token — direct validate fallback');
        }
      }

      if (nativeAnnouncementToken) {
        announcementToken = nativeAnnouncementToken;
      } else {
        console.log('[egp-scraper] falling back to direct validate (CapSolver IP — may be rejected by search)...');
        announcementToken = await validateTurnstileToken(page, rawTurnstileToken, csrfToken);
      }
    }
    console.log(`[egp-scraper] announcement token ready (length=${announcementToken.length})`);

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
        console.error(`[egp-scraper] server rejected announcement token — full response: ${JSON.stringify(resp)}`);
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
            // Pass pre-loaded status so upsertTender can skip its per-doc read
            const currentStatus = config.currentStatusMap?.get(tender.id);
            const { wasNew } = await upsertTender(tender, currentStatus);
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

      // In refresh mode (idFilter set) we must scan the full date range — the
      // targets are scattered across pages so the consecutive-known-pages heuristic
      // would exit far too early. Only apply it on full scrape runs.
      if (!config.idFilter) {
        if (pageNewCount === 0) {
          consecutiveKnownPages++;
          if (consecutiveKnownPages >= 2) {
            console.log('[egp-scraper] 2 consecutive all-known pages — reached overlap, stopping early');
            break;
          }
        } else {
          consecutiveKnownPages = 0;
        }
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

export async function runStatusRefresh(overrides: Partial<ScrapeConfig> = {}): Promise<ScrapeResult> {
  const toRefresh = await getOpenOrUnknownTenders();

  if (toRefresh.length === 0) {
    console.log('[egp-scraper] runStatusRefresh: no open/unknown tenders to refresh');
    return { scraped: 0, inserted: 0, updated: 0, errors: 0, durationMs: 0 };
  }

  const now = Date.now();
  // Thai government tenders don't stay open for more than ~6 months.
  // Anything older than 180 days is force-closed without scanning the API.
  const STALE_DAYS = 180;
  // The e-GP portal has thousands of records/month nationally — scanning more than
  // ~45 days back takes too long (thousands of pages) and hits rate limits.
  const SCAN_DAYS = 45;

  const recentIds = new Set<string>();
  const staleIds: string[] = [];

  for (const t of toRefresh) {
    const date = dateFromProjectId(t.id);
    const ageMs = date ? now - new Date(date).getTime() : Infinity;
    if (ageMs > STALE_DAYS * 86_400_000) {
      staleIds.push(t.id);
    } else {
      recentIds.add(t.id);
    }
  }

  if (staleIds.length > 0) {
    console.log(`[egp-scraper] runStatusRefresh: force-closing ${staleIds.length} stale tenders (>${STALE_DAYS}d old)`);
    await forceCloseTenders(staleIds);
  }

  if (recentIds.size === 0) {
    console.log('[egp-scraper] runStatusRefresh: no recent tenders to scan');
    return { scraped: 0, inserted: 0, updated: staleIds.length, errors: 0, durationMs: 0 };
  }

  const currentStatusMap = new Map(
    toRefresh.filter((t) => recentIds.has(t.id)).map((t) => [t.id, t.status] as const)
  );

  console.log(`[egp-scraper] runStatusRefresh: ${recentIds.size} recent tenders, scanning ${SCAN_DAYS} days back (${staleIds.length} force-closed)`);
  return runScrape({ ...overrides, dateFromDaysAgo: SCAN_DAYS, idFilter: recentIds, currentStatusMap });
}
