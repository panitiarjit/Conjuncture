import type { Tender } from './types';
import { getDisplayStatus } from './deadline';
import { resolveProcurementType, resolveMethod } from './procurement';

const STATUS_SORT_ORDER: Record<string, number> = { open: 0, unknown: 1, closed: 2 };

export interface TenderFilters {
  search: string;
  selectedCategories: string[];
  location: string;
  statusFilter: 'all' | 'open' | 'closed';
  budgetMin: string;
  budgetMax: string;
  sort: 'deadline' | 'budget' | 'recent';
  selectedProcurementTypes: string[];
  selectedProcurementMethods: string[];
}

export function filterAndSortTenders(tenders: Tender[], filters: TenderFilters): Tender[] {
  const { search, selectedCategories, location, statusFilter, budgetMin, budgetMax, sort, selectedProcurementTypes, selectedProcurementMethods } =
    filters;

  const result = tenders.filter((tender) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (
        !tender.title.toLowerCase().includes(q) &&
        !tender.agency.toLowerCase().includes(q) &&
        !tender.description.toLowerCase().includes(q)
      )
        return false;
    }
    if (selectedCategories.length > 0 && !selectedCategories.includes(tender.category)) return false;
    if (location !== '' && tender.region !== location) return false;
    if (statusFilter !== 'all' && getDisplayStatus(tender) !== statusFilter) return false;
    if (budgetMin !== '') {
      const min = Number(budgetMin);
      if (!isNaN(min) && tender.budget < min) return false;
    }
    if (budgetMax !== '') {
      const max = Number(budgetMax);
      if (!isNaN(max) && tender.budget > max) return false;
    }
    if (selectedProcurementTypes.length > 0) {
      const pt = tender.procurementType ?? resolveProcurementType(tender.title);
      if (!selectedProcurementTypes.includes(pt)) return false;
    }
    if (selectedProcurementMethods.length > 0) {
      const pm = resolveMethod(tender.title, tender.methodId, tender.budget);
      if (!selectedProcurementMethods.includes(pm)) return false;
    }
    return true;
  });

  return [...result].sort((a, b) => {
    // Open/unknown always before closed regardless of sort mode
    const statusDiff = (STATUS_SORT_ORDER[a.status] ?? 1) - (STATUS_SORT_ORDER[b.status] ?? 1);
    if (statusDiff !== 0) return statusDiff;
    // Within same status group, apply user-selected sort
    if (sort === 'deadline') return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    if (sort === 'budget') return b.budget - a.budget;
    return b.id.localeCompare(a.id);
  });
}

