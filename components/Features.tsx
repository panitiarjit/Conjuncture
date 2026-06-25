"use client";

import Link from "next/link";
import { type Lang } from "@/lib/landing-translations";

interface FeaturesProps { lang: Lang; }

const FINDINGS_EN = [
  {
    number: "01",
    stat: "218×",
    label: "Price competition collapsed in 6 years",
    body: "In FY2561, winning bids averaged 13.12% below reference price. By FY2567: 0.06%. Same contract types, same agencies. The market changed dramatically. Why is still an open question.",
    tag: "Year-on-year trend",
    color: "border-rose-100",
    tagColor: "bg-rose-50 text-rose-600",
  },
  {
    number: "02",
    stat: "36.1%",
    label: "of e-bidding contracts won within 1% of reference price",
    body: "Of 1,070 e-bidding contracts analyzed, 36% were won within 0.5% of the reference price. A method designed to force competitive pricing. It produced the same result as a fixed-price purchase in more than a third of cases.",
    tag: "Method analysis",
    color: "border-amber-100",
    tagColor: "bg-amber-50 text-amber-600",
  },
  {
    number: "03",
    stat: "121×",
    label: "Gap between least and most competitive provinces",
    body: "Saraburi: winning bids averaged 0.09% below reference. Phichit: 10.91%. Same procurement law, same contract types. Geography shapes the competitive environment more than project category.",
    tag: "Provincial data",
    color: "border-blue-100",
    tagColor: "bg-blue-50 text-blue-600",
  },
  {
    number: "04",
    stat: "57%",
    label: "of agencies bought from only one vendor",
    body: "Of 4,003 agencies with winner data, 2,275 had a single winning vendor across all analyzed contracts. Not always a red flag. But combined with near-zero price undercutting, it creates a pattern worth examining.",
    tag: "Concentration",
    color: "border-violet-100",
    tagColor: "bg-violet-50 text-violet-600",
  },
  {
    number: "05",
    stat: "3.28%",
    label: "Below-reference average for ฿1M–10M projects vs 1.01% for ฿100M+",
    body: "Larger contracts do not attract more competition. Medium-sized projects (฿1M–10M) see the most competitive pricing. Both micro projects (under ฿100k) and mega projects (over ฿100M) cluster near the reference price.",
    tag: "Budget tier",
    color: "border-emerald-100",
    tagColor: "bg-emerald-50 text-emerald-600",
  },
  {
    number: "06",
    stat: "812",
    label: "Statistical anomaly flags across 19,773 contracts",
    body: "Contracts with Z-score > 3 versus the agency's own median. Includes a ฿46M construction contract awarded for ฿461K (99% below reference) and one person winning 4 child-development center contracts at 97% below reference each.",
    tag: "Anomaly detection",
    color: "border-slate-100",
    tagColor: "bg-slate-50 text-slate-600",
  },
];

const FINDINGS_TH = [
  {
    number: "01",
    stat: "218×",
    label: "การแข่งขันราคาลดลงไปในหกปี",
    body: "ปีงบประมาณ 2561 ราคาที่ชนะต่ำกว่ากลางเฉลี่ย 13.12% ปี 2567 เหลือเพียง 0.06% ประเภทสัญญาเดิม หน่วยงานเดิม ตลาดเปลี่ยนไปชัดเจน แต่สาเหตุที่แท้จริงยังเป็นคำถามเปิด",
    tag: "แนวโน้มรายปี",
    color: "border-rose-100",
    tagColor: "bg-rose-50 text-rose-600",
  },
  {
    number: "02",
    stat: "36.1%",
    label: "ของ e-bidding ชนะในราคาใกล้เต็มราคากลาง",
    body: "จาก 1,070 สัญญา e-bidding ที่วิเคราะห์ 36% ชนะในราคาที่ต่ำกว่ากลางไม่ถึง 0.5% วิธีที่ออกแบบมาเพื่อการแข่งขัน แต่ผลลัพธ์ไม่ต่างกับการตั้งราคาตายตัว",
    tag: "วิธีการจัดซื้อ",
    color: "border-amber-100",
    tagColor: "bg-amber-50 text-amber-600",
  },
  {
    number: "03",
    stat: "121×",
    label: "ช่องว่างระหว่างจังหวัดที่มีการแข่งขันต่ำสุดและสูงสุด",
    body: "สระบุรี ราคาที่ชนะต่ำกว่ากลางเฉลี่ย 0.09% พิจิตร 10.91% กฎหมายเดียวกัน ประเภทสัญญาเดียวกัน แต่ภูมิภาคกำหนดสภาพตลาดได้มากกว่าประเภทโครงการ",
    tag: "ข้อมูลจังหวัด",
    color: "border-blue-100",
    tagColor: "bg-blue-50 text-blue-600",
  },
  {
    number: "04",
    stat: "57%",
    label: "ของหน่วยงานซื้อจากผู้ขายรายเดียวตลอด",
    body: "จาก 4,003 หน่วยงานที่มีข้อมูลผู้ชนะ 2,275 รายมีผู้ชนะรายเดียวในทุกสัญญาที่วิเคราะห์ ไม่ได้หมายความว่ามีปัญหาเสมอ แต่เมื่อรวมกับการเสนอราคาใกล้เต็มราคากลาง รูปแบบนี้ควรตรวจสอบ",
    tag: "ความเข้มข้นตลาด",
    color: "border-violet-100",
    tagColor: "bg-violet-50 text-violet-600",
  },
  {
    number: "05",
    stat: "3.28%",
    label: "ราคาที่ชนะต่ำกว่ากลางเฉลี่ยในโครงการ 1–10 ล้าน เทียบ 1.01% ในโครงการ 100 ล้านขึ้นไป",
    body: "โครงการใหญ่ไม่ได้มีการแข่งขันมากกว่าเสมอไป โครงการขนาด 1–10 ล้านบาทมีการต่อราคาสูงที่สุด ส่วนโครงการเล็กมาก (ต่ำกว่า 1 แสนบาท) และโครงการใหญ่มาก (เกิน 100 ล้านบาท) ต่างเสนอราคาใกล้เต็มราคากลาง",
    tag: "ขนาดวงเงิน",
    color: "border-emerald-100",
    tagColor: "bg-emerald-50 text-emerald-600",
  },
  {
    number: "06",
    stat: "812",
    label: "สัญญาผิดปกติทางสถิติจาก 19,773 รายการ",
    body: "สัญญาที่มี Z-score > 3 เทียบกับค่ากลางของหน่วยงานตัวเอง รวมถึงสัญญาก่อสร้าง ฿46 ล้าน ที่ชนะในราคา ฿461,000 (ต่ำกว่ากลาง 99%) และบุคคลหนึ่งชนะ 4 ศูนย์พัฒนาเด็กเล็ก ต่ำกว่ากลาง 97% ต่อสัญญา",
    tag: "ตรวจจับความผิดปกติ",
    color: "border-slate-100",
    tagColor: "bg-slate-50 text-slate-600",
  },
];

