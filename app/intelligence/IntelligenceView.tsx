'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Trophy, Users, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import type { AwardedContract } from '@/lib/types';

const PAGE_SIZE = 50;

const DATE_ARTIFACT = /^\d{1,2}\s\S+\s\d{2}$/;
function cleanWinner(name: string | null): string | null {
  if (!name) return null;
  const s = name.trim();
  if (!s || s === '-' || DATE_ARTIFACT.test(s)) return null;
  return s;
}

function fmt(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString('th-TH')}`;
}

interface Props {
  contracts: AwardedContract[];
  keyword: string;
  totalBudget: number;
  avgDiscount: number | null;
}

export default function IntelligenceView({
  contracts, keyword, totalBudget, avgDiscount,
}: Props) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(contracts.length / PAGE_SIZE));
  const pageContracts = contracts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tableHeaders = [
    t('intel.table.project'),
    t('intel.table.province'),
    t('intel.table.budget'),
    t('intel.table.agreed-price'),
    t('intel.table.discount'),
    t('intel.table.winner'),
    t('intel.table.year'),
  ];

  return (
    <>
      {/* Page header */}
      <div className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
        <div className="container-app py-8">
          <nav className="flex items-center gap-2 text-sm text-[#717171] mb-3">
            <Link href="/" className="hover:text-[#111111] transition-colors">{t('common.home.label')}</Link>
            <span>/</span>
            <span className="text-[#111111] font-medium">{t('intel.title')}</span>
          </nav>
          <h1 className="text-2xl font-semibold text-[#111111] mb-1">{t('intel.title')}</h1>
          <p className="text-[#717171] text-sm">{t('intel.desc')}</p>
        </div>
      </div>

      <div className="container-app py-8">
        {/* Search bar */}
        <div className="flex gap-2 mb-6">
          <form method="GET" className="flex gap-2 flex-1">
            <input
              name="q"
              defaultValue={keyword}
              placeholder={t('intel.search.placeholder')}
              className="flex-1 border border-[#E0E0E0] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B6EA5]"
            />
            <button
              type="submit"
              className="bg-[#1E3A5F] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#2a4f7f] transition-colors"
            >
              {t('common.search.button')}
            </button>
          </form>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: t('intel.stats.contracts'),    value: contracts.length.toLocaleString() },
            { label: t('intel.stats.total-budget'), value: fmt(totalBudget) },
            { label: t('intel.stats.avg-discount'), value: avgDiscount !== null ? `${avgDiscount.toFixed(1)}%` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-[#E0E0E0] rounded-xl p-4">
              <div className="text-xs text-[#717171] mb-1">{label}</div>
              <div className="text-xl font-semibold text-[#111111]">{value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        {contracts.length === 0 ? (
          <div className="text-center py-16 text-[#717171]">
            No awarded contracts found for &ldquo;{keyword}&rdquo;.
          </div>
        ) : (
          <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
                    {tableHeaders.map((h) => (
                      <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-[#717171] uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageContracts.map((c) => {
                    const hasLosers = (c.losers?.length ?? 0) > 0;
                    return (
                      <tr key={c.projectId} className="border-b border-[#E0E0E0] hover:bg-[#F7F7F7] transition-colors">
                        <td className="py-3 px-4">
                          <div className="text-sm font-medium text-[#111111] leading-snug line-clamp-2">
                            {c.projectName}
                          </div>
                          <div className="text-xs text-[#717171] mt-0.5">{c.agency}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-[#444]">{c.province}</td>
                        <td className="py-3 px-4 text-sm text-right font-mono">{fmt(c.budget)}</td>
                        <td className="py-3 px-4 text-sm text-right font-mono">{fmt(c.agreedPrice)}</td>
                        <td className="py-3 px-4 text-sm text-center">
                          {c.discountFromReference !== null ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <TrendingDown size={13} />
                              {c.discountFromReference.toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <Trophy size={13} className="text-amber-500 flex-shrink-0" />
                            <span className={`text-sm leading-snug ${cleanWinner(c.winnerName) ? 'text-[#111111]' : 'text-[#B0B0B0] italic'}`}>
                              {cleanWinner(c.winnerName) ?? 'ไม่ระบุ'}
                            </span>
                          </div>
                          {hasLosers && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <Users size={13} className="text-[#717171] flex-shrink-0" />
                              <span className="text-xs text-[#717171]">
                                {c.losers!.length} loser{c.losers!.length > 1 ? 's' : ''} identified
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#717171]">{c.fiscalYear}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-[#E0E0E0] flex items-center justify-between">
                  <span className="text-xs text-[#717171]">
                    {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, contracts.length).toLocaleString()} of {contracts.length.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo(0, 0); }}
                      disabled={page === 1}
                      className="p-1.5 rounded border border-[#E0E0E0] text-[#717171] hover:bg-[#F7F7F7] disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                      .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === '…' ? (
                          <span key={`ellipsis-${i}`} className="px-1 text-[#B0B0B0] text-sm">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => { setPage(p as number); window.scrollTo(0, 0); }}
                            className={`min-w-[32px] h-8 px-2 rounded text-sm font-medium transition-colors ${
                              p === page
                                ? 'bg-[#1E3A5F] text-white'
                                : 'border border-[#E0E0E0] text-[#444] hover:bg-[#F7F7F7]'
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}
                    <button
                      onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo(0, 0); }}
                      disabled={page === totalPages}
                      className="p-1.5 rounded border border-[#E0E0E0] text-[#717171] hover:bg-[#F7F7F7] disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
