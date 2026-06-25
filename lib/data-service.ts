import 'server-only';
import { unstable_cache } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { TENDERS, PROJECTS, VENDORS, CATEGORIES } from './mock-data';
import type { Tender, Project, Vendor, Category, AwardedContract, SoeTender } from './types';

// Module-level in-memory cache — persists across requests on the same warm Worker instance.
// Without R2/KV configured, unstable_cache has no persistent backend in Cloudflare Workers,
// so this prevents Firestore re-reads on every request from the same warm Worker.
const _memCache = new Map<string, { data: unknown; expiresAt: number }>();
function memGet<T>(key: string): T | null {
  const e = _memCache.get(key);
  return e && Date.now() < e.expiresAt ? (e.data as T) : null;
}
function memSet(key: string, data: unknown, ttlMs: number): void {
  _memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function hasFirestoreCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

// Disk cache — last-resort fallback when Firestore is down and Next.js cache has expired
const DISK_CACHE_PATH = path.join(process.cwd(), '.tender-cache.json');

function saveToDisk(tenders: Tender[]): void {
  try {
    fs.writeFileSync(DISK_CACHE_PATH, JSON.stringify(tenders));
  } catch {
    // non-critical
  }
}

function loadFromDisk(): Tender[] | null {
  try {
    const raw = fs.readFileSync(DISK_CACHE_PATH, 'utf-8');
    return JSON.parse(raw) as Tender[];
  } catch {
    return null;
  }
}

// Next.js data cache — shared across all serverless invocations, revalidates every hour.
// Call revalidateTag('tenders') after a scrape to bust the cache immediately.
const fetchTendersFromFirestore = unstable_cache(
  async (): Promise<Tender[]> => {
    // firebase-admin uses eval() which is blocked in Cloudflare Workers.
    // Use the REST client (Web Crypto + fetch) instead — works everywhere.
    const { restGetCollection } = await import('./firestore-rest');
    const tenders = await restGetCollection<Tender>('tenders', 2000);
    saveToDisk(tenders);
    return tenders;
  },
  ['tenders'],
  { revalidate: 21600, tags: ['tenders'] },
);

export async function getTenders(): Promise<Tender[]> {
  if (!hasFirestoreCredentials()) return TENDERS;
  const cached = memGet<Tender[]>('tenders');
  if (cached) return cached;
  try {
    const tenders = await fetchTendersFromFirestore();
    memSet('tenders', tenders, 6 * 60 * 60 * 1000); // 6h
    return tenders;
  } catch (err) {
    console.warn('[data-service] Firestore unavailable, serving disk/mock fallback:', (err as Error).message);
    return loadFromDisk() ?? TENDERS;
  }
}

export async function getTenderById(id: string): Promise<Tender | undefined> {
  const tenders = await getTenders();
  return tenders.find((t) => t.id === id);
}

export async function getProjects(): Promise<Project[]> {
  return PROJECTS;
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  return PROJECTS.find((p) => p.id === id);
}

export async function getVendors(): Promise<Vendor[]> {
  return VENDORS;
}

export async function getVendorById(id: string): Promise<Vendor | undefined> {
  return VENDORS.find((v) => v.id === id);
}

export async function getCategories(): Promise<Category[]> {
  // Reuses getTenders() cache — no separate Firestore read
  const tenders = await getTenders();
  const counts: Partial<Record<string, number>> = {};
  for (const t of tenders) {
    if (t.status !== 'closed') counts[t.category] = (counts[t.category] ?? 0) + 1;
  }
  return CATEGORIES.map((c) => ({ ...c, count: counts[c.id] ?? 0 }));
}

// ── CGD awarded contracts ─────────────────────────────────────────────────────

/**
 * Fetch a single awarded contract by e-GP project ID.
 * Returns null if not in Firestore (tender not yet awarded or not yet fetched).
 */
export async function getAwardedContract(projectId: string): Promise<AwardedContract | null> {
  if (!hasFirestoreCredentials()) return null;
  const cacheKey = `contract:${projectId}`;
  const cached = memGet<AwardedContract | null>(cacheKey);
  if (cached !== null) return cached;
  try {
    const { restGetDocument } = await import('./firestore-rest');
    const doc = await restGetDocument<AwardedContract>('cgd_contracts', projectId);
    const result = doc ?? null;
    memSet(cacheKey, result, 6 * 60 * 60 * 1000); // 6h
    return result;
  } catch {
    return null;
  }
}

/**
 * Fetch recent awarded contracts, optionally filtered by keyword in project name.
 * Used by the market intelligence page.
 */
const fetchAwardedContractsFromFirestore = unstable_cache(
  async (keyword: string | undefined, maxDocs: number): Promise<AwardedContract[]> => {
    const { restGetCollection } = await import('./firestore-rest');
    const all = await restGetCollection<AwardedContract>('cgd_contracts', maxDocs);
    if (!keyword) return all;
    const kw = keyword.toLowerCase();
    return all.filter((c) => c.projectName.toLowerCase().includes(kw));
  },
  ['cgd_contracts'],
  // 24h revalidate: cgd_contracts only changes once/day (fetch-historical at 15:00).
  // Keeps daily Firestore reads from this path to 1 revalidation × 5k docs = 5k reads/day.
  { revalidate: 86400, tags: ['cgd_contracts'] },
);

export async function getAwardedContracts(keyword?: string, maxDocs = 2_000): Promise<AwardedContract[]> {
  if (!hasFirestoreCredentials()) return [];
  const cacheKey = `contracts:${keyword ?? ''}:${maxDocs}`;
  const cached = memGet<AwardedContract[]>(cacheKey);
  if (cached) return cached;
  try {
    const contracts = await fetchAwardedContractsFromFirestore(keyword, maxDocs);
    memSet(cacheKey, contracts, 24 * 60 * 60 * 1000); // 24h: cgd_contracts changes once/day
    return contracts;
  } catch {
    return [];
  }
}

// Minimal contract shape for benchmark computation (field-masked fetch).
// agency and province are required to build the agency×category and province×category
// fallback tiers — omitting them silently collapses both tiers to category/global.
type BenchmarkContract = Pick<AwardedContract,
  'procurementMethod' | 'discountFromReference' | 'projectType' | 'agency' | 'province' | 'winnerBusinessId'
  | 'fiscalYear' | 'referencePrice' | 'announceDate'
> & { bidders?: string[] };

// procurementMethodGroup is NOT fetched: in the CGD dataset it is always the same generic
// label ("วิธีการจัดหา ประกาศเชิญชวนทั่วไป คัดเลือก เฉพาะเจาะจง") on every contract —
// useless for filtering. procurementMethod carries the actual method name.
const BENCHMARK_FIELDS = [
  'procurementMethod', 'discountFromReference', 'projectType', 'agency', 'province',
  'winnerBusinessId', 'bidders', 'fiscalYear', 'referencePrice', 'announceDate',
];

const fetchBenchmarkContractsFromFirestore = unstable_cache(
  async (): Promise<BenchmarkContract[]> => {
    const { restGetCollectionPage } = await import('./firestore-rest');
    const all: BenchmarkContract[] = [];
    let cursor: string | undefined;
    // Cap at 10k docs: field-masked fetch is cheap per-doc (~150 bytes) but Firestore
    // still charges one read per document. 10k × 1 refresh/day = 10k reads/day.
    // Test scripts mirror this cap so validation reflects production behaviour.
    do {
      const { docs, nextPageToken } = await restGetCollectionPage<BenchmarkContract>(
        'cgd_contracts',
        300,
        cursor,
        BENCHMARK_FIELDS,
      );
      all.push(...docs);
      cursor = nextPageToken;
    } while (cursor && all.length < 10_000);
    return all;
  },
  ['benchmark_contracts'],
  { revalidate: 86400, tags: ['cgd_contracts'] },
);

export async function getContractsForBenchmark(): Promise<BenchmarkContract[]> {
  if (!hasFirestoreCredentials()) return [];
  const cacheKey = 'benchmark_contracts';
  const cached = memGet<BenchmarkContract[]>(cacheKey);
  if (cached) return cached;
  try {
    const contracts = await fetchBenchmarkContractsFromFirestore();
    memSet(cacheKey, contracts, 24 * 60 * 60 * 1000);
    return contracts;
  } catch {
    return [];
  }
}

// ── SOE tenders (soe_tenders Firestore collection) ───────────────────────────

const fetchSoeTendersFromFirestore = unstable_cache(
  async (): Promise<SoeTender[]> => {
    const { restGetCollection } = await import('./firestore-rest');
    return restGetCollection<SoeTender>('soe_tenders', 1000);
  },
  ['soe_tenders'],
  { revalidate: 21600, tags: ['soe_tenders'] },
);

export async function getSoeTenders(): Promise<SoeTender[]> {
  if (!hasFirestoreCredentials()) return [];
  const cached = memGet<SoeTender[]>('soe_tenders');
  if (cached) return cached;
  try {
    const tenders = await fetchSoeTendersFromFirestore();
    memSet('soe_tenders', tenders, 6 * 60 * 60 * 1000);
    return tenders;
  } catch {
    return [];
  }
}

/** Paginated fetch — used by /api/cgd-csv for Google Sheets IMPORTDATA chaining. */
export async function getAwardedContractsPage(
  pageSize = 2_000,
  pageToken?: string,
  fieldMask?: string[],
): Promise<{ contracts: AwardedContract[]; nextPageToken?: string }> {
  if (!hasFirestoreCredentials()) throw new Error('Missing Firebase credentials');
  const { restGetCollectionPage } = await import('./firestore-rest');
  const { docs, nextPageToken } = await restGetCollectionPage<AwardedContract>(
    'cgd_contracts',
    pageSize,
    pageToken,
    fieldMask,
  );
  return { contracts: docs, nextPageToken };
}
