"use client";

import { useState, useMemo } from "react";
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
import { Sliders, TrendingUp, Shield, AlertTriangle } from "lucide-react";
import { t, type Lang } from "@/lib/landing-translations";

interface SimulatorProps {
  lang: Lang;
}

// OLS regression on 548 competitive e-bidding construction tenders (FY2559–2568)
// Model: discount = OLS_B0 + OLS_B1 × bidders  (R²=0.325, RMSE=11.25%)
// Budget term dropped: log(budget) standardised β = -0.007, partial R² ≈ 0
const OLS_B0   = 0.87;   // intercept
const OLS_B1   = 3.03;   // discount added per additional bidder
const OLS_RMSE = 11.26;  // residual stdev — used as fallback sigma

// Observed means and stdevs per bidder count — derived from AllBidders sheet (FY2559–2568)
// OLS formula is the fallback for counts without observed data.
const REAL_DISCOUNT_BY_BIDDERS: Record<number, { mean: number; stdev: number }> = {
  2:  { mean: 5.8,  stdev: 7.7  },  // n=104
  3:  { mean: 8.9,  stdev: 11.4 },  // n=145
  4:  { mean: 13.8, stdev: 12.7 },  // n=86
  5:  { mean: 19.2, stdev: 12.4 },  // n=65
  6:  { mean: 20.3, stdev: 13.0 },  // n=48
  7:  { mean: 20.5, stdev: 10.9 },  // n=26
  8:  { mean: 29.6, stdev: 10.5 },  // n=14
  9:  { mean: 27.2, stdev: 11.1 },  // n=25
  10: { mean: 27.0, stdev: 14.0 },  // n=13
  11: { mean: 34.5, stdev: 8.4  },  // n=11
  12: { mean: 37.6, stdev: 3.2  },  // n=6
  13: { mean: 35.3, stdev: 2.2  },  // n=2
};

function getBench(competitors: number): { mean: number; stdev: number } {
  if (REAL_DISCOUNT_BY_BIDDERS[competitors]) return REAL_DISCOUNT_BY_BIDDERS[competitors];
  return {
    mean:  OLS_B0 + OLS_B1 * competitors,
    stdev: OLS_RMSE,
  };
}

function computeSimulation(
  competitors: number,
  budgetM: number,
  costPct: number,
  targetMarginPct: number,
) {
  const bench = getBench(competitors);

  const benchDiscount = bench.mean;
  const sigma = Math.max(bench.stdev, 5);

  const costRatio = costPct / 100;

  const marginMaxDiscount = Math.max(0, (1 - costRatio / (1 - targetMarginPct / 100)) * 100);

  const marketOptimalDiscount = benchDiscount;

  const targetDiscount = Math.min(marketOptimalDiscount, marginMaxDiscount);
  const optimalBid = budgetM * (1 - targetDiscount / 100);

  const z = (targetDiscount - benchDiscount) / sigma;
  const peakWin = Math.min(88, (100 / competitors) * 1.3);
  const winProb = Math.max(8, Math.exp(-0.5 * z * z) * peakWin);

  const costEstimate = budgetM * costRatio;
  const actualMargin = ((optimalBid - costEstimate) / optimalBid) * 100;

  const isMarginConstrained = marginMaxDiscount < marketOptimalDiscount;

  const risk: "low" | "medium" | "high" = isMarginConstrained ? "high" : winProb > 45 ? "low" : winProb > 25 ? "medium" : "high";

  const profit = optimalBid - costEstimate;

  return {
    winProb: Math.round(winProb),
    optimalBid: Math.round(optimalBid * 10) / 10,
    costEstimate: Math.round(costEstimate * 10) / 10,
    profit: Math.round(profit * 10) / 10,
    actualMargin: Math.round(actualMargin * 10) / 10,
    targetDiscount: Math.round(targetDiscount * 10) / 10,
    benchDiscount: Math.round(benchDiscount * 10) / 10,
    marginMaxDiscount: Math.round(marginMaxDiscount * 10) / 10,
    isMarginConstrained,
    risk,
  };
}

