'use client';

import { useState, useMemo, useCallback } from 'react';

export type SortOption = 'deadline' | 'budget' | 'recent';

export interface FilterParams<S extends string> {
  search: string;
  selectedCategories: string[];
  location: string;
  statusFilter: S;
  budgetMin: string;
  budgetMax: string;
  sort: SortOption;
}

export interface ListingFilterState<S extends string> {
  search: string;
  setSearch: (v: string) => void;
  selectedCategories: string[];
  toggleCategory: (id: string) => void;
  location: string;
  setLocation: (v: string) => void;
  statusFilter: S;
  setStatusFilter: (v: S) => void;
  budgetMin: string;
  setBudgetMin: (v: string) => void;
  budgetMax: string;
  setBudgetMax: (v: string) => void;
  sort: SortOption;
  setSort: (v: SortOption) => void;
  clearFilters: () => void;
}

export function useListingFilters<TItem, S extends string>(
  data: TItem[],
  filterFn: (items: TItem[], params: FilterParams<S>) => TItem[],
  defaultStatus: S,
  defaultSort: SortOption,
): ListingFilterState<S> & { results: TItem[] } {
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [statusFilter, setStatusFilter] = useState<S>(defaultStatus);
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [sort, setSort] = useState<SortOption>(defaultSort);

  const toggleCategory = useCallback((id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setSelectedCategories([]);
    setLocation('');
    setStatusFilter(defaultStatus);
    setBudgetMin('');
    setBudgetMax('');
    setSort(defaultSort);
  }, [defaultStatus, defaultSort]);

  const results = useMemo(
    () =>
      filterFn(data, {
        search,
        selectedCategories,
        location,
        statusFilter,
        budgetMin,
        budgetMax,
        sort,
      }),
    [filterFn, data, search, selectedCategories, location, statusFilter, budgetMin, budgetMax, sort],
  );

  return {
    search, setSearch,
    selectedCategories, toggleCategory,
    location, setLocation,
    statusFilter, setStatusFilter,
    budgetMin, setBudgetMin,
    budgetMax, setBudgetMax,
    sort, setSort,
    clearFilters,
    results,
  };
}
