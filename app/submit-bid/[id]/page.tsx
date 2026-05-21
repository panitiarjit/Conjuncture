'use client';
import { useProtectedRoute } from '@/lib/use-protected-route';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Banknote,
  MapPin,
  Clock,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import StatusPill from '@/components/ui/StatusPill';
import { getProjectById } from '@/lib/data-service';
import { getDaysRemaining, computeProjectStatus } from '@/lib/deadline';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBudget(amount: number): string {
  return '฿' + amount.toLocaleString('th-TH');
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubmitBidPage() {
  const { isAuthenticated, isLoading } = useProtectedRoute();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [project, setProject] = useState<import('@/lib/types').Project | undefined>(undefined);
  useEffect(() => { getProjectById(id).then(setProject); }, [id]);
  const daysRemaining = project ? getDaysRemaining(project.deadline) : 0;
  const projectStatus = project ? computeProjectStatus(project.deadline, project.status) : 'open';

  if (isLoading || !isAuthenticated) return null;

  // ── Form state ──
  const [price, setPrice] = useState('');
  const [timeline, setTimeline] = useState('');
  const [message, setMessage] = useState('');
  const [portfolioFile, setPortfolioFile] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center py-20">
            <p className="text-2xl font-semibold text-[#111111] mb-2">Project not found</p>
            <p className="text-[#717171] mb-6">
              The project you are looking for does not exist or has been removed.
            </p>
            <Link href="/projects" className="btn-primary">
              Browse Projects
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const deadlineUrgent = daysRemaining <= 3;
  const msgLength = message.trim().length;

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!price || Number(price) <= 0) next.price = 'Please enter a valid proposed price.';
    if (!timeline) next.timeline = 'Please select a proposed timeline.';
    if (msgLength < 30) next.message = `Covering message must be at least 30 characters (${msgLength}/30).`;
    if (!agreed) next.agreed = 'You must confirm this bid before submitting.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) {
      setSubmitted(true);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center bg-[#F7F7F7]">
          <div className="max-w-md w-full mx-auto px-4 py-16 text-center">
            <CheckCircle2 size={52} className="text-[#2D6A4F] mx-auto mb-4" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-[#111111] mb-2">Bid Submitted</h1>
            <p className="text-sm text-[#717171] mb-8 leading-relaxed">
              Your bid has been submitted. The buyer will review all bids after the deadline.
            </p>
            <Link href="/projects" className="btn-primary">
              Back to Projects
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-[#F7F7F7]">
        <div className="container-app py-8">
          {/* Back link */}
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-[#717171] hover:text-[#111111] transition-colors mb-6 focus-ring rounded"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Back to Project
          </Link>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* ── LEFT: Project Brief (40%) ──────────────────────────────── */}
            <aside className="w-full lg:w-2/5 flex-shrink-0 lg:sticky lg:top-20 flex flex-col gap-4">
              <div className="bg-white border border-[#E0E0E0] rounded-2xl p-6">
                {/* Status + category */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <StatusPill status={projectStatus} />
                  <span className="badge">{categoryLabel(project.category)}</span>
                </div>

                {/* Title */}
                <h1 className="text-lg font-semibold text-[#111111] leading-snug mb-5">
                  {project.title}
                </h1>

                {/* Meta */}
                <div className="flex flex-col gap-3 mb-5">
                  {/* Budget */}
                  <div className="flex items-start gap-2.5 text-sm">
                    <Banknote size={15} className="flex-shrink-0 text-[#717171] mt-0.5" aria-hidden="true" />
                    <div>
                      <span className="text-[#717171]">Budget</span>
                      <span className="block font-semibold text-[#111111] text-base">
                        {formatBudget(project.budgetMin)}
                        <span className="font-normal text-[#717171] mx-1">–</span>
                        {formatBudget(project.budgetMax)}
                      </span>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-2.5 text-sm">
                    <MapPin size={15} className="flex-shrink-0 text-[#717171]" aria-hidden="true" />
                    <span className="text-[#111111]">{project.location}</span>
                  </div>

                  {/* Days remaining */}
                  <div className="flex items-center gap-2.5 text-sm">
                    <Clock
                      size={15}
                      className={`flex-shrink-0 ${deadlineUrgent ? 'text-[#C0392B]' : 'text-[#717171]'}`}
                      aria-hidden="true"
                    />
                    {daysRemaining === 0 ? (
                      <span className="font-semibold text-[#C0392B]">Deadline: today</span>
                    ) : (
                      <span className={deadlineUrgent ? 'text-[#C0392B] font-medium' : 'text-[#111111]'}>
                        {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                      </span>
                    )}
                  </div>
                </div>

                <div className="divider mb-5" />

                {/* Description */}
                <section aria-labelledby="brief-heading" className="mb-5">
                  <h2 id="brief-heading" className="text-sm font-semibold text-[#111111] mb-2">
                    Project Brief
                  </h2>
                  <p className="text-sm text-[#717171] leading-relaxed">{project.description}</p>
                </section>

                {/* Sealed bid notice */}
                <div className="flex items-start gap-2.5 p-4 bg-[#F7F7F7] border border-[#E0E0E0] rounded-xl">
                  <Lock size={15} className="flex-shrink-0 text-[#717171] mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-[#717171] leading-relaxed">
                    This is a sealed bid process. The buyer cannot see other vendors&apos; bids
                    until the deadline passes. You will be notified of the outcome.
                  </p>
                </div>
              </div>
            </aside>

            {/* ── RIGHT: Bid Form (60%) ──────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              <div className="bg-white border border-[#E0E0E0] rounded-2xl p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-[#111111] mb-6">Submit Your Bid</h2>

                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
                  {/* Proposed Price */}
                  <div>
                    <label htmlFor="bid-price" className="label">
                      Proposed Price (THB) <span className="text-[#C0392B]" aria-hidden="true">*</span>
                    </label>
                    <div className="relative">
                      <span
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#717171] select-none pointer-events-none"
                        aria-hidden="true"
                      >
                        ฿
                      </span>
                      <input
                        id="bid-price"
                        type="number"
                        min={0}
                        step={1000}
                        className="input pl-8"
                        placeholder="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        aria-describedby={errors.price ? 'bid-price-error' : undefined}
                      />
                    </div>
                    {errors.price && (
                      <p id="bid-price-error" role="alert" className="text-xs text-[#C0392B] mt-1.5">
                        {errors.price}
                      </p>
                    )}
                  </div>

                  {/* Proposed Timeline */}
                  <div>
                    <label htmlFor="bid-timeline" className="label">
                      Proposed Timeline <span className="text-[#C0392B]" aria-hidden="true">*</span>
                    </label>
                    <select
                      id="bid-timeline"
                      className="input"
                      value={timeline}
                      onChange={(e) => setTimeline(e.target.value)}
                      aria-describedby={errors.timeline ? 'bid-timeline-error' : undefined}
                    >
                      <option value="">Select a timeline</option>
                      <option value="lt-1-week">&lt; 1 week</option>
                      <option value="1-2-weeks">1–2 weeks</option>
                      <option value="2-4-weeks">2–4 weeks</option>
                      <option value="1-2-months">1–2 months</option>
                      <option value="2-3-months">2–3 months</option>
                      <option value="gt-3-months">&gt; 3 months</option>
                    </select>
                    {errors.timeline && (
                      <p id="bid-timeline-error" role="alert" className="text-xs text-[#C0392B] mt-1.5">
                        {errors.timeline}
                      </p>
                    )}
                  </div>

                  {/* Covering Message */}
                  <div>
                    <label htmlFor="bid-message" className="label">
                      Covering Message <span className="text-[#C0392B]" aria-hidden="true">*</span>
                    </label>
                    <textarea
                      id="bid-message"
                      rows={6}
                      className="input resize-none"
                      placeholder="Describe your approach, relevant experience, and why you are the right vendor for this project."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      aria-describedby="bid-message-counter bid-message-error"
                    />
                    <p
                      id="bid-message-counter"
                      className={`text-xs mt-1.5 ${
                        msgLength >= 30 ? 'text-[#2D6A4F]' : 'text-[#717171]'
                      }`}
                    >
                      {msgLength} / 30 characters minimum
                    </p>
                    {errors.message && (
                      <p id="bid-message-error" role="alert" className="text-xs text-[#C0392B] mt-0.5">
                        {errors.message}
                      </p>
                    )}
                  </div>

                  {/* Portfolio Attachment */}
                  <div>
                    <label htmlFor="bid-portfolio" className="label">
                      Portfolio Attachment
                      <span className="ml-1.5 text-xs font-normal text-[#717171]">(Optional)</span>
                    </label>
                    <input
                      id="bid-portfolio"
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                      className="input text-sm text-[#717171] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[#E0E0E0] file:text-xs file:font-medium file:text-[#111111] file:bg-[#F7F7F7] file:cursor-pointer hover:file:bg-[#E0E0E0]"
                      onChange={(e) => setPortfolioFile(e.target.files?.[0]?.name ?? '')}
                    />
                    {portfolioFile && (
                      <p className="text-xs text-[#717171] mt-1.5">Selected: {portfolioFile}</p>
                    )}
                  </div>

                  {/* Terms checkbox */}
                  <div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-[#E0E0E0] accent-[#111111] flex-shrink-0"
                        aria-describedby={errors.agreed ? 'bid-agreed-error' : undefined}
                      />
                      <span className="text-sm text-[#717171] leading-relaxed">
                        I confirm this bid is accurate and I am authorized to commit my company.
                      </span>
                    </label>
                    {errors.agreed && (
                      <p id="bid-agreed-error" role="alert" className="text-xs text-[#C0392B] mt-1.5">
                        {errors.agreed}
                      </p>
                    )}
                  </div>

                  {/* Submit */}
                  <button type="submit" className="btn-primary w-full justify-center">
                    Submit Sealed Bid
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
