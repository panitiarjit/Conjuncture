'use client';

import React, { useState } from 'react';
import { Star, CheckCircle2 } from 'lucide-react';
import VerifiedBadge from '@/components/ui/VerifiedBadge';

const COMPARISON_VENDORS = [
  {
    id: 'vendor-001',
    name: 'Thai Tech Solutions Co., Ltd.',
    verified: 'verified_pro' as const,
    price: '฿2,450,000',
    timeline: '45 days',
    rating: 4.9,
    message:
      'We have delivered 12 similar hotel IT infrastructure projects across Thailand. Our team includes 3 senior network engineers and a dedicated project manager...',
  },
  {
    id: 'vendor-006',
    name: 'Meridian Consulting Group',
    verified: 'verified' as const,
    price: '฿2,200,000',
    timeline: '50 days',
    rating: 4.8,
    message:
      'Our proposal covers full system design, hardware procurement, installation, and 12-month support. We offer the most competitive warranty package...',
  },
  {
    id: 'vendor-002',
    name: 'PS Construction & Engineering',
    verified: 'verified' as const,
    price: '฿2,700,000',
    timeline: '40 days',
    rating: 4.7,
    message:
      'We can complete the project in 40 days with our dedicated IT division. Price includes all cabling, access points, and CCTV hardware...',
  },
];

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={12}
          className={i <= Math.round(rating) ? 'star-filled' : 'star-empty'}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export default function BidComparisonsSection() {
  const [selected, setSelected] = useState<string | null>(null);
  const projectName = 'IT Infrastructure — 5-Star Hotel Chiang Mai';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[#111111]">Bid Comparisons</h2>
        <div className="mt-3 flex items-center gap-3">
          <label htmlFor="project-select" className="text-sm text-[#717171] flex-shrink-0">
            Project:
          </label>
          <select
            id="project-select"
            className="input max-w-xs text-sm"
            defaultValue={projectName}
          >
            <option>{projectName}</option>
            <option>Office Renovation — Silom</option>
            <option>Mobile App Development</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COMPARISON_VENDORS.map((v) => {
          const isSelected = selected === v.id;
          return (
            <div
              key={v.id}
              className={`card flex flex-col gap-4 cursor-pointer transition-all duration-150 ${
                isSelected ? 'border-[#2D6A4F] shadow-md ring-1 ring-[#2D6A4F]' : ''
              }`}
              onClick={() => setSelected(isSelected ? null : v.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#111111] text-sm leading-snug">{v.name}</p>
                  <div className="mt-1">
                    <VerifiedBadge tier={v.verified} size="sm" />
                  </div>
                </div>
                {isSelected && (
                  <CheckCircle2 size={18} className="text-[#2D6A4F] flex-shrink-0" aria-label="Selected" />
                )}
              </div>

              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#717171]">Proposed Price</span>
                  <span className="font-semibold text-[#111111]">{v.price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#717171]">Timeline</span>
                  <span className="text-[#111111]">{v.timeline}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#717171]">Rating</span>
                  <span className="flex items-center gap-1.5">
                    <StarRow rating={v.rating} />
                    <span className="text-xs font-medium text-[#111111]">{v.rating}</span>
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#717171] leading-relaxed line-clamp-3 italic border-t border-[#E0E0E0] pt-3">
                "{v.message}"
              </p>

              <button
                className={`btn-primary text-sm w-full ${isSelected ? 'opacity-100' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(v.id);
                }}
              >
                Accept Bid
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
