/**
 * Minimal Firestore REST client for Cloudflare Workers.
 * firebase-admin uses eval() internally which is blocked in Workers.
 * This client uses Web Crypto (available everywhere) + fetch.
 */

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
}

function parseValue(v: FirestoreValue): unknown {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(parseValue);
  if (v.mapValue) return parseFields(v.mapValue.fields ?? {});
  return null;
}

function parseFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = parseValue(v);
  return out;
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
  const privateKeyPem = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);

  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })));

  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );

  const jwt = `${header}.${payload}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const { access_token } = await res.json() as { access_token: string };
  cachedToken = { value: access_token, expiresAt: (now + 3500) * 1000 };
  return access_token;
}

export async function restGetCollection<T>(collection: string): Promise<T[]> {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
  const token = await getAccessToken();
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`;
  const results: T[] = [];
  let pageToken: string | undefined;

  do {
    const url = pageToken ? `${base}?pageSize=500&pageToken=${pageToken}` : `${base}?pageSize=500`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json() as {
      documents?: Array<{ name: string; fields: Record<string, FirestoreValue> }>;
      nextPageToken?: string;
    };
    for (const doc of data.documents ?? []) {
      const id = doc.name.split('/').pop()!;
      const { updatedAt: _u, ...fields } = parseFields(doc.fields);
      results.push({ id, ...fields } as T);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

export async function restGetDocument<T>(collection: string, id: string): Promise<T | undefined> {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${id}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return undefined;
  const doc = await res.json() as { name: string; fields: Record<string, FirestoreValue> };
  const docId = doc.name.split('/').pop()!;
  const { updatedAt: _u, ...fields } = parseFields(doc.fields);
  return { id: docId, ...fields } as T;
}
