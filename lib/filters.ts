import type { Tender, Project } from './mock-data';
import { computeTenderStatus, getDaysRemaining } from './deadline';

export interface TenderFilters {
  search: string;
  selectedCategories: string[];
  selectedRegion: string;
  statusFilter: 'all' | 'open' | 'closing_soon';
  budgetMin: string;
  budgetMax: string;
  sort: 'deadline' | 'budget' | 'recent';
}

export function filterAndSortTenders(tenders: Tender[], filters: TenderFilters): Tender[] {
  const { search, selectedCategories, selectedRegion, statusFilter, budgetMin, budgetMax, sort } =
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
    if (selectedRegion !== '' && tender.region !== selectedRegion) return false;
    if (statusFilter !== 'all' && computeTenderStatus(tender.deadline) !== statusFilter) return false;
    if (budgetMin !== '') {
      const min = Number(budgetMin);
      if (!isNaN(min) && tender.budget < min) return false;
    }
    if (budgetMax !== '') {
      const max = Number(budgetMax);
      if (!isNaN(max) && tender.budget > max) return false;
    }
    return true;
  });

  return [...result].sort((a, b) => {
    if (sort === 'deadline') return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    if (sort === 'budget') return b.budget - a.budget;
    return b.id.localeCompare(a.id);
  });
}

export interface ProjectFilters {
  search: string;
  selectedCategories: string[];
  selectedLocation: string;
  statusFilter: 'all' | 'open' | 'in_progress';
  budgetMin: string;
  budgetMax: string;
  sort: 'deadline' | 'budget' | 'recent';
}

export function filterAndSortProjects(projects: Project[], filters: ProjectFilters): Project[] {
  const {
    search,
    selectedCategories,
    selectedLocation,
    statusFilter,
    budgetMin,
    budgetMax,
    sort,
  } = filters;

  const result = projects.filter((p) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (
        !p.title.toLowerCase().includes(q) &&
        !p.description.toLowerCase().includes(q) &&
        !p.buyerName.toLowerCase().includes(q)
      )
        return false;
    }
    if (selectedCategories.length > 0 && !selectedCategories.includes(p.category)) return false;
    if (selectedLocation !== '' && p.location !== selectedLocation) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (budgetMin !== '') {
      const min = Number(budgetMin);
      if (!isNaN(min) && p.budgetMax < min) return false;
    }
    if (budgetMax !== '') {
      const max = Number(budgetMax);
      if (!isNaN(max) && p.budgetMin > max) return false;
    }
    return true;
  });

  return [...result].sort((a, b) => {
    if (sort === 'deadline') return getDaysRemaining(a.deadline) - getDaysRemaining(b.deadline);
    if (sort === 'budget') return b.budgetMax - a.budgetMax;
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  });
}
