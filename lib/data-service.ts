import 'server-only';
import { unstable_cache } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { TENDERS, PROJECTS, VENDORS, CATEGORIES } from './mock-data';
import type { Tender, Project, Vendor, Category } from './types';

function hasFirestoreCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

// Disk cache — last-resort fallback when Firestore is down and Next.js cache has expired
const DISK_CACHE_PATH = path.join(process.cwd(), '.tender-cache.json');

function saveToDisk(tenders: Tender[]): void {
  try {
    fs.writeFileSync(DISK_CACHE_PATH, JSON.stringify(tenders));
  } catch {
    // non-critical
  }
}

function loadFromDisk(): Tender[] | null {
  try {
    const raw = fs.readFileSync(DISK_CACHE_PATH, 'utf-8');
    return JSON.parse(raw) as Tender[];
  } catch {
    return null;
  }
}

// Next.js data cache — shared across all serverless invocations, revalidates every 5 min.
// This is the proper fix for Firestore quota: one read per 5-min window, not one per request.
// Call revalidateTag('tenders') after a scrape to bust the cache immediately.
const fetchTendersFromFirestore = unstable_cache(
  async (): Promise<Tender[]> => {
    const { getTendersFromFirestore } = await import('./firestore-admin');
    const tenders = await getTendersFromFirestore();
    saveToDisk(tenders);
    return tenders;
  },
  ['tenders'],
  { revalidate: 3600, tags: ['tenders'] },
);

export async function getTenders(): Promise<Tender[]> {
  if (!hasFirestoreCredentials()) return TENDERS;
  try {
    return await fetchTendersFromFirestore();
  } catch (err) {
    console.warn('[data-service] Firestore unavailable, serving disk/mock fallback:', (err as Error).message);
    return loadFromDisk() ?? TENDERS;
  }
}

// Reuses the cached tender list — no per-document Firestore read per detail page
export async function getTenderById(id: string): Promise<Tender | undefined> {
  const tenders = await getTenders();
  return tenders.find((t) => t.id === id);
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
  // Reuses getTenders() cache — no separate Firestore read
  const tenders = await getTenders();
  const counts: Partial<Record<string, number>> = {};
  for (const t of tenders) {
    if (t.status !== 'closed') counts[t.category] = (counts[t.category] ?? 0) + 1;
  }
  return CATEGORIES.map((c) => ({ ...c, count: counts[c.id] ?? 0 }));
}
