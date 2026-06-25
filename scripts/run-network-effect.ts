/**
 * Run all three Network Effect loops against live Firestore data.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/run-network-effect.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/run-network-effect.ts --loop 1
 *   npx ts-node --project tsconfig.scripts.json scripts/run-network-effect.ts --loop 3
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import {
  loop1AgencyBenchmarks,
  loop2WinModels,
  loop3AnomalyDetection,
  matchPairs,
  type RawOutcome,
  type RawSimInput,
  type RawCommunityReport,
  type CrowdAnomalyResult,
} from '../lib/network-effect';

dotenv.config({ path: '.env.local' });

const args = process.argv.slice(2);
const loopFilter = (() => {
  const idx = args.indexOf('--loop');
  return idx !== -1 ? Number(args[idx + 1]) : null;
})();

function initFirebase() {
  if (admin.apps.length) return admin.app();
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey,
    }),
  });
}

async function fetchAll<T>(collection: string, limit = 50000): Promise<T[]> {
  const db = admin.firestore();
  const snap = await db.collection(collection).limit(limit).get();
  return snap.docs.map((d) => ({ ...d.data(), _id: d.id }) as unknown as T);
}

async function setDoc(collection: string, id: string, data: Record<string, unknown>) {
  const db = admin.firestore();
  await db.collection(collection).doc(id).set(data, { merge: true });
}

async function runLoop1() {
  console.log('\n── Loop 1: Agency discount benchmarks ──');
  const outcomes = await fetchAll<RawOutcome>('bid_outcomes');
  console.log(`  ${outcomes.length} bid outcomes loaded`);

  // Load e-GP benchmarks as reference
  const benchSnap = await admin.firestore().collection('benchmark_categories').get();
  const egpBenchmarks: Record<string, { median: number; p10: number; p25: number; p75: number; p90: number }> = {};
  for (const doc of benchSnap.docs) {
    const d = doc.data();
    egpBenchmarks[doc.id] = {
      median: d.median ?? 0, p10: d.p10 ?? 0, p25: d.p25 ?? 0,
      p75: d.p75 ?? 0, p90: d.p90 ?? 0,
    };
  }
  console.log(`  ${Object.keys(egpBenchmarks).length} e-GP benchmark categories loaded`);

  const results = loop1AgencyBenchmarks(outcomes, egpBenchmarks);
  console.log(`  ${results.length} agency benchmarks computed (gate: n≥20)`);

  for (const r of results) {
    const id = `${r.agency}__${r.project_type}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
    await setDoc('agency_benchmarks', id, r as unknown as Record<string, unknown>);
    console.log(`  ✓ ${r.agency} / ${r.project_type} (n=${r.n_behavioral}, source=${r.source})`);
  }

  if (results.length === 0) {
    console.log('  (no groups met the n≥20 gate yet)');
  }
}

async function runLoop2() {
  console.log('\n── Loop 2: Win probability models ──');
  const outcomes = await fetchAll<RawOutcome>('bid_outcomes');
  const simInputs = await fetchAll<RawSimInput>('simulator_inputs');
  console.log(`  ${outcomes.length} outcomes, ${simInputs.length} simulator inputs`);

  const pairs = matchPairs(outcomes, simInputs);
  console.log(`  ${pairs.length} matched pairs (session_id overlap)`);

  const models = loop2WinModels(pairs);
  console.log(`  ${models.length} win models computed (gate: n≥30 per group)`);

  for (const m of models) {
    const id = `${m.agency_category}__${m.project_type}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
    await setDoc('win_models', id, m as unknown as Record<string, unknown>);
    console.log(`  ✓ ${m.agency_category} / ${m.project_type} (n=${m.n_pairs}, coef=${m.discount_coef})`);
  }

  if (models.length === 0) {
    console.log('  (no groups met the n≥30 gate yet)');
  }
}

async function runLoop3() {
  console.log('\n── Loop 3: Crowd anomaly detection ──');
  const reports = await fetchAll<RawCommunityReport>('community_reports');
  const existing = await fetchAll<CrowdAnomalyResult>('crowd_anomalies');
  console.log(`  ${reports.length} community reports, ${existing.length} existing anomalies`);

  const results = loop3AnomalyDetection(reports, existing);
  console.log(`  ${results.length} anomaly groups detected`);

  for (const r of results) {
    const id = `${r.agency}__${r.pattern}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
    await setDoc('crowd_anomalies', id, r as unknown as Record<string, unknown>);
    console.log(`  ✓ ${r.agency} — ${r.pattern} (n=${r.report_count}, status=${r.status})`);
  }

  if (results.length === 0) {
    console.log('  (no agency reached the 2-report monitoring threshold yet)');
  }
}

async function main() {
  initFirebase();

  const runAll = loopFilter === null;

  if (runAll || loopFilter === 1) await runLoop1();
  if (runAll || loopFilter === 2) await runLoop2();
  if (runAll || loopFilter === 3) await runLoop3();

  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
