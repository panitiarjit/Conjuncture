/**
 * Reads the current Firestore tenders and groups "other" titles so we can
 * see what keyword patterns are missing.
 * Usage: ts-node --project tsconfig.scripts.json scripts/audit-categories.ts
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n');

const existing = getApps().find(a => a.name === 'admin');
const app = existing ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'admin');
const db  = getFirestore(app);

(async () => {
  const snap = await db.collection('tenders').get();
  const counts: Record<string, number> = {};
  const otherTitles: string[] = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    counts[d.category] = (counts[d.category] ?? 0) + 1;
    if (d.category === 'other') otherTitles.push(d.title);
  }

  console.log('\n── Category breakdown ───────────────────────');
  Object.entries(counts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`  ${k.padEnd(12)} ${v}`)
  );

  console.log(`\n── "other" titles (${otherTitles.length}) ───────────────────`);
  otherTitles.slice(0, 60).forEach(t => console.log(' •', t.slice(0, 80)));
})();
