"use client";

import { useState, useMemo, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Sliders, TrendingUp, Shield, AlertTriangle, Info } from "lucide-react";
import { t, type Lang } from "@/lib/landing-translations";
import { recommendBid, generateWinCurve, buildCurveFromBand } from "@/lib/bidsight-core";

interface SimulatorProps {
  lang: Lang;
}

function computeSimulation(refPriceM: number, costPct: number, targetMarginPct: number) {
  const costM = refPriceM * (costPct / 100);
  const rec = recommendBid(refPriceM, costM, targetMarginPct);

  const pct = rec.positioningPct;
  const risk: "low" | "medium" | "high" =
    rec.cannotMeetMargin || rec.marginFloorBreached
      ? "high"
      : pct >= 50 && pct <= 85
      ? "low"
      : pct > 85 || pct < 25
      ? "high"
      : "medium";

  return {
    positioningPct:      pct,
    positioningLabelTh:  rec.positioningLabelTh,
    positioningLabelEn:  rec.positioningLabelEn,
    band:                rec.band,
    optimalBid:          rec.recommendedBid,
    costEstimate:        Math.round(costM * 10) / 10,
    profit:              Math.round((rec.recommendedBid - costM) * 10) / 10,
    actualMargin:        rec.expectedMargin,
    targetDiscount:      rec.recommendedDiscount,
    benchDiscount:       rec.marketMedianDiscount,
    marginMaxDiscount:   (1 - (costPct / 100) / (1 - targetMarginPct / 100)) * 100,
    isMarginConstrained: rec.marginFloorBreached || rec.cannotMeetMargin,
    risk,
  };
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  accentColor: string;
  isTh: boolean;
}

function SliderField({ label, value, min, max, step, unit, onChange, accentColor, isTh }: SliderFieldProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const [raw, setRaw] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRaw(e.target.value);
  };

  const commitRaw = () => {
    if (raw !== null) {
      const n = parseFloat(raw);
      if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
      setRaw(null);
    }
  };

  const displayVal = unit === "฿M" ? `฿${value}M` : unit ? `${value}${unit}` : String(value);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center gap-2">
        <label className={`text-sm font-medium text-slate-700 shrink-0 ${isTh ? "lang-th text-[0.85rem]" : ""}`}>
          {label}
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={raw !== null ? raw : displayVal}
          onChange={handleInputChange}
          onFocus={(e) => e.target.select()}
          onBlur={commitRaw}
          onKeyDown={(e) => e.key === "Enter" && commitRaw()}
          className={`w-20 text-right text-sm font-bold bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none ${accentColor}`}
        />
      </div>
      <div className="relative h-5 flex items-center">
        <div className="absolute w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${pct}%`,
              background:
                accentColor.includes("blue")
                  ? "linear-gradient(90deg, #1d4ed8, #3b82f6)"
                  : accentColor.includes("emerald")
                  ? "linear-gradient(90deg, #059669, #10b981)"
                  : accentColor.includes("violet")
                  ? "linear-gradient(90deg, #7c3aed, #8b5cf6)"
                  : "linear-gradient(90deg, #d97706, #f59e0b)",
            }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer h-5"
          style={{ zIndex: 10 }}
        />
        <div
          className="absolute w-4 h-4 rounded-full bg-white shadow-lg shadow-black/20 border-2 border-blue-500 transition-all duration-75 pointer-events-none"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{min}{unit && unit !== "฿M" ? unit : ""}</span>
        <span>{max}{unit && unit !== "฿M" ? unit : ""}</span>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, isTh }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs text-slate-400 mb-1">{isTh ? `ราคาเสนอ ${label}` : `Bid at ${label} of reference`}</p>
        <p className="text-sm font-bold text-blue-600">
          {isTh
            ? `เชิงรุกกว่า ${payload[0]?.value}% ของผู้ชนะในอดีต`
            : `More aggressive than ${payload[0]?.value}% of past winners`}
        </p>
      </div>
    );
  }
  return null;
};

