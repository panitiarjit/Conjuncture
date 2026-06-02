/**
 * Client for Thailand Government Spending CKAN API (opend.data.go.th)
 *
 * Uses the CKAN datastore_search endpoint to paginate through datasets.
 * API key is passed via the `api-key` header.
 *
 * DNS note: opend.data.go.th/get-ckan/* redirects to data.go.th/api/3/action/*.
 * Some DNS resolvers (corporate/hotspot) return SERVFAIL for data.go.th.
 * We patch dns.lookup so Node's undici (global fetch) can resolve it.
 */
import dns from 'node:dns';
import type {
  CkanResponse,
  RawCgdContract,
  RawEgpCostBidder,
  CgdContract,
  CgdBidder,
} from './types';

// Patch dns.lookup so undici/fetch can reach data.go.th when local DNS fails.
// data.go.th → Cloudflare Anycast (104.18.24.9).
const _originalLookup = dns.lookup.bind(dns);
const CGD_HOST_IP = '104.18.24.9';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(dns as any).lookup = function patchedLookup(hostname: string, ...args: any[]) {
  if (hostname === 'data.go.th') {
    // Node internals call dns.lookup with { hints, all: true } — callback expects array form.
    const opts = typeof args[0] === 'object' ? args[0] : {};
    const cb = (typeof args[args.length - 1] === 'function' ? args[args.length - 1] : args[0]) as Function;
    if (opts.all) {
      cb(null, [{ address: CGD_HOST_IP, family: 4 }]);
    } else {
      cb(null, CGD_HOST_IP, 4);
    }
    return;
  }
  return (_originalLookup as Function)(hostname, ...args);
};

// Use data.go.th directly (the canonical CKAN action API) to avoid double round-trip.
const CKAN_BASE = 'https://data.go.th/api/3/action/datastore_search';
const RATE_LIMIT_MS = 500;
const PAGE_SIZE = 1000;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function ckanFetch<T>(
  resourceId: string,
  offset: number,
  limit: number,
  q?: string,
  apiKey?: string,
): Promise<CkanResponse<T>> {
  const params = new URLSearchParams({
    resource_id: resourceId,
    offset: String(offset),
    limit: String(limit),
  });
  if (q) params.set('q', q);

  const url = `${CKAN_BASE}?${params}`;
  const headers: Record<string, string> = {};
  const key = apiKey ?? process.env.CGD_API_KEY;
  if (key) headers['api-key'] = key;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`CKAN fetch failed: ${res.status} ${url}`);
  return res.json() as Promise<CkanResponse<T>>;
}

/** Yield all records from a CKAN resource, paginating automatically. */
async function* paginateResource<T>(
  resourceId: string,
  q?: string,
  apiKey?: string,
  startOffset = 0,
): AsyncGenerator<T[]> {
  let offset = startOffset;
  let total: number | null = null;

  while (true) {
    const data = await ckanFetch<T>(resourceId, offset, PAGE_SIZE, q, apiKey);
    if (!data.success) throw new Error(`CKAN returned success:false for ${resourceId}`);

    total ??= data.result.total;
    const records = data.result.records;
    if (records.length === 0) break;

    yield records;

    offset += records.length;
    if (offset >= total) break;
    await sleep(RATE_LIMIT_MS);
  }
}

// ── Normalisation helpers ─────────────────────────────────────────────────────

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || v === '-') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function normaliseCgdContract(raw: RawCgdContract): CgdContract {
  const budget = toNum(raw['งบประมาณ(บาท)']);
  const ref = toNum(raw['ราคากลาง(บาท)']);
  const agreed = toNum(raw['ราคาตกลงซื้อ/จ้าง']);
  const discount =
    ref && agreed && ref > 0 ? Math.round(((ref - agreed) / ref) * 10000) / 100 : null;

  return {
    projectId: String(raw.รหัสโครงการ),
    projectName: raw.ชื่อโครงการ ?? '',
    projectType: raw.ชื่อประเภทโครงการ ?? '',
    agency: raw.ชื่อหน่วยงาน ?? '',
    subAgency: raw.ชื่อหน่วยงานย่อย ?? '',
    procurementMethod: raw['วิธีจัดซื้อฯ'] ?? '',
    procurementMethodGroup: raw['กลุ่มวิธีจัดซื้อฯ'] ?? '',
    announceDate: raw.วันที่ประกาศ ?? '',
    transactionDate: raw.วันที่เกิดรายการ ?? '',
    budget,
    referencePrice: ref,
    agreedPrice: agreed,
    fiscalYear: raw.ปีงบประมาณ,
    province: raw.จังหวัด ?? '',
    provinceEn: raw['จังหวัด(Eng)'] ?? '',
    district: raw['เขต/อำเภอ'] ?? '',
    districtEn: raw['เขต/อำเภอ(Eng)'] ?? '',
    subDistrict: raw['แขวง/ตำบล'] ?? '',
    subDistrictEn: raw['แขวง/ตำบล(Eng)'] != null ? String(raw['แขวง/ตำบล(Eng)']) : '',
    gpsPoint: raw.พิกัดของโครงการ != null ? String(raw.พิกัดของโครงการ) : '',
    projectStatus: raw.สถานะโครงการ != null ? String(raw.สถานะโครงการ) : null,
    latitude: toNum(raw.ละติจูดโครงการ),
    longitude: toNum(raw.ลองจิจูดโครงการ),
    winnerName: raw.ชื่อผู้ชนะ ?? null,
    winnerBusinessId: raw.เลขนิติบุคคล ?? null,
    contractNo: raw.เลขที่สัญญา ?? null,
    contractSignDate: raw.วันที่ลงนามสัญญา ?? null,
    contractEndDate: raw.วันที่สิ้นสุดสัญญา ?? null,
    contractValue: toNum(raw['งบสัญญา(บาท)']),
    contractStatus: raw.สถานะสัญญา ?? null,
    discountFromReference: discount,
  };
}

function normaliseBidder(raw: RawEgpCostBidder): CgdBidder {
  return {
    costId: raw['เลขที่ CoST'],
    projectId: String(raw.เลขที่โครงการ),
    fiscalYear: raw.ปีงบประมาณ,
    bidderName: raw.ชื่อผู้เสนอราคา ?? '',
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch all contracts from a cgd-contract resource chunk, optionally filtered
 * by keyword (full-text search across all fields, including project name).
 */
export async function* fetchContractChunk(
  resourceId: string,
  keyword?: string,
  apiKey?: string,
  startOffset = 0,
): AsyncGenerator<CgdContract[]> {
  for await (const batch of paginateResource<RawCgdContract>(resourceId, keyword, apiKey, startOffset)) {
    yield batch.map(normaliseCgdContract);
  }
}

/**
 * Fetch all bidder records from an egpcost-bidder resource.
 * Returns a map: projectId → bidder names array.
 */
export async function fetchBidderMap(
  resourceId: string,
  apiKey?: string,
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for await (const batch of paginateResource<RawEgpCostBidder>(resourceId, undefined, apiKey)) {
    for (const raw of batch) {
      const b = normaliseBidder(raw);
      if (!map.has(b.projectId)) map.set(b.projectId, []);
      map.get(b.projectId)!.push(b.bidderName);
    }
  }
  return map;
}

/** Quick total-record count for a resource (single request, limit=0). */
export async function getResourceTotal(resourceId: string, apiKey?: string): Promise<number> {
  const data = await ckanFetch<unknown>(resourceId, 0, 0, undefined, apiKey);
  return data.result.total;
}
