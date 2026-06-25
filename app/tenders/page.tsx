'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Info, Building } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import TenderCard from '@/components/ui/TenderCard';
import TenderCardSkeleton from '@/components/ui/TenderCardSkeleton';
import SoeTenderCard from '@/components/ui/SoeTenderCard';
import TenderFiltersPanel from '@/components/ui/TenderFiltersPanel';
import Pagination from '@/components/ui/Pagination';
import { getTenders, getSoeTenders } from '@/lib/data-service-client';
import type { Tender, SoeTender } from '@/lib/types';
import { filterAndSortTenders } from '@/lib/filters';
import { useLanguage } from '@/lib/language-context';
import { useListingFilters } from '@/lib/use-listing-filters';

const SOE_PAGE_SIZE = 24;

const SOURCE_ORDER = ['BMA', 'MEA', 'EGAT', 'PTT', 'PWA', 'PEA', 'MRTA'];

export default function TendersPage() {
  const { t } = useLanguage();
  const filterState = useListingFilters<Tender, 'all' | 'open' | 'closed'>(getTenders, filterAndSortTenders, 'all', 'recent');

  const [tab, setTab] = useState<'egp' | 'soe'>('egp');
  const [soeTenders, setSoeTenders] = useState<SoeTender[]>([]);
  const [soeLoading, setSoeLoading] = useState(false);
  const [soeSearch, setSoeSearch] = useState('');
  const [soeSource, setSoeSource] = useState<string>('all');
  const [soeStatus, setSoeStatus] = useState<string>('all');
  const [soePage, setSoePage] = useState(1);

  useEffect(() => {
    if (tab === 'soe' && soeTenders.length === 0 && !soeLoading) {
      setSoeLoading(true);
      getSoeTenders().then((data) => {
        setSoeTenders(data);
        setSoeLoading(false);
      });
    }
  }, [tab, soeTenders.length, soeLoading]);

  const filteredSoe = soeTenders.filter((t) => {
    if (soeSource !== 'all' && t.source !== soeSource) return false;
    if (soeStatus !== 'all' && t.status !== soeStatus) return false;
    if (soeSearch) {
      const q = soeSearch.toLowerCase();
      return t.title.toLowerCase().includes(q) || (t.department ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const soeSources = Array.from(new Set(soeTenders.map((t) => t.source)))
    .sort((a, b) => SOURCE_ORDER.indexOf(a) - SOURCE_ORDER.indexOf(b));

  const soeTotalPages = Math.max(1, Math.ceil(filteredSoe.length / SOE_PAGE_SIZE));
  const soePaged = filteredSoe.slice((soePage - 1) * SOE_PAGE_SIZE, soePage * SOE_PAGE_SIZE);

  function handleSoeSearch(q: string) {
    setSoeSearch(q);
    setSoePage(1);
  }
  function handleSoeSource(s: string) {
    setSoeSource(s);
    setSoePage(1);
  }
  function handleSoeStatus(s: string) {
    setSoeStatus(s);
    setSoePage(1);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
          <div className="container-app py-8">
            <nav className="flex items-center gap-2 text-sm text-[#717171] mb-3" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-[#111111] transition-colors">{t('common.home')}</Link>
              <span aria-hidden="true">/</span>
              <span className="text-[#111111] font-medium">{t('tp.title')}</span>
            </nav>
            <h1 className="text-2xl font-semibold text-[#111111] mb-1">{t('tp.title')}</h1>
            <p className="text-[#717171] text-sm">{t('tp.desc')}</p>
          </div>
        </div>

        {/* Source tabs */}
        <div className="border-b border-[#E0E0E0] bg-white">
          <div className="container-app">
            <div className="flex gap-0">
              <button
                onClick={() => setTab('egp')}
                className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors duration-150 ${
                  tab === 'egp'
                    ? 'border-[#1E3A5F] text-[#1E3A5F]'
                    : 'border-transparent text-[#717171] hover:text-[#111111]'
                }`}
              >
                รัฐบาล (e-GP)
              </button>
              <button
                onClick={() => setTab('soe')}
                className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors duration-150 ${
                  tab === 'soe'
                    ? 'border-[#1E3A5F] text-[#1E3A5F]'
                    : 'border-transparent text-[#717171] hover:text-[#111111]'
                }`}
              >
                <Building size={14} />
                รัฐวิสาหกิจ (SOE)
                {soeTenders.length > 0 && (
                  <span className="ml-1 bg-[#F7F7F7] border border-[#E0E0E0] text-[#717171] text-xs px-1.5 py-0.5 rounded-full">
                    {soeTenders.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {tab === 'egp' && (
          <>
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
                <TenderFiltersPanel state={filterState} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                    <p className="text-sm text-[#717171]">
                      {filterState.isLoading ? (
                        <span className="inline-block h-4 w-32 bg-[#E0E0E0] rounded animate-pulse" />
                      ) : (
                        <>
                          {t('tp.showing')}{' '}
                          <span className="font-semibold text-[#111111]">{filterState.results.length}</span>{' '}
                          {filterState.results.length !== 1 ? t('tp.tenders') : t('tp.tender')}
                        </>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <label htmlFor="sort-tenders" className="text-sm text-[#717171] whitespace-nowrap">{t('common.sortBy')}</label>
                      <select
                        id="sort-tenders"
                        value={filterState.sort}
                        onChange={(e) => filterState.setSort(e.target.value as 'deadline' | 'budget' | 'recent')}
                        className="input text-sm py-2 w-auto"
                      >
                        <option value="deadline">{t('common.sort.deadline')}</option>
                        <option value="budget">{t('common.sort.budget')}</option>
                        <option value="recent">{t('common.sort.recent')}</option>
                      </select>
                    </div>
                  </div>

                  {filterState.isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {[...Array(6)].map((_, i) => <TenderCardSkeleton key={i} />)}
                    </div>
                  ) : filterState.results.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filterState.paginatedResults.map((tender) => (
                          <TenderCard key={tender.id} tender={tender} />
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
                        <p className="font-semibold text-[#111111] mb-1">{t('tp.noResults')}</p>
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
          </>
        )}

        {tab === 'soe' && (
          <div className="container-app py-8">
            {/* SOE filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex gap-2 flex-1">
                <input
                  type="text"
                  value={soeSearch}
                  onChange={(e) => handleSoeSearch(e.target.value)}
                  placeholder="ค้นหาโครงการ หรือหน่วยงาน…"
                  className="flex-1 border border-[#E0E0E0] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B6EA5]"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={soeSource}
                  onChange={(e) => handleSoeSource(e.target.value)}
                  className="input text-sm py-2 w-auto"
                >
                  <option value="all">ทุกองค์กร</option>
                  {soeSources.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={soeStatus}
                  onChange={(e) => handleSoeStatus(e.target.value)}
                  className="input text-sm py-2 w-auto"
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="open">เปิดรับ</option>
                  <option value="awarded">ประกาศผล</option>
                </select>
              </div>
            </div>

            {soeLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {[...Array(6)].map((_, i) => <TenderCardSkeleton key={i} />)}
              </div>
            ) : filteredSoe.length > 0 ? (
              <>
                <p className="text-sm text-[#717171] mb-4">
                  แสดง <span className="font-semibold text-[#111111]">{filteredSoe.length}</span> รายการ
                  {soeSource !== 'all' && ` จาก ${soeSource}`}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {soePaged.map((t) => (
                    <SoeTenderCard key={`${t.source}_${t.id}`} tender={t} />
                  ))}
                </div>
                <Pagination
                  page={soePage}
                  totalPages={soeTotalPages}
                  onPageChange={setSoePage}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-[#F7F7F7] flex items-center justify-center">
                  <Search size={24} className="text-[#717171]" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-[#111111] mb-1">
                    {soeTenders.length === 0 ? 'ยังไม่มีข้อมูลรัฐวิสาหกิจ' : 'ไม่พบผลการค้นหา'}
                  </p>
                  <p className="text-sm text-[#717171]">
                    {soeTenders.length === 0
                      ? 'ข้อมูลจะปรากฏเมื่อระบบดึงข้อมูลจากเว็บไซต์รัฐวิสาหกิจสำเร็จ'
                      : 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
