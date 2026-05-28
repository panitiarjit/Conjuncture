/**
 * e-GP HTTP client.
 *
 * The site uses three layers of protection:
 *   1. F5 BigIP WAF — requires a real Chrome TLS fingerprint + session cookies
 *   2. Cloudflare Turnstile — raw token solved by CapSolver
 *   3. Custom CSRF — token stored in sessionStorage.csrf by Angular, sent as X-Xsrf-Token
 *
 * All API calls must therefore be made from within a Playwright browser context that has
 * navigated to the announcement page (so the F5 WAF session and Angular CSRF token are set).
 */
import type { Page } from 'playwright';
import type { EgpApiResponse, ScrapeConfig } from './types';

// ── CapSolver Turnstile ────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Resolve a Cloudflare Turnstile challenge via the CapSolver service. */
export async function getTurnstileToken(config: ScrapeConfig, action?: string, cdata?: string): Promise<string> {
  const apiKey = config.capsolverApiKey ?? process.env.CAPSOLVER_API_KEY;
  if (!apiKey) throw new Error('CAPSOLVER_API_KEY env var not set');

  const task: Record<string, string> = {
    type: 'AntiTurnstileTaskProxyLess',
    websiteURL: config.cfPageUrl,
    websiteKey: config.cfTurnstileSiteKey,
  };
  if (action !== undefined) task['action'] = action;
  if (cdata !== undefined) task['cdata'] = cdata;

  const createRes = await fetch('https://api.capsolver.com/createTask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientKey: apiKey, task }),
  });
  const createData = (await createRes.json()) as { taskId?: string; errorCode?: string; errorDescription?: string };
  if (createData.errorCode) {
    throw new Error(`CapSolver createTask error: ${createData.errorCode} — ${createData.errorDescription}`);
  }
  const { taskId } = createData as { taskId: string };

  for (let i = 0; i < 30; i++) {
    await sleep(3_000);
    const pollRes = await fetch('https://api.capsolver.com/getTaskResult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: apiKey, taskId }),
    });
    const data = (await pollRes.json()) as { status: string; solution?: { token: string }; errorCode?: string; errorDescription?: string };
    if (data.status === 'ready' && data.solution?.token) return data.solution.token;
    if (data.errorCode) throw new Error(`CapSolver getTaskResult error: ${data.errorCode} — ${data.errorDescription}`);
  }
  throw new Error('CapSolver Turnstile solve timed out after 90s');
}

// ── Browser-based API calls ────────────────────────────────────────────────

/**
 * Exchange a raw CapSolver Turnstile token for the server's signed announcementToken.
 * Must be called from within a browser page that has already navigated to cfPageUrl.
 */
export async function validateTurnstileToken(page: Page, rawToken: string, csrfToken?: string): Promise<string> {
  const result = await page.evaluate(
    async ({ token, csrf }: { token: string; csrf: string }) => {
      const headers: Record<string, string> = {
        'Accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
      };
      if (csrf) headers['X-Xsrf-Token'] = csrf;
      const r = await fetch(
        `/egp-atpj27-service/pb/a-egp-allt-project/api/v1/cfturnstile/validate/${encodeURIComponent(token)}`,
        { headers }
      );
      const body = await r.json();
      return (body as { data?: string }).data ?? null;
    },
    { token: rawToken, csrf: csrfToken ?? '' }
  );

  if (!result) throw new Error('validate endpoint returned no announcementToken');
  return result;
}

export interface SearchParams {
  announceSDate: string;       // YYYY-MM-DD CE
  announceEDate: string;       // YYYY-MM-DD CE
  page: number;                // 1-indexed
  announcementToken: string;
  csrfToken: string;           // from sessionStorage.csrf in the browser
}

/** Search announcements from within a browser page context. */
export async function searchAnnouncements(
  page: Page,
  config: ScrapeConfig,
  params: SearchParams
): Promise<EgpApiResponse> {
  const result = await page.evaluate(
    async ({ baseUrl, searchPath, params }: { baseUrl: string; searchPath: string; params: SearchParams }) => {
      const qs = new URLSearchParams({
        announceSDate: params.announceSDate,
        announceEDate: params.announceEDate,
        announcementTodayFlag: 'false',
        page: String(params.page),
        announcementToken: params.announcementToken,
      });
      const res = await fetch(`${baseUrl}${searchPath}?${qs}`, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'content-type': 'application/json',
          'X-Xsrf-Token': params.csrfToken,
        },
      });
      return res.json() as Promise<unknown>;
    },
    { baseUrl: config.baseUrl, searchPath: config.searchPath, params }
  );

  return result as EgpApiResponse;
}
