import { TENDERS, PROJECTS, VENDORS, CATEGORIES } from './mock-data';
import type { Tender, Project, Vendor, Category } from './types';

export function getTenders(): Tender[] {
  return TENDERS;
}

export function getTenderById(id: string): Tender | undefined {
  return TENDERS.find((t) => t.id === id);
}

export function getProjects(): Project[] {
  return PROJECTS;
}

export function getProjectById(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}

export function getVendors(): Vendor[] {
  return VENDORS;
}

export function getVendorById(id: string): Vendor | undefined {
  return VENDORS.find((v) => v.id === id);
}

export function getCategories(): Category[] {
  return CATEGORIES;
}
