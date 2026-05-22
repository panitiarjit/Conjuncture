/**
 * Re-runs mapCategory on every Firestore tender currently in "other"
 * using the stored title + description (= flowName). No API call, no CapSolver token.
 * Usage: ts-node --project tsconfig.scripts.json scripts/reclassify-other.ts
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

(async () => {
  const snap = await db.collection('tenders').where('category', '==', 'other').get();
  console.log(`Found ${snap.docs.length} "other" documents to re-classify`);

  const counts: Record<string, number> = {};
  let updated = 0;

  const BATCH = 499;
  for (let i = 0; i < snap.docs.length; i += BATCH) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + BATCH)) {
      const d = doc.data();
      // description stores flowName; typeId is not saved so pass null
      const newCat = mapCategory(null, d.description ?? '', d.title ?? '');
      counts[newCat] = (counts[newCat] ?? 0) + 1;
      if (newCat !== 'other') {
        batch.update(doc.ref, { category: newCat, updatedAt: new Date().toISOString() });
        updated++;
      }
    }
    await batch.commit();
  }

  console.log('\n── Re-classification result ──────────────────');
  Object.entries(counts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`  ${k.padEnd(12)} ${v}`)
  );
  console.log(`\nUpdated: ${updated} / ${snap.docs.length} documents`);
})();
