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

export async function getTenders(): Promise<Tender[]> {
  if (hasFirestoreCredentials()) {
    const { getTendersFromFirestore } = await import('./firestore-admin');
    return getTendersFromFirestore();
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
  return CATEGORIES;
}
