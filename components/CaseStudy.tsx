"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, ReferenceLine,
} from "recharts";
import { TrendingUp, AlertTriangle, Users, Activity } from "lucide-react";
import { t, type Lang } from "@/lib/landing-translations";

interface CaseStudyProps { lang: Lang; }

// ── Real data from discountbyagencycat + profiles sheets ──────────────────────
// 554 competitive e-bidding construction tenders across 386 agencies (FY2561–2568)
// median = median winning discount %; agreed = total agreed / total budget %
const AGENCY_DATA = [
  { short: "DOH",  full: "กรมทางหลวง",              median: 0.10,  n: 144, agreed: 94.98, color: "#bbf7d0" },
  { short: "DRR",  full: "กรมทางหลวงชนบท",          median: 0.14,  n: 85,  agreed: 98.77, color: "#bbf7d0" },
  { short: "DWR",  full: "กรมทรัพยากรน้ำ",          median: 0.15,  n: 18,  agreed: 92.54, color: "#bbf7d0" },
  { short: "RTA",  full: "กองทัพบก",                 median: 0.31,  n: 8,   agreed: 97.59, color: "#bbf7d0" },
  { short: "DGR",  full: "กรมทรัพยากรน้ำบาดาล",    median: 0.66,  n: 11,  agreed: 88.51, color: "#d9f99d" },
  { short: "DPT",  full: "กรมโยธาธิการและผังเมือง", median: 1.01,  n: 33,  agreed: 98.32, color: "#d9f99d" },
  { short: "BMA",  full: "กรุงเทพมหานคร",           median: 8.34,  n: 27,  agreed: 91.30, color: "#fef08a" },
  { short: "RID",  full: "กรมชลประทาน",             median: 8.28,  n: 21,  agreed: 74.72, color: "#fef08a" },
  { short: "PEA",  full: "การไฟฟ้าส่วนภูมิภาค",    median: 17.72, n: 11,  agreed: 91.80, color: "#fca5a5" },
  { short: "MWA",  full: "การประปานครหลวง",         median: 24.30, n: 6,   agreed: 15.93, color: "#ef4444" },
];

// ── Real data from yearonyear sheet ──────────────────────────────────────────
const YOY_DATA = [
  { year: "2561", label: "FY61", projects: 90 },
  { year: "2562", label: "FY62", projects: 109 },
  { year: "2563", label: "FY63", projects: 305 },
  { year: "2567", label: "FY67", projects: 4400 },
  { year: "2568", label: "FY68", projects: 148786 },
];

// ── Real data from province sheet — 77 Thai provinces ────────────────────────
// Total: 153,685 projects, ฿1.09T budget
const PROVINCE_DATA_TOP = [
  { province: "กรุงเทพมหานคร", label: "Bangkok",       projects: 26942, budgetB: 546 },
  { province: "ชลบุรี",         label: "Chonburi",      projects: 4965,  budgetB: 32  },
  { province: "นครราชสีมา",    label: "Korat",          projects: 5384,  budgetB: 21  },
  { province: "เชียงใหม่",     label: "Chiang Mai",     projects: 4979,  budgetB: 19  },
  { province: "สงขลา",         label: "Songkhla",       projects: 3968,  budgetB: 20  },
  { province: "ขอนแก่น",       label: "Khon Kaen",      projects: 4004,  budgetB: 18  },
  { province: "นนทบุรี",       label: "Nonthaburi",     projects: 3760,  budgetB: 27  },
  { province: "อุบลราชธานี",   label: "Ubon",           projects: 3656,  budgetB: 16  },
  { province: "อุดรธานี",      label: "Udon Thani",     projects: 3000,  budgetB: 11  },
  { province: "ปทุมธานี",      label: "Pathum Thani",   projects: 2532,  budgetB: 16  },
];

