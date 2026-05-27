import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Tender, TenderStatus } from './types';

let app: App;
let db: Firestore;

function getAdminApp(): App {
  if (app) return app;
  const existing = getApps().find((a: App) => a.name === 'admin');

  // Prefer a pre-written credentials file (set by GitHub Actions via
  // FIREBASE_SERVICE_ACCOUNT_B64 → decoded JSON file). This completely
  // bypasses the private-key newline parsing issues.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = existing ?? initializeApp(undefined, 'admin');
    return app;
  }

  // Fall back to individual env vars (local dev).
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '')
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim() || undefined;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin env vars: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY'
    );
  }

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
/** Collection for e-GP methodId codes not yet in METHOD_ID_MAP. */
const UNKNOWN_METHODS_COLLECTION = 'unknown_method_ids';

/**
 * @param currentStatus  If the caller already knows the Firestore status (e.g. from a
 *   bulk read at the start of a refresh run), pass it here to skip the per-document
 *   read-before-write — saves 1 Firestore read per tender in refresh mode.
 */
export async function upsertTender(
  tender: Tender,
  currentStatus?: TenderStatus,
): Promise<{ wasNew: boolean }> {
  const ref = getDb().collection(COLLECTION).doc(tender.id);

  if (currentStatus !== undefined) {
    // Caller already has the current status — no per-doc read needed.
    // Downgrade protection still applies: never re-open a closed tender.
    const status =
      currentStatus === 'closed' && tender.status !== 'closed' ? 'closed' : tender.status;
    await ref.set({ ...tender, status, updatedAt: new Date().toISOString() }, { merge: true });
    return { wasNew: false }; // refresh mode only processes existing docs
  }

  // Normal path (new scrape): read to check existence and current status.
  // Never downgrade a closed tender back to open — B0 and W0 announcements share the
  // same projectId; whichever is processed last would otherwise overwrite the status.
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() : null;
  const status =
    existing?.status === 'closed' && tender.status !== 'closed' ? 'closed' : tender.status;
  await ref.set({ ...tender, status, updatedAt: new Date().toISOString() }, { merge: true });
  return { wasNew: !snap.exists };
}

/** Targeted query — only returns tenders still open or unresolved.
 *  Use this in status-refresh to avoid reading the entire collection. */
export async function getOpenOrUnknownTenders(): Promise<Tender[]> {
  const snap = await getDb()
    .collection(COLLECTION)
    .where('status', 'in', ['open', 'unknown'])
    .get();
  return snap.docs.map((doc) => {
    const { updatedAt: _u, ...tender } = doc.data();
    return tender as Tender;
  });
}

export async function getTendersFromFirestore(): Promise<Tender[]> {
  const PAGE = 500;
  const results: Tender[] = [];
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let query = getDb().collection(COLLECTION).orderBy('__name__').limit(PAGE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    for (const doc of snap.docs) {
      const { updatedAt: _u, ...tender } = doc.data();
      results.push(tender as Tender);
    }
    if (snap.docs.length < PAGE) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return results;
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

export async function forceCloseTenders(ids: string[]): Promise<void> {
  const BATCH_LIMIT = 499;
  const db = getDb();
  const now = new Date().toISOString();
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    ids.slice(i, i + BATCH_LIMIT).forEach((id) => {
      batch.update(db.collection(COLLECTION).doc(id), { status: 'closed', updatedAt: now });
    });
    await batch.commit();
  }
}

export async function getTenderByIdFromFirestore(id: string): Promise<Tender | undefined> {
  const snap = await getDb().collection(COLLECTION).doc(id).get();
  if (!snap.exists) return undefined;
  const { updatedAt: _u, ...tender } = snap.data()!;
  return tender as Tender;
}

export async function recordUnknownMethodId(
  methodId: string,
  sampleTitle: string,
  sampleFlowName?: string,
): Promise<void> {
  const ref = getDb().collection(UNKNOWN_METHODS_COLLECTION).doc(methodId);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({ count: (snap.data()!.count ?? 0) + 1, lastSeen: new Date().toISOString() });
  } else {
    await ref.set({
      methodId,
      sampleTitle,
      sampleFlowName: sampleFlowName ?? null,
      count: 1,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    });
  }
}

export async function getUnknownMethodIds(): Promise<
  Array<{ methodId: string; sampleTitle: string; sampleFlowName: string | null; count: number }>
> {
  const snap = await getDb().collection(UNKNOWN_METHODS_COLLECTION).get();
  return snap.docs.map(
    (doc) =>
      doc.data() as {
        methodId: string;
        sampleTitle: string;
        sampleFlowName: string | null;
        count: number;
      },
  );
}
