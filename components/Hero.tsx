"use client";

import { ArrowRight } from "lucide-react";
import { t, type Lang } from "@/lib/landing-translations";

interface HeroProps { lang: Lang; }

// Real data from 16 analysis sheets — Thai gov procurement registry FY2561–2568
// Sheets used: yearonyear · methods · singlebidder · winconcentration · discountbyagencycat
//              allbidders · anomalies · keywords · provinces · profiles · winners
const TICKER_EN = [
  "153,685 Projects Across 77 Thai Provinces",
  "฿1.09 Trillion Total Procurement Budget",
  "Single-Bidder E-bidding: 0.65% Median Discount (524 tenders)",
  "243× Agency Spread: DOH 0.1% Median vs MWA 24.3%",
  "356 Agencies: 100% Single-Winner Concentration",
  "54 Anomaly Flags (Z-score ≥ 2.0) — Max Discount 93.9%",
  "499 Companies · ฿65.1B Total Contract Value Tracked",
  "21.4% Win Rate — 237 Competitor Profiles in Database",
  "524 Single-Bidder Tenders — Maximum Margin Zone",
  "Road Construction: 2,478 Tenders — Top Procurement Category",
];

const TICKER_TH = [
  "153,685 โครงการใน 77 จังหวัดทั่วไทย",
  "งบจัดซื้อจัดจ้างรวม ฿1.09 ล้านล้านบาท",
  "e-bidding รายเดียว: ส่วนลดมัธยฐาน 0.65% (524 โครงการ)",
  "ส่วนลดต่างกัน 243 เท่า: กรมทางหลวง 0.1% vs การประปา 24.3%",
  "356 หน่วยงาน — ผู้ชนะรายเดียวทุกโครงการ",
  "54 โครงการผิดปกติ (Z-score ≥ 2.0) — ส่วนลดสูงสุด 93.9%",
  "499 บริษัท · มูลค่าสัญญารวม ฿65.1B",
  "อัตราชนะ 21.4% — โปรไฟล์คู่แข่ง 237 ราย",
  "524 โครงการ e-bidding รายเดียว — โซนกำไรสูงสุด",
  "ก่อสร้างถนน: 2,478 โครงการ — ประเภทสัญญาสูงสุด",
];

export default function Hero({ lang }: HeroProps) {
  const tx = t[lang].hero;
  const isTh = lang === "th";

  return (
    <section className="relative pt-32 pb-20 bg-white overflow-hidden">
      {/* Very subtle dot grid bg */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Fade at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-6 text-center">

        {/* Data provenance badge */}
        <div className="fade-up d1 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-200 bg-white text-slate-500 text-xs font-medium mb-8 shadow-sm">
          <span className="relative flex w-2 h-2">
            <span className="ping-dot absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
          </span>
          {isTh ? "ข้อมูลจริงจากระบบจัดซื้อจัดจ้างภาครัฐ · ปีงบประมาณ 2561–2568" : "Real data from Thai Government Procurement Registry · FY2561–2568"}
        </div>

        {/* HEADLINE */}
        {isTh ? (
          <div className="fade-up d2 th-heading text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter mb-6 text-center">
            <div className="mb-5 lg:mb-7">ประมูลชนะ</div>
            <div className="mb-5 lg:mb-7 text-slate-400">ด้วยข้อมูลจริง</div>
            <div>ไม่ต้องเดา</div>
          </div>
        ) : (
          <h1 className="fade-up d2 en-heading text-5xl sm:text-6xl lg:text-[5.5rem] font-black tracking-tighter leading-none mb-6 text-balance text-black">
            Bid Smarter.<br />
            <span className="text-slate-400">Win More.</span><br />
            Protect Margins.
          </h1>
        )}

        {/* Subheadline */}
        <p className={`fade-up d3 text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed ${
          isTh ? "lang-th text-lg" : "text-xl"
        }`}>
          {tx.subheadline}
        </p>

        {/* CTA */}
        <div className="fade-up d4 max-w-xs mx-auto mb-10">
          <button
            onClick={() => {
              window.open("mailto:panitiarjit@gmail.com?subject=Demo%20Request&body=Hi%2C%0A%0AI%27d%20like%20to%20request%20a%20demo%20of%20Conjuncture.", "_blank");
            }}
            className={`w-full py-3.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 bg-black text-white hover:bg-slate-800 transition-colors shadow-lg shadow-black/10 ${isTh ? "lang-th" : ""}`}
          >
            {isTh ? "ขอทดลองใช้งาน" : "Request Demo"}
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className={`text-xs text-slate-400 text-center mt-3 ${isTh ? "lang-th" : ""}`}>
            {isTh ? "ตอบกลับภายใน 24 ชั่วโมง · ไม่มีค่าใช้จ่าย" : "We'll respond within 24 hours · No commitment required"}
          </p>
        </div>

        {/* Stats row */}
        <div className="fade-up d5 flex flex-wrap justify-center gap-8 text-center border-t border-slate-100 pt-10">
          {[
            { value: tx.stat1Value, label: tx.stat1Label },
            { value: tx.stat2Value, label: tx.stat2Label },
            { value: tx.stat3Value, label: tx.stat3Label },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-2xl font-black text-black tracking-tight">{s.value}</p>
              <p className={`text-sm text-slate-400 mt-0.5 ${isTh ? "lang-th text-xs" : ""}`}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Real-data ticker strip */}
      <div className="mt-16 border-y border-slate-100 bg-slate-50 py-3 overflow-hidden">
        <div className="flex ticker gap-0">
          {(isTh ? [...TICKER_TH, ...TICKER_TH] : [...TICKER_EN, ...TICKER_EN]).map((item, i) => (
            <div key={i} className={`flex items-center gap-3 px-8 whitespace-nowrap flex-shrink-0 ${isTh ? "lang-th" : ""}`}>
              <span className="text-xs font-semibold text-slate-700">{item}</span>
              <span className="text-slate-300">·</span>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
