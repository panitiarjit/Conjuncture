'use client';

import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import FilterSection from '@/components/ui/FilterSection';
import { getCategories } from '@/lib/data-service';
import type { Category } from '@/lib/types';
import { CATEGORY_KEYS } from '@/lib/translation-keys';
import { ALL_THAI_PROVINCES, getProvinceName } from '@/lib/data-utils';
import { useLanguage } from '@/lib/language-context';
import type { ListingFilterState } from '@/lib/use-listing-filters';

interface Props {
  state: ListingFilterState<'all' | 'open' | 'in_progress'>;
}

export default function ProjectFiltersPanel({ state }: Props) {
  const { t, lang } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  const {
    search, setSearch,
    selectedCategories, toggleCategory,
    location, setLocation,
    statusFilter, setStatusFilter,
    budgetMin, setBudgetMin,
    budgetMax, setBudgetMax,
    clearFilters,
  } = state;

  const statusOptions = [
    { value: 'all' as const, label: t('common.all') },
    { value: 'open' as const, label: t('common.open') },
    { value: 'in_progress' as const, label: t('pp.inProgress') },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 gap-5 sticky top-20" aria-label="Project filters">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717171] pointer-events-none" aria-hidden="true" />
        <input
          type="text"
          placeholder={t('pp.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9 text-sm"
          aria-label={t('pp.search')}
        />
      </div>

      <FilterSection title={t('common.category')}>
        {categories.map((cat) => (
          <label key={cat.id} className="flex items-center gap-2.5 text-sm text-[#111111] cursor-pointer hover:text-[#717171] transition-colors">
            <input
              type="checkbox"
              checked={selectedCategories.includes(cat.id)}
              onChange={() => toggleCategory(cat.id)}
              className="rounded border-[#E0E0E0] accent-[#111111] w-4 h-4 flex-shrink-0"
            />
            <span className="flex-1">{t(CATEGORY_KEYS[cat.id])}</span>
            <span className="text-xs text-[#717171]">{cat.count}</span>
          </label>
        ))}
      </FilterSection>

      <FilterSection title={t('common.location')}>
        <select value={location} onChange={(e) => setLocation(e.target.value)} className="input text-sm" aria-label={t('common.location')}>
          <option value="">{t('tp.allRegions')}</option>
          {ALL_THAI_PROVINCES.map((province) => (
            <option key={province} value={province}>{getProvinceName(province, lang)}</option>
          ))}
        </select>
      </FilterSection>

      <FilterSection title={t('common.status')}>
        {statusOptions.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-2.5 text-sm text-[#111111] cursor-pointer hover:text-[#717171] transition-colors">
            <input type="radio" name="project-status" value={value} checked={statusFilter === value} onChange={() => setStatusFilter(value)} className="border-[#E0E0E0] accent-[#111111] w-4 h-4 flex-shrink-0" />
            {label}
          </label>
        ))}
      </FilterSection>

      <FilterSection title={t('common.budgetRange')}>
        <div className="flex flex-col gap-2">
          <input type="number" placeholder={t('common.min')} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} className="input text-sm" min={0} />
          <input type="number" placeholder={t('common.max')} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className="input text-sm" min={0} />
        </div>
      </FilterSection>

      <button type="button" onClick={clearFilters} className="btn-ghost text-sm w-full justify-center border border-[#E0E0E0] rounded-lg">
        {t('common.clearFilters')}
      </button>
    </aside>
  );
}
