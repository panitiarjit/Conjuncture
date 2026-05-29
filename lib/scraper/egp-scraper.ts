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
      // Prevents Chrome refusing to open a profile whose .lock file survived a kill
      '--no-process-singleton-lock',
    ],
    locale: 'th-TH',
    ...(proxyConfig ? { proxy: proxyConfig } : {}),
  });
  const page = context.pages()[0] ?? await context.newPage();
  // alwaysIsolated mode can deadlock evaluate() when iframes create new contexts.
  // A 30s default timeout converts silent infinite hangs into catchable TimeoutErrors.
  context.setDefaultTimeout(30_000);

  try {
    // Intercept search requests to log the exact URL + all headers the browser adds
    // (Referer, Origin, Cookie, Accept-Language, etc.) — this tells us if there's a
    // header the server checks that we're missing or sending differently.
    // Only log the first call to avoid spamming on multi-page runs.
    let searchInterceptCount = 0;
    await page.route(/\/pb\/a-egp-allt-project\/announcement/, async (route: import('playwright').Route) => {
      const req = route.request();
      if (searchInterceptCount < 2) {
        searchInterceptCount++;
        console.log(`[egp-scraper] search req #${searchInterceptCount}: ${req.method()} ${req.url().slice(0, 500)}`);
        const hdrs = req.headers();
        const relevant = ['referer', 'origin', 'x-xsrf-token', 'accept-language', 'x-requested-with',
                          'authorization', 'content-type', 'accept', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest'];
        const subset = Object.fromEntries(Object.entries(hdrs).filter(([k]) => relevant.includes(k) || k.startsWith('cookie')));
        console.log(`[egp-scraper] search headers (relevant): ${JSON.stringify(subset)}`);
      }
      const response = await route.fetch();
      const bodyText = await response.text();
      if (searchInterceptCount <= 2 && bodyText.includes('validateCfTurnTile')) {
        console.log(`[egp-scraper] search response (${response.status()}): ${bodyText.slice(0, 300)}`);
        // Log response headers that might hint at why the token was rejected
        const respHdrs = response.headers();
        const interestingRespHdrs = Object.fromEntries(
          Object.entries(respHdrs).filter(([k]) =>
            ['set-cookie', 'www-authenticate', 'x-auth-required', 'location',
             'x-error', 'x-frame-options', 'content-type'].includes(k.toLowerCase())
          )
        );
        if (Object.keys(interestingRespHdrs).length > 0) {
          console.log(`[egp-scraper] search response headers: ${JSON.stringify(interestingRespHdrs)}`);
        }
      }
      await route.fulfill({ response, body: bodyText });
    });

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

    // Automation signals captured here (runs in rebrowser isolated world — values reflect
    // the same underlying objects Cloudflare's turnstile.js sees in the main world).
    const autoSignals = await page.evaluate(() => ({
      webdriver: (navigator as Navigator & { webdriver?: boolean }).webdriver,
      hasFocus: document.hasFocus(),
      visibility: document.visibilityState,
      hidden: document.hidden,
      pluginsLen: navigator.plugins?.length,
      languages: (navigator as Navigator & { languages?: string[] }).languages,
      chromeExists: !!(window as Window & { chrome?: unknown }).chrome,
      // Additional Turnstile fingerprint signals
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      screenW: screen.width,
      screenH: screen.height,
      colorDepth: screen.colorDepth,
      outerW: window.outerWidth,
      outerH: window.outerHeight,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      // chrome.loadTimes and chrome.csi are only present in real Chrome (not headless)
      chromeLoadTimes: typeof (window as Window & { chrome?: { loadTimes?: unknown } }).chrome?.loadTimes,
      chromeRuntime: !!(window as Window & { chrome?: { runtime?: unknown } }).chrome?.runtime,
      notificationPermission: (typeof Notification !== 'undefined' ? Notification.permission : 'N/A'),
    }));
    console.log(`[egp-scraper] automation signals: ${JSON.stringify(autoSignals)}`);

    // Initial random mouse movement (early user behavior before page fully loads)
    const viewport = page.viewportSize();
    const vw = viewport?.width ?? 1280;
    const vh = viewport?.height ?? 720;
    await page.mouse.move(vw * 0.2, vh * 0.2, { steps: 6 });
    await sleep(180);
    await page.mouse.move(vw * 0.5, vh * 0.35, { steps: 10 });
    await sleep(200);
    await page.mouse.move(vw * 0.45, vh * 0.55, { steps: 8 });
    await sleep(150);

    // Poll for CSRF token — Angular sets it async after bootstrap; give up to angularInitMs.
    // Wrap in try/catch: in alwaysIsolated mode evaluate() may throw TimeoutError if a new
    // iframe context races with the CDP call — just retry on the next tick.
    let csrfToken = '';
    const deadline = Date.now() + config.angularInitMs;
    while (Date.now() < deadline) {
      try {
        csrfToken = await page.evaluate(() => sessionStorage.getItem('csrf') ?? '');
      } catch { /* timeout or context race — retry */ }
      if (csrfToken) break;
      await sleep(1000);
    }
    if (!csrfToken) {
      throw new Error(`Angular CSRF token not found after bootstrap — URL: ${page.url()}`);
    }
    console.log('[egp-scraper] CSRF token obtained');

    // context.cookies() includes HttpOnly cookies invisible to document.cookie —
    // these may include session cookies relevant to the validateCfTurnTile check.
    const allCookies = await context.cookies(config.cfPageUrl);
    console.log(`[egp-scraper] all cookies at CSRF (${allCookies.length}): [${allCookies.map(c => c.name).join(', ')}]`);

    // Wait briefly for the cf-turnstile outer div to appear (Angular renders it async).
    // Use a short timeout so we don't block if it hasn't appeared yet.
    const tsEl = await page.waitForSelector('.cf-turnstile', { timeout: 5_000 }).catch(() => null);
    if (tsEl) {
      // Scroll into view and hover to signal human activity before Turnstile evaluates.
      await tsEl.scrollIntoViewIfNeeded().catch(() => null);
      const tsBox = await tsEl.boundingBox().catch(() => null);
      if (tsBox) {
        await page.mouse.move(tsBox.x + tsBox.width / 2, tsBox.y - 30, { steps: 8 });
        await sleep(200);
        await page.mouse.move(tsBox.x + tsBox.width / 2, tsBox.y + tsBox.height / 2, { steps: 10 });
        await sleep(300);
        console.log(`[egp-scraper] scrolled + hovered cf-turnstile at (${Math.round(tsBox.x + tsBox.width / 2)}, ${Math.round(tsBox.y + tsBox.height / 2)})`);
      }
    } else {
      console.log('[egp-scraper] cf-turnstile not in DOM after 5s');
    }

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
      let iframeHandle = await page.waitForSelector('.cf-turnstile iframe', { timeout: 45_000 })
        .catch(() => null);
      console.log(iframeHandle ? '[egp-scraper] Turnstile iframe appeared' : '[egp-scraper] Turnstile iframe did NOT appear after 45s (Cloudflare suppressed it)');

      // If the iframe didn't appear, try resetting the Turnstile widget.
      // After 45s of genuine page activity (mouse moves, scroll, hover), Cloudflare may
      // score the session higher on a re-challenge. reset() clears the current state and
      // re-runs Cloudflare's challenge decision.
      if (!iframeHandle && !nativeAnnouncementToken) {
        const widgetId = await page.evaluate(() => {
          const input = document.querySelector<HTMLInputElement>('[id^="cf-chl-widget-"][id$="_response"]');
          return input?.id?.replace('_response', '') ?? null;
        });
        if (widgetId) {
          const resetResult = await page.evaluate((id: string) => {
            const t = (window as any).turnstile;
            if (!t?.reset) return 'turnstile.reset not available';
            try { t.reset(id); return `reset called for ${id}`; } catch (e: any) { return `reset error: ${e.message}`; }
          }, widgetId);
          console.log(`[egp-scraper] turnstile.reset: ${resetResult}`);
          console.log('[egp-scraper] waiting 30s for iframe after reset...');
          iframeHandle = await page.waitForSelector('.cf-turnstile iframe', { timeout: 30_000 }).catch(() => null);
          console.log(iframeHandle ? '[egp-scraper] Turnstile iframe appeared after reset!' : '[egp-scraper] Turnstile iframe still absent after reset');

          if (!iframeHandle) {
            // Log every method/prop on window.turnstile to understand what API is initialised
            const turnstileMethods = await page.evaluate(() => {
              const t = (window as any).turnstile;
              if (!t) return 'window.turnstile is undefined';
              const names = new Set<string>();
              let obj: object | null = t;
              while (obj && obj !== Object.prototype) {
                Object.getOwnPropertyNames(obj).forEach(n => names.add(n));
                obj = Object.getPrototypeOf(obj);
              }
              const methods = [...names].filter(n => n !== 'constructor').map(n => {
                try { return `${n}:${typeof (t as any)[n]}`; } catch { return `${n}:?`; }
              });
              return methods.join(', ');
            });
            console.log(`[egp-scraper] window.turnstile API: ${turnstileMethods}`);

            // Try execute() — for explicit render mode it triggers the challenge
            const execResult = await page.evaluate((id: string) => {
              const t = (window as any).turnstile;
              if (!t?.execute) return 'turnstile.execute not available';
              try { t.execute(id); return `execute called for ${id}`; } catch (e: any) { return `execute error: ${e.message}`; }
            }, widgetId);
            console.log(`[egp-scraper] turnstile.execute: ${execResult}`);
            if (execResult.startsWith('execute called')) {
              await sleep(20_000);
              iframeHandle = await page.waitForSelector('.cf-turnstile iframe', { timeout: 1_000 }).catch(() => null);
              console.log(iframeHandle ? '[egp-scraper] iframe appeared after execute!' : '[egp-scraper] iframe still absent after execute');
            }
          }

          if (!iframeHandle) {
            // Last resort: call turnstile.render() directly with the actual site key.
            // This forces a fresh challenge evaluation after ~3 min of browser activity.
            const renderResult = await page.evaluate(([siteKey, action]: [string, string]) => {
              const t = (window as any).turnstile;
              if (!t?.render) return 'turnstile.render not available';
              const el = document.getElementById('idcf-turnstile');
              if (!el) return 'element #idcf-turnstile not found';
              try {
                el.innerHTML = '';
                const newId = t.render(el, { sitekey: siteKey, action, theme: 'light' });
                return `render called, widgetId=${newId}`;
              } catch (e: any) { return `render error: ${e.message}`; }
            }, [config.cfTurnstileSiteKey, 'egp-aann09-web'] as [string, string]);
            console.log(`[egp-scraper] turnstile.render: ${renderResult}`);
            if (renderResult.startsWith('render called')) {
              console.log('[egp-scraper] waiting 30s for iframe after forced render...');
              iframeHandle = await page.waitForSelector('.cf-turnstile iframe', { timeout: 30_000 }).catch(() => null);
              console.log(iframeHandle ? '[egp-scraper] iframe appeared after render!' : '[egp-scraper] iframe still absent after render');
            }
          }
        }
      }

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
          // Check if F5 BigIP cookies changed — if so, server-side state was updated
          const postValidateCookies = await context.cookies(config.cfPageUrl);
          const tsBefore = allCookies.filter(c => c.name.startsWith('TS')).map(c => `${c.name}=${c.value.slice(-12)}`);
          const tsAfter = postValidateCookies.filter(c => c.name.startsWith('TS')).map(c => `${c.name}=${c.value.slice(-12)}`);
          console.log(`[egp-scraper] F5 cookies changed after validate: ${JSON.stringify(tsBefore) !== JSON.stringify(tsAfter)}`);
          console.log(`[egp-scraper] TS before: [${tsBefore.join(', ')}]`);
          console.log(`[egp-scraper] TS after:  [${tsAfter.join(', ')}]`);
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
