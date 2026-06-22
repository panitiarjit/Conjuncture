import 'server-only';
import { unstable_cache } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { TENDERS, PROJECTS, VENDORS, CATEGORIES } from './mock-data';
import type { Tender, Project, Vendor, Category, AwardedContract } from './types';

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
    const tenders = await restGetCollection<Tender>('tenders');
    saveToDisk(tenders);
    return tenders;
  },
  ['tenders'],
  { revalidate: 3600, tags: ['tenders'] },
);

export async function getTenders(): Promise<Tender[]> {
  if (!hasFirestoreCredentials()) return TENDERS;
  const cached = memGet<Tender[]>('tenders');
  if (cached) return cached;
  try {
    const tenders = await fetchTendersFromFirestore();
    memSet('tenders', tenders, 60 * 60 * 1000); // 1h
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
  // 6h revalidate: cgd_contracts only changes once/day (fetch-historical at 15:00).
  // Keeps daily Firestore reads from this path to ≤4 revalidations × 2k docs = 8k reads/day.
  { revalidate: 21600, tags: ['cgd_contracts'] },
);

export async function getAwardedContracts(keyword?: string, maxDocs = 2_000): Promise<AwardedContract[]> {
  if (!hasFirestoreCredentials()) return [];
  const cacheKey = `contracts:${keyword ?? ''}:${maxDocs}`;
  const cached = memGet<AwardedContract[]>(cacheKey);
  if (cached) return cached;
  try {
    const contracts = await fetchAwardedContractsFromFirestore(keyword, maxDocs);
    memSet(cacheKey, contracts, 6 * 60 * 60 * 1000); // 6h matches KV revalidate
    return contracts;
  } catch {
    return [];
  }
}

// Minimal contract shape for benchmark computation (field-masked fetch)
type BenchmarkContract = Pick<AwardedContract, 'procurementMethod' | 'discountFromReference' | 'projectType'>;

const BENCHMARK_FIELDS = ['procurementMethod', 'discountFromReference', 'projectType'];

const fetchBenchmarkContractsFromFirestore = unstable_cache(
  async (): Promise<BenchmarkContract[]> => {
    const { restGetCollectionPage } = await import('./firestore-rest');
    const all: BenchmarkContract[] = [];
    let cursor: string | undefined;
    // Fetch up to 10,000 docs with field mask — small payload, fast to parse
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
  { revalidate: 21600, tags: ['cgd_contracts'] },
);

export async function getContractsForBenchmark(): Promise<BenchmarkContract[]> {
  if (!hasFirestoreCredentials()) return [];
  const cacheKey = 'benchmark_contracts';
  const cached = memGet<BenchmarkContract[]>(cacheKey);
  if (cached) return cached;
  try {
    const contracts = await fetchBenchmarkContractsFromFirestore();
    memSet(cacheKey, contracts, 6 * 60 * 60 * 1000);
    return contracts;
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
