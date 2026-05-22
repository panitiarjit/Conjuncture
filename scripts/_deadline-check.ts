import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = getApps().find((a: App) => a.name === 'admin') ?? initializeApp({
  credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!, privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n') })
}, 'admin');
const db = getFirestore(app);

async function main() {
  const snap = await db.collection('tenders').limit(15).get();
  console.log('Sample of deadlines:');
  for (const doc of snap.docs) {
    const d = doc.data();
    console.log(`ID: ${doc.id}  deadline: ${d.deadline}  status: ${d.status}  flowName: ${d.description?.slice(0,30)}`);
  }
}
main().catch(console.error).finally(() => process.exit(0));
