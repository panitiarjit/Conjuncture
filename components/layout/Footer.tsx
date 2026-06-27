'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/language-context';
import { ContributorStats } from '@/components/ContributorStats';

const LINK_GROUPS = [
  {
    headingEn: 'Data',
    headingTh: 'ข้อมูล',
    links: [
      { labelEn: 'Bid Simulator', labelTh: 'จำลองราคาประมูล', href: '/bidtool' },
      { labelEn: 'Market Intelligence', labelTh: 'ข้อมูลตลาด', href: '/intelligence' },
      { labelEn: 'Agency Intel', labelTh: 'ข้อมูลหน่วยงาน', href: '/agency' },
      { labelEn: 'Procurement Plans', labelTh: 'แผนจัดซื้อ', href: '/plans' },
    ],
  },
  {
    headingEn: 'Community',
    headingTh: 'ชุมชน',
    links: [
      { labelEn: 'Report a bid outcome', labelTh: 'รายงานผลประมูล', href: '/report' },
      { labelEn: 'Research findings', labelTh: 'ผลการวิจัย', href: '/research' },
      { labelEn: 'Anomaly reports', labelTh: 'รายงานผิดปกติ', href: '/report' },
    ],
  },
];

export default function Footer() {
  const { lang } = useLanguage();
  const isTh = lang === 'th';

  return (
    <footer className="bg-white border-t border-[#E0E0E0]">
      <div className="container-app py-8">
        <ContributorStats />
        <div className="flex flex-wrap gap-12">
          {/* Brand */}
          <div className="min-w-[180px]">
            <Link
              href="/"
              className="inline-flex items-center gap-2 focus-ring rounded-md"
              aria-label="Conjuncture home"
            >
              <span className="text-[#111111] text-lg font-semibold tracking-tight">CONJUNCTURE</span>
              <span className="text-[#E0E0E0]" aria-hidden="true">•</span>
              <span className="text-base" aria-label="Thailand">🇹🇭</span>
            </Link>
            <p className={`mt-3 text-sm text-[#717171] leading-relaxed max-w-[220px] ${isTh ? 'lang-th' : ''}`}>
              {isTh
                ? 'ข้อมูลจัดซื้อจัดจ้างภาครัฐไทย\nใช้งานได้จริง'
                : 'Thai procurement data,\nmade usable.'}
            </p>
            <p className="mt-4 text-xs text-[#B0B0B0]">
              251,000+ contracts · e-GP · FY2559–2568
            </p>
          </div>

          {/* Link groups — clustered together, left-aligned */}
          <div className="flex gap-12">
            {LINK_GROUPS.map((group) => (
              <div key={group.headingEn}>
                <h3 className="text-xs font-semibold text-[#111111] uppercase tracking-wider mb-4">
                  {isTh ? group.headingTh : group.headingEn}
                </h3>
                <ul className="flex flex-col gap-2.5" role="list">
                  {group.links.map((link) => (
                    <li key={link.href + link.labelEn}>
                      <Link
                        href={link.href}
                        className={`text-sm text-[#717171] hover:text-[#111111] transition-colors duration-150 focus-ring rounded ${isTh ? 'lang-th' : ''}`}
                      >
                        {isTh ? link.labelTh : link.labelEn}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[#E0E0E0]">
        <div className="container-app py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#717171]">
              © {new Date().getFullYear()} Conjuncture Co., Ltd. · Bangkok, Thailand
            </p>
            <p className="text-xs text-[#717171]">
              Data sourced from Thailand's e-GP system (กรมบัญชีกลาง) · Public domain
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
