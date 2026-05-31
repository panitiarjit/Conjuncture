export const dynamic = 'force-dynamic';
import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Download, Trophy, Users, TrendingDown } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProtectedShell from '@/components/layout/ProtectedShell';
import { getAwardedContracts } from '@/lib/data-service';
import type { AwardedContract } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Market Intelligence — Conjuncture',
  description: 'Awarded government contracts with winner analysis and competitor intelligence.',
};

function fmt(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString('th-TH')}`;
}

function ContractRow({ c }: { c: AwardedContract }) {
  const hasLosers = (c.losers?.length ?? 0) > 0;
  return (
    <tr className="border-b border-[#E0E0E0] hover:bg-[#F7F7F7] transition-colors">
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
          <span className="text-sm text-[#111111] line-clamp-1">{c.winnerName ?? '—'}</span>
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
      <td className="py-3 px-4 text-xs text-[#717171]">{c.fiscalYear} BE</td>
    </tr>
  );
}

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const keyword = q ?? 'จ้างเหมา';
  const contracts = await getAwardedContracts(keyword);

  const totalBudget = contracts.reduce((s, c) => s + (c.budget ?? 0), 0);
  const avgDiscount =
    contracts.filter((c) => c.discountFromReference !== null).length > 0
      ? contracts
          .filter((c) => c.discountFromReference !== null)
          .reduce((s, c) => s + c.discountFromReference!, 0) /
        contracts.filter((c) => c.discountFromReference !== null).length
      : null;
  const withLosers = contracts.filter((c) => (c.losers?.length ?? 0) > 0).length;

  const exportUrl = `/api/export-prospects?keyword=${encodeURIComponent(keyword)}`;
  const exportLosersUrl = `/api/export-prospects?keyword=${encodeURIComponent(keyword)}&losers=true`;

  return (
    <ProtectedShell>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          {/* Page header */}
          <div className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
            <div className="container-app py-8">
              <nav className="flex items-center gap-2 text-sm text-[#717171] mb-3">
                <Link href="/" className="hover:text-[#111111] transition-colors">Home</Link>
                <span>/</span>
                <span className="text-[#111111] font-medium">Market Intelligence</span>
              </nav>
              <h1 className="text-2xl font-semibold text-[#111111] mb-1">Market Intelligence</h1>
              <p className="text-[#717171] text-sm">
                Awarded government contracts with winner analysis. Data from CGD Open Data API.
              </p>
            </div>
          </div>

          <div className="container-app py-8">
            {/* Search + export bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <form method="GET" className="flex gap-2 flex-1">
                <input
                  name="q"
                  defaultValue={keyword}
                  placeholder="Keyword (e.g. จ้างเหมา)"
                  className="flex-1 border border-[#E0E0E0] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B6EA5]"
                />
                <button
                  type="submit"
                  className="bg-[#1E3A5F] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#2a4f7f] transition-colors"
                >
                  Search
                </button>
              </form>
              <div className="flex gap-2">
                <a
                  href={exportUrl}
                  className="flex items-center gap-2 border border-[#E0E0E0] bg-white px-4 py-2 rounded-lg text-sm font-medium text-[#444] hover:bg-[#F7F7F7] transition-colors"
                >
                  <Download size={15} />
                  Export All
                </a>
                {withLosers > 0 && (
                  <a
                    href={exportLosersUrl}
                    className="flex items-center gap-2 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2a4f7f] transition-colors"
                  >
                    <Download size={15} />
                    Export Losers Only ({withLosers})
                  </a>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Contracts', value: contracts.length.toLocaleString() },
                { label: 'Total Budget', value: fmt(totalBudget) },
                { label: 'Avg Discount', value: avgDiscount !== null ? `${avgDiscount.toFixed(1)}%` : '—' },
                { label: 'With Loser Data', value: withLosers.toString() },
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
                Run <code className="bg-[#F7F7F7] px-1 rounded">scripts/fetch-cgd.ts</code> to populate data.
              </div>
            ) : (
              <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
                        {['Project', 'Province', 'Budget', 'Agreed Price', 'Discount', 'Winner / Losers', 'Year'].map((h) => (
                          <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-[#717171] uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.slice(0, 200).map((c) => (
                        <ContractRow key={c.projectId} c={c} />
                      ))}
                    </tbody>
                  </table>
                  {contracts.length > 200 && (
                    <div className="p-4 text-center text-sm text-[#717171] border-t border-[#E0E0E0]">
                      Showing 200 of {contracts.length} — use Export to get all
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedShell>
  );
}
