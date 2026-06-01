/**
 * Fetches only the CoST transparency contracts from CGD and writes them to
 * Firestore cgd_contracts with loser data populated.
 *
 * CoST (Construction Sector Transparency Initiative) projects are
 * จ้างก่อสร้าง type, NOT filtered by the main fetch-cgd keyword (จ้างเหมา).
 * This script bridges that gap by looking up each CoST project ID directly.
 *
 * Usage: npx ts-node --project tsconfig.scripts.json scripts/fetch-cost-contracts.ts [--dry] [--year 2567]
 */
import 'dotenv/config';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { fetchBidderMap } from '../lib/cgd/cgd-client';
import type { CgdContract } from '../lib/cgd/types';
import { CGD_CONTRACT_RESOURCES, EGPCOST_BIDDER_RESOURCES } from '../lib/cgd/types';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const YEAR = Number(args[args.indexOf('--year') + 1] ?? '2567');
const CGD_API_KEY = process.env.CGD_API_KEY;
const CKAN_BASE = 'https://data.go.th/api/3/action/datastore_search';
const RATE_MS = 300;

if (!CGD_API_KEY) { console.error('CGD_API_KEY required'); process.exit(1); }

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

function toNum(v: unknown): number | null {
  if (v == null || v === '' || v === '-') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

async function lookupContract(
  resourceId: string,
  projectId: string,
  apiKey: string,
): Promise<Record<string, unknown> | null> {
  const url = `${CKAN_BASE}?resource_id=${resourceId}&filters=${encodeURIComponent(JSON.stringify({ 'รหัสโครงการ': Number(projectId) }))}&limit=1`;
  const res = await fetch(url, { headers: { 'api-key': apiKey } });
  if (!res.ok) return null;
  const data = await res.json() as { success: boolean; result: { records: Record<string, unknown>[] } };
  return data.result.records[0] ?? null;
}

function normalise(raw: Record<string, unknown>, losers: string[]): CgdContract & { losers: string[]; bidders: string[] } {
  const budget = toNum(raw['งบประมาณ(บาท)']);
  const ref = toNum(raw['ราคากลาง(บาท)']);
  const agreed = toNum(raw['ราคาตกลงซื้อ/จ้าง']);
  const discount = ref && agreed && ref > 0 ? Math.round(((ref - agreed) / ref) * 10000) / 100 : null;
  return {
    projectId: String(raw['รหัสโครงการ']),
    projectName: String(raw['ชื่อโครงการ'] ?? ''),
    projectType: String(raw['ชื่อประเภทโครงการ'] ?? ''),
    agency: String(raw['ชื่อหน่วยงาน'] ?? ''),
    subAgency: String(raw['ชื่อหน่วยงานย่อย'] ?? ''),
    procurementMethod: String(raw['วิธีจัดซื้อฯ'] ?? ''),
    procurementMethodGroup: String(raw['กลุ่มวิธีจัดซื้อฯ'] ?? ''),
    announceDate: String(raw['วันที่ประกาศ'] ?? ''),
    budget,
    referencePrice: ref,
    agreedPrice: agreed,
    fiscalYear: Number(raw['ปีงบประมาณ'] ?? YEAR),
    province: String(raw['จังหวัด'] ?? ''),
    winnerName: raw['ชื่อผู้ชนะ'] ? String(raw['ชื่อผู้ชนะ']) : null,
    winnerBusinessId: raw['เลขนิติบุคคล'] ? String(raw['เลขนิติบุคคล']) : null,
    contractNo: raw['เลขที่สัญญา'] ? String(raw['เลขที่สัญญา']) : null,
    contractSignDate: raw['วันที่ลงนามสัญญา'] ? String(raw['วันที่ลงนามสัญญา']) : null,
    contractEndDate: raw['วันที่สิ้นสุดสัญญา'] ? String(raw['วันที่สิ้นสุดสัญญา']) : null,
    contractValue: toNum(raw['งบสัญญา(บาท)']),
    contractStatus: raw['สถานะสัญญา'] ? String(raw['สถานะสัญญา']) : null,
    discountFromReference: discount,
    losers,
    bidders: losers, // CoST always includes winner in the bidder list
  };
}

function initDb(): Firestore {
  let app = getApps().find((a) => a.name === 'cost-fetch');
  if (!app) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '').replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').trim();
    if (!projectId || !clientEmail || !privateKey) throw new Error('Missing Firebase Admin env vars');
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'cost-fetch');
  }
  return getFirestore(app);
}

async function main() {
  const bidderId = EGPCOST_BIDDER_RESOURCES[YEAR];
  if (!bidderId) { console.error(`No egpcost-bidder resource for year ${YEAR}`); process.exit(1); }

  console.log(`[cost-fetch] Year: ${YEAR} | Dry: ${DRY}`);
  console.log(`[cost-fetch] Loading CoST bidder map...`);
  const bidderMap = await fetchBidderMap(bidderId, CGD_API_KEY);
  console.log(`[cost-fetch] ${bidderMap.size} CoST projects`);

  const chunks = CGD_CONTRACT_RESOURCES[YEAR];
  if (!chunks) { console.error(`No contract resources for year ${YEAR}`); process.exit(1); }

  const db = DRY ? null : initDb();
  let found = 0;
  let written = 0;

  const projectIds = [...bidderMap.keys()];

  for (const projectId of projectIds) {
    const allBidders = bidderMap.get(projectId)!;
    let raw: Record<string, unknown> | null = null;

    // Search each chunk until found
    for (const chunkId of chunks) {
      raw = await lookupContract(chunkId, projectId, CGD_API_KEY!);
      await sleep(RATE_MS);
      if (raw) break;
    }

    if (!raw) {
      console.warn(`[cost-fetch] Project ${projectId} not found in any chunk`);
      continue;
    }

    const winnerName = raw['ชื่อผู้ชนะ'] ? String(raw['ชื่อผู้ชนะ']).trim().toLowerCase() : '';
    const losers = allBidders.filter((b) => b.trim().toLowerCase() !== winnerName);
    const contract = normalise(raw, losers);

    found++;
    console.log(`[cost-fetch] ${found}/${projectIds.length} — ${contract.projectName.slice(0, 60)} | losers: ${losers.length}`);

    if (!DRY && db) {
      const ref = db.collection('cgd_contracts').doc(projectId);
      await ref.set({ ...contract, _fetchedAt: new Date().toISOString() }, { merge: true });
      written++;
    }
  }

  console.log(`\n[cost-fetch] Done: ${found} found | ${DRY ? '0 (dry)' : written + ' written'}`);
}

main().catch((e) => { console.error('[cost-fetch] Fatal:', e); process.exit(1); });
