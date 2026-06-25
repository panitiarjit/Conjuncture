import type { Tender, Project, Vendor, Category, SoeTender } from './types';

export async function getTenders(): Promise<Tender[]> {
  const r = await fetch('/api/tenders');
  if (!r.ok) return [];
  return r.json();
}

export async function getTenderById(id: string): Promise<Tender | undefined> {
  const r = await fetch(`/api/tenders/${id}`);
  if (!r.ok) return undefined;
  return r.json();
}

export async function getProjects(): Promise<Project[]> {
  const r = await fetch('/api/projects');
  if (!r.ok) return [];
  return r.json();
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  const r = await fetch(`/api/projects/${id}`);
  if (!r.ok) return undefined;
  return r.json();
}

export async function getVendorById(id: string): Promise<Vendor | undefined> {
  const r = await fetch(`/api/vendors/${id}`);
  if (!r.ok) return undefined;
  return r.json();
}

export async function getCategories(): Promise<Category[]> {
  const r = await fetch('/api/categories');
  if (!r.ok) return [];
  return r.json();
}

export async function getSoeTenders(): Promise<SoeTender[]> {
  const r = await fetch('/api/soe-tenders');
  if (!r.ok) return [];
  return r.json();
}
