import React from 'react';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  Lock,
  Users,
  CalendarDays,
  ShieldCheck,
  ArrowLeft,
  CheckSquare,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import StatusPill from '@/components/ui/StatusPill';
import ProtectedShell from '@/components/layout/ProtectedShell';
import { getProjectById } from '@/lib/data-service';
import { getDaysRemaining, computeProjectStatus } from '@/lib/deadline';

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

function getInitials(name: string): string {
  return name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// Generic "what we're looking for" requirements by category
const CATEGORY_REQUIREMENTS: Record<string, string[]> = {
  construction: [
    'Licensed contractor with relevant construction permits',
    'Portfolio of comparable completed projects',
    'Qualified civil engineers on the project team',
    'ISO 9001 or equivalent quality certification',
    'Liability insurance covering the project value',
  ],
  renovation: [
    'Proven experience in commercial or residential renovation',
    'In-house team for structural, electrical, and plumbing work',
    'Portfolio of completed renovation projects',
    'Ability to work within occupied premises with minimal disruption',
    'Transparent itemised quotation',
  ],
  technology: [
    'Registered software or IT company in Thailand (5+ years)',
    'Relevant portfolio of delivered systems or applications',
    'Experienced development team with verifiable references',
    'Post-launch support and maintenance plan',
    'Data security practices compliant with PDPA',
  ],
  logistics: [
    'Licensed freight and logistics operator',
    'Own or contracted fleet sufficient for the project scope',
    'GPS tracking and real-time reporting capability',
    'Cold-chain or specialist handling experience (if applicable)',
    'Liability insurance for goods in transit',
  ],
  agriculture: [
    'Technical expertise in the relevant agricultural domain',
    'Certified products and materials (กรมวิชาการเกษตร approved)',
    'On-site installation and commissioning capability',
    'Post-installation maintenance and support',
    'References from comparable agricultural projects',
  ],
  cleaning: [
    'Registered cleaning services company',
    'Staff trained in occupational health and safety',
    'Third-party liability insurance',
    'Supervisory staff on site during working hours',
    'Regular reporting and photo documentation',
  ],
  consulting: [
    'Qualified consultants with verifiable credentials',
    'Proven track record in the relevant advisory area',
    'Clear methodology and deliverables in the proposal',
    'Confidentiality and data handling agreement',
    'References from previous consulting engagements',
  ],
  other: [
    'Demonstrated experience relevant to the project scope',
    'Registered company in Thailand with valid tax ID',
    'Adequate insurance coverage',
    'Clear project plan and timeline in the bid',
    'References or portfolio demonstrating similar work',
  ],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProjectById(id);

  if (!project) {
    return (
      <ProtectedShell>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center py-20">
            <p className="text-2xl font-semibold text-[#111111] mb-2">Project not found</p>
            <p className="text-[#717171] mb-6">
              The project you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <Link href="/projects" className="btn-primary">
              Browse Projects
            </Link>
          </div>
        </main>
        <Footer />
      </div>
      </ProtectedShell>
    );
  }

  const requirements =
    CATEGORY_REQUIREMENTS[project.category] ?? CATEGORY_REQUIREMENTS['other'];

  const daysRemaining = getDaysRemaining(project.deadline);
  const projectStatus = computeProjectStatus(project.deadline, project.status);
  const deadlineUrgent = daysRemaining <= 3;

  return (
    <ProtectedShell>
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="container-app py-8">
          {/* Back link */}
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-sm text-[#717171] hover:text-[#111111] transition-colors mb-6 focus-ring rounded"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Browse Projects
          </Link>

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* LEFT */}
            <div className="flex-1 min-w-0">
              {/* Status + category */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <StatusPill status={projectStatus} />
                <span className="badge">{categoryLabel(project.category)}</span>
              </div>

              {/* Title */}
              <h1 className="text-2xl font-semibold text-[#111111] leading-snug mb-5">
                {project.title}
              </h1>

              {/* Meta */}
              <div className="flex flex-col gap-3 mb-6">
                {/* Buyer */}
                <div className="flex items-center gap-2.5">
                  <span
                    className="avatar text-xs flex-shrink-0"
                    style={{ width: 28, height: 28, fontSize: '0.7rem' }}
                    aria-hidden="true"
                  >
                    {getInitials(project.buyerName)}
                  </span>
                  <span className="text-sm text-[#717171]">Posted by</span>
                  <span className="text-sm font-medium text-[#111111]">{project.buyerName}</span>
                  {project.buyerVerified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]">
                      <ShieldCheck size={11} aria-hidden="true" />
                      Verified
                    </span>
                  )}
                </div>

                {/* Budget */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[#717171] w-[100px] flex-shrink-0">Budget</span>
                  <span className="font-semibold text-[#111111] text-base">
                    {formatBudget(project.budgetMin)}
                    <span className="font-normal text-[#717171] mx-1">–</span>
                    {formatBudget(project.budgetMax)}
                  </span>
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={15} className="flex-shrink-0 text-[#717171]" aria-hidden="true" />
                  <span className="text-[#717171] w-[85px] flex-shrink-0">Location</span>
                  <span className="text-[#111111]">{project.location}</span>
                </div>

                {/* Days remaining */}
                <div className="flex items-center gap-2 text-sm">
                  <Clock
                    size={15}
                    className={`flex-shrink-0 ${deadlineUrgent ? 'text-[#C0392B]' : 'text-[#717171]'}`}
                    aria-hidden="true"
                  />
                  <span className="text-[#717171] w-[85px] flex-shrink-0">Deadline</span>
                  {daysRemaining === 0 ? (
                    <span className="font-semibold text-[#C0392B]">Today</span>
                  ) : (
                    <span
                      className={`font-medium ${
                        deadlineUrgent ? 'text-[#C0392B]' : 'text-[#111111]'
                      }`}
                    >
                      {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                    </span>
                  )}
                </div>

                {/* Posted date */}
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays size={15} className="flex-shrink-0 text-[#717171]" aria-hidden="true" />
                  <span className="text-[#717171] w-[85px] flex-shrink-0">Posted</span>
                  <span className="text-[#111111]">{formatDate(project.postedAt)}</span>
                </div>
              </div>

              {/* Divider */}
              <div className="divider mb-6" />

              {/* Project brief */}
              <section className="mb-8" aria-labelledby="brief-heading">
                <h2 id="brief-heading" className="text-base font-semibold text-[#111111] mb-3">
                  Project Brief
                </h2>
                <p className="text-sm text-[#717171] leading-relaxed">{project.description}</p>
              </section>

              {/* What we're looking for */}
              <section className="mb-8" aria-labelledby="looking-for-heading">
                <h2
                  id="looking-for-heading"
                  className="text-base font-semibold text-[#111111] mb-3"
                >
                  What We&apos;re Looking For
                </h2>
                <ul className="flex flex-col gap-3" role="list">
                  {requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[#717171]">
                      <CheckSquare
                        size={15}
                        className="flex-shrink-0 text-[#2D6A4F] mt-0.5"
                        aria-hidden="true"
                      />
                      {req}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Bids received */}
              <section
                className="p-4 bg-[#F7F7F7] border border-[#E0E0E0] rounded-xl"
                aria-labelledby="bids-heading"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Users size={15} className="text-[#717171]" aria-hidden="true" />
                  <h2 id="bids-heading" className="text-sm font-semibold text-[#111111]">
                    Bids Received
                  </h2>
                </div>
                <p className="text-sm text-[#717171]">
                  <span className="font-semibold text-[#111111]">{project.bidsReceived}</span>{' '}
                  bid{project.bidsReceived !== 1 ? 's' : ''} submitted. All bids are sealed until
                  the deadline.
                </p>
              </section>
            </div>

            {/* RIGHT: sticky sidebar */}
            <aside className="w-full lg:w-80 flex-shrink-0 lg:sticky lg:top-20 flex flex-col gap-4">
              <div className="card shadow-sm">
                {/* Sealed bid notice */}
                <div className="flex items-start gap-2.5 p-3 bg-[#F7F7F7] border border-[#E0E0E0] rounded-lg mb-5">
                  <Lock
                    size={15}
                    className="flex-shrink-0 text-[#717171] mt-0.5"
                    aria-hidden="true"
                  />
                  <p className="text-xs text-[#717171] leading-relaxed">
                    All bids are sealed. Vendors cannot see competing bids.
                  </p>
                </div>

                {/* CTA */}
                <Link
                  href={`/submit-bid/${project.id}`}
                  className="btn-primary w-full justify-center mb-2"
                >
                  Submit Your Bid
                </Link>

                <p className="text-xs text-[#717171] text-center mb-5">
                  Sign in to submit a bid
                </p>

                {/* Divider */}
                <div className="divider mb-5" />

                {/* Summary stats */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#717171]">Budget</span>
                    <span className="font-semibold text-[#111111]">
                      {formatBudget(project.budgetMin)}
                      <span className="font-normal text-[#717171] mx-1">–</span>
                      {formatBudget(project.budgetMax)}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-[#717171]">Deadline</span>
                    <span
                      className={`font-medium ${
                        deadlineUrgent ? 'text-[#C0392B]' : 'text-[#111111]'
                      }`}
                    >
                      {daysRemaining === 0
                        ? 'Today'
                        : `${daysRemaining}d remaining`}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-[#717171]">Bids submitted</span>
                    <span className="font-medium text-[#111111]">{project.bidsReceived}</span>
                  </div>
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
