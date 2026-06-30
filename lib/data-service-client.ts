import type { Tender, Category, SoeTender } from './types';

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
