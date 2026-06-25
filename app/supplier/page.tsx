'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { Package, Trophy, TrendingUp, ArrowUpRight, Building2, BarChart2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import type { SupplierCategoryStats } from '@/app/api/supplier-intel/route';

const CATEGORY_OPTIONS = [
  { value: 'construction', label: 'Construction (ก่อสร้าง)' },
  { value: 'renovation', label: 'Renovation / Repair (ปรับปรุง)' },
  { value: 'medical', label: 'Medical (การแพทย์)' },
  { value: 'technology', label: 'Technology / IT (เทคโนโลยี)' },
  { value: 'food', label: 'Food & Catering (อาหาร)' },
  { value: 'education', label: 'Education (การศึกษา)' },
  { value: 'security', label: 'Security (รักษาความปลอดภัย)' },
  { value: 'consulting', label: 'Consulting / Design (ที่ปรึกษา)' },
  { value: 'logistics', label: 'Logistics / Vehicles (ขนส่ง)' },
  { value: 'agriculture', label: 'Agriculture / Environment (เกษตร)' },
  { value: 'cleaning', label: 'Cleaning / Waste (ทำความสะอาด)' },
  { value: 'other', label: 'Other' },
];

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return `฿${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString('th-TH')}`;
}

// CGD stores business IDs as floats → scientific notation "1.07537E+11".
// Convert to the proper 13-digit Thai juristic entity ID.
function dbdUrl(businessId: string | null): string | null {
  if (!businessId) return null;
  const num = Number(businessId);
  if (!isNaN(num) && isFinite(num) && num > 999_999) {
    const id = Math.round(num).toString().padStart(13, '0');
    return `https://www.dbd.go.th/main.php?filename=index&search=${id}`;
  }
  // Already a clean string
  return `https://www.dbd.go.th/main.php?filename=index&search=${encodeURIComponent(businessId)}`;
}

