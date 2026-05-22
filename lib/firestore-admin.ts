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

export async function getTendersFromFirestore(limit = 200): Promise<Tender[]> {
  const snap = await getDb()
    .collection(COLLECTION)
    .orderBy('deadline', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = doc.data();
    // Strip server-side fields before returning domain type
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { updatedAt: _u, ...tender } = data;
    return tender as Tender;
  });
}

export async function getTenderByIdFromFirestore(id: string): Promise<Tender | undefined> {
  const snap = await getDb().collection(COLLECTION).doc(id).get();
  if (!snap.exists) return undefined;
  const { updatedAt: _u, ...tender } = snap.data()!;
  return tender as Tender;
}
