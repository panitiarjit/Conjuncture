'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Search, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Skeleton from '@/components/ui/Skeleton';
import { useLanguage } from '@/lib/language-context';
import type { PlansResponse } from '@/app/api/procurement-plans/route';

const THAI_MONTHS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `฿${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString('th-TH')}`;
}

export default function PlansPage() {
  const { t, lang } = useLanguage();
  const [data, setData] = useState<PlansResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/procurement-plans?page=${page}`)
      .then((r) => r.json())
      .then((d: PlansResponse & { error?: string }) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Failed to load plans'))
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = data?.plans.filter((p) =>
    !query || p.projectName.toLowerCase().includes(query.toLowerCase()) || p.planCode.includes(query),
  ) ?? [];

  const totalPages = data ? Math.ceil(data.total / 50) : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
          <div className="container-app py-8">
            <nav className="flex items-center gap-2 text-sm text-[#717171] mb-3">
              <Link href="/" className="hover:text-[#111111] transition-colors">{t('common.home.label')}</Link>
              <span>/</span>
              <span className="text-[#111111] font-medium">{t('plans.title')}</span>
            </nav>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-[#EFF6FF] rounded-xl flex items-center justify-center flex-shrink-0">
                <CalendarDays size={20} className="text-[#1E3A5F]" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-[#111111]">{t('plans.title')}</h1>
                <p className="text-[#717171] text-sm">{t('plans.desc')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="container-app py-8">
          {/* Info banner */}
          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 mb-6 flex items-start gap-3">
            <CalendarDays size={16} className="text-[#1E3A5F] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[#1E3A5F]">
              <span className="font-semibold">Early-warning pipeline</span> — agencies must publish their annual procurement plan
              before opening a tender. Monitoring this gives you 30–90 days of lead time to prepare.
              Data sourced from{' '}
              <a
                href="https://data.go.th"
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-0.5"
              >
                data.go.th <ExternalLink size={11} />
              </a>
              {' '}· more agencies added as they publish.
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md mb-6">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717171]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('plans.search.placeholder')}
              className="w-full pl-9 pr-4 py-2.5 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B6EA5]"
            />
          </div>

          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          )}

          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 text-sm text-[#B91C1C]">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="text-xs text-[#717171] mb-3">
                {data ? `${filtered.length} plan${filtered.length !== 1 ? 's' : ''} shown · ${data.total} total in dataset` : ''}
              </div>

              <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden mb-6">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
                      <th className="py-3 px-4 text-left text-xs font-semibold text-[#717171] uppercase tracking-wide">{t('plans.table.plan')}</th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-[#717171] uppercase tracking-wide">{t('agency.table.project')}</th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-[#717171] uppercase tracking-wide whitespace-nowrap">{t('plans.table.budget')}</th>
                      <th className="py-3 px-4 text-center text-xs font-semibold text-[#717171] uppercase tracking-wide whitespace-nowrap">{t('plans.table.expected')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((plan, i) => (
                      <tr
                        key={`${plan.planCode}-${i}`}
                        className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-[#717171] bg-[#F7F7F7] px-2 py-0.5 rounded">
                            {plan.planCode || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-[#111111] max-w-xs">
                          <span className="line-clamp-2">{plan.projectName}</span>
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-right whitespace-nowrap text-[#111111]">
                          {fmt(plan.budget)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-xs bg-[#EFF6FF] text-[#1E3A5F] px-2 py-0.5 rounded-full whitespace-nowrap">
                            <CalendarDays size={11} />
                            {lang === 'th' ? THAI_MONTHS[plan.month] : EN_MONTHS[plan.month]} {lang === 'th' ? plan.year + 543 : plan.year}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-sm text-[#717171]">
                          {t('plans.no-results')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E0E0E0] text-sm text-[#717171] hover:bg-[#F7F7F7] disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft size={14} /> {t('plans.prev')}
                  </button>
                  <span className="text-sm text-[#717171]">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E0E0E0] text-sm text-[#717171] hover:bg-[#F7F7F7] disabled:opacity-40 transition-colors"
                  >
                    {t('plans.next')} <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
