'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Search,
  FileText,
  Building2,
  TrendingUp,
  FolderOpen,
  Info,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Upload,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import StatusPill from '@/components/ui/StatusPill';
import ProjectCard from '@/components/ui/ProjectCard';
import { getTenders, getProjects } from '@/lib/data-service';
import { computeTenderStatus } from '@/lib/deadline';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavKey = 'overview' | 'projects' | 'mybids' | 'tenders' | 'earnings' | 'documents';

interface NavItem {
  key: NavKey;
  label: string;
  icon: React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function formatBudget(n: number) {
  return '฿' + n.toLocaleString('th-TH');
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const RECENT_BIDS = [
  { project: 'IT Infrastructure — 5-Star Hotel Chiang Mai', amount: '฿2,450,000', status: 'Under Consideration' },
  { project: 'Mobile App Development — Food Ordering', amount: '฿420,000', status: 'Pending Review' },
  { project: 'ERP System Integration — Manufacturing', amount: '฿890,000', status: 'Accepted' },
];

const MY_BIDS_TABLE = [
  { project: 'IT Infrastructure — Chiang Mai Hotel', category: 'Technology', amount: '฿2,450,000', timeline: '45 days', status: 'Under Consideration', submitted: '12 May 2025' },
  { project: 'Mobile App — Food Platform', category: 'Technology', amount: '฿420,000', timeline: '60 days', status: 'Pending Review', submitted: '8 May 2025' },
  { project: 'ERP Integration — Manufacturing', category: 'Technology', amount: '฿890,000', timeline: '30 days', status: 'Accepted', submitted: '2 May 2025' },
  { project: 'Office IT Setup — Silom Tower', category: 'Technology', amount: '฿185,000', timeline: '14 days', status: 'Declined', submitted: '28 Apr 2025' },
  { project: 'Data Centre Migration', category: 'Technology', amount: '฿1,200,000', timeline: '90 days', status: 'Pending Review', submitted: '20 Apr 2025' },
];

const EARNINGS_TRANSACTIONS = [
  { date: '15 May 2025', project: 'ERP System Integration', amount: '฿890,000', fee: '฿44,500', net: '฿845,500', status: 'Paid' },
  { date: '10 Apr 2025', project: 'Cloud Infrastructure Setup', amount: '฿350,000', fee: '฿17,500', net: '฿332,500', status: 'Paid' },
  { date: '25 Mar 2025', project: 'Mobile App Phase 1', amount: '฿210,000', fee: '฿10,500', net: '฿199,500', status: 'Paid' },
  { date: '1 Mar 2025', project: 'Network Security Audit', amount: '฿95,000', fee: '฿4,750', net: '฿90,250', status: 'Paid' },
  { date: '14 Feb 2025', project: 'Server Room Renovation', amount: '฿180,000', fee: '฿9,000', net: '฿171,000', status: 'Paid' },
];

const DOCUMENT_SLOTS = [
  { name: 'Company Registration (หนังสือรับรองบริษัท)', uploaded: true },
  { name: 'Tax ID Certificate (ใบทะเบียนภาษี)', uploaded: true },
  { name: 'Financial Statements (2 years)', uploaded: false },
  { name: "Director's ID Copy (สำเนาบัตรประชาชนกรรมการ)", uploaded: true },
  { name: 'Portfolio of Completed Projects', uploaded: false },
];

const TENDER_MATCHES = getTenders().filter((t) =>
  ['technology', 'consulting'].includes(t.category)
).slice(0, 4);

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function OverviewSection() {
  const bidStatusClass = (s: string) => {
    if (s === 'Accepted') return 'badge badge-success';
    if (s === 'Under Consideration') return 'badge badge-warning';
    if (s === 'Declined') return 'badge badge-destructive';
    return 'badge';
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold text-[#111111] mb-5">Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Bids', value: '4' },
            { label: 'Won Projects', value: '2' },
            { label: 'Pending Earnings', value: '฿45,000' },
            { label: 'Total Earned', value: '฿280,000' },
          ].map((stat) => (
            <div key={stat.label} className="card text-center">
              <p className="text-2xl font-semibold text-[#111111]">{stat.value}</p>
              <p className="text-sm text-[#717171] mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-[#111111] mb-4">Recent Bids</h3>
        <div className="flex flex-col gap-0 border border-[#E0E0E0] rounded-xl overflow-hidden bg-white">
          {RECENT_BIDS.map((bid, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#E0E0E0] last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#111111] truncate">{bid.project}</p>
                <p className="text-xs text-[#717171] mt-0.5">{bid.amount}</p>
              </div>
              <span className={bidStatusClass(bid.status)}>{bid.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AvailableProjectsSection() {
  const openProjects = getProjects().filter((p) => p.status === 'open');
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-[#111111]">Available Projects</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {openProjects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
}

function MyBidsSection() {
  const bidStatusClass = (s: string) => {
    if (s === 'Accepted') return 'badge badge-success';
    if (s === 'Under Consideration') return 'badge badge-warning';
    if (s === 'Declined') return 'badge badge-destructive';
    return 'badge';
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-[#111111]">My Bids</h2>

      <div className="border border-[#E0E0E0] rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E0E0E0] bg-[#F7F7F7]">
                <th className="text-left px-5 py-3 font-medium text-[#717171]">Project</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Category</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Bid Amount</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Timeline</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Status</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {MY_BIDS_TABLE.map((row, i) => (
                <tr key={i} className="border-b border-[#E0E0E0] last:border-0 hover:bg-[#F7F7F7] transition-colors">
                  <td className="px-5 py-3.5 font-medium text-[#111111] max-w-[200px]">
                    <span className="line-clamp-1">{row.project}</span>
                  </td>
                  <td className="px-4 py-3.5 text-[#717171]">{row.category}</td>
                  <td className="px-4 py-3.5 text-[#111111] font-medium">{row.amount}</td>
                  <td className="px-4 py-3.5 text-[#717171]">{row.timeline}</td>
                  <td className="px-4 py-3.5">
                    <span className={bidStatusClass(row.status)}>{row.status}</span>
                  </td>
                  <td className="px-4 py-3.5 text-[#717171]">{row.submitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GovTendersSection() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[#111111]">Government Tenders</h2>
        <p className="text-sm text-[#717171] mt-1">Tenders matching your service categories.</p>
      </div>

      <div className="flex flex-col gap-3">
        {TENDER_MATCHES.map((tender) => (
          <div
            key={tender.id}
            className="bg-white border border-[#E0E0E0] rounded-xl px-5 py-4 flex items-start justify-between gap-4 flex-wrap"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#111111] leading-snug line-clamp-2">
                {tender.title}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                <span className="text-xs text-[#717171]">{tender.agency}</span>
                <span className="text-xs text-[#717171]">·</span>
                <span className="text-xs font-medium text-[#111111]">
                  {formatBudget(tender.budget)}
                </span>
                <span className="text-xs text-[#717171]">·</span>
                <span className="text-xs text-[#717171]">Deadline: {tender.deadline}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <StatusPill status={computeTenderStatus(tender.deadline)} />
              <button className="btn-outline text-xs py-1.5 px-3">Apply</button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center pt-2">
        <a
          href="/tenders"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#111111] hover:text-[#717171] transition-colors"
        >
          Browse All Tenders
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

function EarningsSection() {
  const statusClass = (s: string) =>
    s === 'Paid' ? 'badge badge-success' : 'badge badge-warning';

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-[#111111]">Earnings</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Earned', value: '฿1,725,000' },
          { label: 'Pending Release', value: '฿45,000' },
          { label: 'Platform Fee (5%)', value: '฿86,250' },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <p className="text-2xl font-semibold text-[#111111]">{s.value}</p>
            <p className="text-sm text-[#717171] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="card bg-[#F7F7F7] flex items-center justify-center h-40">
        <p className="text-sm text-[#717171]">Earnings chart coming soon.</p>
      </div>

      {/* Transaction table */}
      <div className="border border-[#E0E0E0] rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E0E0E0] bg-[#F7F7F7]">
                <th className="text-left px-5 py-3 font-medium text-[#717171]">Date</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Project</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Fee</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Net</th>
                <th className="text-left px-4 py-3 font-medium text-[#717171]">Status</th>
              </tr>
            </thead>
            <tbody>
              {EARNINGS_TRANSACTIONS.map((row, i) => (
                <tr key={i} className="border-b border-[#E0E0E0] last:border-0 hover:bg-[#F7F7F7] transition-colors">
                  <td className="px-5 py-3.5 text-[#717171]">{row.date}</td>
                  <td className="px-4 py-3.5 font-medium text-[#111111]">{row.project}</td>
                  <td className="px-4 py-3.5 text-[#111111]">{row.amount}</td>
                  <td className="px-4 py-3.5 text-[#717171]">{row.fee}</td>
                  <td className="px-4 py-3.5 font-medium text-[#111111]">{row.net}</td>
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

function DocumentsSection() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-[#111111]">Company Document Vault</h2>
        <p className="text-sm text-[#717171] mt-1">
          Stored documents are auto-filled during tender submissions.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-5 py-4">
        <Info size={16} className="text-[#1D4ED8] flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-[#1D4ED8] leading-relaxed">
          Documents are securely stored and only shared with buyers upon bid acceptance.
        </p>
      </div>

      {/* Document slots */}
      <div className="flex flex-col gap-3">
        {DOCUMENT_SLOTS.map((doc) => (
          <div
            key={doc.name}
            className="bg-white border border-[#E0E0E0] rounded-xl px-5 py-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              {doc.uploaded ? (
                <CheckCircle2 size={18} className="text-[#2D6A4F] flex-shrink-0" aria-hidden="true" />
              ) : (
                <AlertCircle size={18} className="text-[#B45309] flex-shrink-0" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#111111] truncate">{doc.name}</p>
                <p className={`text-xs mt-0.5 ${doc.uploaded ? 'text-[#2D6A4F]' : 'text-[#B45309]'}`}>
                  {doc.uploaded ? 'Uploaded' : 'Missing'}
                </p>
              </div>
            </div>
            <button className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 flex-shrink-0">
              <Upload size={12} aria-hidden="true" />
              Update
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} aria-hidden="true" /> },
  { key: 'projects', label: 'Available Projects', icon: <Search size={16} aria-hidden="true" /> },
  { key: 'mybids', label: 'My Bids', icon: <FileText size={16} aria-hidden="true" /> },
  { key: 'tenders', label: 'Gov Tenders', icon: <Building2 size={16} aria-hidden="true" /> },
  { key: 'earnings', label: 'Earnings', icon: <TrendingUp size={16} aria-hidden="true" /> },
  { key: 'documents', label: 'Documents', icon: <FolderOpen size={16} aria-hidden="true" /> },
];

export default function VendorDashboardPage() {
  const [activeNav, setActiveNav] = useState<NavKey>('overview');

  const userName = 'คุณวิชัย ทองดี';
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
                      <p className="text-xs text-[#717171]">Vendor Account</p>
                    </div>
                  </div>
                </div>

                {/* Nav */}
                <nav className="p-2" aria-label="Vendor dashboard navigation">
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
              {activeNav === 'projects' && <AvailableProjectsSection />}
              {activeNav === 'mybids' && <MyBidsSection />}
              {activeNav === 'tenders' && <GovTendersSection />}
              {activeNav === 'earnings' && <EarningsSection />}
              {activeNav === 'documents' && <DocumentsSection />}
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
