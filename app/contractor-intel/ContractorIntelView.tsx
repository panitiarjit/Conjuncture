'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, Building2, TrendingUp, Search, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import type { ContractorSignal } from '@/lib/contractor-intel-types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtBaht(n: number): string {
  if (n >= 1_000_000_000) return `฿${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString('th-TH')}`;
}

function fmtP(p: number): string {
  if (p < 0.001) return 'p < 0.001';
  if (p < 0.01)  return `p = ${p.toFixed(3)}`;
  return `p = ${p.toFixed(2)}`;
}

// Thai category labels
const CAT_LABEL: Record<string, string> = {
  'จ้างก่อสร้าง':                'Construction',
  'จ้างทำของ/จ้างเหมาบริการ':   'Services',
  'ซื้อ':                         'Purchase',
  'เช่า':                         'Rental',
  'จ้างควบคุมงาน':               'Supervision',
  'จ้างที่ปรึกษา':               'Consulting',
  'จ้างออกแบบ':                  'Design',
};

function catLabel(raw: string): string {
  return CAT_LABEL[raw] ?? raw;
}

// ── Flag badges ───────────────────────────────────────────────────────────────

function NearCeilingBadge({ categories, pValues }: { categories: string[]; pValues: number[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
      >
        <TrendingUp size={11} />
        Near-ceiling
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-[#E0E0E0] rounded-xl shadow-lg py-2 w-56">
          <p className="px-3 pb-1.5 text-[10px] text-[#717171] font-medium uppercase tracking-wide border-b border-[#E0E0E0] mb-1">
            Significant categories
          </p>
          {categories.map((cat, i) => (
            <div key={cat} className="px-3 py-1 flex items-center justify-between gap-2">
              <span className="text-xs text-[#111111]">{catLabel(cat)}</span>
              <span className="text-[10px] text-amber-600 font-mono">{fmtP(pValues[i])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgencyLockBadge({ p }: { p: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
      <Building2 size={11} />
      Agency lock · {fmtP(p)}
    </span>
  );
}

// ── Row expand ────────────────────────────────────────────────────────────────

function ContractorRow({ c, lang }: { c: ContractorSignal; lang: 'en' | 'th' }) {
  const [expanded, setExpanded] = useState(false);

  const isFlagged = c.flag_count > 0;

  return (
    <>
      <tr
        className={`border-b border-[#E0E0E0] cursor-pointer transition-colors ${isFlagged ? 'hover:bg-amber-50/40' : 'hover:bg-[#F7F7F7]'}`}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Contractor */}
        <td className="py-3 px-4">
          <div className="flex items-start gap-2">
            {isFlagged && <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />}
            <div>
              <div className="text-sm font-medium text-[#111111] leading-snug">{c.winnerName}</div>
              {c.winnerBusinessId && (
                <div className="text-xs text-[#717171] mt-0.5 font-mono">{c.winnerBusinessId}</div>
              )}
            </div>
          </div>
        </td>

        {/* Wins + value */}
        <td className="py-3 px-4 text-right">
          <div className="text-sm font-medium text-[#111111]">{c.win_count}</div>
          <div className="text-xs text-[#717171]">{fmtBaht(c.total_value_thb)}</div>
        </td>

        {/* Top agency */}
        <td className="py-3 px-4">
          <div className="text-sm text-[#111111] leading-snug line-clamp-2">{c.top_agency}</div>
          <div className="text-xs text-[#717171] mt-0.5">{c.top_agency_pct}% of wins</div>
        </td>

        {/* Bidding */}
        <td className="py-3 px-4 text-center">
          <div className="text-sm font-mono text-[#111111]">
            {c.median_discount === 0 ? '0%' : `${c.median_discount.toFixed(2)}%`}
          </div>
          <div className="text-xs text-[#717171]">{c.near_ceiling_rate}% near-ceiling</div>
        </td>

        {/* Flags */}
        <td className="py-3 px-4">
          <div className="flex flex-wrap gap-1.5">
            {c.flags.near_ceiling && (
              <NearCeilingBadge
                categories={c.near_ceiling_categories}
                pValues={c.near_ceiling_p_values}
              />
            )}
            {c.flags.single_agency_lock && c.single_agency_lock_p !== null && (
              <AgencyLockBadge p={c.single_agency_lock_p} />
            )}
            {!isFlagged && (
              <span className="text-xs text-[#B0B0B0]">—</span>
            )}
          </div>
        </td>

        {/* Years */}
        <td className="py-3 px-4 text-xs text-[#717171]">
          {c.fiscal_years.join(', ')}
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && (
        <tr className="border-b border-[#E0E0E0] bg-[#F7F7F7]">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-2 gap-6 max-w-2xl">
              {/* Agency breakdown */}
              <div>
                <p className="text-xs font-semibold text-[#717171] uppercase tracking-wide mb-2">Agency breakdown</p>
                <div className="space-y-1">
                  {c.agencies.slice(0, 6).map(a => (
                    <div key={a.agency} className="flex items-center gap-2">
                      <div
                        className="h-1.5 rounded-full bg-[#1E3A5F] flex-shrink-0"
                        style={{ width: `${Math.round((a.count / c.win_count) * 80)}px` }}
                      />
                      <span className="text-xs text-[#111111] leading-snug">{a.agency}</span>
                      <span className="text-xs text-[#717171] ml-auto flex-shrink-0">{a.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flag explanation */}
              {isFlagged && (
                <div>
                  <p className="text-xs font-semibold text-[#717171] uppercase tracking-wide mb-2">Why flagged</p>
                  {c.flags.near_ceiling && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-amber-700 mb-0.5">Near-ceiling bidding</p>
                      <p className="text-xs text-[#444]">
                        Bids cluster statistically closer to the reference price ceiling than the market
                        in {c.near_ceiling_categories.map(catLabel).join(', ')} (Mann-Whitney, BH-corrected).
                      </p>
                    </div>
                  )}
                  {c.flags.single_agency_lock && (
                    <div>
                      <p className="text-xs font-medium text-red-700 mb-0.5">Agency concentration</p>
                      <p className="text-xs text-[#444]">
                        {c.top_agency_pct}% of wins from one agency — anomalous vs. peer contractors
                        of similar win count (Binomial test, {fmtP(c.single_agency_lock_p!)}).
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

type FilterMode = 'flagged' | 'all';

interface Props {
  contractors: ContractorSignal[];
}

export default function ContractorIntelView({ contractors }: Props) {
  const { lang, t } = useLanguage();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('flagged');
  const [showMethodology, setShowMethodology] = useState(false);

  const flagged    = useMemo(() => contractors.filter(c => c.flag_count > 0), [contractors]);
  const nearOnly   = useMemo(() => flagged.filter(c => c.flags.near_ceiling && !c.flags.single_agency_lock), [flagged]);
  const agencyOnly = useMemo(() => flagged.filter(c => !c.flags.near_ceiling && c.flags.single_agency_lock), [flagged]);
  const both       = useMemo(() => flagged.filter(c => c.flags.near_ceiling && c.flags.single_agency_lock), [flagged]);

  const visible = useMemo(() => {
    const base = filter === 'flagged' ? flagged : contractors;
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(c =>
      c.winnerName.toLowerCase().includes(q) ||
      (c.winnerBusinessId ?? '').toLowerCase().includes(q) ||
      c.top_agency.toLowerCase().includes(q),
    );
  }, [contractors, flagged, filter, query]);

  return (
    <>
      {/* Page header */}
      <div className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
        <div className="container-app py-8">
          <nav className="flex items-center gap-2 text-sm text-[#717171] mb-3">
            <Link href="/" className="hover:text-[#111111] transition-colors">
              {t('common.home.label')}
            </Link>
            <span>/</span>
            <span className="text-[#111111] font-medium">
              {lang === 'th' ? 'ข้อมูลผู้รับเหมา' : 'Contractor Intelligence'}
            </span>
          </nav>
          <h1 className="text-2xl font-semibold text-[#111111] mb-1">
            {lang === 'th' ? 'ข้อมูลผู้รับเหมา' : 'Contractor Intelligence'}
          </h1>
          <p className="text-[#717171] text-sm max-w-2xl">
            {lang === 'th'
              ? 'ตรวจจับพฤติกรรมผิดปกติของผู้รับเหมาด้วยการทดสอบทางสถิติ — การประมูลใกล้เพดานราคาและการกระจุกตัวของหน่วยงาน'
              : 'Statistical flags on contractor behaviour — near-ceiling bid clustering and single-agency concentration, tested against market baselines.'
            }
          </p>

          {/* Methodology toggle */}
          <button
            onClick={() => setShowMethodology(v => !v)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#717171] hover:text-[#111111] transition-colors"
          >
            <Info size={12} />
            {showMethodology ? 'Hide methodology' : 'How flags work'}
          </button>
          {showMethodology && (
            <div className="mt-3 p-4 bg-white border border-[#E0E0E0] rounded-xl text-xs text-[#444] space-y-2 max-w-2xl">
              <p>
                <span className="font-semibold text-amber-700">Near-ceiling</span> — one-sided Mann-Whitney U
                test per project category: H₁ = contractor discounts are stochastically smaller than the market
                (i.e. bids cluster closer to the reference price). p-values are Benjamini-Hochberg corrected
                across categories. Minimum 5 wins per category required.
              </p>
              <p>
                <span className="font-semibold text-red-700">Agency lock</span> — one-sided Binomial test:
                H₁ = top-agency win fraction exceeds the median for contractors with a similar win count
                (size-stratified baseline: 63% for 5–9 wins, 83% for 10–19, 95% for 20–49).
                Minimum 5 total wins required.
              </p>
              <p className="text-[#717171]">
                Both flags use α = 0.05. Data: CGD awarded contracts (20,000 records). Flagging is
                pattern detection, not proof of wrongdoing.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="container-app py-8">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Contractors analysed', value: contractors.length.toLocaleString() },
            { label: 'Flagged', value: flagged.length.toLocaleString(), highlight: flagged.length > 0 },
            { label: 'Both flags', value: both.length.toLocaleString(), highlight: both.length > 0 },
            { label: 'Near-ceiling only', value: nearOnly.length.toLocaleString() },
          ].map(({ label, value, highlight }) => (
            <div
              key={label}
              className={`border rounded-xl p-4 ${highlight ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#E0E0E0]'}`}
            >
              <div className="text-xs text-[#717171] mb-1">{label}</div>
              <div className={`text-xl font-semibold ${highlight ? 'text-amber-700' : 'text-[#111111]'}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1 min-w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B0B0]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search contractor or agency…"
              className="w-full pl-8 pr-4 py-2 text-sm border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B6EA5]"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center border border-[#E0E0E0] rounded-lg overflow-hidden text-sm">
            {(['flagged', 'all'] as FilterMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={`px-4 py-2 font-medium transition-colors ${
                  filter === mode
                    ? 'bg-[#111111] text-white'
                    : 'bg-white text-[#717171] hover:bg-[#F7F7F7] hover:text-[#111111]'
                }`}
              >
                {mode === 'flagged' ? `Flagged (${flagged.length})` : `All (${contractors.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {visible.length === 0 ? (
          <div className="text-center py-16 text-[#717171] text-sm">
            {query ? `No contractors match "${query}"` : 'No contractors to display.'}
          </div>
        ) : (
          <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
                    {['Contractor', 'Wins / Value', 'Top Agency', 'Median Discount', 'Flags', 'FY'].map(h => (
                      <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-[#717171] uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(c => (
                    <ContractorRow
                      key={c.winnerBusinessId ?? c.winnerName}
                      c={c}
                      lang={lang}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-[#E0E0E0] text-xs text-[#717171]">
              {visible.length.toLocaleString()} contractor{visible.length !== 1 ? 's' : ''} shown
              {query && ` · filtered by "${query}"`}
              {' · Click any row to expand'}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="mt-6 text-xs text-[#B0B0B0] max-w-2xl">
          Flags indicate statistically anomalous patterns relative to market and peer baselines.
          They are investigative signals, not evidence of misconduct. Dataset: 20,000 CGD awarded
          contracts, contractors with ≥ 5 wins only.
        </p>
      </div>
    </>
  );
}
