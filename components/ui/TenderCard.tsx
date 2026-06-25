'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, MapPin, Bookmark, BookmarkCheck } from 'lucide-react';
import type { Tender } from '@/lib/types';
import { getTenderPresentation } from '@/lib/tender-presentation';
import StatusPill from './StatusPill';
import { useLanguage } from '@/lib/language-context';
import { useBookmarks } from '@/lib/use-bookmarks';

interface TenderCardProps {
  tender: Tender;
}

export default function TenderCard({ tender }: TenderCardProps) {
  const { t } = useLanguage();
  const p = getTenderPresentation(tender, t);
  const { isBookmarked, toggle } = useBookmarks();
  const saved = isBookmarked(tender.id);

  return (
    <article className="card-hover flex flex-col gap-4">
      {/* Top row: category + type badges left, status + bookmark right */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 items-center min-w-0">
          <span className="badge">{p.categoryLabel}</span>
          <span className="inline-flex items-center text-xs font-medium px-2.5 py-[3px] rounded-full border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] whitespace-nowrap">
            {p.typeBadgeLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => toggle(tender.id)}
            aria-label={saved ? 'Remove bookmark' : 'Bookmark this tender'}
            className={`p-1.5 rounded-lg transition-colors duration-150 ${
              saved
                ? 'text-[#1E3A5F] bg-[#EFF6FF] hover:bg-[#DBEAFE]'
                : 'text-[#717171] hover:text-[#111111] hover:bg-[#F7F7F7]'
            }`}
          >
            {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          </button>
          <StatusPill status={p.status} />
        </div>
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

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#717171] font-medium flex-shrink-0">
            {t('pm.method.short')}
          </span>
          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${p.methodBadgeClass}`}>
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

      <div className="mt-auto h-px bg-[#E0E0E0]" />

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
