'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useLanguage } from '@/lib/language-context';

const FINDINGS_EN = [
  {
    n: '01',
    stat: '218×',
    title: 'The discount disappeared',
    body: 'Median discount in FY2561: 13.12%. By FY2567: 0.06%. Over six years, the median discount fell by a factor of 218. Same contract types, same agencies. The data shows the change — not the cause.',
    table: [
      ['FY2561', '90 contracts', '13.12%', '5.0–21.6%'],
      ['FY2562', '109 contracts', '12.82%', '3.2–28.7%'],
      ['FY2563', '305 contracts', '5.53%', '0.2–21.2%'],
      ['FY2567', '4,083 contracts', '0.06%', '0–0.6%'],
      ['FY2568', '15,182 contracts', '2.30%', '0.1–13.0%'],
    ],
    headers: ['Fiscal Year', 'Contracts', 'Median Discount', 'IQR'],
    tag: 'Year-on-year trend',
    color: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  {
    n: '02',
    stat: '36.1%',
    title: 'e-bidding designed for competition — without competition',
    body: 'Of 1,070 e-bidding contracts analyzed, 36.1% ended with a discount below 0.5% from reference price. A procurement method designed to force competitive pricing — producing the same outcome as a fixed-price purchase in more than a third of cases.',
    bullets: [
      'Department of Highways (DOH): 63.9% of contracts at near-zero discount',
      'Royal Irrigation Department: 32.0% of 1,639 contracts at near-zero',
      'State Railway of Thailand: 70.7% of 116 contracts at near-zero',
    ],
    tag: 'Method analysis',
    color: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  {
    n: '03',
    stat: '97%',
    title: 'One person. Four child development centers. 97% discount.',
    body: 'In FY2567, the same individual won procurement contracts from four separate child development centers, all with the same ฿308,700 reference price, all at 96–97% discount.',
    table: [
      ['บ้านสะพังกร่าง', '฿308,700', '฿8,078', '97.38%'],
      ['บ้านรางกร่าง', '฿308,700', '฿9,154', '97.03%'],
      ['บ้านขื่อชนก', '฿308,700', '฿9,154', '97.03%'],
      ['บ้านวังตะกู', '฿308,700', '฿11,308', '96.34%'],
    ],
    headers: ['Center', 'Reference Price', 'Winning Price', 'Discount'],
    tag: 'Pattern detection',
    color: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  {
    n: '04',
    stat: '99%',
    title: 'A ฿46M construction contract awarded for ฿461,000',
    body: 'In FY2567, Tambon Sema Administrative Organization awarded a road construction contract with a reference price of ฿46,133,040 to Udonoon Civil Engineering Partnership for ฿461,330 — a 99% discount. The winning bid was 1% of the government\'s own cost estimate. Possible explanations: reference price set far above market, substantial change in scope, or contractor with genuine structural cost advantages.',
    tag: 'Extreme anomaly',
    color: 'border-red-200 bg-red-50 text-red-700',
  },
  {
    n: '05',
    stat: '121×',
    title: 'Each province is a different market',
    body: 'Median discount varies 121× between the least and most competitive provinces. A contractor bidding the same project type in Saraburi versus Phichit needs a completely different pricing strategy.',
    table: [
      ['สระบุรี (Saraburi)', '0.09%', '273'],
      ['แม่ฮ่องสอน (Mae Hong Son)', '0.14%', '50'],
      ['ยโสธร (Yasothon)', '0.17%', '122'],
      ['พิจิตร (Phichit)', '10.91%', '163'],
      ['สมุทรสงคราม (Samut Songkhram)', '10.26%', '39'],
      ['ปทุมธานี (Pathum Thani)', '5.94%', '300'],
    ],
    headers: ['Province', 'Median Discount', 'Contracts'],
    tag: 'Provincial data',
    color: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  {
    n: '06',
    stat: '3.28%',
    title: 'Medium projects face more competition than large ones',
    body: 'The conventional assumption — larger contracts attract more bidders — does not hold. Projects in the ฿1M–10M range produce the highest median discount. Micro and mega contracts both converge near zero.',
    table: [
      ['Under ฿100k', '1,216', '0%'],
      ['฿100k–1M', '5,556', '0.37%'],
      ['฿1M–10M', '9,708', '3.28%'],
      ['฿10M–100M', '2,922', '1.74%'],
      ['Over ฿100M', '371', '1.01%'],
    ],
    headers: ['Budget range', 'Contracts', 'Median Discount'],
    tag: 'Budget tier',
    color: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
];

const FINDINGS_TH = [
  {
    n: '01',
    stat: '218×',
    title: 'การแข่งขันราคาลดลงไปที่ไหน',
    body: 'ปีงบประมาณ 2561 ส่วนลดมัธยฐานอยู่ที่ 13.12% — ปี 2567 เหลือเพียง 0.06% ลดลง 218 เท่าในหกปี ประเภทสัญญาเดิม หน่วยงานเดิม แต่การแข่งขันด้านราคาแทบหายไปอย่างสมบูรณ์',
    table: [
      ['2561', '90 สัญญา', '13.12%', '5.0–21.6%'],
      ['2562', '109 สัญญา', '12.82%', '3.2–28.7%'],
      ['2563', '305 สัญญา', '5.53%', '0.2–21.2%'],
      ['2567', '4,083 สัญญา', '0.06%', '0–0.6%'],
      ['2568', '15,182 สัญญา', '2.30%', '0.1–13.0%'],
    ],
    headers: ['ปีงบประมาณ', 'จำนวนสัญญา', 'ส่วนลดมัธยฐาน', 'IQR'],
    tag: 'แนวโน้มรายปี',
    color: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  {
    n: '02',
    stat: '36.1%',
    title: 'e-bidding ที่ออกแบบมาเพื่อการแข่งขัน แต่ไม่มีการแข่ง',
    body: 'จาก 1,070 สัญญา e-bidding ที่วิเคราะห์ 36.1% ชนะในราคาที่ต่ำกว่ากลางไม่ถึง 0.5% วิธีจัดซื้อที่ออกแบบมาเพื่อบังคับการแข่งขัน แต่ผลลัพธ์ไม่ต่างจากการกำหนดราคาตายตัวในมากกว่าหนึ่งในสามของสัญญา',
    bullets: [
      'กรมทางหลวง: 63.9% ของสัญญาชนะในราคาใกล้เต็มราคากลาง',
      'กรมชลประทาน: 32.0% จาก 1,639 สัญญา',
      'การรถไฟแห่งประเทศไทย: 70.7% จาก 116 สัญญา',
    ],
    tag: 'วิธีการจัดซื้อ',
    color: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  {
    n: '03',
    stat: '97%',
    title: 'บุคคลเดียว ศูนย์พัฒนาเด็กเล็ก 4 แห่ง ต่ำกว่ากลาง 97%',
    body: 'ในปีงบประมาณ 2567 บุคคลคนเดียวชนะการประมูลจากศูนย์พัฒนาเด็กเล็ก 4 แห่งที่ต่างกัน ทั้งหมดมีราคากลาง ฿308,700 เหมือนกัน และทุกสัญญาชนะในราคาต่ำกว่ากลาง 96–97%',
    table: [
      ['บ้านสะพังกร่าง', '฿308,700', '฿8,078', '97.38%'],
      ['บ้านรางกร่าง', '฿308,700', '฿9,154', '97.03%'],
      ['บ้านขื่อชนก', '฿308,700', '฿9,154', '97.03%'],
      ['บ้านวังตะกู', '฿308,700', '฿11,308', '96.34%'],
    ],
    headers: ['ศูนย์', 'ราคากลาง', 'ราคาที่ชนะ', 'ส่วนลด'],
    tag: 'รูปแบบผิดปกติ',
    color: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  {
    n: '04',
    stat: '99%',
    title: 'สัญญาก่อสร้าง ฿46 ล้าน ในราคา ฿461,000',
    body: 'ในปีงบประมาณ 2567 อบต.เสมา มอบสัญญาก่อสร้างถนนราคากลาง ฿46,133,040 ให้กับห้างหุ้นส่วนจำกัดอุดหนุนการโยธา ในราคา ฿461,330 ต่ำกว่ากลาง 99% ราคาที่ชนะคือ 1% ของราคาประมาณการของรัฐ',
    tag: 'ความผิดปกติสุดขีด',
    color: 'border-red-200 bg-red-50 text-red-700',
  },
  {
    n: '05',
    stat: '121×',
    title: 'แต่ละจังหวัดคือตลาดที่แตกต่างกัน',
    body: 'ราคาที่ชนะต่ำกว่ากลางต่างกัน 121 เท่า ระหว่างจังหวัดที่มีการแข่งขันต่ำสุดและสูงสุด กลยุทธ์ราคาที่เหมาะสมในสระบุรีและพิจิตรต้องต่างกันอย่างมีนัยสำคัญ',
    table: [
      ['สระบุรี', '0.09%', '273'],
      ['แม่ฮ่องสอน', '0.14%', '50'],
      ['ยโสธร', '0.17%', '122'],
      ['พิจิตร', '10.91%', '163'],
      ['สมุทรสงคราม', '10.26%', '39'],
      ['ปทุมธานี', '5.94%', '300'],
    ],
    headers: ['จังหวัด', 'ส่วนลดมัธยฐาน', 'จำนวนสัญญา'],
    tag: 'ข้อมูลจังหวัด',
    color: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  {
    n: '06',
    stat: '3.28%',
    title: 'โครงการขนาดกลางแข่งขันได้ดีกว่าโครงการขนาดใหญ่',
    body: 'โครงการใหญ่ไม่ได้มีการแข่งขันมากกว่าเสมอไป โครงการขนาด 1–10 ล้านบาทมีการต่อราคาสูงที่สุด ส่วนโครงการเล็กมาก (ต่ำกว่า 1 แสนบาท) และโครงการใหญ่มาก (เกิน 100 ล้านบาท) ต่างเสนอราคาใกล้เต็มราคากลางเหมือนกัน',
    table: [
      ['น้อยกว่า 100,000 บาท', '1,216', '0%'],
      ['100,000–1 ล้านบาท', '5,556', '0.37%'],
      ['1–10 ล้านบาท', '9,708', '3.28%'],
      ['10–100 ล้านบาท', '2,922', '1.74%'],
      ['มากกว่า 100 ล้านบาท', '371', '1.01%'],
    ],
    headers: ['วงเงินโครงการ', 'จำนวนสัญญา', 'ส่วนลดมัธยฐาน'],
    tag: 'ขนาดวงเงิน',
    color: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
];

export default function ResearchPage() {
  const { lang } = useLanguage();
  const isTh = lang === 'th';
  const findings = isTh ? FINDINGS_TH : FINDINGS_EN;

  return (
    <>
      <Header />
      <main className="bg-white min-h-screen">

        {/* Hero */}
        <section className="border-b border-[#E0E0E0] py-16">
          <div className="max-w-3xl mx-auto px-6">
            <p className="text-xs font-bold tracking-widest uppercase text-[#717171] mb-3">
              {isTh ? 'ผลการวิจัย' : 'Research findings'}
            </p>
            <h1 className={`font-black tracking-tight text-[#111111] leading-none mb-5 ${isTh ? 'lang-th text-4xl sm:text-5xl' : 'text-4xl sm:text-5xl'}`}>
              {isTh ? '6 สิ่งที่ข้อมูลจัดซื้อจัดจ้างบอกเรา' : '6 things procurement data reveals.'}
            </h1>
            <p className={`text-[#717171] leading-relaxed max-w-xl mb-6 ${isTh ? 'lang-th text-base' : 'text-lg'}`}>
              {isTh
                ? 'ข้อมูลจาก e-GP ของกรมบัญชีกลาง ครอบคลุม 1,117 หน่วยงาน มูลค่ารวมกว่า 1 ล้านล้านบาท ปีงบประมาณ 2561–2568'
                : 'From Thailand\'s e-GP system, covering 1,117 agencies and over ฿1 trillion in contract value. Fiscal years 2561–2568.'}
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-[#717171]">251,000+ contracts in database</span>
              <span className="text-[#E0E0E0]">·</span>
              <span className="text-[#717171]">19,773 analyzed</span>
              <span className="text-[#E0E0E0]">·</span>
              <span className="text-[#717171]">77 provinces</span>
            </div>
          </div>
        </section>

        {/* Findings */}
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-6 flex flex-col gap-16">
            {findings.map((f) => (
              <article key={f.n} className="flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <span className="text-sm font-bold text-[#C0C0C0] mt-0.5 flex-shrink-0 w-8">{f.n}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${f.color} ${isTh ? 'lang-th' : ''}`}>
                        {f.tag}
                      </span>
                    </div>
                    <p className="text-4xl font-black text-[#111111] tracking-tight mb-1">{f.stat}</p>
                    <h2 className={`text-xl font-bold text-[#111111] leading-snug ${isTh ? 'lang-th' : ''}`}>{f.title}</h2>
                  </div>
                </div>

                {/* Body */}
                <div className="ml-12">
                  <p className={`text-[#444444] leading-relaxed mb-5 ${isTh ? 'lang-th' : ''}`}>{f.body}</p>

                  {/* Bullets */}
                  {'bullets' in f && f.bullets && (
                    <ul className="flex flex-col gap-2 mb-5">
                      {f.bullets.map((b: string) => (
                        <li key={b} className={`flex items-start gap-2 text-sm text-[#444444] ${isTh ? 'lang-th' : ''}`}>
                          <span className="text-[#C0C0C0] mt-1 flex-shrink-0">—</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Table */}
                  {'table' in f && f.table && (
                    <div className="overflow-x-auto rounded-xl border border-[#E0E0E0]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#E0E0E0] bg-[#F7F7F7]">
                            {f.headers!.map((h: string) => (
                              <th key={h} className={`px-4 py-2.5 text-left text-xs font-semibold text-[#717171] ${isTh ? 'lang-th' : ''}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {f.table.map((row: string[], ri: number) => (
                            <tr key={ri} className="border-b border-[#F0F0F0] last:border-0 hover:bg-[#FAFAFA]">
                              {row.map((cell: string, ci: number) => (
                                <td key={ci} className={`px-4 py-2.5 text-[#111111] ${ci === 0 ? 'font-medium' : ''} ${isTh ? 'lang-th' : ''}`}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {f.n !== '06' && <hr className="border-[#F0F0F0]" />}
              </article>
            ))}
          </div>
        </section>

        {/* Methodology + CTA */}
        <section className="border-t border-[#E0E0E0] py-12 bg-[#F7F7F7]">
          <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row gap-8 items-start sm:items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#717171] uppercase tracking-wider mb-2">
                {isTh ? 'วิธีการ' : 'Methodology'}
              </p>
              <p className={`text-sm text-[#717171] leading-relaxed max-w-md ${isTh ? 'lang-th' : ''}`}>
                {isTh
                  ? '20,000 สัญญาจากฐานข้อมูล cgd_contracts กรองเฉพาะสัญญาที่มีราคากลางและราคาตกลงที่ถูกต้อง เหลือ 19,773 รายการ ความผิดปกติใช้ Z-score เทียบกับค่ามัธยฐานของแต่ละหน่วยงาน'
                  : '20,000 contracts sampled from the cgd_contracts collection. Filtered to valid reference + agreed price pairs: 19,773 usable records. Anomalies use agency-level Z-scores vs. agency median.'}
              </p>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Link
                href="/report"
                className={`inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors ${isTh ? 'lang-th' : ''}`}
              >
                {isTh ? 'รายงานผลประมูล' : 'Report a bid outcome'}
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/bidsight"
                className={`inline-flex items-center gap-2 px-5 py-2.5 border border-[#E0E0E0] text-[#111111] text-sm font-medium rounded-lg hover:border-[#111111] transition-colors ${isTh ? 'lang-th' : ''}`}
              >
                {isTh ? 'ลองใช้ Conjuncture' : 'Try Conjuncture Simulator'}
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
