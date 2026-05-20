'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Users, Clock, Banknote } from 'lucide-react';
import type { Project } from '@/lib/mock-data';
import { formatBudget, getInitials } from '@/lib/format';
import StatusPill from './StatusPill';
import VerifiedBadge from './VerifiedBadge';
import { useLanguage } from '@/lib/language-context';
import { getDaysRemaining, computeProjectStatus } from '@/lib/deadline';

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const { t } = useLanguage();
  const daysRemaining = getDaysRemaining(project.deadline);
  const status = computeProjectStatus(project.deadline, project.status);
  const urgentDays = daysRemaining <= 3;

  function categoryLabel(cat: string): string {
    return t(`cat.${cat}`) !== `cat.${cat}` ? t(`cat.${cat}`) : cat;
  }

  return (
    <article className="card-hover flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <span className="badge">{categoryLabel(project.category)}</span>
        <StatusPill status={status} />
      </div>

      <h3 className="font-semibold text-[#111111] text-base leading-snug line-clamp-2">
        {project.title}
      </h3>

      <div className="flex items-center gap-1.5 text-sm text-[#111111] font-medium">
        <Banknote size={15} className="text-[#717171] flex-shrink-0" aria-hidden="true" />
        <span>
          {formatBudget(project.budgetMin)}
          <span className="text-[#717171] font-normal mx-1">–</span>
          {formatBudget(project.budgetMax)}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-1 text-xs text-[#717171]">
          <MapPin size={12} className="flex-shrink-0" aria-hidden="true" />
          <span>{project.location}</span>
        </div>

        <div className="flex items-center gap-1 text-xs text-[#717171]">
          <Users size={12} className="flex-shrink-0" aria-hidden="true" />
          <span>
            {project.bidsReceived}{' '}
            {project.bidsReceived !== 1 ? t('card.bids') : t('card.bid')}
          </span>
        </div>

        <div
          className={`flex items-center gap-1 text-xs font-medium ${
            urgentDays ? 'text-[#C0392B]' : 'text-[#717171]'
          }`}
        >
          <Clock size={12} className="flex-shrink-0" aria-hidden="true" />
          {daysRemaining === 0 ? (
            <span>{t('card.deadlineToday')}</span>
          ) : (
            <span>
              {daysRemaining}
              {t('card.dLeft')}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="avatar text-xs"
          style={{ width: 28, height: 28, fontSize: '0.75rem' }}
          aria-hidden="true"
        >
          {getInitials(project.buyerName)}
        </span>
        <span className="text-sm text-[#717171] truncate flex-1">{project.buyerName}</span>
        {project.buyerVerified && <VerifiedBadge tier="verified" size="sm" />}
      </div>

      <div className="h-px bg-[#E0E0E0]" />

      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/projects/${project.id}`}
          className="text-sm font-medium text-[#111111] hover:text-[#717171] transition-colors duration-150 flex items-center gap-1 whitespace-nowrap"
        >
          {t('card.viewBrief')}
          <span aria-hidden="true">→</span>
        </Link>
        <Link
          href={`/submit-bid/${project.id}`}
          className="btn-primary text-sm py-2 px-4 whitespace-nowrap"
        >
          {t('card.submitBid')}
        </Link>
      </div>
    </article>
  );
}
