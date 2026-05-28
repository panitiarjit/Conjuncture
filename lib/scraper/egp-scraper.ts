import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
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

  // rebrowser-playwright is a drop-in replacement that patches out the CDP Runtime.enable
  // detection vector — standard Playwright's isolated JS context is detectable by Cloudflare
  // Turnstile even when navigator.webdriver and all JS-level signals are clean.
  // launchPersistentContext merges launch + context options and preserves cf cookies.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { chromium } = require('rebrowser-playwright') as typeof import('playwright');
  const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';

  const proxyUrl = process.env.RESIDENTIAL_PROXY_URL;
  let proxyConfig: { server: string; username?: string; password?: string } | undefined;
  if (proxyUrl) {
    const u = new URL(proxyUrl);
    proxyConfig = {
      server: `${u.protocol}//${u.host}`,
      ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
      ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    };
    console.log(`[egp-scraper] using residential proxy: ${u.host}`);
  } else {
    console.log('[egp-scraper] no RESIDENTIAL_PROXY_URL set — using persistent profile for Cloudflare trust');
  }

  const profileDir = process.env.CHROME_PROFILE_DIR ?? path.join(os.homedir(), '.egp-chrome-profile');
  fs.mkdirSync(profileDir, { recursive: true });
  console.log(`[egp-scraper] Chrome profile: ${profileDir}`);

  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    locale: 'th-TH',
    ...(proxyConfig ? { proxy: proxyConfig } : {}),
  });
  const page = context.pages()[0] ?? await context.newPage();

  try {
    // Intercept Angular's own Turnstile validation call BEFORE navigating.
    // Angular auto-validates Turnstile on page load from within the browser (GitHub Actions IP).
    // If we capture that token instead of using CapSolver (which solves from CapSolver's IP),
    // the announcement token will be bound to the same IP as the search requests.
    let nativeAnnouncementToken: string | null = null;
    await page.route(/cfturnstile\/validate/, async (route: import('playwright').Route) => {
      console.log('[egp-scraper] intercepted validate call');
      const response = await route.fetch();
      const body = await response.json() as Record<string, unknown>;
      // Log full response structure so we can see every field, not just .data
      console.log(`[egp-scraper] validate response body: ${JSON.stringify(body)}`);
      const data = typeof body.data === 'string' ? body.data : null;
      if (data) nativeAnnouncementToken = data;
      await route.fulfill({ response });
    });

    // Stealth patches applied before any page script runs — covers all frames including
    // the Turnstile iframe. AutomationControlled flag removes Chrome-level webdriver signal;
    // this covers JS-level signals that turnstile.js fingerprints.
    await page.addInitScript(() => {
      // webdriver
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // plugins — empty plugins list is a known bot signal
      try {
        const fakePlugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', version: '' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', version: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', version: '' },
        ];
        Object.defineProperty(navigator, 'plugins', { get: () => Object.assign(fakePlugins, { item: (i: number) => fakePlugins[i] ?? null, namedItem: (n: string) => fakePlugins.find(p => p.name === n) ?? null, refresh: () => {} }) });
      } catch (_) {}
      // languages — match locale so header and JS agree
      try { Object.defineProperty(navigator, 'languages', { get: () => ['th-TH', 'th', 'en-US', 'en'] }); } catch (_) {}
      // permissions — default (not denied) for notifications; denied is a bot signal
      try {
        const origQuery = navigator.permissions.query.bind(navigator.permissions);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator.permissions as any).query = (p: PermissionDescriptor) =>
          p.name === 'notifications'
            ? Promise.resolve({ state: 'default', onchange: null } as unknown as PermissionStatus)
            : origQuery(p);
      } catch (_) {}
    });

    console.log('[egp-scraper] navigating to announcement page (Angular init + WAF session)...');
    await page.goto(config.cfPageUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.bringToFront();
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

    // Diagnose automation signals that Cloudflare's turnstile.js checks
    const autoSignals = await page.evaluate(() => ({
      webdriver: (navigator as Navigator & { webdriver?: boolean }).webdriver,
      hasFocus: document.hasFocus(),
      visibility: document.visibilityState,
      hidden: document.hidden,
      pluginsLen: navigator.plugins?.length,
      languages: (navigator as Navigator & { languages?: string[] }).languages,
      chromeExists: !!(window as Window & { chrome?: unknown }).chrome,
    }));
    console.log(`[egp-scraper] automation signals: ${JSON.stringify(autoSignals)}`);

    // Simulate human-like mouse movement so Cloudflare's behavioural check sees activity.
    // Without any mouse events, even a clean fingerprint can score as "bot" on first visit.
    const viewport = page.viewportSize();
    const vw = viewport?.width ?? 1280;
    const vh = viewport?.height ?? 720;
    await page.mouse.move(vw * 0.2, vh * 0.2, { steps: 6 });
    await sleep(180);
    await page.mouse.move(vw * 0.5, vh * 0.35, { steps: 10 });
    await sleep(200);
    await page.mouse.move(vw * 0.45, vh * 0.55, { steps: 8 });
    await sleep(150);
    // Move towards the cf-turnstile element if already rendered
    const tsBox = await page.$eval('.cf-turnstile', (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    }).catch(() => null);
    if (tsBox) {
      await page.mouse.move(tsBox.x, tsBox.y, { steps: 14 });
      await sleep(250);
      console.log(`[egp-scraper] hovered over cf-turnstile at (${Math.round(tsBox.x)}, ${Math.round(tsBox.y)})`);
    }

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

    // Dump cookies so we can see what Cloudflare has set (__cf_bm, cf_clearance, etc.)
    const cookieNames = await page.evaluate(() =>
      document.cookie.split(';').map(c => c.trim().split('=')[0]).filter(Boolean)
    );
    console.log(`[egp-scraper] browser cookies at CSRF: [${cookieNames.join(', ')}]`);

    // ── Turnstile strategy ────────────────────────────────────────────────────
    // After CSRF is set, Angular may still be rendering the Turnstile widget.
    // Poll for up to 30s for either: (a) native Cloudflare auto-solve, or
    // (b) the widget element appearing so we can read its data-callback/action/cdata.
    // Cloudflare may also auto-solve during this window if the stealth plugin
    // makes the browser look legitimate enough.
    let announcementToken: string;

    if (nativeAnnouncementToken) {
      console.log('[egp-scraper] using pre-captured native announcement token');
      announcementToken = nativeAnnouncementToken;
    } else {
      type TurnstileAttrs = { callback: string | null; action: string | null; cdata: string | null; outerHtml: string };
      let turnstileAttrs: TurnstileAttrs | null = null;

      // Step 1: wait up to 45s for the Turnstile iframe to appear inside the widget.
      // The widget div is added by Angular immediately, but Cloudflare's turnstile.js
      // creates the <iframe> asynchronously. We must NOT break early just because the
      // outer div exists — we need to wait for the iframe (which triggers auto-solve).
      console.log('[egp-scraper] waiting up to 45s for Turnstile iframe and native auto-solve...');
      const iframeHandle = await page.waitForSelector('.cf-turnstile iframe', { timeout: 45_000 })
        .catch(() => null);
      console.log(iframeHandle ? '[egp-scraper] Turnstile iframe appeared' : '[egp-scraper] Turnstile iframe did NOT appear after 45s (Cloudflare suppressed it)');

      // Record widget attrs regardless (needed for CapSolver action/cdata)
      turnstileAttrs = await page.evaluate((): TurnstileAttrs | null => {
        const el = document.querySelector('[data-sitekey], .cf-turnstile');
        if (!el) return null;
        return {
          callback: el.getAttribute('data-callback'),
          action:   el.getAttribute('data-action'),
          cdata:    el.getAttribute('data-cdata'),
          outerHtml: el.outerHTML.slice(0, 400),
        };
      });

      // Step 2: if the iframe appeared, wait an extra 15s for Angular's validate call
      if (iframeHandle && !nativeAnnouncementToken) {
        console.log('[egp-scraper] iframe present — waiting 15s for Angular to auto-call validate...');
        const nativeWait = Date.now() + 15_000;
        while (!nativeAnnouncementToken && Date.now() < nativeWait) await sleep(500);
      }

      if (nativeAnnouncementToken) {
        console.log('[egp-scraper] native token captured during widget poll');
        announcementToken = nativeAnnouncementToken;
      } else {
        if (turnstileAttrs) {
          console.log(`[egp-scraper] Turnstile element: callback=${turnstileAttrs.callback} action=${turnstileAttrs.action} cdata=${turnstileAttrs.cdata}`);
          console.log(`[egp-scraper] Turnstile outerHTML: ${turnstileAttrs.outerHtml}`);
        } else {
          // Broader scan for any turnstile-related elements — helps diagnose wrong selector
          const scan = await page.evaluate(() =>
            Array.from(document.querySelectorAll('*'))
              .filter(e => /turnstile/i.test(e.className + ' ' + (e.getAttribute('id') ?? '') + ' ' + (e.getAttribute('data-sitekey') ?? '')))
              .map(e => e.outerHTML.slice(0, 200))
          );
          console.log(`[egp-scraper] Turnstile element NOT found after 30s. Broad scan hits: ${scan.length}`);
          if (scan.length > 0) console.log('[egp-scraper] broad scan samples:', JSON.stringify(scan.slice(0, 3)));
        }

        // Request CapSolver token, forwarding action/cdata if found on the widget
        console.log('[egp-scraper] requesting CapSolver token...');
        const rawTurnstileToken = await getTurnstileToken(
          config,
          turnstileAttrs?.action ?? undefined,
          turnstileAttrs?.cdata ?? undefined,
        );

        // Try injecting token into hidden input to trigger Angular's native validate call.
        // Angular watches the cf-turnstile-response input; filling it + dispatching events
        // should cause Angular to call validate from the browser (same IP as search).
        console.log('[egp-scraper] injecting CapSolver token into hidden input...');
        const injectResult = await page.evaluate((token: string) => {
          const input = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
          if (!input) return 'input not found';
          // Fill the hidden input
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          nativeInputValueSetter?.call(input, token);
          // Dispatch events Angular may be listening for
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          // Also try calling window.turnstile callbacks if registered
          const turnstile = (window as any).turnstile;
          if (turnstile?.getResponse) return `filled + turnstile present`;
          return 'filled';
        }, rawTurnstileToken);
        console.log(`[egp-scraper] inject result: ${injectResult}`);

        // Wait up to 10s for Angular to react and call validate
        const tokenWait = Date.now() + 10_000;
        while (!nativeAnnouncementToken && Date.now() < tokenWait) await sleep(500);
        if (nativeAnnouncementToken) {
          console.log('[egp-scraper] token captured via hidden input injection');
        } else if (turnstileAttrs?.callback) {
          // Fallback: try the named window callback if it exists
          console.log(`[egp-scraper] trying window.${turnstileAttrs.callback}()...`);
          const cbResult = await page.evaluate(([name, token]: [string, string]) => {
            const fn = (window as any)[name];
            if (typeof fn !== 'function') return `window.${name} is not a function`;
            fn(token);
            return 'called';
          }, [turnstileAttrs.callback, rawTurnstileToken] as [string, string]);
          console.log(`[egp-scraper] callback result: ${cbResult}`);
          const cbWait = Date.now() + 10_000;
          while (!nativeAnnouncementToken && Date.now() < cbWait) await sleep(500);
        }

        if (nativeAnnouncementToken) {
          announcementToken = nativeAnnouncementToken;
        } else {
          console.log('[egp-scraper] direct validate (CapSolver token sent from browser IP)...');
          announcementToken = await validateTurnstileToken(page, rawTurnstileToken, csrfToken);
        }
      }
    }
    // The validate endpoint returns the token base64-encoded. Angular decodes it with atob()
    // before passing it as the announcementToken query param. Without the decode, the search
    // endpoint receives a raw base64 string and rejects it with validateCfTurnTile:false.
    const decodedToken = Buffer.from(announcementToken, 'base64').toString('utf8');
    console.log(`[egp-scraper] announcement token ready (raw length=${announcementToken.length}, decoded: ${decodedToken.slice(0, 40)}...)`);

    let pageNum = 1;
    let consecutiveKnownPages = 0;

    while (pageNum <= config.maxPages) {
      const resp = await searchAnnouncements(page, config, {
        announceSDate,
        announceEDate,
        page: pageNum,
        announcementToken: decodedToken,
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
    await context.close();
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
