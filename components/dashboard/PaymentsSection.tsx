'use client';

import React from 'react';

const MOCK_PAYMENT_ROWS = [
  { date: '15 May 2025', project: 'Landscape Renovation — Phuket', vendor: 'PS Construction', amount: '฿300,000', status: 'Released' },
  { date: '10 May 2025', project: 'Mobile App Development', vendor: 'Thai Tech Solutions', amount: '฿200,000', status: 'In Escrow' },
  { date: '2 May 2025', project: 'Drip Irrigation — Chanthaburi', vendor: 'Agri Smart Solutions', amount: '฿125,000', status: 'Released' },
  { date: '24 Apr 2025', project: 'Logistics Contract — Chonburi', vendor: 'Greenline Logistics', amount: '฿90,000', status: 'Released' },
  { date: '15 Apr 2025', project: 'Financial Consulting', vendor: 'Meridian Consulting', amount: '฿60,000', status: 'Released' },
];

function statusClass(s: string) {
  if (s === 'Released') return 'badge badge-success';
  if (s === 'In Escrow') return 'badge badge-warning';
  return 'badge';
}

export default function PaymentsSection() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-[#111111]">Payments</h2>

      <div className="border border-[#E0E0E0] rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E0E0E0] bg-[#F7F7F7]">
                <th className="text-left px-5 py-3 font-medium text-[#717171]">Date</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Project</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Vendor</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PAYMENT_ROWS.map((row, i) => (
                <tr key={i} className="border-b border-[#E0E0E0] last:border-0 hover:bg-[#F7F7F7] transition-colors">
                  <td className="px-5 py-3.5 text-[#717171]">{row.date}</td>
                  <td className="px-4 py-3.5 text-[#111111] font-medium">{row.project}</td>
                  <td className="px-4 py-3.5 text-[#717171]">{row.vendor}</td>
                  <td className="px-4 py-3.5 text-[#111111] font-medium">{row.amount}</td>
                  <td className="px-4 py-3.5">
                    <span className={statusClass(row.status)}>{row.status}</span>
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
