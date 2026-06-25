"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { type Lang } from "@/lib/landing-translations";

interface HeroProps { lang: Lang; }

export default function Hero({ lang }: HeroProps) {
  const isTh = lang === "th";

  return (
    <section className="relative pt-32 pb-20 bg-white overflow-hidden">
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-6 text-center">

        {/* Live data badge */}
        <div className="fade-up d1 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-200 bg-white text-slate-500 text-xs font-medium mb-8 shadow-sm">
          <span className="relative flex w-2 h-2">
            <span className="ping-dot absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
          </span>
          {isTh
            ? "ฐานข้อมูล 251,000+ สัญญา · ระบบ e-GP ปีงบประมาณ 2561–2568"
            : "251,000+ contracts in database · Thai e-GP system · FY2561–2568"}
        </div>

        {/* Headline */}
        {isTh ? (
          <div className="fade-up d2 th-heading text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter mb-6 text-center leading-none">
            <div className="mb-4">ราคากลาง</div>
            <div className="mb-4 text-slate-400">ไม่ใช่ราคาตลาด</div>
          </div>
        ) : (
          <h1 className="fade-up d2 en-heading text-5xl sm:text-6xl lg:text-[5.5rem] font-black tracking-tighter leading-none mb-6 text-balance text-black">
            The reference price<br />
            <span className="text-slate-400">is not the market price.</span>
          </h1>
        )}

        {/* Subheadline */}
        <p className={`fade-up d3 text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed ${isTh ? "lang-th text-lg" : "text-xl"}`}>
          {isTh
            ? "ราคาที่ชนะในการประมูลภาครัฐต่ำกว่ากลางเฉลี่ย 13.12% ในปี 2561 แต่ปี 2567 เหลือเพียง 0.06% ลดลง 218 เท่าในหกปี 251,000+ สัญญาบอกเราว่าแต่ละตลาดไม่เหมือนกัน Conjuncture ช่วยให้คุณรู้ว่าต้องเสนอราคาเท่าไรก่อนยื่น"
            : "The median government procurement discount fell from 13.12% in 2018 to 0.06% in 2024 — a 218× collapse. 251,000+ contracts show every market is different. Conjuncture tells you where to bid before you submit."}
        </p>

        {/* CTA */}
        <div className="fade-up d4 flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          <Link
            href="/register"
            className={`w-full sm:w-auto px-8 py-3.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 bg-black text-white hover:bg-slate-800 transition-colors shadow-lg shadow-black/10 ${isTh ? "lang-th" : ""}`}
          >
            {isTh ? "ลงทะเบียน" : "Register"}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#findings"
            className={`w-full sm:w-auto px-8 py-3.5 text-sm font-medium rounded-xl border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-black transition-colors text-center ${isTh ? "lang-th" : ""}`}
          >
            {isTh ? "ดูผลการวิจัย →" : "Read the findings →"}
          </a>
        </div>

        {/* Stats row */}
        <div className="fade-up d5 flex flex-wrap justify-center gap-10 text-center border-t border-slate-100 pt-10">
          {(isTh ? [
            { value: "251,000+", label: "สัญญาในฐานข้อมูล" },
            { value: "218×", label: "การแข่งขันราคาลดลงไปในหกปี" },
            { value: "77", label: "จังหวัดทั่วประเทศ" },
            { value: "121×", label: "ช่องว่างระหว่างจังหวัด" },
          ] : [
            { value: "251,000+", label: "contracts in database" },
            { value: "218×", label: "discount collapse over 6 yrs" },
            { value: "77", label: "provinces covered" },
            { value: "121×", label: "gap between provinces" },
          ]).map((s, i) => (
            <div key={i}>
              <p className="text-2xl font-black text-black tracking-tight">{s.value}</p>
              <p className={`text-sm text-slate-400 mt-0.5 ${isTh ? "lang-th text-xs" : ""}`}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Findings ticker strip */}
      <div className="mt-16 border-y border-slate-100 bg-slate-50 py-3 overflow-hidden">
        <div className="flex ticker gap-0">
          {(isTh ? [
            "ราคาที่ชนะต่ำกว่ากลางเฉลี่ย 2561: 13.12% ปี 2567: 0.06%",
            "36.1% ของ e-bidding ชนะในราคาใกล้เต็มราคากลาง (ต่ำกว่า 0.5%)",
            "สระบุรี 0.09% vs พิจิตร 10.91% ต่างกัน 121 เท่า",
            "57% ของหน่วยงานซื้อจากผู้ขายรายเดียวตลอด",
            "โครงการ 1–10 ล้านมีการต่อราคาสูงกว่าโครงการ 100 ล้านขึ้นไป",
            "812 สัญญาผิดปกติ (Z-score > 3) จาก 19,773 รายการ",
            "กรมทางหลวง: 63.9% ของสัญญาชนะในราคาใกล้เต็มราคากลาง",
            "สัญญาก่อสร้าง ฿46M ชนะในราคา ฿461,000 ต่ำกว่ากลาง 99%",
          ] : [
            "Median discount FY2561: 13.12% → FY2567: 0.06%",
            "36.1% of e-bidding contracts won within 0.5% of reference",
            "Saraburi 0.09% vs Phichit 10.91% — 121× provincial gap",
            "57% of agencies bought from only one vendor",
            "฿1M–10M projects more competitive than ฿100M+ ones",
            "812 anomaly flags (Z-score > 3) from 19,773 valid contracts",
            "Dept of Highways: 63.9% of contracts at near-zero discount",
            "฿46M construction contract awarded for ฿461K — 99% discount",
          ]).flatMap(x => [x, x]).map((item, i) => (
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
