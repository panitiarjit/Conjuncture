'use client';

import React, { useState, useEffect } from 'react';
import StatusPill from '@/components/ui/StatusPill';
import { getProjects } from '@/lib/data-service-client';
import { getDaysRemaining } from '@/lib/deadline';

export default function MyProjectsSection() {
  const [projects, setProjects] = useState<import('@/lib/types').Project[]>([]);
  useEffect(() => {
    getProjects().then((d) => setProjects(d.slice(0, 4)));
  }, []);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-[#111111]">My Projects</h2>
        <button className="btn-primary text-sm py-2 px-4">Post New Project</button>
      </div>

      <div className="border border-[#E0E0E0] rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E0E0E0] bg-[#F7F7F7]">
                <th className="text-left px-5 py-3 font-medium text-[#717171]">Project</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Category</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Status</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Bids</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Closes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-[#E0E0E0] last:border-0 hover:bg-[#F7F7F7] transition-colors">
                  <td className="px-5 py-4 font-medium text-[#111111] max-w-[220px]">
                    <span className="line-clamp-1">{p.title}</span>
                  </td>
                  <td className="px-4 py-4 text-[#717171] capitalize">{p.category}</td>
                  <td className="px-4 py-4">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="px-4 py-4 text-[#111111]">{p.bidsReceived}</td>
                  <td className="px-4 py-4 text-[#717171]">
                    {getDaysRemaining(p.deadline) === 0 ? 'Today' : `${getDaysRemaining(p.deadline)}d`}
                  </td>
                  <td className="px-4 py-4">
                    <button className="btn-outline text-xs py-1.5 px-3">View Bids</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
