import 'server-only';
import { TENDERS, PROJECTS, VENDORS, CATEGORIES } from './mock-data';
import type { Tender, Project, Vendor, Category } from './types';

function hasFirestoreCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

// In-process cache so the listing stays visible when Firestore is temporarily
// unavailable (quota errors during a scrape run, cold-start latency, etc.)
let tenderCache: Tender[] | null = null;

export async function getTenders(): Promise<Tender[]> {
  if (hasFirestoreCredentials()) {
    try {
      const { getTendersFromFirestore } = await import('./firestore-admin');
      const tenders = await getTendersFromFirestore();
      tenderCache = tenders;
      return tenders;
    } catch (err) {
      console.warn('[data-service] Firestore unavailable, serving cached tenders:', (err as Error).message);
      return tenderCache ?? TENDERS;
    }
  }
  return TENDERS;
}

export async function getTenderById(id: string): Promise<Tender | undefined> {
  if (hasFirestoreCredentials()) {
    const { getTenderByIdFromFirestore } = await import('./firestore-admin');
    return getTenderByIdFromFirestore(id);
  }
  return TENDERS.find((t) => t.id === id);
}

export async function getProjects(): Promise<Project[]> {
  return PROJECTS;
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  return PROJECTS.find((p) => p.id === id);
}

export async function getVendors(): Promise<Vendor[]> {
  return VENDORS;
}

export async function getVendorById(id: string): Promise<Vendor | undefined> {
  return VENDORS.find((v) => v.id === id);
}

export async function getCategories(): Promise<Category[]> {
  if (!hasFirestoreCredentials()) return CATEGORIES;
  const { getTendersFromFirestore } = await import('./firestore-admin');
  const tenders = await getTendersFromFirestore();
  // Count open tenders per category from real data
  const counts: Partial<Record<string, number>> = {};
  for (const t of tenders) {
    if (t.status !== 'closed') counts[t.category] = (counts[t.category] ?? 0) + 1;
  }
  return CATEGORIES.map((c) => ({ ...c, count: counts[c.id] ?? 0 }));
}
