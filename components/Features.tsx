"use client";

import { BarChart2, DollarSign, CreditCard, Package, ArrowUpRight } from "lucide-react";
import { t, type Lang } from "@/lib/landing-translations";

interface FeaturesProps { lang: Lang; }

const ICONS = [BarChart2, DollarSign, CreditCard, Package];
const COLORS = [
  { dot: "bg-blue-500", border: "border-blue-100", tagBg: "bg-blue-50 text-blue-600" },
  { dot: "bg-emerald-500", border: "border-emerald-100", tagBg: "bg-emerald-50 text-emerald-600" },
  { dot: "bg-violet-500", border: "border-violet-100", tagBg: "bg-violet-50 text-violet-600" },
  { dot: "bg-amber-500", border: "border-amber-100", tagBg: "bg-amber-50 text-amber-600" },
];

export default function Features({ lang }: FeaturesProps) {
  const tx = t[lang].features;
  const isTh = lang === "th";

  return (
    <section id="features" className="py-24 lg:py-32 bg-white">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <div className="max-w-2xl mb-16">
          <span className={`text-xs font-bold tracking-widest uppercase text-slate-400 ${isTh ? "lang-th" : ""}`}>
            {isTh ? "ฟีเจอร์หลัก" : "Platform"}
          </span>
          <h2 className={`mt-3 text-black font-black tracking-tight leading-none ${
            isTh ? "th-heading text-4xl sm:text-5xl" : "en-heading text-4xl sm:text-5xl"
          }`}>
            {isTh ? "ทุกสิ่งที่คุณต้องการ\nเพื่อชนะการประมูล" : "Everything you need\nto win more bids."}
          </h2>
          <p className={`mt-4 text-slate-500 leading-relaxed ${isTh ? "lang-th text-base" : "text-lg"}`}>
            {tx.subtitle}
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tx.items.map((item, i) => {
            const Icon = ICONS[i];
            const c = COLORS[i];
            return (
              <div key={i}
                className={`group relative bg-white border ${c.border} rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-2`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${c.tagBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full mb-3 ${c.tagBg}`}>
                  {item.tag}
                </span>
                <h3 className={`font-bold text-black mb-2 leading-snug ${isTh ? "lang-th text-base" : "text-base"}`}>
                  {item.title}
                </h3>
                <p className={`text-slate-500 text-sm leading-relaxed ${isTh ? "lang-th" : ""}`}>
                  {item.description}
                </p>
                <a href="#"
                  className="absolute top-5 right-5 w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 hover:border-black hover:text-black transition-all">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            );
          })}
        </div>

        {/* CTA strip */}
        <div className="mt-12 rounded-2xl bg-black p-8 lg:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className={`font-black text-white text-xl tracking-tight ${isTh ? "th-heading" : "en-heading"}`}>
              {isTh ? "พร้อมเริ่มต้นแล้วหรือยัง?" : "Ready to start winning?"}
            </h3>
            <p className={`text-slate-400 text-sm mt-1 ${isTh ? "lang-th" : ""}`}>
              {isTh ? "ทดลองฟรี 14 วัน ไม่ต้องใช้บัตรเครดิต" : "14-day free trial. No credit card required."}
            </p>
          </div>
          <a href="#demo"
            className={`flex-shrink-0 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-slate-100 transition-colors text-sm ${isTh ? "lang-th" : ""}`}>
            {isTh ? "เริ่มต้นฟรี →" : "Get started free →"}
          </a>
        </div>
      </div>
    </section>
  );
}
