import React from 'react';
import Link from 'next/link';
import {
  Building2,
  CalendarDays,
  MapPin,
  CheckSquare,
  FileText,
  Info,
  ArrowLeft,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import StatusPill from '@/components/ui/StatusPill';
import ProtectedShell from '@/components/layout/ProtectedShell';
import { TENDERS } from '@/lib/mock-data';
import { computeTenderStatus } from '@/lib/deadline';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBudget(amount: number): string {
  return '฿' + amount.toLocaleString('th-TH');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    construction: 'Construction',
    technology: 'Technology',
    logistics: 'Logistics',
    agriculture: 'Agriculture',
    cleaning: 'Cleaning',
    consulting: 'Consulting',
    renovation: 'Renovation',
    other: 'General',
  };
  return map[cat] ?? cat;
}

// Estimate a decision date ~30 days after deadline
function decisionDate(deadlineStr: string): string {
  const d = new Date(deadlineStr);
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Estimate a posted date ~60 days before deadline
function postedDate(deadlineStr: string): string {
  const d = new Date(deadlineStr);
  d.setDate(d.getDate() - 60);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Required documents ───────────────────────────────────────────────────────

const REQUIRED_DOCUMENTS = [
  'Company registration (หนังสือรับรองบริษัท)',
  'Tax ID (เลขประจำตัวผู้เสียภาษี)',
  'Financial statements (last 2 years)',
  'Past project portfolio',
  "Director's ID copy (สำเนาบัตรประชาชนกรรมการ)",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TenderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tender = TENDERS.find((t) => t.id === id);
  const tenderStatus = tender ? computeTenderStatus(tender.deadline) : 'open';

  if (!tender) {
    return (
      <ProtectedShell>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center py-20">
            <p className="text-2xl font-semibold text-[#111111] mb-2">Tender not found</p>
            <p className="text-[#717171] mb-6">
              The tender you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <Link href="/tenders" className="btn-primary">
              Browse Tenders
            </Link>
          </div>
        </main>
        <Footer />
      </div>
      </ProtectedShell>
    );
  }

  return (
    <ProtectedShell>
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="container-app py-8">
          {/* Back link */}
          <Link
            href="/tenders"
            className="inline-flex items-center gap-1.5 text-sm text-[#717171] hover:text-[#111111] transition-colors mb-6 focus-ring rounded"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Government Tenders
          </Link>

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* LEFT: main content */}
            <div className="flex-1 min-w-0">
              {/* Status + category badges */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <StatusPill status={tenderStatus} />
                <span className="badge">{categoryLabel(tender.category)}</span>
              </div>

              {/* Title */}
              <h1 className="text-2xl font-semibold text-[#111111] leading-snug mb-5">
                {tender.title}
              </h1>

              {/* Key meta */}
              <div className="flex flex-col gap-3 mb-6">
                {/* Agency */}
                <div className="flex items-center gap-2 text-sm text-[#717171]">
                  <Building2 size={15} className="flex-shrink-0 text-[#717171]" aria-hidden="true" />
                  <span className="font-medium text-[#111111]">{tender.agency}</span>
                </div>

                {/* Budget */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[#717171] w-[100px] flex-shrink-0">Budget</span>
                  <span className="font-semibold text-[#111111] text-base">
                    {formatBudget(tender.budget)}
                  </span>
                </div>

                {/* Deadline */}
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays size={15} className="flex-shrink-0 text-[#717171]" aria-hidden="true" />
                  <span className="text-[#717171] w-[85px] flex-shrink-0">Deadline</span>
                  <span
                    className={`font-medium ${
                      tenderStatus === 'closing_soon' ? 'text-[#B45309]' : 'text-[#111111]'
                    }`}
                  >
                    {formatDate(tender.deadline)}
                  </span>
                </div>

                {/* Region */}
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={15} className="flex-shrink-0 text-[#717171]" aria-hidden="true" />
                  <span className="text-[#717171] w-[85px] flex-shrink-0">Region</span>
                  <span className="text-[#111111]">{tender.region}</span>
                </div>
              </div>

              {/* Divider */}
              <div className="divider mb-6" />

              {/* About */}
              <section className="mb-8" aria-labelledby="about-heading">
                <h2 id="about-heading" className="text-base font-semibold text-[#111111] mb-3">
                  About This Tender
                </h2>
                <p className="text-sm text-[#717171] leading-relaxed">{tender.description}</p>
              </section>

              {/* Requirements checklist */}
              <section className="mb-8" aria-labelledby="requirements-heading">
                <h2
                  id="requirements-heading"
                  className="text-base font-semibold text-[#111111] mb-3"
                >
                  Requirements Checklist
                </h2>
                <ul className="flex flex-col gap-3" role="list">
                  {tender.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[#717171]">
                      <CheckSquare
                        size={16}
                        className="flex-shrink-0 text-[#2D6A4F] mt-0.5"
                        aria-hidden="true"
                      />
                      {req}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Required documents */}
              <section aria-labelledby="documents-heading">
                <h2
                  id="documents-heading"
                  className="text-base font-semibold text-[#111111] mb-3"
                >
                  Required Documents
                </h2>
                <ul className="flex flex-col gap-3" role="list">
                  {REQUIRED_DOCUMENTS.map((doc, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[#717171]">
                      <FileText
                        size={15}
                        className="flex-shrink-0 text-[#717171] mt-0.5"
                        aria-hidden="true"
                      />
                      {doc}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* RIGHT: sticky sidebar */}
            <aside className="w-full lg:w-80 flex-shrink-0 lg:sticky lg:top-20 flex flex-col gap-4">
              {/* Main action card */}
              <div className="card shadow-sm">
                {/* Fee notice */}
                <div className="flex items-start gap-2.5 p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg mb-5">
                  <Info size={15} className="flex-shrink-0 text-[#B45309] mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-[#B45309]">Submission Fee</p>
                    <p className="text-sm text-[#B45309]">฿1,500 per application</p>
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href={`/assisted-submission/${tender.id}`}
                  className="btn-primary w-full justify-center mb-3"
                >
                  Apply with Assisted Submission
                </Link>

                <p className="text-xs text-[#717171] text-center">
                  Free to browse — fee applies on submission
                </p>

                {/* Divider */}
                <div className="divider my-5" />

                {/* Key dates */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                    Key Dates
                  </h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#717171]">Posted</span>
                    <span className="text-[#111111] font-medium">{postedDate(tender.deadline)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#717171]">Deadline</span>
                    <span
                      className={`font-medium ${
                        tenderStatus === 'closing_soon' ? 'text-[#B45309]' : 'text-[#111111]'
                      }`}
                    >
                      {formatDate(tender.deadline)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#717171]">Decision expected</span>
                    <span className="text-[#111111] font-medium">{decisionDate(tender.deadline)}</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="divider my-5" />

                {/* Agency contact */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                    Issuing Agency
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#F7F7F7] border border-[#E0E0E0] flex items-center justify-center flex-shrink-0">
                      <Building2 size={14} className="text-[#717171]" aria-hidden="true" />
                    </div>
                    <span className="text-sm font-medium text-[#111111]">{tender.agency}</span>
                  </div>
                  <p className="text-xs text-[#717171]">
                    Official procurement via Conjuncture&apos;s assisted submission service.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
    </ProtectedShell>
  );
}