export default function Features({ lang }: FeaturesProps) {
  const isTh = lang === "th";
  const findings = isTh ? FINDINGS_TH : FINDINGS_EN;

  return (
    <section id="findings" className="py-24 lg:py-32 bg-white">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <div className="max-w-2xl mb-16">
          <span className={`text-xs font-bold tracking-widest uppercase text-slate-400 ${isTh ? "lang-th" : ""}`}>
            {isTh ? "ผลการวิจัย" : "Research findings"}
          </span>
          <h2 className={`mt-3 text-black font-black tracking-tight leading-none ${isTh ? "th-heading text-4xl sm:text-5xl" : "en-heading text-4xl sm:text-5xl"}`}>
            {isTh ? "6 สิ่งที่ข้อมูล\n251,000+ สัญญาบอกเรา" : "6 things 251,000+\ncontracts reveal."}
          </h2>
          <p className={`mt-4 text-slate-500 leading-relaxed ${isTh ? "lang-th text-base" : "text-lg"}`}>
            {isTh
              ? "ข้อมูลจากระบบ e-GP ของกรมบัญชีกลาง ครอบคลุม 1,117 หน่วยงาน มูลค่ารวมกว่า 1 ล้านล้านบาท ไม่ใช่การประมาณ ไม่ใช่ตัวอย่าง — เป็นสัญญาจริงจากฐานข้อมูลสาธารณะ"
              : "From Thailand's e-GP system, covering 1,117 agencies and over ฿1 trillion in contract value. Not estimates, not samples — real contracts from a public database that had never been systematically analyzed."}
          </p>
        </div>

        {/* Findings grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {findings.map((f) => (
            <div
              key={f.number}
              className={`relative bg-white border ${f.color} rounded-2xl p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-2`}
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-xs font-bold text-slate-300">{f.number}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${f.tagColor} ${isTh ? "lang-th" : ""}`}>
                  {f.tag}
                </span>
              </div>
              <p className="text-3xl font-black text-black tracking-tight mb-1">{f.stat}</p>
              <p className={`text-sm font-semibold text-black mb-3 leading-snug ${isTh ? "lang-th" : ""}`}>{f.label}</p>
              <p className={`text-sm text-slate-500 leading-relaxed ${isTh ? "lang-th" : ""}`}>{f.body}</p>
            </div>
          ))}
        </div>

        {/* CTA strip */}
        <div className="mt-12 rounded-2xl bg-black p-8 lg:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className={`font-black text-white text-xl tracking-tight ${isTh ? "th-heading" : "en-heading"}`}>
              {isTh ? "ข้อมูลพร้อมใช้งานแล้ว" : "The data is ready."}
            </h3>
            <p className={`text-slate-400 text-sm mt-1 ${isTh ? "lang-th" : ""}`}>
              {isTh ? "ดูว่าราคาของคุณอยู่ระดับใดในตลาดจริง" : "See exactly where your bid stands in the real distribution."}
            </p>
          </div>
          <Link
            href="/register"
            className={`flex-shrink-0 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-slate-100 transition-colors text-sm ${isTh ? "lang-th" : ""}`}
          >
            {isTh ? "ลงทะเบียน →" : "Register →"}
          </Link>
        </div>
      </div>
    </section>
  );
}
