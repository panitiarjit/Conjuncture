/**
 * Fetches awarded contracts from the CGD CKAN API and writes them to Firestore.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/fetch-cgd.ts [options]
 *
 * Options:
 *   --year <BE year>   Fiscal year (default: 2567). Can be 2567 or 2568.
 *   --keyword <text>   Full-text filter for project name (default: จ้างเหมา)
 *   --dry              Print counts only, do not write to Firestore
 *   --chunk <n>        Only process chunk index n (0-based, for partial runs)
 *   --all-bidders      Also fetch egpcost-bidder and tag losing bidders
 */
import 'dotenv/config';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { fetchContractChunk, fetchBidderMap } from '../lib/cgd/cgd-client';
import { CGD_CONTRACT_RESOURCES, EGPCOST_BIDDER_RESOURCES, type CgdContract } from '../lib/cgd/types';

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
};
const hasFlag = (flag: string) => args.includes(flag);

const YEAR = Number(getArg('--year') ?? '2567');
// If --keyword not passed, fetch ALL contract types (no filter).
// If --keyword passed with a value, filter by that keyword.
const KEYWORD = args.includes('--keyword') ? (getArg('--keyword') ?? '') : undefined;
const DRY = hasFlag('--dry');
const CHUNK_INDEX = getArg('--chunk') !== undefined ? Number(getArg('--chunk')) : null;
const ALL_BIDDERS = hasFlag('--all-bidders');

const CGD_API_KEY = process.env.CGD_API_KEY;
if (!CGD_API_KEY) {
  console.error('CGD_API_KEY env var required');
  process.exit(1);
}

// ── Firestore init ────────────────────────────────────────────────────────────

const CGD_COLLECTION = 'cgd_contracts';
const BATCH_SIZE = 499; // Firestore batch limit is 500

function initDb(): Firestore {
  let app = getApps().find((a) => a.name === 'cgd-fetch');
  if (!app) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      app = initializeApp(undefined, 'cgd-fetch');
    } else {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '')
        .replace(/\\\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .trim();
      if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Missing Firebase Admin env vars');
      }
      app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'cgd-fetch');
    }
  }
  return getFirestore(app);
}

async function batchUpsert(db: Firestore, contracts: CgdContract[]): Promise<void> {
  for (let i = 0; i < contracts.length; i += BATCH_SIZE) {
    const slice = contracts.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const c of slice) {
      const ref = db.collection(CGD_COLLECTION).doc(c.projectId);
      batch.set(ref, { ...c, _fetchedAt: new Date().toISOString() }, { merge: true });
    }
    await batch.commit();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const resourceIds = CGD_CONTRACT_RESOURCES[YEAR];
  if (!resourceIds) {
    console.error(`No resources configured for year ${YEAR}. Available: ${Object.keys(CGD_CONTRACT_RESOURCES).join(', ')}`);
    process.exit(1);
  }

  const chunks = CHUNK_INDEX !== null ? [resourceIds[CHUNK_INDEX]] : resourceIds;
  if (!chunks || chunks.some((c) => !c)) {
    console.error(`Invalid chunk index ${CHUNK_INDEX} for year ${YEAR} (${resourceIds.length} chunks)`);
    process.exit(1);
  }

  console.log(`[fetch-cgd] Year: ${YEAR} | Keyword: ${KEYWORD ? `"${KEYWORD}"` : '(all)'} | Chunks: ${chunks.length} | Dry: ${DRY}`);

  // Load bidder map upfront if requested
  let bidderMap: Map<string, string[]> | null = null;
  if (ALL_BIDDERS) {
    const bidderId = EGPCOST_BIDDER_RESOURCES[YEAR];
    if (!bidderId) {
      console.warn(`[fetch-cgd] No egpcost-bidder resource for year ${YEAR}, skipping bidder enrichment`);
    } else {
      console.log(`[fetch-cgd] Loading bidder map for ${YEAR}...`);
      bidderMap = await fetchBidderMap(bidderId, CGD_API_KEY);
      console.log(`[fetch-cgd] Bidder map loaded: ${bidderMap.size} projects with bidder data`);
    }
  }

  const db = DRY ? null : initDb();
  let totalFetched = 0;
  let totalUpserted = 0;
  let totalWithLosers = 0;

  for (let ci = 0; ci < chunks.length; ci++) {
    const resourceId = chunks[ci];
    console.log(`[fetch-cgd] Chunk ${ci + 1}/${chunks.length}: ${resourceId}`);
    let chunkCount = 0;
    const buffer: CgdContract[] = [];

    for await (const batch of fetchContractChunk(resourceId, KEYWORD as string | undefined, CGD_API_KEY)) {
      for (const contract of batch) {
        // Enrich with bidder/loser data if available
        if (bidderMap) {
          const allBidders = bidderMap.get(contract.projectId) ?? [];
          const winner = contract.winnerName?.trim().toLowerCase() ?? '';
          const losers = allBidders.filter((b) => b.trim().toLowerCase() !== winner);
          (contract as CgdContract & { bidders?: string[]; losers?: string[] }).bidders = allBidders;
          (contract as CgdContract & { losers?: string[] }).losers = losers;
          if (losers.length > 0) totalWithLosers++;
        }
        buffer.push(contract);
      }
      chunkCount += batch.length;

      if (!DRY && db && buffer.length >= BATCH_SIZE * 2) {
        const toWrite = buffer.splice(0, buffer.length);
        await batchUpsert(db, toWrite);
        totalUpserted += toWrite.length;
      }
    }

    if (!DRY && db && buffer.length > 0) {
      await batchUpsert(db, buffer);
      totalUpserted += buffer.length;
    }

    totalFetched += chunkCount;
    console.log(`[fetch-cgd] Chunk ${ci + 1} done: ${chunkCount} records (keyword: "${KEYWORD}")`);
  }

  console.log(`\n[fetch-cgd] Complete: ${totalFetched} fetched | ${DRY ? '0 (dry run)' : totalUpserted + ' upserted'} | ${totalWithLosers} with losers`);
}

main().catch((err) => {
  console.error('[fetch-cgd] Fatal:', err);
  process.exit(1);
});
