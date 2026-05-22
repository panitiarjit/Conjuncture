/**
 * Recalculates deadline + category for every Firestore tender using the current mapper.
 * Derives project date from the stored document ID and flowName from description.
 * Usage: ts-node --project tsconfig.scripts.json scripts/fix-deadlines.ts
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { mapCategory } from '../lib/scraper/egp-mapper';

const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n');

const existing = getApps().find(a => a.name === 'admin');
const app = existing ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'admin');
const db  = getFirestore(app);

function dateFromProjectId(id: string): string | null {
  const match = id.match(/^(\d{2})(\d{2})/);
  if (!match) return null;
  const beYear = 2500 + parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  return `${beYear - 543}-${String(month).padStart(2, '0')}-15`;
}

function estimateDeadline(projectDate: string, flowName: string, title: string): string {
  let days = 90;
  if (/เฉพาะเจาะจง/.test(title + flowName)) days = 45;
  const d = new Date(projectDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

(async () => {
  const snap = await db.collection('tenders').get();
  console.log(`Processing ${snap.docs.length} documents...`);

  const today = new Date().toISOString().slice(0, 10);
  let updated = 0;
  let skipped = 0;

  const BATCH = 499;
  for (let i = 0; i < snap.docs.length; i += BATCH) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + BATCH)) {
      const d = doc.data();
      const projectDate = dateFromProjectId(doc.id);
      if (!projectDate) { skipped++; continue; }

      const flowName = d.description ?? '';
      const title    = d.title ?? '';
      const deadline = estimateDeadline(projectDate, flowName, title);
      const category = mapCategory(null, flowName, title);

      batch.update(doc.ref, { deadline, category, updatedAt: new Date().toISOString() });
      updated++;
    }
    await batch.commit();
  }

  // Count active records after fix
  const activeSnap = await db.collection('tenders').where('deadline', '>=', today).get();
  const counts: Record<string, number> = {};
  for (const doc of activeSnap.docs) counts[doc.data().category] = (counts[doc.data().category] ?? 0) + 1;

  console.log(`\nUpdated: ${updated}, Skipped: ${skipped}`);
  console.log(`Active (deadline >= today): ${activeSnap.docs.length}`);
  console.log('\n── Category breakdown (active only) ─────────');
  Object.entries(counts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`  ${k.padEnd(14)} ${v}`)
  );
})();
