'use client';

import React from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProjectCard from '@/components/ui/ProjectCard';
import ProjectCardSkeleton from '@/components/ui/ProjectCardSkeleton';
import ProjectFiltersPanel from '@/components/ui/ProjectFiltersPanel';
import Pagination from '@/components/ui/Pagination';
import { getProjects } from '@/lib/data-service-client';
import type { Project } from '@/lib/types';
import { filterAndSortProjects } from '@/lib/filters';
import { useLanguage } from '@/lib/language-context';
import { useListingFilters } from '@/lib/use-listing-filters';

export default function ProjectsPage() {
  const { t } = useLanguage();
  const filterState = useListingFilters<Project, 'all' | 'open' | 'in_progress'>(getProjects, filterAndSortProjects, 'all', 'recent');

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
          <div className="container-app py-8">
            <nav className="flex items-center gap-2 text-sm text-[#717171] mb-3" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-[#111111] transition-colors">{t('common.home')}</Link>
              <span aria-hidden="true">/</span>
              <span className="text-[#111111] font-medium">{t('pp.title')}</span>
            </nav>
            <h1 className="text-2xl font-semibold text-[#111111] mb-1">{t('pp.title')}</h1>
            <p className="text-[#717171] text-sm">{t('pp.desc')}</p>
          </div>
        </div>

        <div className="container-app py-8">
          <div className="flex gap-8 items-start">
            <ProjectFiltersPanel state={filterState} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <p className="text-sm text-[#717171]">
                  {filterState.isLoading ? (
                    <span className="inline-block h-4 w-32 bg-[#E0E0E0] rounded animate-pulse" />
                  ) : (
                    <>
                      {t('pp.showing')}{' '}
                      <span className="font-semibold text-[#111111]">{filterState.results.length}</span>{' '}
                      {filterState.results.length !== 1 ? t('pp.projects') : t('pp.project')}
                    </>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <label htmlFor="sort-projects" className="text-sm text-[#717171] whitespace-nowrap">{t('common.sortBy')}</label>
                  <select
                    id="sort-projects"
                    value={filterState.sort}
                    onChange={(e) => filterState.setSort(e.target.value as 'deadline' | 'budget' | 'recent')}
                    className="input text-sm py-2 w-auto"
                  >
                    <option value="recent">{t('common.sort.recent')}</option>
                    <option value="deadline">{t('common.sort.deadline')}</option>
                    <option value="budget">{t('common.sort.budget')}</option>
                  </select>
                </div>
              </div>

              {filterState.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {[...Array(6)].map((_, i) => <ProjectCardSkeleton key={i} />)}
                </div>
              ) : filterState.results.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filterState.paginatedResults.map((project) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                  <Pagination
                    page={filterState.page}
                    totalPages={filterState.totalPages}
                    onPageChange={filterState.setPage}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-[#F7F7F7] flex items-center justify-center">
                    <Search size={24} className="text-[#717171]" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#111111] mb-1">{t('pp.noResults')}</p>
                    <p className="text-sm text-[#717171]">{t('common.noResults.desc')}</p>
                  </div>
                  <button type="button" onClick={filterState.clearFilters} className="btn-outline text-sm">
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
