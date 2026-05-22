/**
 * Re-computes status for every Firestore tender using flowName (description) only.
 * Usage: ts-node --project tsconfig.scripts.json scripts/fix-status.ts
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n');

const existing = getApps().find(a => a.name === 'admin');
const app = existing ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'admin');
const db  = getFirestore(app);

const OPEN_KEYWORDS   = ['ประกาศเชิญชวน','เผยแพร่เอกสาร','รับซอง','ยื่นเสนอราคา','ประกาศราคากลาง','จัดทำร่าง'];
const CLOSED_KEYWORDS = ['จัดทำสัญญา','บริหารสัญญา','ยกเลิกโครงการ','ยกเลิก','อนุมัติสั่งซื้อ','อนุมัติสั่งจ้าง','ประกาศผู้ชนะ','ผู้ชนะ','สั่งซื้อสั่งจ้าง'];

function statusFromFlow(flowName: string = ''): 'open' | 'closed' {
  if (CLOSED_KEYWORDS.some(k => flowName.includes(k))) return 'closed';
  if (OPEN_KEYWORDS.some(k => flowName.includes(k))) return 'open';
  return 'open';
}

(async () => {
  const snap = await db.collection('tenders').get();
  console.log(`Processing ${snap.docs.length} documents...`);

  let open = 0, closed = 0;
  const BATCH = 499;

  for (let i = 0; i < snap.docs.length; i += BATCH) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + BATCH)) {
      const flowName = doc.data().description ?? '';
      const status = statusFromFlow(flowName);
      if (status === 'open') open++; else closed++;
      batch.update(doc.ref, { status, updatedAt: new Date().toISOString() });
    }
    await batch.commit();
  }

  console.log(`\nDone — open: ${open}, closed: ${closed}`);
  console.log(`Listing will now show ${open} active tenders.`);
})();
