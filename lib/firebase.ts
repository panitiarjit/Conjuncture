import { initializeApp, getApps } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const isClient = typeof window !== 'undefined';

const app =
  isClient && firebaseConfig.apiKey
    ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0])
    : null;

const _auth = app ? getAuth(app) : null;
// Explicitly set localStorage persistence — default but Safari ITP can reset it
if (_auth) setPersistence(_auth, browserLocalPersistence).catch(() => {});
export const auth = _auth as ReturnType<typeof getAuth>;
export const db = (app ? getFirestore(app) : null) as ReturnType<typeof getFirestore>;
export default app;
