/** One row returned by the e-GP announcement search API. */
export interface RawAnnouncement {
  projectId: string;
  seqNo?: string;
  projectName: string;
  deptSubName?: string;         // agency / procuring unit
  announceSubDesc?: string;     // alternative agency name field
  announceDate: string;         // ISO 8601 datetime
  projectMoney?: number;
  priceBuild?: number;
  methodId?: string;            // method code (not name)
  typeId?: string | null;       // type code (not name)
  rdbProvinceMoiName?: string | null; // province name
  projectStatus?: string;       // e.g. "A"
  stepId?: string;              // e.g. "X01"
  flowName?: string;            // description of current step
  announceType?: string;        // e.g. "W0", "B0", "IM"
  validateConfidential?: boolean;
  modifiedDate?: string | null;
  announceDateStr?: string | null;
  announceWinnerDate?: string | null; // date winner was announced — non-null means awarded
}

export interface EgpDataEnvelope {
  draw?: number;
  recordsTotal?: number;
  recordsFiltered?: number;
  totoalElments?: number;
  totalPages?: number;
  data?: RawAnnouncement[];
}

export interface EgpApiResponse {
  /** Present (false) when the announcementToken is missing or invalid. */
  validateCfTurnTile?: boolean;
  response?: { responseCode: string; messageCode: string | null; description: string | null };
  data?: EgpDataEnvelope;
}

export interface ScrapeConfig {
  /** e-GP base URL */
  baseUrl: string;
  /** Announcement search endpoint path */
  searchPath: string;
  /** Milliseconds delay between paged requests */
  rateLimitMs: number;
  /** Hard cap on pages per run */
  maxPages: number;
  /** Number of calendar days to look back */
  dateFromDaysAgo: number;
  /** CapSolver API key (set via CAPSOLVER_API_KEY env) */
  capsolverApiKey?: string;
  /** Cloudflare Turnstile site key for gprocurement.go.th */
  cfTurnstileSiteKey: string;
  /** Page URL to pass to CapSolver */
  cfPageUrl: string;
  /** Milliseconds to wait for Angular app to initialize */
  angularInitMs: number;
  /**
   * When set, only upsert tenders whose project ID is in this set.
   * Tenders found in the API that are NOT in the set are silently skipped.
   * Used by the status-refresh job to avoid inserting new records mid-refresh.
   */
  idFilter?: Set<string>;
  /**
   * Pre-loaded status map from the initial Firestore read in runStatusRefresh.
   * Passed to upsertTender so it can skip the per-document read-before-write.
   * Key = projectId, value = current TenderStatus in Firestore.
   */
  currentStatusMap?: Map<string, import('../types').TenderStatus>;
}

export interface ScrapeResult {
  scraped: number;
  inserted: number;
  updated: number;
  errors: number;
  durationMs: number;
}

export const DEFAULT_CONFIG: ScrapeConfig = {
  baseUrl: 'https://process5.gprocurement.go.th',
  searchPath: '/egp-atpj27-service/pb/a-egp-allt-project/announcement',
  rateLimitMs: 1200,
  maxPages: 500,   // safety ceiling only — overlap detection stops early in practice
  dateFromDaysAgo: 3,  // 1 day new + 2 day buffer if a run is missed
  cfTurnstileSiteKey: '0x4AAAAAABuINxkTjFy-_hpH',
  cfPageUrl: 'https://process5.gprocurement.go.th/egp-agpc01-web/announcement',
  angularInitMs: 18000,
};
