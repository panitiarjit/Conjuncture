'use client';

import React from 'react';
import { Building2, Calendar, ExternalLink, Trophy } from 'lucide-react';
import type { SoeTender } from '@/lib/types';

const SOURCE_STYLES: Record<string, string> = {
  BMA:  'bg-blue-50 text-blue-700 border-blue-200',
  MEA:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  PEA:  'bg-orange-50 text-orange-700 border-orange-200',
  EGAT: 'bg-purple-50 text-purple-700 border-purple-200',
  PTT:  'bg-red-50 text-red-700 border-red-200',
  PWA:  'bg-green-50 text-green-700 border-green-200',
  MRTA: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const SOURCE_NAMES: Record<string, string> = {
  BMA:  'กรุงเทพมหานคร',
  MEA:  'กฟน.',
  PEA:  'กฟภ.',
  EGAT: 'กฟผ.',
  PTT:  'ปตท.',
  PWA:  'กปภ.',
  MRTA: 'รฟม.',
};

function fmtBudget(n?: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString('th-TH')}`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

interface Props {
  tender: SoeTender;
}

export default function SoeTenderCard({ tender }: Props) {
  const sourceCls = SOURCE_STYLES[tender.source] ?? 'bg-gray-50 text-gray-700 border-gray-200';
  const sourceName = SOURCE_NAMES[tender.source] ?? tender.source;
  const isAwarded = tender.status === 'awarded';
  const dateLabel = isAwarded ? tender.award_date : tender.submission_deadline;
  const datePrefix = isAwarded ? 'ได้รับการคัดเลือก' : 'ปิดรับ';

  return (
    <article className="card-hover flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-[3px] rounded-full border ${sourceCls}`}>
            {tender.source}
          </span>
          <span className="text-xs text-[#717171]">{sourceName}</span>
        </div>
        <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-[3px] rounded-full border ${
          isAwarded
            ? 'bg-gray-50 text-gray-500 border-gray-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          {isAwarded ? 'ประกาศผล' : 'เปิดรับ'}
        </span>
      </div>

      <h3 className="font-semibold text-[#111111] text-base leading-snug line-clamp-2">
        {tender.title}
      </h3>

      {tender.department && (
        <div className="flex items-center gap-1.5 text-sm text-[#717171]">
          <Building2 size={14} className="flex-shrink-0" />
          <span className="truncate">{tender.department}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#717171] font-medium uppercase tracking-wide">วงเงิน</span>
          <span className="text-sm font-semibold text-[#111111]">{fmtBudget(tender.budget)}</span>
        </div>

        {isAwarded && tender.winner_name && (
          <div className="flex items-start gap-1.5">
            <Trophy size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-[#444] leading-snug line-clamp-2">{tender.winner_name}</span>
          </div>
        )}

        {dateLabel && (
          <div className="flex items-center gap-1.5 text-xs text-[#717171]">
            <Calendar size={13} className="flex-shrink-0" />
            <span>{datePrefix} {fmtDate(dateLabel)}</span>
          </div>
        )}
      </div>

      <div className="mt-auto h-px bg-[#E0E0E0]" />

      <div className="flex items-center justify-end">
        {tender.announcement_url ? (
          <a
            href={tender.announcement_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-[#1E3A5F] hover:text-[#2a4f7f] transition-colors"
          >
            ดูประกาศ
            <ExternalLink size={13} />
          </a>
        ) : (
          <span className="text-sm text-[#B0B0B0]">ไม่มีลิงก์</span>
        )}
      </div>
    </article>
  );
}
