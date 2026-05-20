'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  BarChart3,
  Activity,
  CreditCard,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import OverviewSection from '@/components/dashboard/OverviewSection';
import MyProjectsSection from '@/components/dashboard/MyProjectsSection';
import BidComparisonsSection from '@/components/dashboard/BidComparisonsSection';
import InProgressSection from '@/components/dashboard/InProgressSection';
import PaymentsSection from '@/components/dashboard/PaymentsSection';

type NavKey = 'overview' | 'projects' | 'bids' | 'inprogress' | 'payments';

interface NavItem {
  key: NavKey;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} aria-hidden="true" /> },
  { key: 'projects', label: 'My Projects', icon: <FolderOpen size={16} aria-hidden="true" /> },
  { key: 'bids', label: 'Bid Comparisons', icon: <BarChart3 size={16} aria-hidden="true" /> },
  { key: 'inprogress', label: 'In Progress', icon: <Activity size={16} aria-hidden="true" /> },
  { key: 'payments', label: 'Payments', icon: <CreditCard size={16} aria-hidden="true" /> },
];

function getInitials(name: string) {
  return name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export default function BuyerDashboardPage() {
  const [activeNav, setActiveNav] = useState<NavKey>('overview');

  const userName = 'คุณสมชาย วงศ์สุวรรณ';
  const userInitials = getInitials(userName);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F7]">
      <Header />

      <main className="flex-1">
        <div className="container-app py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">

            <aside className="w-full lg:w-60 flex-shrink-0">
              <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
                <div className="p-5 border-b border-[#E0E0E0]">
                  <div className="flex items-center gap-3">
                    <span className="avatar text-sm" aria-label={userName}>
                      {userInitials}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#111111] truncate">{userName}</p>
                      <p className="text-xs text-[#717171]">Buyer Account</p>
                    </div>
                  </div>
                </div>

                <nav className="p-2" aria-label="Buyer dashboard navigation">
                  {NAV_ITEMS.map((item) => {
                    const isActive = activeNav === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setActiveNav(item.key)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                          isActive
                            ? 'bg-[#111111] text-white'
                            : 'text-[#717171] hover:bg-[#F7F7F7] hover:text-[#111111]'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>

            <div className="flex-1 min-w-0">
              {activeNav === 'overview'   && <OverviewSection />}
              {activeNav === 'projects'   && <MyProjectsSection />}
              {activeNav === 'bids'       && <BidComparisonsSection />}
              {activeNav === 'inprogress' && <InProgressSection />}
              {activeNav === 'payments'   && <PaymentsSection />}
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
