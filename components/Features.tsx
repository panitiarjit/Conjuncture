"use client";

import Link from "next/link";
import { type Lang } from "@/lib/landing-translations";

interface FeaturesProps { lang: Lang; }

const FINDINGS_EN = [
  {
    number: "01",
    stat: "218×",
    label: "Discount collapse in 6 years",
    body: "Median discount in FY2561: 13.12%. By FY2567: 0.06%. Same contract types, same agencies. Whether this reflects better reference pricing, reduced competition, or something else is an open question the data cannot answer alone.",
    tag: "Year-on-year trend",
    color: "border-rose-100",
    tagColor: "bg-rose-50 text-rose-600",
  },
  {
    number: "02",
    stat: "36.1%",
    label: "of e-bidding contracts won within 1% of reference",
    body: "Of 1,070 e-bidding contracts analyzed, 36% ended within 0.5% of the reference price. A method designed for competition — producing the same outcome as a fixed-price purchase.",
    tag: "Method analysis",
    color: "border-amber-100",
    tagColor: "bg-amber-50 text-amber-600",
  },
  {
    number: "03",
    stat: "121×",
    label: "Gap between least and most competitive provinces",
    body: "Saraburi median discount: 0.09%. Phichit: 10.91%. Same procurement law, same contract types. Geography determines the competitive environment more than project category.",
    tag: "Provincial data",
    color: "border-blue-100",
    tagColor: "bg-blue-50 text-blue-600",
  },
  {
    number: "04",
    stat: "57%",
    label: "of agencies bought from only one vendor",
    body: "Of 4,003 agencies with winner data, 2,275 had a single winning vendor across all analyzed contracts. Not always a red flag — but combined with near-zero discounts, it creates a pattern worth examining.",
    tag: "Concentration",
    color: "border-violet-100",
    tagColor: "bg-violet-50 text-violet-600",
  },
  {
    number: "05",
    stat: "3.28%",
    label: "Median discount for ฿1M–10M projects vs 1.01% for ฿100M+",
    body: "The conventional assumption — larger contracts attract more competition — does not hold. Medium-sized projects face the most competitive pricing. Micro and mega projects converge near zero.",
    tag: "Budget tier",
    color: "border-emerald-100",
    tagColor: "bg-emerald-50 text-emerald-600",
  },
  {
    number: "06",
    stat: "812",
    label: "Statistical anomaly flags across 19,773 contracts",
    body: "Contracts with Z-score > 3 versus the agency's own median. Includes a ฿46M construction contract awarded for ฿461K (99% discount) and one person winning 4 child-development center contracts at 97% discount each.",
    tag: "Anomaly detection",
    color: "border-slate-100",
    tagColor: "bg-slate-50 text-slate-600",
  },
];

const FINDINGS_TH = [
  {
    number: "01",
    stat: "218×",
    label: "ส่วนลดลดลงในหกปี",
    body: "ส่วนลดมัธยฐานปีงบประมาณ 2561: 13.12% ถึงปีงบประมาณ 2567: 0.06% ประเภทสัญญาเดิม หน่วยงานเดิม ข้อมูลบอกว่า 'เปลี่ยนแปลง' ไม่ใช่ 'เพราะอะไร'",
    tag: "แนวโน้มรายปี",
    color: "border-rose-100",
    tagColor: "bg-rose-50 text-rose-600",
  },
  {
    number: "02",
    stat: "36.1%",
    label: "ของ e-bidding ชนะด้วยส่วนลดน้อยกว่า 1%",
    body: "จาก 1,070 สัญญา e-bidding ที่วิเคราะห์ 36% จบที่ส่วนลดน้อยกว่า 0.5% จากราคากลาง วิธีที่ออกแบบมาเพื่อการแข่งขัน — ผลลัพธ์ไม่ต่างกับการตั้งราคาตายตัว",
    tag: "วิธีการจัดซื้อ",
    color: "border-amber-100",
    tagColor: "bg-amber-50 text-amber-600",
  },
  {
    number: "03",
    stat: "121×",
    label: "ช่องว่างระหว่างจังหวัดที่มีการแข่งขันต่ำสุดและสูงสุด",
    body: "สระบุรี ส่วนลดมัธยฐาน 0.09% พิจิตร 10.91% กฎหมายเดียวกัน ประเภทสัญญาเดียวกัน ภูมิภาคกำหนดสภาพแวดล้อมการแข่งขันได้มากกว่าประเภทโครงการ",
    tag: "ข้อมูลจังหวัด",
    color: "border-blue-100",
    tagColor: "bg-blue-50 text-blue-600",
  },
  {
    number: "04",
    stat: "57%",
    label: "ของหน่วยงานซื้อจากผู้ขายรายเดียวตลอด",
    body: "จาก 4,003 หน่วยงานที่มีข้อมูลผู้ชนะ 2,275 รายมีผู้ชนะรายเดียวในทุกสัญญาที่วิเคราะห์ ไม่ได้หมายความว่ามีปัญหาเสมอ แต่เมื่อรวมกับส่วนลดใกล้ศูนย์ รูปแบบนี้ควรตรวจสอบ",
    tag: "ความเข้มข้นตลาด",
    color: "border-violet-100",
    tagColor: "bg-violet-50 text-violet-600",
  },
  {
    number: "05",
    stat: "3.28%",
    label: "ส่วนลดมัธยฐานโครงการ 1–10 ล้าน vs 1.01% สำหรับโครงการ 100 ล้านขึ้นไป",
    body: "ความเชื่อทั่วไปว่าโครงการใหญ่ดึงดูดการแข่งขันมากกว่า — ไม่จริง โครงการขนาดกลางมีส่วนลดสูงสุด โครงการเล็กมากและใหญ่มากต่างมาบรรจบกันที่ส่วนลดใกล้ศูนย์",
    tag: "ขนาดวงเงิน",
    color: "border-emerald-100",
    tagColor: "bg-emerald-50 text-emerald-600",
  },
  {
    number: "06",
    stat: "812",
    label: "สัญญาผิดปกติทางสถิติจาก 19,773 รายการ",
    body: "สัญญาที่มี Z-score > 3 เทียบกับค่ามัธยฐานของหน่วยงานตัวเอง รวมถึงสัญญาก่อสร้าง ฿46 ล้าน ที่ชนะในราคา ฿461,000 (ส่วนลด 99%) และบุคคลหนึ่งชนะ 4 ศูนย์พัฒนาเด็กเล็ก ส่วนลด 97% ต่อสัญญา",
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
              {isTh ? "ดูว่าราคาของคุณอยู่ที่เปอร์เซ็นไทล์ไหนในตลาดจริง" : "See exactly where your bid stands in the real distribution."}
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
