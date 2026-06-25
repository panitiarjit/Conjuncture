"use client";

import Link from "next/link";
import { ArrowRight, BarChart2, FileText, TrendingUp } from "lucide-react";
import { type Lang } from "@/lib/landing-translations";

interface CaseStudyProps { lang: Lang; }

export default function CaseStudy({ lang }: CaseStudyProps) {
  const isTh = lang === "th";

  const steps = isTh ? [
    {
      icon: BarChart2,
      n: "1",
      title: "จำลองราคาของคุณ",
      body: "ใส่ราคากลาง ต้นทุน และกำไรเป้าหมาย Conjuncture จะแสดงว่าราคาของคุณอยู่ที่เปอร์เซ็นไทล์ไหนของผู้ชนะในอดีต",
    },
    {
      icon: TrendingUp,
      n: "2",
      title: "ยื่นประมูล",
      body: "ใช้ข้อมูลจากตลาดจริง 251,000+ สัญญา แบ่งตามหน่วยงาน ประเภทโครงการ และจังหวัด ไม่ใช่การเดา",
    },
    {
      icon: FileText,
      n: "3",
      title: "รายงานผลใน 2 นาที",
      body: "ไม่ว่าจะชนะหรือแพ้ การรายงานผลของคุณช่วยให้โมเดลเรียนรู้ว่าส่วนลดไหนชนะจริง — ไม่ใช่แค่ส่วนลดที่เคยชนะในอดีต",
    },
  ] : [
    {
      icon: BarChart2,
      n: "1",
      title: "Simulate your bid",
      body: "Enter your reference price, cost, and margin target. Conjuncture shows which percentile of past winners your bid falls at — by procurement category.",
    },
    {
      icon: TrendingUp,
      n: "2",
      title: "Submit your tender",
      body: "Backed by 251,000+ real contracts, segmented by agency, project type, and province. Price from data, not intuition.",
    },
    {
      icon: FileText,
      n: "3",
      title: "Report the outcome in 2 min",
      body: "Win or lose — your report teaches the model which discounts actually win, not just which discounts have won historically. Each report improves the model for everyone in your category.",
    },
  ];

  return (
    <section id="community" className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">

        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: copy */}
          <div>
            <span className={`text-xs font-bold tracking-widest uppercase text-slate-400 ${isTh ? "lang-th" : ""}`}>
              {isTh ? "เครือข่ายข้อมูล" : "Data network"}
            </span>
            <h2 className={`mt-3 font-black tracking-tight leading-none text-black ${isTh ? "th-heading text-4xl sm:text-5xl" : "en-heading text-4xl sm:text-5xl"}`}>
              {isTh ? (
                <>ยิ่งมีคนรายงาน<br /><span className="text-slate-400">โมเดลยิ่งแม่นยำ</span></>
              ) : (
                <>The more people report,<br /><span className="text-slate-400">the better the model.</span></>
              )}
            </h2>
            <p className={`mt-5 text-slate-500 leading-relaxed ${isTh ? "lang-th text-base" : "text-lg"}`}>
              {isTh
                ? "ข้อมูล e-GP บันทึกเฉพาะผู้ชนะ ไม่มีข้อมูลผู้แพ้ ดังนั้นเราไม่สามารถคำนวณความน่าจะเป็นในการชนะได้จากข้อมูลสาธารณะอย่างเดียว เมื่อคุณรายงานผลประมูล — ทั้งชนะและแพ้ — โมเดลจะเรียนรู้ว่าส่วนลดไหนชนะจริงในตลาดของคุณ"
                : "The e-GP database records only winners. There is no losing-bid data. To calculate real win probability — not just percentile positioning — we need matched outcome data. When you report your bid result, the model learns what actually wins in your market segment."}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/report"
                className={`inline-flex items-center gap-2 px-6 py-3 bg-black text-white font-bold rounded-xl text-sm hover:bg-slate-800 transition-colors ${isTh ? "lang-th" : ""}`}
              >
                {isTh ? "รายงานผลประมูล" : "Report a bid outcome"}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/register"
                className={`inline-flex items-center gap-2 px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl text-sm hover:border-slate-400 hover:text-black transition-colors ${isTh ? "lang-th" : ""}`}
              >
                {isTh ? "ลงทะเบียน" : "Register"}
              </Link>
            </div>
          </div>

          {/* Right: steps */}
          <div className="flex flex-col gap-5">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.n} className="flex gap-5 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-white" size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Step {step.n}</span>
                    </div>
                    <h3 className={`font-bold text-black text-sm mb-1.5 ${isTh ? "lang-th" : ""}`}>{step.title}</h3>
                    <p className={`text-slate-500 text-sm leading-relaxed ${isTh ? "lang-th" : ""}`}>{step.body}</p>
                  </div>
                </div>
              );
            })}

            {/* Loop activation note */}
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-5 py-4">
              <p className={`text-xs font-semibold text-emerald-700 mb-0.5 ${isTh ? "lang-th" : ""}`}>
                Network Effect Loops
              </p>
              <p className={`text-xs text-emerald-600 leading-relaxed ${isTh ? "lang-th" : ""}`}>
                {isTh
                  ? "เมื่อมีผลการประมูล 20+ รายการในหมวดเดียวกัน โมเดลจะเริ่มผสมข้อมูลชุมชนเข้ากับข้อมูล e-GP ที่ 30+ รายการ โมเดลจะประมาณความน่าจะเป็นในการชนะได้จริง"
                  : "At 20+ outcomes per agency×category, the model blends community data with e-GP benchmarks. At 30+ matched pairs, it estimates real win probability — not just positioning."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
