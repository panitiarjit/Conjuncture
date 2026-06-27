'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Search, Building2, TrendingDown, Trophy, BarChart2, ArrowLeft } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Skeleton from '@/components/ui/Skeleton';
import { useLanguage } from '@/lib/language-context';
import type { AgencyStats } from '@/app/api/agency-intel/route';

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return `฿${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString('th-TH')}`;
}

export default function AgencyPage() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [stats, setStats] = useState<AgencyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [topAgencies, setTopAgencies] = useState<{ agency: string; n: number }[]>([]);
  const [topLoading, setTopLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agencies')
      .then(r => r.json())
      .then((data: { agency: string; n: number }[]) => setTopAgencies(data.slice(0, 24)))
      .catch(() => {})
      .finally(() => setTopLoading(false));
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch('/api/agencies');
      const data: { agency: string; n: number }[] = await res.json();
      const filtered = data
        .filter((a) => a.agency.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 8)
        .map((a) => a.agency);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } catch {}
  }, []);

  const search = useCallback(async (agencyName: string) => {
    if (!agencyName.trim()) return;
    setLoading(true);
    setError(null);
    setStats(null);
    setShowSuggestions(false);
    try {
      const res = await fetch(`/api/agency-intel?agency=${encodeURIComponent(agencyName)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? 'Agency not found');
        return;
      }
      setStats(await res.json());
    } catch {
      setError(t('common.error.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
          <div className="container-app py-8">
            <nav className="flex items-center gap-2 text-sm text-[#717171] mb-3">
              <Link href="/" className="hover:text-[#111111] transition-colors">{t('common.home.label')}</Link>
              <span>/</span>
              <span className="text-[#111111] font-medium">{t('agency.title')}</span>
            </nav>
            <h1 className="text-2xl font-semibold text-[#111111] mb-1">{t('agency.title')}</h1>
            <p className="text-[#717171] text-sm">{t('agency.desc')}</p>
          </div>
        </div>

        <div className="container-app py-8">
          {/* Search bar */}
          <div className="relative max-w-xl mb-8">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717171]" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    fetchSuggestions(e.target.value);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') search(query); }}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder={t('agency.search.placeholder')}
                  className="w-full pl-9 pr-4 py-2.5 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B6EA5]"
                />
                {showSuggestions && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-[#E0E0E0] rounded-lg shadow-lg overflow-hidden"
                  >
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#111111] hover:bg-[#F7F7F7] flex items-center gap-2"
                        onClick={() => { setQuery(s); setShowSuggestions(false); search(s); }}
                      >
                        <Building2 size={14} className="text-[#717171] flex-shrink-0" />
                        <span className="truncate">{s}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => search(query)}
                disabled={loading}
                className="bg-[#1E3A5F] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#2a4f7f] disabled:opacity-50 transition-colors"
              >
                {loading ? t('common.loading') : t('common.search.button')}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 text-sm text-[#B91C1C] mb-6">
              {error}
            </div>
          )}

          {/* Loading skeleton for stats */}
          {loading && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-96" />
                <Skeleton className="h-96" />
              </div>
              <Skeleton className="h-64" />
            </div>
          )}

          {stats && !loading && (
            <div className="space-y-6">
              {/* Back button */}
              <button
                onClick={() => { setStats(null); setQuery(''); setError(null); }}
                className="inline-flex items-center gap-1.5 text-sm text-[#717171] hover:text-[#111111] transition-colors"
              >
                <ArrowLeft size={14} />
                {t('agency.back')}
              </button>

              {/* Agency header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EFF6FF] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-[#1E3A5F]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#111111]">{stats.agency}</h2>
                  <p className="text-sm text-[#717171]">{stats.totalContracts.toLocaleString()} {t('agency.awarded')}</p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: t('agency.stats.contracts'), value: stats.totalContracts.toLocaleString() },
                  { label: t('agency.stats.budget'),    value: fmt(stats.totalBudget) },
                  { label: t('agency.stats.avg-discount'), value: stats.avgDiscount !== null ? `${stats.avgDiscount.toFixed(1)}%` : '—', sub: t('agency.stats.from-ref') },
                  { label: t('agency.stats.avg-size'),  value: fmt(stats.avgBudget) },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="bg-white border border-[#E0E0E0] rounded-xl p-4">
                    <div className="text-xs text-[#717171] mb-1">{label}</div>
                    <div className="text-xl font-semibold text-[#111111]">{value}</div>
                    {sub && <div className="text-xs text-[#717171] mt-0.5">{sub}</div>}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top winners */}
                <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E0E0E0] flex items-center gap-2">
                    <Trophy size={16} className="text-amber-500" />
                    <h3 className="text-sm font-semibold text-[#111111]">{t('agency.winners.title')}</h3>
                  </div>
                  {stats.topWinners.length === 0 ? (
                    <div className="px-5 py-8 text-sm text-[#B0B0B0] text-center">
                      Winner names not recorded in CGD data for this agency.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E0E0E0]">
                      {stats.topWinners.map((w, i) => (
                        <div key={w.name} className="px-5 py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-bold text-[#717171] w-5 flex-shrink-0">#{i + 1}</span>
                            <span className="text-sm text-[#111111] truncate">{w.name}</span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-medium text-[#111111]">{w.count} {t('common.wins.label')}</div>
                            <div className="text-xs text-[#717171]">{fmt(w.totalValue)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top categories + fiscal year */}
                <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-[#E0E0E0] flex items-center gap-2">
                    <BarChart2 size={16} className="text-[#1E3A5F]" />
                    <h3 className="text-sm font-semibold text-[#111111]">{t('agency.categories.title')}</h3>
                  </div>
                  <div className="p-5 space-y-3">
                    {stats.topCategories.map((cat) => {
                      const pct = Math.round((cat.count / stats.totalContracts) * 100);
                      return (
                        <div key={cat.category}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-[#111111] truncate mr-4">{cat.category || 'Unclassified'}</span>
                            <span className="text-[#717171] flex-shrink-0">{cat.count} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-[#F7F7F7] rounded-full overflow-hidden">
                            <div className="h-full bg-[#1E3A5F] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Fiscal year trend */}
                  {stats.fiscalYearBreakdown.length >= 1 && (
                    <div className="border-t border-[#E0E0E0] px-5 pt-4 pb-4 flex-1 flex flex-col min-h-[120px]">
                      <div className="text-xs font-semibold text-[#717171] uppercase tracking-wide mb-3">
                        {t('agency.fiscal.title')}
                      </div>
                      {(() => {
                        const maxCount = Math.max(...stats.fiscalYearBreakdown.map((f) => f.count));
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="flex gap-2 mb-1">
                              {stats.fiscalYearBreakdown.map((fy) => (
                                <div key={fy.year} className="flex-1 text-center">
                                  <span className="text-[9px] text-[#717171]">{fy.count}</span>
                                </div>
                              ))}
                            </div>
                            <div className="h-20 flex items-end gap-2">
                              {stats.fiscalYearBreakdown.map((fy) => (
                                <div
                                  key={fy.year}
                                  className="flex-1 bg-[#BFDBFE] rounded-sm"
                                  style={{ height: `${Math.max(Math.round((fy.count / maxCount) * 100), 5)}%` }}
                                />
                              ))}
                            </div>
                            <div className="flex gap-2 mt-1">
                              {stats.fiscalYearBreakdown.map((fy) => (
                                <div key={fy.year} className="flex-1 text-center">
                                  <span className="text-[10px] text-[#717171]">{String(fy.year).slice(-2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent contracts table */}
              <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E0E0E0]">
                  <h3 className="text-sm font-semibold text-[#111111]">{t('agency.recent.title')}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
                        {[t('agency.table.project'), t('agency.table.budget'), t('agency.table.agreed-price'), t('agency.table.discount'), t('agency.table.winner')].map((h) => (
                          <th key={h} className="py-2.5 px-4 text-left text-xs font-semibold text-[#717171] uppercase tracking-wide whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentContracts.slice(0, 20).map((c) => (
                        <tr key={c.projectId} className="border-b border-[#E0E0E0] hover:bg-[#F7F7F7] transition-colors">
                          <td className="py-3 px-4 text-sm text-[#111111] max-w-xs">
                            <span className="line-clamp-2">{c.projectName}</span>
                          </td>
                          <td className="py-3 px-4 text-sm text-right font-mono whitespace-nowrap">{fmt(c.budget)}</td>
                          <td className="py-3 px-4 text-sm text-right font-mono whitespace-nowrap">{fmt(c.agreedPrice)}</td>
                          <td className="py-3 px-4 text-sm text-center">
                            {c.discountFromReference !== null ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                <TrendingDown size={12} />
                                {c.discountFromReference.toFixed(1)}%
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-3 px-4 text-sm text-[#111111] max-w-[160px]">
                            <span className="truncate block">{c.winnerName ?? '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {stats.recentContracts.length > 20 && (
                    <div className="px-4 py-3 text-center text-xs text-[#717171] border-t border-[#E0E0E0]">
                      Showing 20 of {stats.recentContracts.length} recent contracts
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Agency cards grid */}
          {!stats && !loading && !error && (
            <div>
              <p className="text-sm font-semibold text-[#111111] mb-1">{t('agency.top-title')}</p>
              <p className="text-xs text-[#717171] mb-4">{t('agency.top-desc')}</p>

              {topLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {topAgencies.map((a) => (
                    <button
                      key={a.agency}
                      onClick={() => { setQuery(a.agency); search(a.agency); }}
                      className="text-left bg-white border border-[#E0E0E0] rounded-xl p-4 hover:border-[#1E3A5F] hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 bg-[#EFF6FF] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-[#1E3A5F] transition-colors">
                          <Building2 size={14} className="text-[#1E3A5F] group-hover:text-white transition-colors" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#111111] line-clamp-2 leading-snug">{a.agency}</p>
                          <p className="text-xs text-[#717171] mt-1">{a.n.toLocaleString()} {t('common.contracts.label')}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!topLoading && topAgencies.length === 0 && (
                <div className="text-center py-16 text-[#717171]">
                  <Building2 size={40} className="mx-auto mb-4 text-[#E0E0E0]" />
                  <p className="text-sm">{t('agency.search.placeholder')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