// ── Real discount distribution from 554 competitive (2+ bidder) e-bidding rows ─
const DISC_DIST = [
  { range: "0–5",   count: 180, pct: 32.5 },
  { range: "5–10",  count: 75,  pct: 13.5 },
  { range: "10–15", count: 59,  pct: 10.6 },
  { range: "15–20", count: 64,  pct: 11.6 },
  { range: "20–25", count: 44,  pct: 7.9  },
  { range: "25–30", count: 40,  pct: 7.2  },
  { range: "30–35", count: 30,  pct: 5.4  },
  { range: "35–40", count: 32,  pct: 5.8  },
  { range: "40–45", count: 22,  pct: 4.0  },
  { range: "45+",   count: 8,   pct: 1.4  },
];

// ── Real data from winners sheet (499 companies, ฿65.1B total) ────────────────
// Sorted by total contract value descending — all values verified from sheet
const WINNERS_ALL = [
  { short: "CHEC Thai",    full: "ซีเอชอีซี (ไทย)",                    wins: 1, agencies: 1, valueB: 7.30 },
  { short: "Ch. Karnchang",full: "ช.การช่าง (มหาชน)",                  wins: 1, agencies: 1, valueB: 6.64 },
  { short: "Buriram TC",   full: "บุรีรัมย์ธงชัยก่อสร้าง",             wins: 1, agencies: 1, valueB: 3.47 },
  { short: "Powerline",    full: "เพาเวอร์ไลน์ เอ็นจิเนียริ่ง",        wins: 1, agencies: 1, valueB: 2.96 },
  { short: "Nawarat",      full: "เนาวรัตน์พัฒนาการ",                  wins: 3, agencies: 3, valueB: 2.93 },
  { short: "Civil CS",     full: "ซีวิล คอนสตรัคชั่น เซอร์วิสเซส",    wins: 2, agencies: 2, valueB: 1.38 },
  { short: "Paisalkij",    full: "ไพศาลกิจซิสเต็ม",                    wins: 2, agencies: 2, valueB: 1.25 },
  { short: "Uthai Chaiyo", full: "อุทัยไชโย",                           wins: 1, agencies: 1, valueB: 0.97 },
  { short: "Tipakorn",     full: "ทิพากร",                              wins: 2, agencies: 2, valueB: 0.90 },
  { short: "Siam Panthu",  full: "สยามพันธุ์วัฒนา",                    wins: 1, agencies: 1, valueB: 0.86 },
];

// ── Real data from anomalies sheet: 54 Z-score flagged projects ──────────────
// 53 "High Competition" (Z-score ≥ 2.0), 1 "Data Error — Review"
// Max discount: 93.94% (Z=6.29) at การประปานครหลวง

const AgencyTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-black">{d?.full}</p>
      <p className="text-slate-500">Projects: <span className="font-bold text-black">{d?.n}</span></p>
      <p className="text-slate-500">Median discount: <span className="font-bold text-blue-600">{d?.median}%</span></p>
      <p className="text-slate-500">Agreed vs ref: <span className="font-bold">{d?.agreed}%</span></p>
    </div>
  );
};

const YoyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-black">FY{label}</p>
      <p className="text-slate-500">Projects: <span className="font-bold text-blue-600">{Number(payload[0]?.value).toLocaleString()}</span></p>
    </div>
  );
};

const DiscTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-black">{label}% discount</p>
      <p className="text-slate-500"><span className="font-bold text-blue-600">{payload[0]?.value}</span> tenders ({payload[0]?.payload?.pct}%)</p>
    </div>
  );
};

const WinnersTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-black">{d?.full}</p>
      <p className="text-slate-500">Contract value: <span className="font-bold text-blue-600">฿{d?.valueB}B</span></p>
      <p className="text-slate-500">Wins tracked: <span className="font-bold text-black">{d?.wins}</span></p>
      <p className="text-slate-500">Agencies served: <span className="font-bold text-black">{d?.agencies}</span></p>
    </div>
  );
};

