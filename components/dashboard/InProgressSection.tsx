'use client';

import React from 'react';
import { Lock, CheckCircle2, Circle } from 'lucide-react';
import { MILESTONE_COLORS, type MilestoneStatus } from '@/lib/theme';

function MilestoneStep({
  label,
  status,
  isLast,
}: {
  label: string;
  status: MilestoneStatus;
  isLast?: boolean;
}) {
  const c = MILESTONE_COLORS[status];
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${c.ring}`}>
          {status === 'complete' ? (
            <CheckCircle2 size={16} className="text-white" aria-hidden="true" />
          ) : status === 'active' ? (
            <Circle size={10} className="text-white fill-white" aria-hidden="true" />
          ) : (
            <Circle size={10} className="text-[#717171]" aria-hidden="true" />
          )}
        </div>
        {!isLast && <div className={`w-0.5 h-8 mt-1 ${c.line}`} />}
      </div>
      <div className="pt-1">
        <p className={`text-sm font-medium ${c.text}`}>{label}</p>
        <p className="text-xs text-[#717171] mt-0.5">
          {status === 'complete' ? 'Completed' : status === 'active' ? 'In Progress' : 'Pending'}
        </p>
      </div>
    </div>
  );
}

export default function InProgressSection() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-[#111111]">In Progress</h2>

      <div className="card flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-[#111111]">
              Landscape Renovation — Phuket Residential Complex
            </h3>
            <p className="text-sm text-[#717171] mt-1">
              Started: 1 May 2025 &nbsp;·&nbsp; Vendor: PS Construction & Engineering
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 badge badge-warning px-3 py-1.5 text-sm">
            <Lock size={13} aria-hidden="true" />
            ฿300,000 in Escrow
          </span>
        </div>

        <div>
          <h4 className="text-sm font-medium text-[#717171] uppercase tracking-wide mb-4">
            Milestones
          </h4>
          <div className="flex flex-col">
            <MilestoneStep label="Contract Signed" status="complete" />
            <MilestoneStep label="Work in Progress" status="active" />
            <MilestoneStep label="Final Delivery" status="pending" isLast />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-4 border-t border-[#E0E0E0]">
          <button className="btn-primary">Release Payment</button>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#C0392B] text-[#C0392B] text-sm font-medium bg-transparent hover:bg-[#FDE8E8] transition-colors duration-150">
            Raise Dispute
          </button>
        </div>
      </div>
    </div>
  );
}
