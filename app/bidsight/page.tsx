"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  ChevronDown, AlertTriangle, Info,
} from "lucide-react";
import { buildCurveFromBand } from "@/lib/bidsight-core";
import Header from "@/components/layout/Header";
import { useLanguage } from "@/lib/language-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Band { p10: number; p25: number; median: number; p75: number; p90: number; }
interface ApiRec {
  recommendedBid: number;
  recommendedDiscount: number;
  marketMedianDiscount: number;
  expectedMargin: number;
  marginFloorBreached: boolean;
  cannotMeetMargin: boolean;
  positioningPct: number;
  positioningLabelEn: string;
  band: Band;
  comparableN: number;
  scope: string;
  fallbackUsed: boolean;
  benchmarkSource: string;
  bidSignals: {
    signals: { marginViability: number; competitiveness: number; marketVolume: number };
    rationale: string;
  };
  note: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtM(m: number) { return `฿${m.toFixed(2)}M`; }
function fmtMShort(m: number) { return `฿${m.toFixed(1)}M`; }

function posLabel(pct: number): string {
  if (pct < 25) return 'Soft — below most winners';
  if (pct < 50) return 'Conservative — below median';
  if (pct < 75) return 'Competitive — around typical range';
  if (pct < 90) return 'Aggressive — strong positioning';
  return 'Very aggressive — top decile';
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const bidM = parseFloat(label ?? '0');
  const pos = payload[0]?.value;
  return (
    <div className="bg-[#0D1628] border border-[#1A2B48] rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-[#64748B] mb-0.5">Bid: <span className="text-[#E2E8F0] font-mono font-semibold">{fmtM(bidM)}</span></p>
      <p className="text-[#60A5FA] font-semibold">{pos}th %ile positioning</p>
      <p className="text-[#64748B] mt-0.5">{posLabel(pos ?? 0)}</p>
    </div>
  );
}

// ── SliderInput ───────────────────────────────────────────────────────────────

function SliderInput({
  label, value, onChange, min, max, step, prefix, suffix,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; prefix?: string; suffix?: string;
}) {
  const [raw, setRaw] = useState('');
  const [focused, setFocused] = useState(false);

  const sliderMax = Math.max(max, value);

  function commit(raw: string) {
    const n = parseFloat(raw);
    if (!isNaN(n)) onChange(Math.min(sliderMax, Math.max(min, n)));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">{label}</span>
        <div className="flex items-center bg-[#060C1A] border border-[#1A2B48] rounded-lg px-2.5 py-1 gap-0.5 focus-within:border-[#3B82F6] transition-colors">
          {prefix && <span className="text-[#64748B] text-sm font-mono">{prefix}</span>}
          <input
            type="text"
            inputMode="decimal"
            className="w-16 text-sm font-mono text-[#E2E8F0] outline-none bg-transparent text-right"
            value={focused ? raw : value.toString()}
            onFocus={() => { setRaw(value.toString()); setFocused(true); }}
            onBlur={() => { setFocused(false); commit(raw); }}
            onChange={e => setRaw(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setFocused(false); commit(raw); } }}
          />
          {suffix && <span className="text-[#64748B] text-sm font-mono">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={sliderMax}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="dark-range"
      />
      <div className="flex justify-between text-[10px] text-[#334155] mt-0.5">
        <span>{prefix}{min}{suffix}</span>
        <span>{prefix}{max}{suffix}</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BidSightPage() {
  const { t } = useLanguage();

  // ── Dropdown data ─────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<{ id: string; n: number; median: number }[]>([]);
  const [agencies, setAgencies] = useState<{ agency: string; n: number }[]>([]);

  useEffect(() => {
    fetch('/api/benchmark-categories').then(r => r.json()).then(setCategories).catch(() => {});
    fetch('/api/agencies').then(r => r.json()).then(setAgencies).catch(() => {});
  }, []);

  // ── Inputs ────────────────────────────────────────────────────────────────
  const [category, setCategory] = useState('');
  const [agency, setAgency] = useState('');
  const [agencySearch, setAgencySearch] = useState('');
  const [agencyOpen, setAgencyOpen] = useState(false);
  const [refPriceM, setRefPriceM] = useState(10);
  const [costM, setCostM] = useState(8.2);
  const [targetMarginPct, setTargetMarginPct] = useState(10);
  const [targetPositionPct, setTargetPositionPct] = useState(50);

  useEffect(() => {
    if (costM > refPriceM) setCostM(parseFloat((refPriceM * 0.82).toFixed(2)));
  }, [refPriceM]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Market data (from API) ────────────────────────────────────────────────
  const [apiRec, setApiRec] = useState<ApiRec | null>(null);
  const [loading, setLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);

      const params = new URLSearchParams({
        refPriceM:       refPriceM.toString(),
        costM:           costM.toString(),
        targetMarginPct: targetMarginPct.toString(),
      });
      params.set('targetPositionPct', targetPositionPct.toString());
      if (agency)   params.set('agency',      agency);
      if (category) params.set('projectType', category);

      fetch(`/api/recommend-bid?${params}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(data => { if (!ctrl.signal.aborted) { setApiRec(data); setLoading(false); } })
        .catch(e => { if (e.name !== 'AbortError') setLoading(false); });
    }, 50);

    return () => clearTimeout(timer);
  }, [refPriceM, costM, targetMarginPct, targetPositionPct, agency, category]);

  // ── Curve data ────────────────────────────────────────────────────────────
  const band = apiRec?.band ?? { p10: 2, p25: 4, median: 6.1, p75: 14, p90: 22 };
  const maxDisc = Math.max(band.p90 * 1.15, band.median * 2.5, 30);

  const curvePoints = useMemo(() => {
    const raw = buildCurveFromBand(band, 25);
    return raw.map(pt => ({
      bidM: Math.round(refPriceM * (1 - pt.disc / 100) * 100) / 100,
      disc:        pt.disc,
      positionPct: pt.positionPct,
    })).sort((a, b) => a.bidM - b.bidM);
  }, [band, refPriceM]);

  // ── Local recommendation (instant — derived from cached band + current economics) ──
  const localRec = useMemo(() => {
    const costRatio = costM / refPriceM;
    const marginMaxDiscount = (1 - costRatio / (1 - targetMarginPct / 100)) * 100;
    const cannotMeetMargin = marginMaxDiscount <= 0;

    const nearest = curvePoints.length > 0
      ? curvePoints.reduce((best, pt) =>
          Math.abs(pt.positionPct - targetPositionPct) < Math.abs(best.positionPct - targetPositionPct) ? pt : best
        )
      : null;
    const benchTarget = nearest?.disc ?? band.median;

    const targetDiscount = cannotMeetMargin ? 0 : Math.min(benchTarget, marginMaxDiscount);
    const bid = Math.round(refPriceM * (1 - targetDiscount / 100) * 100) / 100;
    const actualMargin = cannotMeetMargin ? 0 : (bid - costM) / bid * 100;
    const marginFloorBreached = !cannotMeetMargin && benchTarget > marginMaxDiscount;

    const posNearest = curvePoints.length > 0
      ? curvePoints.reduce((best, pt) =>
          Math.abs(pt.disc - targetDiscount) < Math.abs(best.disc - targetDiscount) ? pt : best
        )
      : null;

    return {
      recommendedBid:      bid,
      recommendedDiscount: Math.round(targetDiscount * 10) / 10,
      expectedMargin:      Math.round(actualMargin * 10) / 10,
      positioningPct:      posNearest?.positionPct ?? 50,
      marginFloorBreached,
      cannotMeetMargin,
    };
  }, [band, curvePoints, refPriceM, costM, targetMarginPct, targetPositionPct]);

  // ── Interactive explore slider ────────────────────────────────────────────
  const [exploreBidM, setExploreBidM] = useState<number | null>(null);

  const exploreNearest = exploreBidM !== null
    ? curvePoints.reduce((b, p) => Math.abs(p.bidM - exploreBidM) < Math.abs(b.bidM - exploreBidM) ? p : b, curvePoints[0])
    : null;

  const bandLowM  = Math.round(refPriceM * (1 - band.p75 / 100) * 100) / 100;
  const bandHighM = Math.round(refPriceM * (1 - band.p25 / 100) * 100) / 100;

  const maxEvPoint = useMemo(() => {
    if (!curvePoints.length || costM >= refPriceM) return null;
    return curvePoints.reduce((best, pt) => {
      const ev = (pt.positionPct / 100) * (pt.bidM - costM);
      const bestEv = (best.positionPct / 100) * (best.bidM - costM);
      return ev > bestEv ? pt : best;
    });
  }, [curvePoints, costM, refPriceM]);

  const rec = apiRec;

  // ── Agency search ─────────────────────────────────────────────────────────
  const filteredAgencies = useMemo(() => {
    if (!agencySearch) return agencies.slice(0, 80);
    const q = agencySearch.toLowerCase();
    return agencies.filter(a => a.agency.toLowerCase().includes(q)).slice(0, 50);
  }, [agencies, agencySearch]);

  // ── Chart X domain ────────────────────────────────────────────────────────
  const chartMin = Math.max(0, refPriceM * (1 - maxDisc / 100));
  const chartMax = refPriceM * 1.01;

  const signals = rec?.bidSignals.signals;

  return (
    <div className="min-h-screen flex flex-col bg-[#080D1A]">
      <Header dark />

      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 bg-[#0D1628] border-r border-[#1A2B48] flex flex-col overflow-y-auto">
          <div className="p-5 space-y-5 flex-1">
            {/* Page title */}
            <div>
              <h1 className="text-base font-semibold text-[#E2E8F0]">{t('bid.title')}</h1>
              <p className="text-xs text-[#64748B] mt-0.5">{t('bid.desc')}</p>
            </div>

            <div>
              <p className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-widest mb-4">{t('bid.section.market')}</p>

              {/* Category */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1.5">{t('bid.category.label')}</p>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-[#060C1A] border border-[#1A2B48] text-[#E2E8F0] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#3B82F6] transition-colors appearance-none"
                >
                  <option value="">{t('bid.category.all')}</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.id} ({c.n})</option>
                  ))}
                </select>
                {category && categories.find(c => c.id === category) && (
                  <p className="text-[10px] text-[#64748B] mt-1">
                    Median discount: {categories.find(c => c.id === category)?.median.toFixed(1)}%
                  </p>
                )}
              </div>

              {/* Agency */}
              <div className="mb-4 relative">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1.5">{t('bid.agency.label')}</p>
                <div
                  className="w-full bg-[#060C1A] border border-[#1A2B48] text-[#E2E8F0] text-sm rounded-lg px-3 py-2 cursor-pointer flex items-center justify-between hover:border-[#3B82F6] transition-colors"
                  onClick={() => setAgencyOpen(v => !v)}
                >
                  <span className={agency ? 'text-[#E2E8F0]' : 'text-[#334155]'}>
                    {agency || t('bid.agency.any')}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-[#64748B] transition-transform ${agencyOpen ? 'rotate-180' : ''}`} />
                </div>
                {agencyOpen && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-[#0D1628] border border-[#1A2B48] rounded-lg mt-1 shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-[#1A2B48]">
                      <input
                        className="w-full bg-[#060C1A] border border-[#1A2B48] text-[#E2E8F0] text-xs rounded px-2.5 py-1.5 outline-none placeholder-[#334155] focus:ring-1 focus:ring-[#3B82F6]"
                        placeholder={t('bid.agency.search')}
                        value={agencySearch}
                        onChange={e => setAgencySearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      <button
                        className="w-full text-left px-3 py-2 text-xs text-[#64748B] hover:bg-[#1A2B48] transition-colors"
                        onClick={() => { setAgency(''); setAgencyOpen(false); setAgencySearch(''); }}
                      >
                        {t('bid.agency.any')}
                      </button>
                      {filteredAgencies.map(a => (
                        <button
                          key={a.agency}
                          className="w-full text-left px-3 py-2 text-xs text-[#C4D3E8] hover:bg-[#1A2B48] transition-colors flex items-center justify-between gap-2"
                          onClick={() => { setAgency(a.agency); setAgencyOpen(false); setAgencySearch(''); }}
                        >
                          <span className="truncate">{a.agency}</span>
                          <span className="text-[#334155] flex-shrink-0">{a.n}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#1A2B48] pt-5">
              <p className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-widest mb-4">{t('bid.section.economics')}</p>
              <div className="space-y-5">
                <SliderInput
                  label={t('bid.ref-price')}
                  value={refPriceM}
                  onChange={setRefPriceM}
                  min={0.1} max={5000} step={0.1}
                  prefix="฿" suffix="M"
                />
                <SliderInput
                  label={t('bid.cost')}
                  value={costM}
                  onChange={v => setCostM(Math.min(v, refPriceM))}
                  min={0.1} max={refPriceM} step={0.1}
                  prefix="฿" suffix="M"
                />
                <SliderInput
                  label={t('bid.target-margin')}
                  value={targetMarginPct}
                  onChange={setTargetMarginPct}
                  min={1} max={30} step={1}
                  suffix="%"
                />

                {/* Aggression control */}
                <div>
                  <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">{t('bid.aggression')}</p>
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      { key: 'bid.aggression.safe'       as const, pct: 35, sub: 'P35' },
                      { key: 'bid.aggression.balanced'   as const, pct: 50, sub: 'P50' },
                      { key: 'bid.aggression.aggressive' as const, pct: 70, sub: 'P70' },
                    ] as const).map(opt => (
                      <button
                        key={opt.pct}
                        onClick={() => setTargetPositionPct(opt.pct)}
                        className={`rounded-lg py-2 text-center transition-colors border ${
                          targetPositionPct === opt.pct
                            ? 'bg-[#1D4ED8] border-[#2563EB] text-white'
                            : 'bg-[#060C1A] border-[#1A2B48] text-[#64748B] hover:border-[#3B82F6] hover:text-[#C4D3E8]'
                        }`}
                      >
                        <div className="text-[11px] font-semibold">{t(opt.key)}</div>
                        <div className={`text-[9px] ${targetPositionPct === opt.pct ? 'text-blue-300' : 'text-[#334155]'}`}>{opt.sub}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#334155] mt-1.5">{t('bid.aggression.desc')}</p>
                </div>
              </div>
            </div>

            {/* Bid signals — three raw factors, no composite score */}
            {rec && signals && (
              <div className="border border-[#1E293B] rounded-xl p-4 mt-2 bg-[#0F172A]/60">
                <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-3">
                  {t('bid.score.title')}
                </p>
                <div className="space-y-2 mb-3">
                  {([
                    { key: 'marginViability',  label: t('bid.signal.margin'),      val: signals.marginViability },
                    { key: 'competitiveness',  label: t('bid.signal.positioning'), val: signals.competitiveness },
                    { key: 'marketVolume',     label: t('bid.signal.volume'),      val: signals.marketVolume },
                  ] as const).map(({ key, label, val }) => (
                    <div key={key}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[#94A3B8]">{label}</span>
                        <span className="text-white font-semibold">{val}</span>
                      </div>
                      <div className="h-1 bg-[#1E293B] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            val >= 60 ? 'bg-emerald-500' : val >= 35 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[#64748B] text-[11px] leading-relaxed">
                  {rec.bidSignals.rationale}
                </p>
              </div>
            )}
          </div>

          {/* Benchmark note */}
          <div className="px-5 pb-5">
            {rec && (
              <p className="text-[10px] text-[#334155] leading-relaxed">
                Benchmark: {rec.benchmarkSource} · {rec.comparableN.toLocaleString()} contracts
                {rec.fallbackUsed && ' (fallback tier)'}
              </p>
            )}
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* ── Hero metrics ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Recommended bid */}
            <div className="lg:col-span-2 bg-[#0D1628] border border-[#1A2B48] rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <p className="text-[#64748B] text-xs font-semibold uppercase tracking-widest mb-1">
                    {t('bid.rec.title')}
                  </p>
                  <p className={`text-5xl font-black tracking-tight ${localRec.cannotMeetMargin ? 'text-red-400' : 'text-[#E2E8F0]'}`}>
                    {fmtM(localRec.recommendedBid)}
                  </p>
                </div>
                {!localRec.cannotMeetMargin && (
                  <div className="text-right flex-shrink-0 space-y-3">
                    <div>
                      <p className="text-[#64748B] text-[11px] mb-0.5">{t('bid.rec.discount')}</p>
                      <p className="text-[#E2E8F0] font-black text-xl">−{localRec.recommendedDiscount}%</p>
                    </div>
                    <div>
                      <p className="text-[#64748B] text-[11px] mb-0.5">{t('bid.rec.margin')}</p>
                      <p className={`font-black text-xl ${localRec.marginFloorBreached ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {localRec.expectedMargin.toFixed(1)}%
                      </p>
                      <p className={`text-[10px] mt-0.5 ${localRec.marginFloorBreached ? 'text-amber-500' : 'text-[#334155]'}`}>
                        {localRec.marginFloorBreached ? t('bid.rec.margin-limited') : t('bid.rec.market-det')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Confidence band */}
              {!localRec.cannotMeetMargin && (
                <div className="mt-3">
                  <p className="text-[#64748B] text-xs mb-2">{t('bid.rec.band')}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-[#64748B] text-sm font-mono">{fmtMShort(bandLowM)}</span>
                    <div className="flex-1 h-2.5 bg-[#1A2B48] rounded-full relative overflow-hidden">
                      <div
                        className="absolute inset-y-0 bg-[#2563EB] rounded-full"
                        style={{
                          left: `${Math.max(0, ((bandLowM - chartMin) / (chartMax - chartMin)) * 100)}%`,
                          right: `${Math.max(0, (1 - (bandHighM - chartMin) / (chartMax - chartMin)) * 100)}%`,
                        }}
                      />
                      {localRec.recommendedBid >= chartMin && localRec.recommendedBid <= chartMax && (
                        <div
                          className="absolute inset-y-0 w-0.5 bg-emerald-400 rounded"
                          style={{ left: `${((localRec.recommendedBid - chartMin) / (chartMax - chartMin)) * 100}%` }}
                        />
                      )}
                    </div>
                    <span className="text-[#64748B] text-sm font-mono">{fmtMShort(bandHighM)}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-[#64748B]">
                    <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-[#2563EB] rounded inline-block" /> {t('bid.rec.past-winners')}</span>
                    <span className="flex items-center gap-1"><span className="w-0.5 h-3 bg-emerald-400 inline-block rounded" /> {t('bid.rec.recommended')}</span>
                  </div>
                </div>
              )}

              {localRec.cannotMeetMargin && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-red-950/50 border border-red-800/60 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-xs">
                    Cost structure ({fmtM(costM)}) cannot support a profitable bid at any competitive discount from {fmtM(refPriceM)} reference price.
                    Reduce cost or lower target margin.
                  </p>
                </div>
              )}
            </div>

            {/* Positioning + EV */}
            <div className="space-y-4">
              <div className="bg-[#0D1628] border border-[#1A2B48] rounded-2xl p-5">
                <p className="text-[#64748B] text-xs font-semibold uppercase tracking-widest mb-3">{t('bid.positioning.title')}</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className={`text-4xl font-black ${
                    localRec.positioningPct >= 50 && localRec.positioningPct <= 85
                      ? 'text-emerald-400'
                      : localRec.positioningPct < 25 || localRec.positioningPct > 85
                      ? 'text-red-400'
                      : 'text-amber-400'
                  }`}>
                    {localRec.positioningPct}
                  </span>
                  <span className="text-[#64748B] text-lg mb-1">th %ile</span>
                </div>
                <div className="w-full h-1.5 bg-[#1A2B48] rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      localRec.positioningPct >= 50 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${localRec.positioningPct}%` }}
                  />
                </div>
                <p className="text-[#64748B] text-[11px]">{posLabel(localRec.positioningPct)}</p>
                <p className="text-[#334155] text-[10px] mt-1">
                  {t('bid.positioning.median')} −{rec?.marketMedianDiscount ?? band.median}%
                </p>
                {localRec.marginFloorBreached && targetPositionPct !== 50 && (
                  <div className="mt-2 p-2 bg-amber-950/50 border border-amber-800/60 rounded-lg">
                    <p className="text-amber-300 text-[10px] leading-relaxed">
                      P{targetPositionPct} blocked by {targetMarginPct}% margin floor — lower {t('bid.target-margin')} to reach more aggressive positioning.
                    </p>
                  </div>
                )}
              </div>

              {maxEvPoint && (
                <div className="bg-[#0D1628] border border-[#1A2B48] rounded-2xl p-5">
                  <p className="text-[#64748B] text-xs font-semibold uppercase tracking-widest mb-2">{t('bid.ev.title')}</p>
                  <p className="text-amber-400 text-2xl font-black mb-0.5">{fmtM(maxEvPoint.bidM)}</p>
                  <p className="text-[#64748B] text-[11px]">
                    −{maxEvPoint.disc.toFixed(1)}% discount · {maxEvPoint.positionPct}th %ile
                  </p>
                  <p className="text-[#334155] text-[10px] mt-1.5">{t('bid.ev.desc')}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Win curve ────────────────────────────────────────────── */}
          <div className="bg-[#0D1628] border border-[#1A2B48] rounded-2xl p-6 mb-4">
            <div className="flex items-start justify-between gap-4 mb-1">
              <div>
                <h3 className="text-[#E2E8F0] text-sm font-semibold mb-0.5">{t('bid.curve.title')}</h3>
                <p className="text-[#64748B] text-xs">{t('bid.curve.desc')}</p>
              </div>
              {rec && (
                <span className="flex-shrink-0 text-[10px] font-semibold text-[#60A5FA] bg-[#1D3461]/60 border border-[#2563EB]/40 rounded px-2 py-0.5 uppercase tracking-wide">
                  {rec.benchmarkSource} · {rec.comparableN.toLocaleString()} contracts
                </span>
              )}
            </div>

            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curvePoints} margin={{ top: 10, right: 16, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A2B48" />
                  <XAxis
                    dataKey="bidM"
                    type="number"
                    domain={[chartMin, chartMax]}
                    tick={{ fill: "#64748B", fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: "#1A2B48" }}
                    tickFormatter={v => `฿${(+v).toFixed(0)}M`}
                    label={{ value: 'Bid Price (฿M)', position: 'insideBottom', offset: -5, fill: '#64748B', fontSize: 10 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#64748B", fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: "#1A2B48" }}
                    tickFormatter={v => `${v}%`}
                    width={42}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#1A2B48', strokeWidth: 1 }} />

                  {!localRec.cannotMeetMargin && (
                    <ReferenceLine
                      x={localRec.recommendedBid}
                      stroke="#34D399"
                      strokeWidth={2}
                      label={{ value: 'Rec.', fill: '#34D399', fontSize: 10, dy: -6 }}
                    />
                  )}

                  {maxEvPoint && (
                    <ReferenceLine
                      x={maxEvPoint.bidM}
                      stroke="#FBBF24"
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                      label={{ value: 'Max EV', fill: '#FBBF24', fontSize: 10, dy: 14 }}
                    />
                  )}

                  {exploreNearest && (
                    <ReferenceLine
                      x={exploreNearest.bidM}
                      stroke="#818CF8"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                    />
                  )}

                  <Area
                    type="monotone"
                    dataKey="positionPct"
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    fill="url(#blueGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#60A5FA", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Explore slider */}
            <div className="mt-5 border-t border-[#1A2B48] pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wide">{t('bid.curve.explore')}</p>
                {exploreNearest && (
                  <p className="text-[#60A5FA] text-xs font-semibold">
                    {fmtM(exploreNearest.bidM)} → <span className="text-[#E2E8F0]">{exploreNearest.positionPct}th %ile</span>
                    {' '}· {posLabel(exploreNearest.positionPct).split(' — ')[0]}
                  </p>
                )}
              </div>
              <input
                type="range"
                min={chartMin}
                max={chartMax}
                step={(chartMax - chartMin) / 200}
                value={exploreBidM ?? localRec.recommendedBid}
                onChange={e => setExploreBidM(parseFloat(e.target.value))}
                className="dark-range-indigo"
              />
              <div className="flex justify-between text-[10px] text-[#334155] mt-1">
                <span>{fmtMShort(chartMin)} (−{maxDisc.toFixed(0)}% disc)</span>
                <span>{fmtMShort(chartMax)} (0% disc)</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-3 text-[10px] text-[#64748B]">
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[#3B82F6] inline-block rounded" />Positioning curve</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-emerald-400 inline-block rounded" />Recommended bid</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-px border-dashed border-t border-amber-400 inline-block" />Max expected value</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-px border-dashed border-t border-indigo-400 inline-block" />Explorer cursor</span>
            </div>
          </div>

          {/* ── Market band summary ───────────────────────────────────── */}
          {rec && (
            <div className="grid grid-cols-5 gap-2 mb-4">
              {[
                { label: 'P10', val: band.p10, bidM: refPriceM * (1 - band.p10 / 100) },
                { label: 'P25', val: band.p25, bidM: refPriceM * (1 - band.p25 / 100) },
                { label: 'Median', val: band.median, bidM: refPriceM * (1 - band.median / 100) },
                { label: 'P75', val: band.p75, bidM: refPriceM * (1 - band.p75 / 100) },
                { label: 'P90', val: band.p90, bidM: refPriceM * (1 - band.p90 / 100) },
              ].map(({ label, val, bidM }) => (
                <div key={label} className={`bg-[#0D1628] border rounded-xl p-3 text-center ${label === 'Median' ? 'border-[#2563EB]' : 'border-[#1A2B48]'}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${label === 'Median' ? 'text-[#60A5FA]' : 'text-[#64748B]'}`}>{label}</p>
                  <p className="text-[#E2E8F0] text-sm font-mono font-bold">−{val}%</p>
                  <p className="text-[#334155] text-[10px] font-mono">{fmtMShort(bidM)}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Disclaimer ───────────────────────────────────────────── */}
          <div className="flex items-start gap-2 text-[10px] text-[#64748B] bg-[#0D1628] border border-[#1A2B48] rounded-lg p-3">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-[#334155]" />
            <span>{rec?.note ?? 'Positioning percentile is not a win probability. It shows where this bid sits relative to historical winners, not P(this bid wins).'}</span>
          </div>
        </main>
      </div>
    </div>
  );
}
