/**
 * Fetches the full historical CGD dataset into Firestore in daily batches.
 *
 * Firestore free tier allows 20k writes/day (resets midnight Pacific = 14:00 BKK).
 * This script writes up to DAILY_LIMIT records per run, saves progress to
 * .fetch-historical-state.json, and resumes from that position next run.
 *
 * Schedule via launchd to run daily at 14:05 BKK (07:05 UTC).
 *
 * Usage:
 *   npm run fetch-historical          — resume from saved state (or start fresh)
 *   npm run fetch-historical -- --reset  — clear state and restart from beginning
 *   npm run fetch-historical -- --status — show current progress without fetching
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { fetchContractChunk } from '../lib/cgd/cgd-client';
import { CGD_CONTRACT_RESOURCES } from '../lib/cgd/types';

const DAILY_LIMIT   = 18_000; // conservative buffer below 20k free tier
const BATCH_SIZE    = 499;    // Firestore batch limit
const STATE_FILE    = path.join(process.cwd(), '.fetch-historical-state.json');
const CGD_COLLECTION = 'cgd_contracts';

// Fetch order: most recent first so newest data is available soonest
const ALL_YEARS = [2568, 2567, 2566, 2565, 2564, 2563, 2562, 2561, 2560, 2559];

interface FetchState {
  yearIndex:    number;   // index into ALL_YEARS
  chunkIndex:   number;   // index into CGD_CONTRACT_RESOURCES[year]
  offset:       number;   // pagination offset within current chunk
  totalWritten: number;   // all-time total written to Firestore
  done:         boolean;
  lastRun:      string;
}

const DEFAULT_STATE: FetchState = {
  yearIndex: 0, chunkIndex: 0, offset: 0,
  totalWritten: 0, done: false, lastRun: '',
};

function loadState(): FetchState {
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(state: FetchState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function initDb(): Firestore {
  let app = getApps().find((a) => a.name === 'hist-fetch');
  if (!app) {
    const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey  = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '')
      .replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').trim();
    if (!projectId || !clientEmail || !privateKey)
      throw new Error('Missing Firebase Admin env vars');
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'hist-fetch');
  }
  return getFirestore(app);
}

async function batchWrite(db: Firestore, contracts: ReturnType<typeof Array.prototype.map>): Promise<void> {
  for (let i = 0; i < contracts.length; i += BATCH_SIZE) {
    const slice = contracts.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const c of slice) {
      const ref = db.collection(CGD_COLLECTION).doc((c as any).projectId);
      batch.set(ref, { ...(c as any), _fetchedAt: new Date().toISOString() }, { merge: true });
    }
    await batch.commit();
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--reset')) {
    fs.rmSync(STATE_FILE, { force: true });
    console.log('State reset. Run again without --reset to start fetching.');
    return;
  }

  const state = loadState();

  if (args.includes('--status')) {
    if (state.done) {
      console.log('✅ All historical data fetched. Total written:', state.totalWritten.toLocaleString());
    } else {
      const year = ALL_YEARS[state.yearIndex];
      const chunks = CGD_CONTRACT_RESOURCES[year] ?? [];
      console.log(`Progress: year ${year} (${state.yearIndex + 1}/${ALL_YEARS.length}), chunk ${state.chunkIndex + 1}/${chunks.length}, offset ${state.offset.toLocaleString()}`);
      console.log(`Total written all-time: ${state.totalWritten.toLocaleString()}`);
      console.log(`Last run: ${state.lastRun || 'never'}`);
    }
    return;
  }

  if (state.done) {
    console.log('✅ Already complete. Total written:', state.totalWritten.toLocaleString());
    return;
  }

  const apiKey = process.env.CGD_API_KEY;
  if (!apiKey) { console.error('CGD_API_KEY env var required'); process.exit(1); }

  const db = initDb();
  let writtenToday = 0;
  state.lastRun = new Date().toISOString();

  outer: while (state.yearIndex < ALL_YEARS.length) {
    const year   = ALL_YEARS[state.yearIndex];
    const chunks = CGD_CONTRACT_RESOURCES[year] ?? [];

    while (state.chunkIndex < chunks.length) {
      const chunkId = chunks[state.chunkIndex];
      console.log(`[fetch-historical] Year ${year} chunk ${state.chunkIndex + 1}/${chunks.length} offset ${state.offset.toLocaleString()}`);

      try {
        for await (const batch of fetchContractChunk(chunkId, undefined, apiKey, state.offset)) {
          await batchWrite(db, batch);
          writtenToday    += batch.length;
          state.offset    += batch.length;
          state.totalWritten += batch.length;
          saveState(state);
          console.log(`  +${batch.length} written | today: ${writtenToday.toLocaleString()} | all-time: ${state.totalWritten.toLocaleString()}`);

          if (writtenToday >= DAILY_LIMIT) {
            console.log(`Daily limit reached (${writtenToday}). Stopping — resume tomorrow.`);
            break outer;
          }
        }
      } catch (err) {
        console.error(`Error on chunk ${chunkId}:`, (err as Error).message);
        saveState(state);
        process.exit(1);
      }

      // Chunk done — advance to next
      state.chunkIndex++;
      state.offset = 0;
      saveState(state);
      console.log(`  Chunk complete.`);
    }

    // Year done — advance to next
    console.log(`[fetch-historical] Year ${year} complete.`);
    state.yearIndex++;
    state.chunkIndex = 0;
    state.offset = 0;
    saveState(state);
  }

  if (state.yearIndex >= ALL_YEARS.length) {
    state.done = true;
    saveState(state);
    console.log(`✅ All historical data fetched. Total written: ${state.totalWritten.toLocaleString()}`);
  }
}

main().catch((err) => {
  console.error('[fetch-historical] Fatal:', err);
  process.exit(1);
});
