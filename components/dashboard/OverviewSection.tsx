'use client';

import React from 'react';
import { CheckCircle2, Clock3, Activity } from 'lucide-react';

const ACTIVITY_ITEMS = [
  {
    icon: <CheckCircle2 size={16} className="text-[#2D6A4F]" aria-hidden="true" />,
    text: 'Vendor Thai Tech Solutions submitted a bid on your IT project.',
    time: '2 hours ago',
  },
  {
    icon: <Clock3 size={16} className="text-[#B45309]" aria-hidden="true" />,
    text: 'Project "Office Renovation — Silom" is closing in 12 days.',
    time: '5 hours ago',
  },
  {
    icon: <Activity size={16} className="text-[#1D4ED8]" aria-hidden="true" />,
    text: 'Milestone 1 "Contract Signed" marked complete by Greenline Logistics.',
    time: 'Yesterday',
  },
];

export default function OverviewSection() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold text-[#111111] mb-5">Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Projects', value: '3' },
            { label: 'Pending Bids', value: '12' },
            { label: 'In Progress', value: '1' },
            { label: 'Completed', value: '8' },
          ].map((stat) => (
            <div key={stat.label} className="card text-center">
              <p className="text-3xl font-semibold text-[#111111]">{stat.value}</p>
              <p className="text-sm text-[#717171] mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-[#111111] mb-4">Recent Activity</h3>
        <div className="flex flex-col gap-0 border border-[#E0E0E0] rounded-xl overflow-hidden">
          {ACTIVITY_ITEMS.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-5 py-4 bg-white border-b border-[#E0E0E0] last:border-0"
            >
              <span className="mt-0.5 flex-shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#111111]">{item.text}</p>
                <p className="text-xs text-[#717171] mt-0.5">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
