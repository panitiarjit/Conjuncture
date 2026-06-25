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

function b64url(buf: ArrayBuffer | Uint8Array): string {
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

export async function restGetCollection<T>(collection: string, maxDocs?: number): Promise<T[]> {
  const { docs } = await restGetCollectionPage<T>(collection, maxDocs);
  return docs;
}

export async function restGetCollectionPage<T>(
  collection: string,
  pageSize = 500,
  startPageToken?: string,
  fieldMask?: string[],
): Promise<{ docs: T[]; nextPageToken?: string }> {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
  const token = await getAccessToken();
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`;
  const maskQs = fieldMask ? fieldMask.map((f) => `mask.fieldPaths=${encodeURIComponent(f)}`).join('&') : '';
  const results: T[] = [];
  let cursor: string | undefined = startPageToken;

  do {
    const remaining = pageSize - results.length;
    const fetchSize = Math.min(300, remaining);
    const base_url = cursor
      ? `${base}?pageSize=${fetchSize}&pageToken=${cursor}`
      : `${base}?pageSize=${fetchSize}`;
    const url = maskQs ? `${base_url}&${maskQs}` : base_url;

    // Promise.race timeout — AbortController does not reliably cancel
    // in-flight fetches in Cloudflare Workers, so we race instead.
    const TIMEOUT_MS = 14_000;
    const fetchStart = Date.now();
    let clearTimer: () => void = () => {};
    const timeoutPromise = new Promise<never>((_, reject) => {
      const id = setTimeout(
        () => reject(Object.assign(new Error('Firestore timeout'), { name: 'AbortError' })),
        TIMEOUT_MS,
      );
      clearTimer = () => clearTimeout(id);
    });
    // IMPORTANT: attach a no-op catch so the rejection is handled when the
    // fetch wins the race — otherwise Workers crashes with UnhandledRejection.
    timeoutPromise.catch(() => {});

    let res: Response;
    try {
      res = await Promise.race([
        fetch(url, { headers: { Authorization: `Bearer ${token}` } }),
        timeoutPromise,
      ]);
    } catch (err) {
      clearTimer();
      if ((err as Error).name === 'AbortError') {
        return { docs: results, nextPageToken: undefined };
      }
      throw err;
    } finally {
      clearTimer();
    }

    // Fetch resolved, but if it was slow the body may be large — skip parsing
    // to avoid a CPU spike on top of the already-slow network time.
    if (Date.now() - fetchStart > 5_000) {
      return { docs: results, nextPageToken: undefined };
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = await res.json() as {
      documents?: Array<{ name: string; fields: Record<string, FirestoreValue> }>;
      nextPageToken?: string;
    };
    for (const doc of data.documents ?? []) {
      const id = doc.name.split('/').pop()!;
      const { updatedAt: _u, ...fields } = parseFields(doc.fields);
      results.push({ id, ...fields } as T);
    }
    cursor = data.nextPageToken;
  } while (cursor && results.length < pageSize);

  return { docs: results, nextPageToken: cursor };
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

// ── Write helpers ─────────────────────────────────────────────────────────────

function encodeValue(v: unknown): FirestoreValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (v instanceof Date) return { stringValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val !== undefined) fields[k] = encodeValue(val);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function encodeDocument(data: Record<string, unknown>): { fields: Record<string, FirestoreValue> } {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = encodeValue(v);
  }
  return { fields };
}

/** Create a document with auto-generated ID. Returns the new document ID. */
export async function restAddDocument(
  collection: string,
  data: Record<string, unknown>,
): Promise<string> {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(encodeDocument(data)),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore write ${res.status}: ${err.slice(0, 200)}`);
  }
  const doc = await res.json() as { name: string };
  return doc.name.split('/').pop()!;
}

/** Create or overwrite a document with a known ID. */
export async function restSetDocument(
  collection: string,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(encodeDocument(data)),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore set ${res.status}: ${err.slice(0, 200)}`);
  }
}
