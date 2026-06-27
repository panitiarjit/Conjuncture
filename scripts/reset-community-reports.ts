/**
 * Deletes all community_reports documents and resets the contributor_stats counter.
 * Run once: npx ts-node --project tsconfig.scripts.json scripts/reset-community-reports.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { restGetCollection, restSetDocument } from '../lib/firestore-rest';

// Firestore REST delete (not in firestore-rest.ts yet)
async function deleteDocument(collection: string, id: string): Promise<void> {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
  // Use the same JWT approach — import getAccessToken trick
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${id}`;
  // We need a token — re-use the module-level cache via a dummy read
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${await getToken()}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE ${collection}/${id}: ${res.status}`);
  }
}

async function getToken(): Promise<string> {
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
  const privateKeyPem = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);

  function b64url(buf: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return Buffer.from(s, 'binary').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  const header = b64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = b64url(Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })));

  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(privateKeyPem, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${header}.${payload}.${sig}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const { access_token } = await res.json() as { access_token: string };
  return access_token;
}

async function main() {
  const reports = await restGetCollection<{ id: string }>('community_reports', 500);
  console.log(`Found ${reports.length} community report(s).`);

  for (const r of reports) {
    await deleteDocument('community_reports', r.id);
    console.log(`Deleted ${r.id}`);
  }

  await restSetDocument('_meta', 'contributor_stats', {
    outcome_reports: 0,
    community_reports: 0,
    agencies_improved: 0,
    anomalies_verified: 0,
    last_updated: new Date().toISOString(),
  });
  console.log('Reset contributor_stats to zero.');
}

main().catch((err) => { console.error(err); process.exit(1); });
