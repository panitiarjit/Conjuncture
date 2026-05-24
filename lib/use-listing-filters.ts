'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';

export type SortOption = 'deadline' | 'budget' | 'recent';

export const PAGE_SIZE = 12;

export interface FilterParams<S extends string> {
  search: string;
  selectedCategories: string[];
  location: string;
  statusFilter: S;
  budgetMin: string;
  budgetMax: string;
  sort: SortOption;
  selectedProcurementTypes: string[];
  selectedProcurementMethods: string[];
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
  selectedProcurementTypes: string[];
  toggleProcurementType: (id: string) => void;
  selectedProcurementMethods: string[];
  toggleProcurementMethod: (id: string) => void;
  clearFilters: () => void;
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
}

export function useListingFilters<TItem, S extends string>(
  fetchData: () => Promise<TItem[]>,
  filterFn: (items: TItem[], params: FilterParams<S>) => TItem[],
  defaultStatus: S,
  defaultSort: SortOption,
): ListingFilterState<S> & { results: TItem[]; paginatedResults: TItem[]; isLoading: boolean } {
  const [data, setData] = useState<TItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [statusFilter, setStatusFilter] = useState<S>(defaultStatus);
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [sort, setSort] = useState<SortOption>(defaultSort);
  const [selectedProcurementTypes, setSelectedProcurementTypes] = useState<string[]>([]);
  const [selectedProcurementMethods, setSelectedProcurementMethods] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    const load = () =>
      fetchData().then((d) => {
        if (!mounted) return;
        setData(d);
        setIsLoading(false);
      });
    load();
    const id = setInterval(load, 300_000); // 5 min — 60s was exhausting Firestore free-tier quota
    return () => {
      mounted = false;
      clearInterval(id);
    };
    // fetchData is always a stable module-level function reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCategory = useCallback((id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }, []);

  // Reset to page 1 whenever filters change
  const setSearchAndReset = useCallback((v: string) => { setSearch(v); setPage(1); }, []);
  const toggleCategoryAndReset = useCallback((id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
    setPage(1);
  }, []);
  const setLocationAndReset = useCallback((v: string) => { setLocation(v); setPage(1); }, []);
  const setStatusFilterAndReset = useCallback((v: S) => { setStatusFilter(v); setPage(1); }, []);
  const setBudgetMinAndReset = useCallback((v: string) => { setBudgetMin(v); setPage(1); }, []);
  const setBudgetMaxAndReset = useCallback((v: string) => { setBudgetMax(v); setPage(1); }, []);
  const setSortAndReset = useCallback((v: SortOption) => { setSort(v); setPage(1); }, []);
  const toggleProcurementType = useCallback((id: string) => {
    setSelectedProcurementTypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setPage(1);
  }, []);
  const toggleProcurementMethod = useCallback((id: string) => {
    setSelectedProcurementMethods((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setSelectedCategories([]);
    setLocation('');
    setStatusFilter(defaultStatus);
    setBudgetMin('');
    setBudgetMax('');
    setSort(defaultSort);
    setSelectedProcurementTypes([]);
    setSelectedProcurementMethods([]);
    setPage(1);
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
        selectedProcurementTypes,
        selectedProcurementMethods,
      }),
    [filterFn, data, search, selectedCategories, location, statusFilter, budgetMin, budgetMax, sort, selectedProcurementTypes, selectedProcurementMethods],
  );

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedResults = useMemo(
    () => results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [results, safePage],
  );

  return {
    search, setSearch: setSearchAndReset,
    selectedCategories, toggleCategory: toggleCategoryAndReset,
    location, setLocation: setLocationAndReset,
    statusFilter, setStatusFilter: setStatusFilterAndReset,
    budgetMin, setBudgetMin: setBudgetMinAndReset,
    budgetMax, setBudgetMax: setBudgetMaxAndReset,
    sort, setSort: setSortAndReset,
    selectedProcurementTypes, toggleProcurementType,
    selectedProcurementMethods, toggleProcurementMethod,
    clearFilters,
    page: safePage, setPage,
    totalPages,
    results,
    paginatedResults,
    isLoading,
  };
}
