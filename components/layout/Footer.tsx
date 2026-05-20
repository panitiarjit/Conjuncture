'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/language-context';

export default function Footer() {
  const { t } = useLanguage();

  const LINK_GROUPS = [
    {
      heading: t('footer.platform'),
      links: [
        { label: t('footer.browseTenders'), href: '/tenders' },
        { label: t('footer.browseProjects'), href: '/projects' },
        { label: t('footer.postProject'), href: '/post-project' },
        { label: t('footer.howItWorks'), href: '/' },
      ],
    },
    {
      heading: t('footer.vendors'),
      links: [
        { label: t('footer.createProfile'), href: '/auth/signup' },
        { label: t('footer.submitBid'), href: '/projects' },
        { label: t('footer.govTenders'), href: '/tenders' },
        { label: t('footer.vendorDash'), href: '/dashboard/vendor' },
      ],
    },
    {
      heading: t('footer.company'),
      links: [
        { label: t('footer.about'), href: '/' },
        { label: t('footer.trust'), href: '/' },
        { label: t('footer.terms'), href: '#' },
        { label: t('footer.privacy'), href: '#' },
      ],
    },
  ];

  return (
    <footer className="bg-white border-t border-[#E0E0E0]">
      <div className="container-app py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/home"
              className="inline-flex items-center gap-2 focus-ring rounded-md"
              aria-label="Conjuncture home"
            >
              <span className="text-[#111111] text-lg font-semibold tracking-tight">CONJUNCTURE</span>
              <span className="text-[#E0E0E0]" aria-hidden="true">•</span>
              <span className="text-base" aria-label="Thailand">🇹🇭</span>
            </Link>
            <p className="mt-3 text-sm text-[#717171] leading-relaxed max-w-[220px]">
              {t('footer.tagline1')}{' '}
              <br />
              {t('footer.tagline2')}
            </p>
          </div>

          {LINK_GROUPS.map((group) => (
            <div key={group.heading}>
              <h3 className="text-xs font-semibold text-[#111111] uppercase tracking-wider mb-4">
                {group.heading}
              </h3>
              <ul className="flex flex-col gap-2.5" role="list">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#717171] hover:text-[#111111] transition-colors duration-150 focus-ring rounded"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#E0E0E0]">
        <div className="container-app py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#717171]">
              &copy; 2025 Conjuncture Co., Ltd. &nbsp;|&nbsp; Bangkok, Thailand
            </p>
            <p className="text-xs text-[#717171]">
              {t('footer.regulated')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