export default function BiddingSimulator({ lang }: SimulatorProps) {
  const tx = t[lang].simulator;
  const isTh = lang === "th";

  // ── Slider layer (user economics — local, no fetch) ──────────────────────
  const [refPrice, setRefPrice] = useState(10);
  const [costPct, setCostPct] = useState(82);
  const [targetMarginPct, setTargetMarginPct] = useState(5);

  const {
    positioningPct, positioningLabelTh, positioningLabelEn,
    band, optimalBid, costEstimate, profit, actualMargin,
    risk, targetDiscount, benchDiscount, marginMaxDiscount, isMarginConstrained,
  } = useMemo(
    () => computeSimulation(refPrice, costPct, targetMarginPct),
    [refPrice, costPct, targetMarginPct]
  );

  // ── Market layer (curve — fetched on category change, independent of sliders)
  const [projectType, setProjectType] = useState("");
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [marketBand, setMarketBand] = useState<{ p10: number; p25: number; median: number; p75: number; p90: number } | null>(null);
  const [marketN, setMarketN] = useState(0);
  const [marketLoading, setMarketLoading] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: any[]) => {
        const list = (Array.isArray(data) ? data : [])
          .filter((c) => c.id && c.label)
          .map((c) => ({ id: c.id as string, label: c.label as string }));
        setCategories(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectType) { setMarketBand(null); setMarketN(0); return; }
    setMarketLoading(true);
    const qs = new URLSearchParams({ refPriceM: "10", costM: "8", targetMarginPct: "10", projectType });
    fetch(`/api/recommend-bid?${qs}`)
      .then((r) => r.json())
      .then((data: any) => {
        setMarketBand(data.band ?? null);
        setMarketN(data.comparableN ?? 0);
      })
      .catch(() => {})
      .finally(() => setMarketLoading(false));
  }, [projectType]);

  // Curve morphs with market selection; sliders never trigger a refetch
  const curveData = useMemo(
    () => marketBand ? buildCurveFromBand(marketBand) : generateWinCurve(),
    [marketBand]
  );

  const riskMap = {
    low:    { color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200",  label: tx.low,    icon: Shield },
    medium: { color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",    label: tx.medium, icon: Sliders },
    high:   { color: "text-red-600",     bg: "bg-red-50 border-red-200",      label: tx.high,   icon: AlertTriangle },
  } as const;
  const riskConfig = riskMap[risk as keyof typeof riskMap];

  // Colour for positioning percentile: green at 50-75th (competitive), amber below 25 or above 85, red at extremes
  const positionColor =
    isMarginConstrained
      ? "text-red-600"
      : positioningPct >= 50 && positioningPct <= 85
      ? "text-emerald-600"
      : positioningPct > 85 || positioningPct < 25
      ? "text-red-600"
      : "text-amber-600";

  const RiskIcon = riskConfig.icon;

  const snapLabel = (disc: number) =>
    curveData.reduce((best, d) =>
      Math.abs(d.disc - disc) < Math.abs(best.disc - disc) ? d : best
    ).bid;
  const optimalLabel = snapLabel(targetDiscount);
  const marginLabel  = snapLabel(marginMaxDiscount);

  return (
    <section id="simulator" className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl mb-12">
          <span className={`text-xs font-bold tracking-widest uppercase text-slate-400 ${isTh ? "lang-th" : ""}`}>
            {isTh ? "ทดสอบด้วยข้อมูลจริง" : "Live Simulator"}
          </span>
          <h2
            className={`mt-3 text-black font-black tracking-tight leading-none ${
              isTh ? "th-heading text-4xl sm:text-5xl" : "en-heading text-4xl sm:text-5xl"
            }`}
          >
            {tx.title}
          </h2>
          <p className={`mt-4 text-slate-500 leading-relaxed ${isTh ? "lang-th text-base" : "text-lg"}`}>
            {tx.subtitle}
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Sliders panel */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Sliders className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">
                {isTh ? "ตัวแปรการประมูล" : "Bid Parameters"}
              </span>
            </div>

            {/* Market selector — changes the curve, not the sliders */}
            <div className="space-y-1.5">
              <label className={`text-sm font-medium text-slate-700 ${isTh ? "lang-th text-[0.85rem]" : ""}`}>
                {isTh ? "ประเภทตลาด" : "Market"}
              </label>
              <div className="relative">
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-slate-400 pr-8"
                >
                  <option value="">{isTh ? "ทุกตลาด (ค่าเริ่มต้น)" : "All markets (default)"}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</div>
              </div>
              {marketLoading && (
                <p className="text-[10px] text-slate-400">{isTh ? "กำลังโหลดข้อมูลตลาด…" : "Loading market data…"}</p>
              )}
              {!marketLoading && marketBand && marketN > 0 && (
                <p className="text-[10px] text-slate-400">
                  {isTh ? `อ้างอิง ${marketN.toLocaleString()} สัญญา` : `${marketN.toLocaleString()} comparable contracts`}
                </p>
              )}
            </div>

            <SliderField
              label={tx.projectScope}
              value={refPrice}
              min={1}
              max={200}
              step={1}
              unit="฿M"
              onChange={setRefPrice}
              accentColor="text-emerald-600"
              isTh={isTh}
            />
            <SliderField
              label={isTh ? `ต้นทุนของคุณ (% ราคากลาง) = ฿${(refPrice * costPct / 100).toFixed(1)}M` : `Your estimated costs (% of ref. price) = ฿${(refPrice * costPct / 100).toFixed(1)}M`}
              value={costPct}
              min={50}
              max={100}
              step={1}
              unit="%"
              onChange={setCostPct}
              accentColor="text-violet-600"
              isTh={isTh}
            />
            <SliderField
              label={isTh ? "กำไรขั้นต่ำที่ต้องการ" : "Target Margin %"}
              value={targetMarginPct}
              min={1}
              max={20}
              step={1}
              unit="%"
              onChange={setTargetMarginPct}
              accentColor="text-emerald-600"
              isTh={isTh}
            />

            {/* Output metrics */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">

              {/* Row 1 — Positioning Percentile */}
              <div className="bg-slate-50 rounded-xl p-3">
                <p className={`text-[11px] text-slate-500 mb-1 ${isTh ? "lang-th" : ""}`}>
                  {isTh ? "ตำแหน่งในตลาด" : "Market Positioning"}
                </p>
                <div className="flex items-end gap-2">
                  <span className={`text-3xl font-black ${positionColor}`}>{positioningPct}th</span>
                  <div className="mb-1 flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        positioningPct >= 50 && positioningPct <= 85
                          ? "bg-emerald-500"
                          : positioningPct > 85 || positioningPct < 25
                          ? "bg-red-500"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${positioningPct}%` }}
                    />
                  </div>
                </div>
                <p className={`text-[10px] font-medium mt-0.5 ${positionColor} ${isTh ? "lang-th" : ""}`}>
                  {isTh ? positioningLabelTh : positioningLabelEn}
                </p>
              </div>

              {/* Row 2 — Optimal Bid + Est. Profit */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className={`rounded-xl p-3 border ${isMarginConstrained ? "bg-red-50 border-red-200" : "bg-slate-50 border-transparent"}`}>
                  <p className={`text-[11px] text-slate-500 mb-1 ${isTh ? "lang-th" : ""}`}>{tx.optimalBid}</p>
                  <p className={`text-base font-bold ${isMarginConstrained ? "text-red-600" : "text-black"}`}>฿{optimalBid.toFixed(1)}M</p>
                  <p className={`text-[10px] mt-0.5 ${isMarginConstrained ? "text-red-400" : "text-slate-400"}`}>
                    {isTh ? `−${targetDiscount}% จากราคาอ้างอิง` : `−${targetDiscount}% off reference`}
                  </p>
                </div>
                <div className={`rounded-xl p-3 border ${isMarginConstrained ? "bg-red-50 border-red-200" : "bg-slate-50 border-transparent"}`}>
                  <p className={`text-[11px] text-slate-500 mb-1 ${isTh ? "lang-th" : ""}`}>
                    {isTh ? "กำไรโครงการ" : "Est. Profit"}
                  </p>
                  <p className={`text-base font-bold ${isMarginConstrained ? "text-red-600" : "text-emerald-600"}`}>
                    ฿{profit.toFixed(1)}M
                  </p>
                  <p className={`text-[10px] mt-0.5 ${isMarginConstrained ? "text-red-400" : "text-slate-400"}`}>
                    {isTh
                      ? `กำไร ${actualMargin.toFixed(1)}% · ต้นทุน ฿${costEstimate.toFixed(1)}M`
                      : `${actualMargin.toFixed(1)}% margin · cost ฿${costEstimate.toFixed(1)}M`}
                  </p>
                </div>
              </div>

              {/* Row 3 — Band + Risk */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl p-3 border bg-slate-50 border-transparent">
                  <p className={`text-[11px] text-slate-500 mb-1.5 ${isTh ? "lang-th" : ""}`}>
                    {isTh ? "แถบส่วนลดตลาด" : "Market discount band"}
                  </p>
                  <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                    <span>P10</span><span>P25</span><span>P50</span><span>P75</span><span>P90</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-semibold text-slate-700">
                    <span>{band.p10}%</span>
                    <span>{band.p25}%</span>
                    <span className="text-blue-600">{band.median}%</span>
                    <span>{band.p75}%</span>
                    <span>{band.p90}%</span>
                  </div>
                </div>
                <div className={`${riskConfig.bg} border rounded-xl p-3`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <RiskIcon className={`w-3 h-3 ${riskConfig.color}`} />
                    <p className={`text-[11px] text-slate-500 ${isTh ? "lang-th" : ""}`}>{tx.riskLevel}</p>
                  </div>
                  <p className={`text-base font-semibold ${riskConfig.color} ${isTh ? "lang-th" : ""}`}>{riskConfig.label}</p>
                  <p className={`text-[10px] mt-0.5 text-slate-400`}>
                    {isTh ? `เปอร์เซ็นไทล์ที่ ${positioningPct}` : `${positioningPct}th percentile`}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Chart panel */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className={`text-base font-semibold text-black mb-1 ${isTh ? "lang-th" : ""}`}>
                  {isTh ? "ตำแหน่งราคาเทียบกับผู้ชนะในอดีต" : "Bid Positioning vs. Historical Winners"}
                </h3>
                <p className={`text-xs text-slate-400 ${isTh ? "lang-th text-[0.75rem]" : ""}`}>
                  {isTh
                    ? "แกน Y = % ของผู้ชนะในอดีตที่ให้ส่วนลดน้อยกว่าราคาเสนอของคุณ (ไม่ใช่ความน่าจะเป็นในการชนะ)"
                    : "Y axis = % of past winners who discounted less than you — not a win probability"}
                </p>
              </div>
              {projectType && !marketLoading && (
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-blue-500 bg-blue-50 border border-blue-100 rounded px-2 py-0.5">
                  {categories.find((c) => c.id === projectType)?.label ?? projectType}
                </span>
              )}
            </div>

            <div className="h-64 lg:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curveData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="posGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="bid"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                    label={{
                      value: isTh ? "ราคาเสนอ (% ราคาอ้างอิง)" : "Bid price (% of reference)",
                      position: "insideBottom", offset: -2, fill: "#94a3b8", fontSize: 11,
                    }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                    tickFormatter={(v: any) => `${v}%`}
                    label={{
                      value: isTh ? "เปอร์เซ็นไทล์" : "Positioning %ile",
                      angle: -90, position: "insideLeft", offset: 14, fill: "#94a3b8", fontSize: 11,
                    }}
                  />
                  <Tooltip content={<CustomTooltip isTh={isTh} />} />
                  <ReferenceLine
                    x={marginLabel}
                    stroke={isMarginConstrained ? "#ef4444" : "#8b5cf6"}
                    strokeDasharray="6 3"
                    strokeWidth={1.5}
                    label={{
                      value: isTh ? `จุดคุ้มทุน −${marginMaxDiscount.toFixed(1)}%` : `Break-even −${marginMaxDiscount.toFixed(1)}%`,
                      fill: isMarginConstrained ? "#ef4444" : "#8b5cf6", fontSize: 10, dy: -6,
                    }}
                  />
                  <ReferenceLine
                    x={optimalLabel}
                    stroke="#10b981"
                    strokeWidth={2.5}
                    label={{
                      value: isTh ? "ราคาที่เหมาะสม" : "Optimal bid",
                      fill: "#10b981", fontSize: 11, dy: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="positionPct"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#posGradient)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#3b82f6", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex items-center gap-6 text-xs text-slate-400 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-blue-500" />
                <span className={isTh ? "lang-th" : ""}>{isTh ? "เปอร์เซ็นไทล์ตำแหน่ง" : "Positioning %ile"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-emerald-500" />
                <span className={isTh ? "lang-th" : ""}>{isTh ? "ราคาที่เหมาะสม" : "Optimal Bid"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-4 h-px border-t-2 border-dashed ${isMarginConstrained ? "border-red-400" : "border-violet-400"}`} />
                <span className={isTh ? "lang-th" : ""}>{isTh ? "จุดคุ้มทุน" : "Break-even Limit"}</span>
              </div>
            </div>

            {isMarginConstrained ? (
              <div className="mt-5 flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className={`text-xs text-slate-600 leading-relaxed ${isTh ? "lang-th" : ""}`}>
                  <span className="font-semibold text-red-700">{isTh ? "ถึงจุดคุ้มทุนแล้ว: " : "Break-even limit reached: "}</span>
                  {isTh ? (
                    <>เป้ากำไร {targetMarginPct}% จำกัดส่วนลดสูงสุดที่{" "}
                    <span className="font-semibold text-red-600">−{marginMaxDiscount.toFixed(1)}%</span> แต่ตลาดนี้มีส่วนลดกลางที่{" "}
                    <span className="font-semibold text-black">−{benchDiscount}%</span> — ราคาของคุณสูงกว่าผู้ชนะส่วนใหญ่ ลดเป้ากำไรหรือถอนตัว</>
                  ) : (
                    <>Your {targetMarginPct}% margin target caps your discount at{" "}
                    <span className="font-semibold text-red-600">−{marginMaxDiscount.toFixed(1)}%</span>, but market median is{" "}
                    <span className="font-semibold text-black">−{benchDiscount}%</span>. You&apos;re bidding above most past winners.
                    Lower your margin or walk away.</>
                  )}
                </p>
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className={`text-xs text-slate-600 leading-relaxed ${isTh ? "lang-th" : ""}`}>
                  <span className="font-semibold text-blue-600">{isTh ? "ข้อมูลตลาด: " : "Market Data: "}</span>
                  {isTh ? (
                    <>ส่วนลดกลางตลาด{" "}
                    <span className="font-semibold text-amber-600">−{benchDiscount}%</span> จาก 29,750 โครงการ e-bidding
                    กำไร {targetMarginPct}% รองรับได้ถึง −{marginMaxDiscount.toFixed(1)}% ✓ — เสนอ ฿{optimalBid.toFixed(1)}M{" "}
                    (เปอร์เซ็นไทล์ที่ <span className={`font-semibold ${positionColor}`}>{positioningPct}</span>
                    {" "}· <span className={`font-semibold ${positionColor} lang-th`}>{positioningLabelTh}</span>)
                    กำไร <span className="font-semibold text-emerald-600">{actualMargin.toFixed(1)}%</span></>
                  ) : (
                    <>Market median{" "}
                    <span className="font-semibold text-amber-600">−{benchDiscount}%</span> across 29,750 e-bidding tenders.
                    Your {targetMarginPct}% margin allows up to −{marginMaxDiscount.toFixed(1)}% ✓ — bid ฿{optimalBid.toFixed(1)}M{" "}
                    (<span className={`font-semibold ${positionColor}`}>{positioningPct}th %ile</span>
                    {" "}· <span className={`font-semibold ${positionColor}`}>{positioningLabelEn.split(" — ")[0]}</span>),{" "}
                    <span className="font-semibold text-emerald-600">{actualMargin.toFixed(1)}% estimated margin</span>.</>
                  )}
                </p>
              </div>
            )}

            <div className="mt-2 flex items-start gap-1.5 text-[10px] text-slate-400">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className={isTh ? "lang-th" : ""}>
                {isTh
                  ? "เปอร์เซ็นไทล์ตำแหน่ง ≠ ความน่าจะเป็นในการชนะ ข้อมูลมีเฉพาะผู้ชนะ — ไม่มีข้อมูลผู้แพ้ ความน่าจะเป็นที่แท้จริงต้องใช้จำนวนผู้ประมูลซึ่งไม่สามารถรู้ล่วงหน้า"
                  : "Positioning %ile ≠ win probability. Data contains only winners, not losers. True P(win) requires bidder count — unknowable at bid time."}
              </span>
            </div>

            <p className="mt-1 text-[10px] text-slate-400 text-right">
              {isTh
                ? "อ้างอิง: 29,750 โครงการ e-bidding · ส่วนลดจากราคากลาง · ปีงบ 2561–2568"
                : "Benchmarks: 29,750 e-bidding tenders · reference price discounts · FY2561–2568"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
