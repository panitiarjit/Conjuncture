import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Tender } from './types';

let app: App;
let db: Firestore;

function getAdminApp(): App {
  if (app) return app;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin env vars: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY'
    );
  }

  const existing = getApps().find((a: App) => a.name === 'admin');
  app = existing ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'admin');
  return app;
}

function getDb(): Firestore {
  if (db) return db;
  db = getFirestore(getAdminApp());
  return db;
}

/** Collection name for scraped tenders. */
const COLLECTION = 'tenders';

export async function upsertTender(tender: Tender): Promise<{ wasNew: boolean }> {
  const ref = getDb().collection(COLLECTION).doc(tender.id);
  const snap = await ref.get();
  await ref.set({ ...tender, updatedAt: new Date().toISOString() }, { merge: true });
  return { wasNew: !snap.exists };
}

export async function getTendersFromFirestore(limit = 500): Promise<Tender[]> {
  // Filter by status=='open' — flowName from the e-GP portal is the source of truth
  // for whether a project is still accepting bids, not an estimated deadline.
  const snap = await getDb()
    .collection(COLLECTION)
    .where('status', '==', 'open')
    .limit(limit)
    .get();

  return snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = doc.data();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { updatedAt: _u, ...tender } = data;
    return tender as Tender;
  });
}

export async function pruneExpiredTenders(): Promise<number> {
  // Remove records the e-GP portal has moved to a closed stage.
  // Daily scrape updates status; this prune cleans up what was closed since last run.
  const snap = await getDb()
    .collection(COLLECTION)
    .where('status', '==', 'closed')
    .get();

  if (snap.empty) return 0;

  let deleted = 0;
  const BATCH_LIMIT = 499;
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = getDb().batch();
    snap.docs.slice(i, i + BATCH_LIMIT).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += Math.min(BATCH_LIMIT, snap.docs.length - i);
  }
  return deleted;
}

export async function getTenderByIdFromFirestore(id: string): Promise<Tender | undefined> {
  const snap = await getDb().collection(COLLECTION).doc(id).get();
  if (!snap.exists) return undefined;
  const { updatedAt: _u, ...tender } = snap.data()!;
  return tender as Tender;
}
