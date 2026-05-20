'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, CalendarDays, MapPin } from 'lucide-react';
import type { Tender } from '@/lib/mock-data';
import { formatBudget, formatDate } from '@/lib/format';
import { getProcurementMethod, type ProcurementMethod } from '@/lib/procurement';
import StatusPill from './StatusPill';
import { useLanguage } from '@/lib/language-context';
import { computeTenderStatus } from '@/lib/deadline';

interface TenderCardProps {
  tender: Tender;
}

export default function TenderCard({ tender }: TenderCardProps) {
  const { t } = useLanguage();
  const status = computeTenderStatus(tender.deadline);
  const isClosingSoon = status === 'closing_soon';
  const method: ProcurementMethod = getProcurementMethod(tender.budget);

  function categoryLabel(cat: string): string {
    return t(`cat.${cat}`) !== `cat.${cat}` ? t(`cat.${cat}`) : cat;
  }

  const methodColors: Record<ProcurementMethod, string> = {
    specific_simple: 'bg-[#D8F3DC] text-[#2D6A4F] border-[#B7E4C7]',
    specific_compare: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
    e_bidding: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  };

  return (
    <article className="card-hover flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <span className="badge">{categoryLabel(tender.category)}</span>
        <StatusPill status={status} />
      </div>

      <h3 className="font-semibold text-[#111111] text-base leading-snug line-clamp-2">
        {tender.title}
      </h3>

      <div className="flex items-center gap-1.5 text-sm text-[#717171]">
        <Building2 size={14} className="flex-shrink-0" aria-hidden="true" />
        <span className="truncate">{tender.agency}</span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#717171] font-medium uppercase tracking-wide">
            {t('card.budget')}
          </span>
          <span className="text-sm font-semibold text-[#111111]">{formatBudget(tender.budget)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-[#717171] font-medium uppercase tracking-wide">
            {t('pm.method')}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${methodColors[method]}`}>
            {t(`pm.${method}`)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[#717171]">
            <CalendarDays size={13} className="flex-shrink-0" aria-hidden="true" />
            <span>{t('card.deadline')}</span>
          </div>
          <span className={`text-sm font-medium ${isClosingSoon ? 'text-[#B45309]' : 'text-[#111111]'}`}>
            {formatDate(tender.deadline)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[#717171]">
            <MapPin size={13} className="flex-shrink-0" aria-hidden="true" />
            <span>{t('card.region')}</span>
          </div>
          <span className="text-sm text-[#111111]">{tender.region}</span>
        </div>
      </div>

      <div className="h-px bg-[#E0E0E0]" />

      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/tenders/${tender.id}`}
          className="text-sm font-medium text-[#111111] hover:text-[#717171] transition-colors duration-150 flex items-center gap-1 whitespace-nowrap"
        >
          {t('card.viewDetails')}
          <span aria-hidden="true">→</span>
        </Link>
        <Link
          href={`/assisted-submission/${tender.id}`}
          className="btn-primary text-sm py-2 px-4 whitespace-nowrap"
        >
          {t('card.apply')}
        </Link>
      </div>
    </article>
  );
}
