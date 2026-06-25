'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart2, TrendingUp, FileText, Building2, ArrowRight, Map } from 'lucide-react';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import ProcurementFeed from '@/components/ProcurementFeed';

const QUICK_ACTIONS = [
  {
    icon: TrendingUp,
    href: '/bidsight',
    titleTh: 'Conjuncture',
    titleEn: 'Conjuncture',
    descTh: 'จำลองราคาประมูลและดูว่าคุณอยู่ที่เปอร์เซ็นไทล์ไหนของตลาด',
    descEn: 'Simulate your bid and see where you stand in the real market distribution.',
    accent: 'border-black bg-black text-white',
    iconColor: 'text-white',
  },
  {
    icon: BarChart2,
    href: '/intelligence',
    titleTh: 'ข้อมูลตลาด',
    titleEn: 'Market Intelligence',
    descTh: 'ส่วนลดมัธยฐาน ดัชนี HHI และโปรไฟล์หน่วยงาน',
    descEn: 'Median discounts, HHI concentration index, and agency profiles.',
    accent: 'border-slate-200 bg-white text-black',
    iconColor: 'text-slate-700',
  },
  {
    icon: Building2,
    href: '/agency',
    titleTh: 'ข้อมูลหน่วยงาน',
    titleEn: 'Agency Intel',
    descTh: 'ดูประวัติการจัดซื้อ ผู้ชนะซ้ำ และส่วนลดเฉลี่ยของแต่ละหน่วยงาน',
    descEn: 'Procurement history, repeat winners, and average discounts per agency.',
    accent: 'border-slate-200 bg-white text-black',
    iconColor: 'text-slate-700',
  },
  {
    icon: Map,
    href: '/plans',
    titleTh: 'แผนจัดซื้อ',
    titleEn: 'Procurement Plans',
    descTh: 'แผนจัดซื้อจัดจ้างล่วงหน้าของหน่วยงานภาครัฐ',
    descEn: 'Upcoming procurement plans published by government agencies.',
    accent: 'border-slate-200 bg-white text-black',
    iconColor: 'text-slate-700',
  },
];


export default function HomePage() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isTh = lang === 'th';

  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F7F7F7]">
        <div className="container-app py-12">

          {/* ── Welcome ── */}
          <div className="mb-10">
            <p className="text-sm text-[#717171] mb-1">
              {isTh ? 'ยินดีต้อนรับกลับ' : 'Welcome back'}
              {firstName ? `, ${firstName}` : ''}
            </p>
            <h1 className="text-2xl font-semibold text-[#111111] tracking-tight">
              {isTh ? 'ข้อมูลพร้อมใช้งาน' : 'Your procurement intelligence'}
            </h1>
          </div>

          {/* ── Quick actions ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className={`group flex flex-col gap-4 p-6 rounded-xl border-2 transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${a.accent}`}
                >
                  <Icon size={22} className={a.iconColor} />
                  <div>
                    <p className={`font-semibold text-sm mb-1 ${a.accent.includes('bg-black') ? 'text-white' : 'text-[#111111]'}`}>
                      {isTh ? a.titleTh : a.titleEn}
                    </p>
                    <p className={`text-xs leading-relaxed ${a.accent.includes('bg-black') ? 'text-white/70' : 'text-[#717171]'} ${isTh ? 'lang-th' : ''}`}>
                      {isTh ? a.descTh : a.descEn}
                    </p>
                  </div>
                  <ArrowRight size={14} className={`mt-auto self-end opacity-0 group-hover:opacity-100 transition-opacity ${a.accent.includes('bg-black') ? 'text-white' : 'text-[#111111]'}`} />
                </Link>
              );
            })}
          </div>

          {/* ── Two column ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Live procurement feed — 2/3 */}
            <div className="lg:col-span-2">
              <ProcurementFeed />
            </div>

            {/* Report CTA — 1/3 */}
            <div className="bg-black rounded-xl p-6 flex flex-col gap-5 justify-between">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-white/60" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-white/40">
                    {isTh ? 'เครือข่ายข้อมูล' : 'Data network'}
                  </span>
                </div>
                <h2 className={`font-bold text-white leading-snug mb-1.5 ${isTh ? 'lang-th text-base' : 'text-base'}`}>
                  {isTh ? 'รายงานผลประมูลของคุณ' : 'Report your bid outcome'}
                </h2>
                <p className={`text-xs text-white/50 leading-relaxed ${isTh ? 'lang-th' : ''}`}>
                  {isTh
                    ? 'ข้อมูล e-GP บันทึกเฉพาะผู้ชนะ ข้อมูลผู้แพ้มีแค่คุณ'
                    : 'e-GP records only winners. Only you have the losing-bid data.'}
                </p>
              </div>

              {/* Loop progress */}
              <div className="flex flex-col gap-5">
                <p className="text-[10px] font-bold tracking-widest uppercase text-white/30">
                  Network loops
                </p>
                {[
                  { n: 20,  label: isTh ? 'ต่อหมวด → blend benchmark' : 'per category → blend benchmark', pct: 4 },
                  { n: 30,  label: isTh ? 'คู่ match → คาด P(win)' : 'matched pairs → P(win) model', pct: 2 },
                  { n: 2,   label: isTh ? 'ต่อหน่วยงาน → flag anomaly' : 'per agency → anomaly flag', pct: 50 },
                ].map((loop) => (
                  <div key={loop.n}>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-sm text-white/70 ${isTh ? 'lang-th' : ''}`}>{loop.label}</span>
                      <span className="text-xs font-bold text-white/40">{loop.n}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all"
                        style={{ width: `${loop.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="border-t border-white/10" />

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl px-4 py-5">
                  <p className="text-3xl font-black text-white">0</p>
                  <p className={`text-xs text-white/40 mt-1 ${isTh ? 'lang-th' : ''}`}>
                    {isTh ? 'ผลที่รายงาน' : 'outcomes reported'}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl px-4 py-5">
                  <p className="text-3xl font-black text-white">–</p>
                  <p className={`text-xs text-white/40 mt-1 ${isTh ? 'lang-th' : ''}`}>
                    {isTh ? 'หมวดที่ใช้งาน' : 'active categories'}
                  </p>
                </div>
              </div>

              {/* CTA */}
              <Link
                href="/report"
                className={`w-full flex items-center justify-center gap-2 py-3.5 bg-white text-black text-sm font-bold rounded-xl hover:bg-slate-100 transition-colors ${isTh ? 'lang-th' : ''}`}
              >
                {isTh ? 'รายงานผลประมูล' : 'Report a bid outcome'}
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* ── Database stats strip ── */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(isTh ? [
              { value: '251,000+', label: 'สัญญาในฐานข้อมูล' },
              { value: '1,117', label: 'หน่วยงานที่วิเคราะห์' },
              { value: '77', label: 'จังหวัด' },
              { value: '฿1.09T', label: 'มูลค่าสัญญารวม' },
            ] : [
              { value: '251,000+', label: 'contracts in database' },
              { value: '1,117', label: 'agencies profiled' },
              { value: '77', label: 'provinces' },
              { value: '฿1.09T', label: 'total contract value' },
            ]).map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-[#E0E0E0] px-5 py-4">
                <p className="text-xl font-black text-[#111111] tracking-tight">{s.value}</p>
                <p className={`text-xs text-[#717171] mt-0.5 ${isTh ? 'lang-th' : ''}`}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