function generateCurveData(competitors: number) {
  const bench = getBench(competitors);
  const benchDiscount = bench.mean;
  const sigma = Math.max(bench.stdev, 5);

  const peakWin = Math.min(88, (100 / competitors) * 1.3);
  const maxDisc = Math.min(55, benchDiscount * 2.5 + sigma);

  return Array.from({ length: 17 }, (_, i) => {
    const discPct = (maxDisc * i) / 16;
    const z = (discPct - benchDiscount) / sigma;
    const relProb = Math.exp(-0.5 * z * z);
    return {
      bid: `${Math.round(100 - discPct)}%`,
      disc: Math.round(discPct * 10) / 10,
      winProb: Math.max(2, Math.round(relProb * peakWin)),
    };
  });
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
        <p className="text-sm font-bold text-blue-600">{payload[0]?.value}% {isTh ? "โอกาสชนะ" : "win chance"}</p>
      </div>
    );
  }
  return null;
};

export default function BiddingSimulator({ lang }: SimulatorProps) {
  const tx = t[lang].simulator;
  const isTh = lang === "th";

  const [competitors, setCompetitors] = useState(5);
  const [scope, setScope] = useState(10);
  const [costPct, setCostPct] = useState(82);
  const [targetMarginPct, setTargetMarginPct] = useState(5);

  const { winProb, optimalBid, costEstimate, profit, actualMargin, risk, targetDiscount, benchDiscount, marginMaxDiscount, isMarginConstrained } = useMemo(
    () => computeSimulation(competitors, scope, costPct, targetMarginPct),
    [competitors, scope, costPct, targetMarginPct]
  );

  const curveData = useMemo(
    () => generateCurveData(competitors),
    [competitors]
  );

  const riskMap = {
    low:    { color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200",  label: tx.low,    icon: Shield },
    medium: { color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",    label: tx.medium, icon: Sliders },
    high:   { color: "text-red-600",     bg: "bg-red-50 border-red-200",      label: tx.high,   icon: AlertTriangle },
  } as const;
  const riskConfig = riskMap[risk as keyof typeof riskMap];

  const winColor = winProb >= 45 ? "text-emerald-600" : winProb >= 25 ? "text-amber-600" : "text-red-600";

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

            <SliderField
              label={tx.competitorCount}
              value={competitors}
              min={2}
              max={13}
              step={1}
              unit={` ${tx.competitors}`}
              onChange={setCompetitors}
              accentColor="text-blue-600"
              isTh={isTh}
            />
            <SliderField
              label={tx.projectScope}
              value={scope}
              min={1}
              max={200}
              step={1}
              unit="฿M"
              onChange={setScope}
              accentColor="text-emerald-600"
              isTh={isTh}
            />
            <SliderField
              label={isTh ? `ต้นทุนของคุณ (% ราคากลาง) = ฿${(scope * costPct / 100).toFixed(1)}M` : `Your estimated costs (% of budget) = ฿${(scope * costPct / 100).toFixed(1)}M`}
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

              {/* Row 1 — Win Probability (hero) */}
              <div className="bg-slate-50 rounded-xl p-3">
                <p className={`text-[11px] text-slate-500 mb-1 ${isTh ? "lang-th" : ""}`}>{tx.winProbability}</p>
                <div className="flex items-end gap-2">
                  <span className={`text-3xl font-black ${winColor}`}>{winProb}%</span>
                  <div className="mb-1 flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        winProb >= 45 ? "bg-emerald-500" : winProb >= 25 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${winProb}%` }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {isTh ? `vs ${Math.round(100/competitors)}% หากไม่มีข้อมูล` : `vs ${Math.round(100/competitors)}% uninformed baseline`}
                </p>
              </div>

              {/* Row 2 — Optimal Bid + Est. Profit */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className={`rounded-xl p-3 border ${isMarginConstrained ? "bg-red-50 border-red-200" : "bg-slate-50 border-transparent"}`}>
                  <p className={`text-[11px] text-slate-500 mb-1 ${isTh ? "lang-th" : ""}`}>{tx.optimalBid}</p>
                  <p className={`text-base font-bold ${isMarginConstrained ? "text-red-600" : "text-black"}`}>฿{optimalBid.toFixed(1)}M</p>
                  <p className={`text-[10px] mt-0.5 ${isMarginConstrained ? "text-red-400" : "text-slate-400"}`}>
                    {isTh ? `−${targetDiscount}% จากราคากลาง` : `−${targetDiscount}% off budget`}
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

              {/* Row 3 — Max Discount + Risk Level */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className={`rounded-xl p-3 border ${isMarginConstrained ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                  <p className={`text-[11px] text-slate-500 mb-1 ${isTh ? "lang-th" : ""}`}>
                    {isTh ? `ส่วนลดสูงสุด (${targetMarginPct}% กำไร)` : `Max discount (${targetMarginPct}% margin)`}
                  </p>
                  <p className={`text-base font-bold ${isMarginConstrained ? "text-red-600" : "text-emerald-600"}`}>
                    −{marginMaxDiscount}%
                  </p>
                  <p className={`text-[10px] mt-0.5 ${isMarginConstrained ? "text-red-400" : "text-emerald-500"}`}>
                    {isMarginConstrained
                      ? (isTh ? `ตลาดต้องการ −${benchDiscount}%` : `Market needs −${benchDiscount}%`)
                      : (isTh ? `ตลาด −${benchDiscount}% ✓` : `Market −${benchDiscount}% ✓`)}
                  </p>
                </div>
                <div className={`${riskConfig.bg} border rounded-xl p-3`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <RiskIcon className={`w-3 h-3 ${riskConfig.color}`} />
                    <p className={`text-[11px] text-slate-500 ${isTh ? "lang-th" : ""}`}>{tx.riskLevel}</p>
                  </div>
                  <p className={`text-base font-semibold ${riskConfig.color} ${isTh ? "lang-th" : ""}`}>{riskConfig.label}</p>
                  <p className={`text-[10px] mt-0.5 ${isMarginConstrained ? "text-red-400" : "text-slate-400"}`}>
                    {isTh ? `${winProb}% โอกาสชนะ` : `${winProb}% win chance`}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Chart panel */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="mb-4">
              <h3 className={`text-base font-semibold text-black mb-1 ${isTh ? "lang-th" : ""}`}>{tx.chartTitle}</h3>
              <p className={`text-xs text-slate-400 ${isTh ? "lang-th text-[0.75rem]" : ""}`}>{tx.chartDesc}</p>
            </div>

            <div className="h-64 lg:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curveData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="winGradient" x1="0" y1="0" x2="0" y2="1">
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
                    label={{ value: isTh ? "ราคาเสนอ (% ราคากลาง)" : "Bid price (% of budget)", position: "insideBottom", offset: -2, fill: "#94a3b8", fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                    label={{ value: isTh ? "โอกาสชนะ" : "Win probability", angle: -90, position: "insideLeft", offset: 14, fill: "#94a3b8", fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip isTh={isTh} />} />
                  <ReferenceLine
                    x={marginLabel}
                    stroke={isMarginConstrained ? "#ef4444" : "#8b5cf6"}
                    strokeDasharray="6 3"
                    strokeWidth={1.5}
                    label={{ value: isTh ? `จุดคุ้มทุน −${marginMaxDiscount}%` : `Break-even limit −${marginMaxDiscount}%`, fill: isMarginConstrained ? "#ef4444" : "#8b5cf6", fontSize: 10, dy: -6 }}
                  />
                  <ReferenceLine
                    x={optimalLabel}
                    stroke="#10b981"
                    strokeWidth={2.5}
                    label={{ value: isTh ? "ราคาที่เหมาะสม" : "Optimal bid", fill: "#10b981", fontSize: 11, dy: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="winProb"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#winGradient)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#3b82f6", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex items-center gap-6 text-xs text-slate-400 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-blue-500" />
                <span className={isTh ? "lang-th" : ""}>{isTh ? "โอกาสชนะ" : "Win Probability"}</span>
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
                    <span className="font-semibold text-red-600">−{marginMaxDiscount}%</span> แต่ตลาดนี้
                    ({competitors} ราย) อยู่ที่{" "}
                    <span className="font-semibold text-black">−{benchDiscount}%</span> — คุณเสนอราคาสูงกว่าตลาด โอกาสชนะเหลือ{" "}
                    <span className={`font-semibold ${winColor}`}>{winProb}%</span> ลดเป้ากำไรหรือถอนตัวจากการประมูลนี้</>
                  ) : (
                    <>Your {targetMarginPct}% margin target caps your discount at{" "}
                    <span className="font-semibold text-red-600">−{marginMaxDiscount}%</span>, but this market
                    ({competitors} bidders) benchmarks at{" "}
                    <span className="font-semibold text-black">−{benchDiscount}%</span>. You&apos;re bidding above market —
                    win probability drops to{" "}
                    <span className={`font-semibold ${winColor}`}>{winProb}%</span>.
                    Lower your margin target or walk away from this tender.</>
                  )}
                </p>
              </div>
            ) : competitors <= 2 ? (
              <div className="mt-5 flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <p className={`text-xs text-slate-600 leading-relaxed ${isTh ? "lang-th" : ""}`}>
                  <span className="font-semibold text-emerald-700">{isTh ? "โซนการแข่งขันต่ำ: " : "Low Competition Zone: "}</span>
                  {isTh ? (
                    <>คู่แข่งเพียง 2 ราย ข้อมูล singlebidder 524 โครงการมีส่วนลดมัธยฐาน{" "}
                    <span className="font-semibold text-emerald-600">0.65%</span> — ใกล้ราคากลาง
                    เป้ากำไร {targetMarginPct}% รองรับได้ที่ต้นทุน {costPct}%: เสนอ ฿{optimalBid.toFixed(1)}M (−{targetDiscount}%)
                    กำไรจริง <span className="font-semibold text-emerald-600">{actualMargin.toFixed(1)}%</span></>
                  ) : (
                    <>Only 2 competitors. Our singlebidder dataset shows 524 e-bidding tenders with 1 bidder at a{" "}
                    <span className="font-semibold text-emerald-600">0.65% median discount</span> — near reference price.
                    Your {targetMarginPct}% margin target is viable at {costPct}% estimated costs: bid ฿{optimalBid.toFixed(1)}M (−{targetDiscount}%),
                    estimated{" "}
                    <span className="font-semibold text-emerald-600">{actualMargin.toFixed(1)}% actual margin</span>.</>
                  )}
                </p>
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className={`text-xs text-slate-600 leading-relaxed ${isTh ? "lang-th" : ""}`}>
                  <span className="font-semibold text-blue-600">{isTh ? "ข้อมูลตลาด: " : "Market Data: "}</span>
                  {isTh ? (
                    <>สัญญา {competitors} ราย มีส่วนลดอ้างอิง{" "}
                    <span className="font-semibold text-amber-600">−{benchDiscount}%</span> จาก 548 โครงการ
                    กำไร {targetMarginPct}% รองรับได้ถึง −{marginMaxDiscount}% ✓ — เสนอ ฿{optimalBid.toFixed(1)}M (−{targetDiscount}%){" "}
                    <span className={`font-semibold ${winColor}`}>โอกาสชนะ {winProb}%</span>{" "}
                    กำไร <span className="font-semibold text-emerald-600">{actualMargin.toFixed(1)}%</span></>
                  ) : (
                    <>{competitors}-bidder contracts benchmark at{" "}
                    <span className="font-semibold text-amber-600">−{benchDiscount}%</span> across 548 tenders.
                    Your {targetMarginPct}% margin allows up to −{marginMaxDiscount}% ✓ — bid at ฿{optimalBid.toFixed(1)}M (−{targetDiscount}%),{" "}
                    <span className={`font-semibold ${winColor}`}>{winProb}% win probability</span>,{" "}
                    <span className="font-semibold text-emerald-600">{actualMargin.toFixed(1)}% estimated margin</span>.</>
                  )}
                </p>
              </div>
            )}
            <p className="mt-2 text-[10px] text-slate-400 text-right">
              {isTh
                ? "อ้างอิง: 548 โครงการ e-bidding + 524 โครงการรายเดียว · โอกาสชนะ = ฐาน(1/n) × ค่าปรับเทียบ · ปีงบ 2561–2568"
                : "Benchmarks: 548 e-bidding tenders + 524 singlebidder records · win prob = base(1/n) × calibration · FY2561–2568"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
