'use client';
import { useProtectedRoute } from '@/lib/use-protected-route';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  BarChart3,
  Activity,
  CreditCard,
  Lock,
  Star,
  CheckCircle2,
  Circle,
  Clock3,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import StatusPill from '@/components/ui/StatusPill';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { PROJECTS, VENDORS } from '@/lib/mock-data';
import { getDaysRemaining } from '@/lib/deadline';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavKey = 'overview' | 'projects' | 'bids' | 'inprogress' | 'payments';

interface NavItem {
  key: NavKey;
  label: string;
  icon: React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBudget(n: number) {
  return '฿' + n.toLocaleString('th-TH');
}

function getInitials(name: string) {
  return name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

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

// ─── Mock data ────────────────────────────────────────────────────────────────

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

const MOCK_PAYMENT_ROWS = [
  { date: '15 May 2025', project: 'Landscape Renovation — Phuket', vendor: 'PS Construction', amount: '฿300,000', status: 'Released' },
  { date: '10 May 2025', project: 'Mobile App Development', vendor: 'Thai Tech Solutions', amount: '฿200,000', status: 'In Escrow' },
  { date: '2 May 2025', project: 'Drip Irrigation — Chanthaburi', vendor: 'Agri Smart Solutions', amount: '฿125,000', status: 'Released' },
  { date: '24 Apr 2025', project: 'Logistics Contract — Chonburi', vendor: 'Greenline Logistics', amount: '฿90,000', status: 'Released' },
  { date: '15 Apr 2025', project: 'Financial Consulting', vendor: 'Meridian Consulting', amount: '฿60,000', status: 'Released' },
];

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

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function OverviewSection() {
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

function MyProjectsSection() {
  const projects = PROJECTS.slice(0, 4);
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

function BidComparisonsSection() {
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

type MilestoneStatus = 'complete' | 'active' | 'pending';

function MilestoneStep({
  label,
  status,
  isLast,
}: {
  label: string;
  status: MilestoneStatus;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            status === 'complete'
              ? 'bg-[#2D6A4F]'
              : status === 'active'
              ? 'bg-[#1D4ED8]'
              : 'bg-[#E0E0E0]'
          }`}
        >
          {status === 'complete' ? (
            <CheckCircle2 size={16} className="text-white" aria-hidden="true" />
          ) : status === 'active' ? (
            <Circle size={10} className="text-white fill-white" aria-hidden="true" />
          ) : (
            <Circle size={10} className="text-[#717171]" aria-hidden="true" />
          )}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 h-8 mt-1 ${
              status === 'complete' ? 'bg-[#2D6A4F]' : 'bg-[#E0E0E0]'
            }`}
          />
        )}
      </div>
      <div className="pt-1">
        <p
          className={`text-sm font-medium ${
            status === 'complete'
              ? 'text-[#2D6A4F]'
              : status === 'active'
              ? 'text-[#1D4ED8]'
              : 'text-[#717171]'
          }`}
        >
          {label}
        </p>
        <p className="text-xs text-[#717171] mt-0.5">
          {status === 'complete' ? 'Completed' : status === 'active' ? 'In Progress' : 'Pending'}
        </p>
      </div>
    </div>
  );
}

function InProgressSection() {
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

        {/* Milestone tracker */}
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

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-[#E0E0E0]">
          <button className="btn-primary">Release Payment</button>
          <button
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#C0392B] text-[#C0392B] text-sm font-medium bg-transparent hover:bg-[#FDE8E8] transition-colors duration-150"
          >
            Raise Dispute
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentsSection() {
  const statusClass = (s: string) => {
    if (s === 'Released') return 'badge badge-success';
    if (s === 'In Escrow') return 'badge badge-warning';
    return 'badge';
  };

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

// ─── Page ─────────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} aria-hidden="true" /> },
  { key: 'projects', label: 'My Projects', icon: <FolderOpen size={16} aria-hidden="true" /> },
  { key: 'bids', label: 'Bid Comparisons', icon: <BarChart3 size={16} aria-hidden="true" /> },
  { key: 'inprogress', label: 'In Progress', icon: <Activity size={16} aria-hidden="true" /> },
  { key: 'payments', label: 'Payments', icon: <CreditCard size={16} aria-hidden="true" /> },
];

export default function BuyerDashboardPage() {
  const { isAuthenticated, isLoading } = useProtectedRoute();
  const [activeNav, setActiveNav] = useState<NavKey>('overview');
  if (isLoading || !isAuthenticated) return null;

  // Mock logged-in buyer
  const userName = 'คุณสมชาย วงศ์สุวรรณ';
  const userInitials = getInitials(userName);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F7]">
      <Header />

      <main className="flex-1">
        <div className="container-app py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">

            {/* ── Sidebar ── */}
            <aside className="w-full lg:w-60 flex-shrink-0">
              <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
                {/* User identity */}
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

                {/* Nav */}
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

            {/* ── Main content ── */}
            <div className="flex-1 min-w-0">
              {activeNav === 'overview' && <OverviewSection />}
              {activeNav === 'projects' && <MyProjectsSection />}
              {activeNav === 'bids' && <BidComparisonsSection />}
              {activeNav === 'inprogress' && <InProgressSection />}
              {activeNav === 'payments' && <PaymentsSection />}
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