export default function SupplierPage() {
  const [category, setCategory] = useState('');
  const [stats, setStats] = useState<SupplierCategoryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (cat: string) => {
    if (!cat) return;
    setLoading(true);
    setError(null);
    setStats(null);
    try {
      const res = await fetch(`/api/supplier-intel?category=${encodeURIComponent(cat)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? 'No data for this category');
        return;
      }
      setStats(await res.json());
    } catch {
      setError('Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const MAX_BAR_PX = 80;
  const maxBudget = stats
    ? Math.max(...stats.growthTrend.map((g) => g.totalBudget), 1)
    : 1;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <div className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
          <div className="container-app py-8">
            <nav className="flex items-center gap-2 text-sm text-[#717171] mb-3">
              <Link href="/" className="hover:text-[#111111] transition-colors">Home</Link>
              <span>/</span>
              <span className="text-[#111111] font-medium">Supplier Intelligence</span>
            </nav>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#EFF6FF] rounded-xl flex items-center justify-center flex-shrink-0">
                <Package size={20} className="text-[#1E3A5F]" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-[#111111]">Supplier / Distributor Intelligence</h1>
                <p className="text-[#717171] text-sm mt-0.5">
                  Identify which prime contractors win in your supply category — and approach them as a supplier.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container-app py-8">
          {/* Category selector */}
          <div className="max-w-xl mb-8">
            <label className="block text-sm font-medium text-[#111111] mb-2">
              Select your supply category
            </label>
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B6EA5] bg-white"
              >
                <option value="">— Choose a category —</option>
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={() => search(category)}
                disabled={!category || loading}
                className="bg-[#1E3A5F] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#2a4f7f] disabled:opacity-50 transition-colors"
              >
                {loading ? 'Loading…' : 'Analyse'}
              </button>
            </div>
            <p className="text-xs text-[#717171] mt-2">
              Shows winning contractors from 29,000+ CGD awarded contracts — your potential supply chain customers.
            </p>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 text-sm text-[#B91C1C] mb-6">
              {error}
            </div>
          )}

          {stats && (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
                  <div className="text-xs text-[#717171] mb-1">Contracts in Dataset</div>
                  <div className="text-xl font-semibold text-[#111111]">{stats.totalContracts.toLocaleString()}</div>
                </div>
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
                  <div className="text-xs text-[#717171] mb-1">Total Market Value</div>
                  <div className="text-xl font-semibold text-[#111111]">{fmt(stats.totalBudget)}</div>
                </div>
                <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
                  <div className="text-xs text-[#717171] mb-1">Avg Contract Size</div>
                  <div className="text-xl font-semibold text-[#111111]">{fmt(stats.avgBudget)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top contractors */}
                <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E0E0E0] flex items-center gap-2">
                    <Trophy size={16} className="text-amber-500" />
                    <h2 className="text-sm font-semibold text-[#111111]">Top Contractors to Approach</h2>
                    <span className="ml-auto text-xs text-[#717171]">ranked by total contract value</span>
                  </div>
                  <div className="divide-y divide-[#F0F0F0]">
                    {stats.topContractors.slice(0, 15).map((c, i) => {
                      const dbd = dbdUrl(c.businessId);
                      return (
                        <div key={c.name} className="px-5 py-3 flex items-center gap-3">
                          <span className="text-xs font-bold text-[#B0B0B0] w-5 flex-shrink-0">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[#111111] truncate">{c.name}</div>
                            <div className="text-xs text-[#717171]">{c.wins} contracts · avg {fmt(c.avgValue)}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-semibold text-[#111111]">{fmt(c.totalValue)}</div>
                            {dbd && (
                              <a
                                href={dbd}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-[#3B6EA5] hover:underline inline-flex items-center gap-0.5"
                              >
                                DBD <ArrowUpRight size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Market growth trend */}
                <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E0E0E0] flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-600" />
                    <h2 className="text-sm font-semibold text-[#111111]">Market Spend Trend (฿)</h2>
                    <span className="ml-auto text-xs text-[#717171]">by fiscal year (BE)</span>
                  </div>
                  <div className="p-5">
                    {/* Value labels above bars */}
                    <div className="flex gap-2 mb-1">
                      {stats.growthTrend.map((g) => (
                        <div key={g.year} className="flex-1 text-center">
                          <span className="text-[9px] text-[#717171] leading-tight">{fmt(g.totalBudget)}</span>
                        </div>
                      ))}
                    </div>
                    {/* Bar area — fixed height, bars grow upward */}
                    <div className="flex items-end gap-2" style={{ height: `${MAX_BAR_PX}px` }}>
                      {stats.growthTrend.map((g) => (
                        <div
                          key={g.year}
                          className="flex-1 bg-[#1E3A5F] rounded-t"
                          style={{ height: `${Math.max(Math.round((g.totalBudget / maxBudget) * MAX_BAR_PX), 4)}px` }}
                          title={`${g.count} contracts · ${fmt(g.totalBudget)}`}
                        />
                      ))}
                    </div>
                    {/* Year + count labels below bars */}
                    <div className="flex gap-2 mt-1">
                      {stats.growthTrend.map((g) => (
                        <div key={g.year} className="flex-1 text-center">
                          <span className="text-[10px] text-[#717171] block">{String(g.year).slice(-2)}</span>
                          <span className="text-[9px] text-[#B0B0B0]">{g.count}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-[#F0F0F0] text-xs text-[#717171]">
                      Each bar = total government spend in this category per fiscal year.
                      Numbers below bars = contract count.
                    </div>
                  </div>

                  {/* Recent contracts table */}
                  <div className="border-t border-[#E0E0E0]">
                    <div className="px-5 py-3 flex items-center gap-2">
                      <BarChart2 size={14} className="text-[#717171]" />
                      <h3 className="text-xs font-semibold text-[#111111] uppercase tracking-wide">
                        Recent Contracts (latest 10)
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-[#F7F7F7]">
                            {['Project', 'Agency', 'Value', 'Winner'].map((h) => (
                              <th key={h} className="py-2 px-4 text-left text-[10px] font-semibold text-[#717171] uppercase tracking-wide whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recentTenders.slice(0, 10).map((t) => (
                            <tr key={t.projectId} className="border-t border-[#F0F0F0] hover:bg-[#FAFAFA]">
                              <td className="py-2 px-4 text-xs text-[#111111] max-w-[160px]">
                                <span className="line-clamp-2">{t.projectName}</span>
                              </td>
                              <td className="py-2 px-4 text-xs text-[#717171] max-w-[120px]">
                                <span className="truncate block">{t.agency}</span>
                              </td>
                              <td className="py-2 px-4 text-xs font-mono whitespace-nowrap text-right">{fmt(t.agreedPrice ?? t.budget)}</td>
                              <td className="py-2 px-4 text-xs text-[#111111] max-w-[120px]">
                                <span className="truncate block">{t.winnerName ?? '—'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* How to use */}
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 size={15} className="text-[#1E3A5F]" />
                  <h3 className="text-sm font-semibold text-[#1E3A5F]">How to use this data</h3>
                </div>
                <ol className="text-sm text-[#1E3A5F] space-y-1 list-decimal list-inside">
                  <li>Identify the top contractors in your supply category above.</li>
                  <li>Click their DBD link to find company registration details and directors.</li>
                  <li>Approach them directly as a supplier — they win these contracts regularly and need reliable supply chains.</li>
                  <li>Monitor the &quot;Recent Contracts&quot; section for upcoming repeat buyers.</li>
                </ol>
              </div>
            </div>
          )}

          {!stats && !loading && !error && (
            <div className="text-center py-20 text-[#717171]">
              <Package size={40} className="mx-auto mb-4 text-[#E0E0E0]" />
              <p className="text-sm font-medium">Select a supply category to discover your target contractors.</p>
              <p className="text-xs mt-1 text-[#B0B0B0]">
                Data from CGD Open Data · 29,000+ awarded contracts across all fiscal years.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
