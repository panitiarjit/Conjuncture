import 'server-only';
import type { AwardedContract, SoeTender } from './types';

// Module-level in-memory cache — persists across requests on the same warm Worker instance.
// unstable_cache is NOT used: it calls new Function() internally which is blocked in Workers.
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
// Field-masked like benchmark to avoid full-doc payload timeouts on Cloudflare Workers.
// Includes every field used by IntelligenceView and the export-prospects API.
// Budget: 5k reads/day (24h cache, 5k docs × 1 revalidation/day).
const INTEL_FIELDS = [
  'projectId', 'projectName', 'agency', 'province', 'projectType',
  'procurementMethodGroup', 'budget', 'referencePrice', 'agreedPrice',
  'discountFromReference', 'winnerName', 'winnerBusinessId', 'fiscalYear', 'losers',
];

async function fetchAwardedContractsFromFirestore(): Promise<AwardedContract[]> {
  const { restGetCollectionPage } = await import('./firestore-rest');
  const all: AwardedContract[] = [];
  let cursor: string | undefined;
  do {
    const { docs, nextPageToken } = await restGetCollectionPage<AwardedContract>(
      'cgd_contracts',
      300,
      cursor,
      INTEL_FIELDS,
    );
    all.push(...docs);
    cursor = nextPageToken;
  } while (cursor && all.length < 5_000);
  return all;
}

export async function getAwardedContracts(keyword?: string): Promise<AwardedContract[]> {
  if (!hasFirestoreCredentials()) return [];
  const cacheKey = 'intel_contracts';
  const cached = memGet<AwardedContract[]>(cacheKey);
  if (cached) {
    if (!keyword) return cached;
    const kw = keyword.toLowerCase();
    return cached.filter((c) => c.projectName?.toLowerCase().includes(kw));
  }
  try {
    const contracts = await fetchAwardedContractsFromFirestore();
    memSet(cacheKey, contracts, 24 * 60 * 60 * 1000);
    if (!keyword) return contracts;
    const kw = keyword.toLowerCase();
    return contracts.filter((c) => c.projectName?.toLowerCase().includes(kw));
  } catch (err) {
    console.error('[data-service] getAwardedContracts failed:', (err as Error).message);
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

async function fetchBenchmarkContractsFromFirestore(): Promise<BenchmarkContract[]> {
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
}

export async function getContractsForBenchmark(): Promise<BenchmarkContract[]> {
  if (!hasFirestoreCredentials()) return [];
  const cacheKey = 'benchmark_contracts';
  const cached = memGet<BenchmarkContract[]>(cacheKey);
  if (cached) return cached;
  try {
    const contracts = await fetchBenchmarkContractsFromFirestore();
    memSet(cacheKey, contracts, 24 * 60 * 60 * 1000);
    return contracts;
  } catch (err) {
    console.error('[data-service] getContractsForBenchmark failed:', (err as Error).message);
    return [];
  }
}

// ── Agency intel contracts (field-masked, paginated) ─────────────────────────
// Field-masked like benchmark to avoid full-doc payload timeouts in Workers.
// Budget: 5k reads/day (24h cache). Matches the agency-intel line in CLAUDE.md.
export type AgencyIntelContract = {
  id: string;
  projectId?: string;
  projectName: string;
  agency: string;
  projectType: string;
  budget: number | null;
  agreedPrice: number | null;
  discountFromReference: number | null;
  fiscalYear: number;
  winnerName: string | null;
  winnerBusinessId: string | null;
  announceDate: string;
};

const AGENCY_INTEL_FIELDS = [
  'projectId', 'projectName', 'agency', 'projectType',
  'budget', 'agreedPrice', 'discountFromReference',
  'fiscalYear', 'winnerName', 'winnerBusinessId', 'announceDate',
];

async function fetchAgencyIntelContractsFromFirestore(): Promise<AgencyIntelContract[]> {
  const { restGetCollectionPage } = await import('./firestore-rest');
  const all: AgencyIntelContract[] = [];
  let cursor: string | undefined;
  do {
    const { docs, nextPageToken } = await restGetCollectionPage<AgencyIntelContract>(
      'cgd_contracts',
      300,
      cursor,
      AGENCY_INTEL_FIELDS,
    );
    all.push(...docs);
    cursor = nextPageToken;
  } while (cursor && all.length < 5_000);
  return all;
}

export async function getAgencyIntelContracts(): Promise<AgencyIntelContract[]> {
  if (!hasFirestoreCredentials()) return [];
  const cacheKey = 'agency_intel_contracts';
  const cached = memGet<AgencyIntelContract[]>(cacheKey);
  if (cached) return cached;
  try {
    const contracts = await fetchAgencyIntelContractsFromFirestore();
    memSet(cacheKey, contracts, 24 * 60 * 60 * 1000);
    return contracts;
  } catch (err) {
    console.error('[data-service] getAgencyIntelContracts failed:', (err as Error).message);
    return [];
  }
}

// ── Contractor intel (contractor_intel Firestore collection) ──────────────────
// Written by scripts/analyze-contractors.ts (manual run).
// Cached 24h — small collection (~500–2k docs), safe to load in full.

import type { ContractorSignal } from './contractor-intel-types';
export type { ContractorSignal };

async function fetchContractorIntelFromFirestore(): Promise<ContractorSignal[]> {
  const { restGetCollectionPage } = await import('./firestore-rest');
  const all: ContractorSignal[] = [];
  let cursor: string | undefined;
  do {
    const { docs, nextPageToken } = await restGetCollectionPage<ContractorSignal>(
      'contractor_intel',
      500,
      cursor,
    );
    all.push(...docs);
    cursor = nextPageToken;
  } while (cursor);
  return all;
}

async function getAllContractorIntel(): Promise<ContractorSignal[]> {
  if (!hasFirestoreCredentials()) return [];
  const cached = memGet<ContractorSignal[]>('contractor_intel');
  if (cached) return cached;
  try {
    const data = await fetchContractorIntelFromFirestore();
    memSet('contractor_intel', data, 24 * 60 * 60 * 1000);
    return data;
  } catch (err) {
    console.error('[data-service] getAllContractorIntel failed:', (err as Error).message);
    return [];
  }
}

export async function getContractorIntel(name: string): Promise<ContractorSignal | null> {
  const all = await getAllContractorIntel();
  const needle = name.trim().toLowerCase();
  return all.find(c => c.winnerName.toLowerCase().includes(needle)) ?? null;
}

export async function getFlaggedContractors(minFlags = 1): Promise<ContractorSignal[]> {
  const all = await getAllContractorIntel();
  return all.filter(c => c.flag_count >= minFlags);
}

export async function getAllContractorIntelForPage(): Promise<ContractorSignal[]> {
  return getAllContractorIntel();
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
