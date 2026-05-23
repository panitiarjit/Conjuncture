'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, MapPin } from 'lucide-react';
import type { Tender } from '@/lib/types';
import { getTenderPresentation } from '@/lib/tender-presentation';
import StatusPill from './StatusPill';
import { useLanguage } from '@/lib/language-context';

interface TenderCardProps {
  tender: Tender;
}

export default function TenderCard({ tender }: TenderCardProps) {
  const { t } = useLanguage();
  const p = getTenderPresentation(tender, t);

  return (
    <article className="card-hover flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <span className="badge">{p.categoryLabel}</span>
        <StatusPill status={p.status} />
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
          <span className="text-sm font-semibold text-[#111111]">{p.formattedBudget}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[#717171] font-medium uppercase tracking-wide flex-shrink-0">
            {t('pm.method')}
          </span>
          <span className={`text-xs font-medium px-2 py-1 rounded-lg border text-center max-w-[52%] ${p.methodBadgeClass}`}>
            {t(`pm.${p.procurementMethod}`)}
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
