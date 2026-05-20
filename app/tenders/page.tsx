'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Info } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import TenderCard from '@/components/ui/TenderCard';
import FilterSection from '@/components/ui/FilterSection';
import { TENDERS, CATEGORIES } from '@/lib/mock-data';
import { filterAndSortTenders, type TenderFilters } from '@/lib/filters';
import { ALL_THAI_PROVINCES, getProvinceName } from '@/lib/data-utils';
import { useProtectedRoute } from '@/lib/use-protected-route';
import { useLanguage } from '@/lib/language-context';

type StatusFilter = 'all' | 'open' | 'closing_soon';
type SortOption = 'deadline' | 'budget' | 'recent';

export default function TendersPage() {
  const { isAuthenticated, isLoading } = useProtectedRoute();
  const { t, lang } = useLanguage();
  if (isLoading || !isAuthenticated) return null;

  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [sort, setSort] = useState<SortOption>('deadline');

  function toggleCategory(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function clearFilters() {
    setSearch('');
    setSelectedCategories([]);
    setSelectedRegion('');
    setStatusFilter('all');
    setBudgetMin('');
    setBudgetMax('');
    setSort('deadline');
  }

  const filteredTenders = useMemo(() => {
    const filters: TenderFilters = {
      search,
      selectedCategories,
      selectedRegion,
      statusFilter,
      budgetMin,
      budgetMax,
      sort,
    };
    return filterAndSortTenders(TENDERS, filters);
  }, [search, selectedCategories, selectedRegion, statusFilter, budgetMin, budgetMax, sort]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: t('common.all') },
    { value: 'open', label: t('common.open') },
    { value: 'closing_soon', label: t('tp.closingSoon') },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
          <div className="container-app py-8">
            <nav className="flex items-center gap-2 text-sm text-[#717171] mb-3" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-[#111111] transition-colors">
                {t('common.home')}
              </Link>
              <span aria-hidden="true">/</span>
              <span className="text-[#111111] font-medium">{t('tp.title')}</span>
            </nav>
            <h1 className="text-2xl font-semibold text-[#111111] mb-1">{t('tp.title')}</h1>
            <p className="text-[#717171] text-sm">{t('tp.desc')}</p>
          </div>
        </div>

        <div className="bg-[#EFF6FF] border-b border-[#BFDBFE]">
          <div className="container-app py-3">
            <div className="flex items-center gap-2 text-sm text-[#1D4ED8]">
              <Info size={15} className="flex-shrink-0" aria-hidden="true" />
              <span>{t('tp.banner')}</span>
            </div>
          </div>
        </div>

        <div className="container-app py-8">
          <div className="flex gap-8 items-start">
            <aside
              className="hidden lg:flex flex-col w-64 flex-shrink-0 gap-5 sticky top-20"
              aria-label="Tender filters"
            >
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717171] pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  placeholder={t('tp.search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input pl-9 text-sm"
                  aria-label={t('tp.search')}
                />
              </div>

              <FilterSection title={t('common.category')}>
                {CATEGORIES.map((cat) => (
                  <label
                    key={cat.id}
                    className="flex items-center gap-2.5 text-sm text-[#111111] cursor-pointer hover:text-[#717171] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      className="rounded border-[#E0E0E0] accent-[#111111] w-4 h-4 flex-shrink-0"
                    />
                    <span className="flex-1">{t(`cat.${cat.id}`)}</span>
                    <span className="text-xs text-[#717171]">{cat.count}</span>
                  </label>
                ))}
              </FilterSection>

              <FilterSection title={t('tp.region')}>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="input text-sm"
                  aria-label={t('tp.region')}
                >
                  <option value="">{t('tp.allRegions')}</option>
                  {ALL_THAI_PROVINCES.map((province) => (
                    <option key={province} value={province}>
                      {getProvinceName(province, lang)}
                    </option>
                  ))}
                </select>
              </FilterSection>

              <FilterSection title={t('common.status')}>
                {statusOptions.map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex items-center gap-2.5 text-sm text-[#111111] cursor-pointer hover:text-[#717171] transition-colors"
                  >
                    <input
                      type="radio"
                      name="status"
                      value={value}
                      checked={statusFilter === value}
                      onChange={() => setStatusFilter(value)}
                      className="border-[#E0E0E0] accent-[#111111] w-4 h-4 flex-shrink-0"
                    />
                    {label}
                  </label>
                ))}
              </FilterSection>

              <FilterSection title={t('common.budgetRange')}>
                <div className="flex flex-col gap-2">
                  <input
                    type="number"
                    placeholder={t('common.min')}
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    className="input text-sm"
                    min={0}
                  />
                  <input
                    type="number"
                    placeholder={t('common.max')}
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    className="input text-sm"
                    min={0}
                  />
                </div>
              </FilterSection>

              <button
                type="button"
                onClick={clearFilters}
                className="btn-ghost text-sm w-full justify-center border border-[#E0E0E0] rounded-lg"
              >
                {t('common.clearFilters')}
              </button>
            </aside>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <p className="text-sm text-[#717171]">
                  {t('tp.showing')}{' '}
                  <span className="font-semibold text-[#111111]">{filteredTenders.length}</span>{' '}
                  {filteredTenders.length !== 1 ? t('tp.tenders') : t('tp.tender')}
                </p>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor="sort-tenders"
                    className="text-sm text-[#717171] whitespace-nowrap"
                  >
                    {t('common.sortBy')}
                  </label>
                  <select
                    id="sort-tenders"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOption)}
                    className="input text-sm py-2 w-auto"
                  >
                    <option value="deadline">{t('common.sort.deadline')}</option>
                    <option value="budget">{t('common.sort.budget')}</option>
                    <option value="recent">{t('common.sort.recent')}</option>
                  </select>
                </div>
              </div>

              {filteredTenders.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredTenders.map((tender) => (
                    <TenderCard key={tender.id} tender={tender} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-[#F7F7F7] flex items-center justify-center">
                    <Search size={24} className="text-[#717171]" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#111111] mb-1">{t('tp.noResults')}</p>
                    <p className="text-sm text-[#717171]">{t('common.noResults.desc')}</p>
                  </div>
                  <button type="button" onClick={clearFilters} className="btn-outline text-sm">
                    {t('common.clearFilters')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