type Tab = "agency" | "growth" | "distribution" | "province" | "winners";
type WinnersFilter = "all" | "repeat" | "single";

export default function CaseStudy({ lang }: CaseStudyProps) {
  const tx = t[lang].caseStudy;
  const isTh = lang === "th";
  const [tab, setTab] = useState<Tab>("agency");
  const [winnersFilter, setWinnersFilter] = useState<WinnersFilter>("all");

  const filteredWinners = WINNERS_ALL.filter(w =>
    winnersFilter === "repeat" ? w.wins > 1 :
    winnersFilter === "single" ? w.wins === 1 :
    true
  );

  const tabs: { id: Tab; label: string; labelTh: string }[] = [
    { id: "agency",       label: "Agency Benchmarks",     labelTh: "เปรียบเทียบหน่วยงาน" },
    { id: "growth",       label: "Market Growth",         labelTh: "การเติบโตของตลาด" },
    { id: "distribution", label: "Discount Distribution", labelTh: "การกระจายส่วนลด" },
    { id: "province",     label: "Province Coverage",     labelTh: "ครอบคลุมทั่วประเทศ" },
    { id: "winners",      label: "Winners & Profiles",    labelTh: "ผู้ชนะ & โปรไฟล์" },
  ];

  return (
    <section id="case-study" className="py-24 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="max-w-2xl mb-10">
          <span className={`text-xs font-bold tracking-widest uppercase text-slate-400 ${isTh ? "lang-th" : ""}`}>
            {isTh ? "ข้อมูลตลาดจริง" : "Real Market Data"}
          </span>
          <h2 className={`mt-3 text-black font-black tracking-tight leading-none ${
            isTh ? "th-heading text-4xl sm:text-5xl" : "en-heading text-4xl sm:text-5xl"
          }`}>
            {isTh ? "ข้อมูลที่เปลี่ยน\nวิธีการประมูล" : "The intelligence that\nchanges how you bid."}
          </h2>
          <p className={`mt-4 text-slate-500 leading-relaxed ${isTh ? "lang-th text-base" : "text-lg"}`}>
            {isTh
              ? "จากชุดข้อมูลการจัดซื้อจัดจ้างภาครัฐ 554 โครงการ e-bidding (2+ ราย) ใน 386 หน่วยงาน ปีงบประมาณ 2561–2568"
              : "From 554 competitive e-bidding construction tenders (2+ bidders) across 386 Thai government agencies, FY2561–2568."}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Activity,      value: "554",   sub: isTh ? "โครงการ e-bidding (386 หน่วยงาน)" : "competitive tenders · 386 agencies",   color: "text-blue-600",   bg: "bg-blue-50" },
            { icon: AlertTriangle, value: "54",    sub: isTh ? "Anomaly flags (Z-score ≥ 2.0)" : "Anomaly flags (Z-score ≥ 2.0)",  color: "text-amber-600",  bg: "bg-amber-50" },
            { icon: Users,         value: "356",   sub: isTh ? "หน่วยงาน ผู้ชนะรายเดียว" : "Agencies with single-winner lock", color: "text-violet-600", bg: "bg-violet-50" },
            { icon: TrendingUp,    value: "243×",  sub: isTh ? "ส่วนลดมัธยฐาน: DOH 0.1% vs MWA 24.3%" : "Median spread: DOH 0.1% vs MWA 24.3%", color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map(({ icon: Icon, value, sub, color, bg }) => (
            <div key={value} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className={`text-xl font-black text-black leading-none ${isTh ? "th-heading" : "en-heading"}`}>{value}</p>
                <p className={`text-[11px] text-slate-500 mt-0.5 leading-tight ${isTh ? "lang-th" : ""}`}>{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Chart panel */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {tabs.map(tb => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`flex-shrink-0 px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                  tab === tb.id
                    ? "border-black text-black"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                } ${isTh ? "lang-th text-[0.82rem]" : ""}`}
              >
                {isTh ? tb.labelTh : tb.label}
              </button>
            ))}
          </div>

          <div className="p-6 lg:p-8">
            {/* ─── Agency Benchmarks ─── */}
            {tab === "agency" && (
              <div>
                <div className="mb-5">
                  <h3 className={`text-base font-bold text-black ${isTh ? "lang-th" : ""}`}>
                    {isTh ? "ส่วนลดมัธยฐานตามหน่วยงาน" : "Median winning discount by agency"}
                  </h3>
                  <p className={`text-xs text-slate-400 mt-1 ${isTh ? "lang-th" : ""}`}>
                    {isTh
                      ? "การรู้ระดับการแข่งขันของหน่วยงานเป้าหมายคือข้อได้เปรียบที่แท้จริง — ส่วนลดมัธยฐานต่างกันถึง 243 เท่า"
                      : "Knowing your target agency's competitive intensity is a genuine edge — median discount varies 243× across agencies (DOH 0.1% vs MWA 24.3%)."}
                  </p>
                </div>
                <div className="h-72 lg:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...AGENCY_DATA].sort((a, b) => a.median - b.median)}
                      layout="vertical"
                      margin={{ top: 0, right: 60, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 30]}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={{ stroke: "#e2e8f0" }}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <YAxis
                        type="category"
                        dataKey="short"
                        tick={{ fill: "#334155", fontSize: 11, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                      />
                      <Tooltip content={<AgencyTooltip />} cursor={{ fill: "#f8fafc" }} />
                      <Bar dataKey="median" radius={[0, 4, 4, 0]} label={{ position: "right", formatter: (v: any) => `${v}%`, fill: "#64748b", fontSize: 11, fontWeight: 600 }}>
                        {[...AGENCY_DATA].sort((a, b) => a.median - b.median).map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className={`text-xs text-slate-600 leading-relaxed ${isTh ? "lang-th" : ""}`}>
                    <span className="font-semibold text-amber-700">{isTh ? "ข้อมูลสำคัญ: " : "Key finding: "}</span>
                    {isTh
                      ? "กรมทางหลวง (DOH) มีส่วนลดมัธยฐาน 0.10% ในขณะที่การประปานครหลวง (MWA) อยู่ที่ 24.3% — ต่างกัน 243 เท่า ในกลุ่มงานก่อสร้างเหมือนกัน ข้อมูลจาก 386 หน่วยงาน 554 โครงการ"
                      : "DOH median winning discount is 0.10% while MWA sits at 24.3% — a 243× difference for the same construction contract type across 386 agencies and 554 tenders. Blind bidding destroys margins."}
                  </p>
                </div>
                <p className="mt-2 text-[10px] text-slate-400 text-right">
                  Source: discountbyagencycat · 554 competitive tenders · 386 agencies · FY2561–2568
                </p>
              </div>
            )}

            {/* ─── Market Growth ─── */}
            {tab === "growth" && (
              <div>
                <div className="mb-5">
                  <h3 className={`text-base font-bold text-black ${isTh ? "lang-th" : ""}`}>
                    {isTh ? "การเติบโตของตลาดจัดซื้อจัดจ้างภาครัฐ" : "Thai government procurement market growth"}
                  </h3>
                  <p className={`text-xs text-slate-400 mt-1 ${isTh ? "lang-th" : ""}`}>
                    {isTh
                      ? "จากข้อมูลปีงบประมาณ 2561–2568 — จำนวนโครงการเพิ่มขึ้น 1,653 เท่า"
                      : "FY2561 to FY2568 — project count grew 1,653× as the digital procurement system scaled up."}
                  </p>
                </div>
                <div className="h-64 lg:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={YOY_DATA} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      <Tooltip content={<YoyTooltip />} />
                      <Line type="monotone" dataKey="projects" stroke="#3b82f6" strokeWidth={2.5}
                        dot={{ r: 5, fill: "#3b82f6", strokeWidth: 0 }}
                        activeDot={{ r: 7, fill: "#2563eb", strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: isTh ? "โครงการ FY2568" : "FY2568 projects",  value: "148,786", color: "text-blue-600" },
                    { label: isTh ? "วิธี e-bidding" : "E-bidding method", value: "1,074",   color: "text-emerald-600" },
                    { label: isTh ? "มูลค่าตลาดรวม" : "Total market value", value: "฿1.09T",  color: "text-violet-600" },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                      <p className={`text-[10px] text-slate-500 mt-0.5 ${isTh ? "lang-th" : ""}`}>{s.label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-slate-400 text-right">
                  Source: yearonyear + methods sheets · Thai government procurement registry
                </p>
              </div>
            )}

            {/* ─── Discount Distribution ─── */}
            {tab === "distribution" && (
              <div>
                <div className="mb-5">
                  <h3 className={`text-base font-bold text-black ${isTh ? "lang-th" : ""}`}>
                    {isTh ? "การกระจายส่วนลดในการประมูล e-bidding" : "Winning bid discount distribution (e-bidding)"}
                  </h3>
                  <p className={`text-xs text-slate-400 mt-1 ${isTh ? "lang-th" : ""}`}>
                    {isTh
                      ? "e-bidding จ้างก่อสร้าง (2+ ราย) · มัธยฐาน 11.8% · 32.5% ของโครงการส่วนลดต่ำกว่า 5%"
                      : "competitive e-bidding construction (2+ bidders) · median 11.8% · 32.5% of tenders won at <5% discount"}
                  </p>
                </div>
                <div className="h-64 lg:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={DISC_DIST} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="range" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false}
                        tickFormatter={(v) => `${v}%`} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<DiscTooltip />} cursor={{ fill: "#f8fafc" }} />
                      <ReferenceLine x="10–15" stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5}
                        label={{ value: "Mean 14.7%", position: "insideTopRight", fill: "#f59e0b", fontSize: 10 }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {DISC_DIST.map((d, i) => (
                          <Cell key={i} fill={
                            d.pct >= 30 ? "#e2e8f0"
                            : d.range.startsWith("40") || d.range.startsWith("45") ? "#8b5cf6"
                            : i < 2 ? "#bfdbfe" : i < 5 ? "#3b82f6" : "#1d4ed8"
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className={`text-xs text-slate-600 leading-relaxed ${isTh ? "lang-th" : ""}`}>
                    <span className="font-semibold text-blue-700">{isTh ? "ข้อมูลเชิงลึก: " : "Insight: "}</span>
                    {isTh
                      ? "32.5% ของโครงการ e-bidding ที่แข่งขันกันชนะด้วยส่วนลดต่ำกว่า 5% — แต่ 32% ของโครงการต้องการส่วนลดมากกว่า 20% เพื่อชนะ Conjuncture ระบุโซนไหนที่โครงการของคุณตกอยู่"
                      : "32.5% of competitive e-bidding projects are won with <5% discount — but 32% require >20% to win. Conjuncture identifies which zone your tender falls in before you bid."}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: isTh ? "ส่วนลดเฉลี่ย" : "Mean discount",   value: "14.7%", color: "text-blue-600"    },
                    { label: isTh ? "ส่วนลดมัธยฐาน" : "Median discount", value: "11.8%", color: "text-slate-700"   },
                    { label: isTh ? "โซนแข่งขันสูง (>35%)" : "High-comp zone",  value: "62",    color: "text-violet-600"  },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-xl p-2.5 text-center">
                      <p className={`text-base font-black ${s.color}`}>{s.value}</p>
                      <p className={`text-[10px] text-slate-500 mt-0.5 leading-tight ${isTh ? "lang-th" : ""}`}>{s.label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-400 text-right">
                  Source: 554 competitive e-bidding tenders · FY2561–2568 · จัดซื้อจัดจ้างภาครัฐ
                </p>
              </div>
            )}

            {/* ─── Province Coverage ─── */}
            {tab === "province" && (
              <div>
                <div className="mb-5">
                  <h3 className={`text-base font-bold text-black ${isTh ? "lang-th" : ""}`}>
                    {isTh ? "ครอบคลุม 77 จังหวัด 153,685 โครงการ" : "77 provinces · 153,685 projects · ฿1.09T budget"}
                  </h3>
                  <p className={`text-xs text-slate-400 mt-1 ${isTh ? "lang-th" : ""}`}>
                    {isTh
                      ? "ข้อมูลจากทุกจังหวัดในประเทศไทย — Conjuncture มีข้อมูลเปรียบเทียบสำหรับทุกภูมิภาค"
                      : "Full national coverage — Conjuncture benchmarks are available for every province and region."}
                  </p>
                </div>
                <div className="h-72 lg:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={PROVINCE_DATA_TOP}
                      layout="vertical"
                      margin={{ top: 0, right: 55, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={{ stroke: "#e2e8f0" }}
                        tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tick={{ fill: "#334155", fontSize: 11, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        width={84}
                      />
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          name === "projects" ? `${Number(value).toLocaleString()} projects` : `฿${value}B`,
                          name === "projects" ? "Projects" : "Budget"
                        ]}
                        contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                      />
                      <Bar dataKey="projects" fill="#3b82f6" radius={[0, 4, 4, 0]}
                        label={{ position: "right", formatter: (v: any) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v, fill: "#64748b", fontSize: 11 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: isTh ? "จังหวัดครอบคลุม" : "Provinces covered", value: "77/77",     color: "text-blue-600"    },
                    { label: isTh ? "โครงการทั้งหมด" : "Total projects",     value: "153,685",   color: "text-emerald-600" },
                    { label: isTh ? "มูลค่าตลาดรวม" : "Total budget",       value: "฿1.09T",    color: "text-violet-600"  },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                      <p className={`text-[10px] text-slate-500 mt-0.5 leading-tight ${isTh ? "lang-th" : ""}`}>{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <p className={`text-xs text-slate-600 leading-relaxed ${isTh ? "lang-th" : ""}`}>
                    <span className="font-semibold text-emerald-700">{isTh ? "ข้อมูลครอบคลุม: " : "Full coverage: "}</span>
                    {isTh
                      ? "กรุงเทพมหานครมีโครงการ 26,942 โครงการมูลค่า ฿546B — ต่างจากหนองบัวลำภู 762 โครงการ ฿2B Conjuncture ปรับเทียบตามจังหวัดเป้าหมายของคุณ"
                      : "Bangkok has 26,942 projects worth ฿546B vs. Nong Bua Lamphu's 762 projects worth ฿2B. Conjuncture calibrates benchmarks to your target province."}
                  </p>
                </div>
                <p className="mt-2 text-[10px] text-slate-400 text-right">
                  Source: province sheet · 77 จังหวัด · FY2568 data
                </p>
              </div>
            )}

            {/* ─── Winners & Profiles ─── */}
            {tab === "winners" && (
              <div>
                <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h3 className={`text-base font-bold text-black ${isTh ? "lang-th" : ""}`}>
                      {isTh ? "ผู้ชนะสัญญาสูงสุด & อัตราชนะการประมูล" : "Top contract winners & competitor profiles"}
                    </h3>
                    <p className={`text-xs text-slate-400 mt-1 ${isTh ? "lang-th" : ""}`}>
                      {isTh
                        ? "499 บริษัท · มูลค่าสัญญารวม ฿65.1B · อัตราชนะโดยรวม 21.4%"
                        : "499 companies · ฿65.1B total contracts · 21.4% overall win rate across 237 profiled bidders"}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {(["all", "repeat", "single"] as WinnersFilter[]).map(f => (
                      <button
                        key={f}
                        onClick={() => setWinnersFilter(f)}
                        className={`px-3 py-1 text-[11px] font-semibold rounded-full border transition-all ${
                          winnersFilter === f
                            ? "bg-black text-white border-black"
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        {f === "all"    ? (isTh ? "ทั้งหมด" : "All") :
                         f === "repeat" ? (isTh ? "ชนะหลายครั้ง" : "Repeat Winners") :
                                          (isTh ? "สัญญาเดียว" : "One Big Deal")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-56 lg:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={filteredWinners}
                      layout="vertical"
                      margin={{ top: 0, right: 64, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 8]}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={{ stroke: "#e2e8f0" }}
                        tickLine={false}
                        tickFormatter={(v) => `฿${v}B`}
                      />
                      <YAxis
                        type="category"
                        dataKey="short"
                        tick={{ fill: "#334155", fontSize: 11, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        width={96}
                      />
                      <Tooltip content={<WinnersTooltip />} cursor={{ fill: "#f8fafc" }} />
                      <Bar dataKey="valueB" radius={[0, 4, 4, 0]}
                        label={{ position: "right", formatter: (v: any) => `฿${v}B`, fill: "#64748b", fontSize: 11, fontWeight: 600 }}>
                        {filteredWinners.map((d, i) => {
                          const palette = ["#1d4ed8","#2563eb","#3b82f6","#60a5fa","#93c5fd","#bfdbfe","#dbeafe","#eff6ff","#f0f9ff","#f8fafc"];
                          return <Cell key={i} fill={palette[Math.min(i, palette.length - 1)]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: isTh ? "บริษัทผู้ชนะทั้งหมด" : "Total winning companies",  value: "499",   color: "text-blue-600"    },
                    { label: isTh ? "อัตราชนะโดยรวม" : "Overall win rate",              value: "21.4%", color: "text-emerald-600" },
                    { label: isTh ? "โปรไฟล์คู่แข่งที่ติดตาม" : "Competitor profiles tracked", value: "237",   color: "text-violet-600"  },
                    { label: isTh ? "Z-score สูงสุด (Anomaly)" : "Max anomaly Z-score", value: "6.29",  color: "text-red-600"     },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                      <p className={`text-[10px] text-slate-500 mt-0.5 leading-tight ${isTh ? "lang-th" : ""}`}>{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className={`text-xs text-slate-600 leading-relaxed ${isTh ? "lang-th" : ""}`}>
                    <span className="font-semibold text-red-700">{isTh ? "Anomaly Detector: " : "Anomaly Detector: "}</span>
                    {isTh
                      ? "54 โครงการมีส่วนลดผิดปกติสูง (Z-score ≥ 2.0) ระหว่าง 37.6%–93.9% — การประปานครหลวงสูงสุด 93.94% (Z=6.29) Conjuncture แจ้งเตือนก่อนคุณเข้าประมูลในโซนเหล่านี้"
                      : "54 projects flagged with extreme discounts (Z-score ≥ 2.0), ranging 37.6%–93.9%. MWA topped at 93.94% off (Z=6.29). Conjuncture alerts you before you bid into an outlier zone."}
                  </p>
                </div>
                <div className="mt-3 flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <Users className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className={`text-xs text-slate-600 leading-relaxed ${isTh ? "lang-th" : ""}`}>
                    <span className="font-semibold text-blue-700">{isTh ? "Competitor Intelligence: " : "Competitor Intelligence: "}</span>
                    {isTh
                      ? "บริษัทที่ติดตามมาก 5+ ครั้งโดยไม่ชนะเลย — มีอยู่ในฐานข้อมูล Conjuncture รู้ว่าคุณกำลังแข่งกับใคร ก่อนยื่นราคา"
                      : "Companies with 5+ tracked bids but 0% win rate exist in the dataset. Know who you're bidding against — and their track record — before you submit."}
                  </p>
                </div>
                <p className="mt-2 text-[10px] text-slate-400 text-right">
                  Source: winners · profiles · anomalies sheets · 499 companies · FY2561–2568
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
