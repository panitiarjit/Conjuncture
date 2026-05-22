'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Check,
  CheckCircle2,
  CreditCard,
  AlertTriangle,
  Building2,
  CalendarDays,
  Banknote,
  Info,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/auth-context';
import { getProcurementMethod, requiresBidBond } from '@/lib/procurement';
import { useProtectedRoute } from '@/lib/use-protected-route';
import { useLanguage } from '@/lib/language-context';
import { computeTenderStatus } from '@/lib/deadline';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentSlot {
  id: string;
  label: string;
  sublabel: string;
}

interface CompanyInfo {
  companyName: string;
  registrationNumber: string;
  taxId: string;
  authorizedDirector: string;
  businessAddress: string;
  contactPhone: string;
  contactEmail: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const BASE_DOCUMENTS: DocumentSlot[] = [
  {
    id: 'company-reg',
    label: 'Company Registration Certificate',
    sublabel: 'หนังสือรับรองบริษัท',
  },
  {
    id: 'tax-id',
    label: 'Tax ID Certificate',
    sublabel: 'ใบทะเบียนภาษีมูลค่าเพิ่ม',
  },
  {
    id: 'financial',
    label: 'Financial Statements',
    sublabel: 'Last 2 years',
  },
  {
    id: 'director-id',
    label: "Director's National ID Copy",
    sublabel: 'สำเนาบัตรประจำตัวประชาชนกรรมการ',
  },
  {
    id: 'portfolio',
    label: 'Project Portfolio / Past Work Evidence',
    sublabel: 'ผลงานและหลักฐานประสบการณ์',
  },
];

const BID_BOND_DOCUMENT: DocumentSlot = {
  id: 'bid-bond',
  label: 'Bid Bond (หลักประกันซอง)',
  sublabel: '2–5% of contract value — bank guarantee or cashier\'s cheque',
};

const STEP_LABELS = ['Documents', 'Auto-fill', 'Review & Pay'];

const SUBMISSION_FEE = 1500;

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function generateRef(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `REF-2025-${num}`;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Submission progress" className="mb-8">
      <ol className="flex items-center">
        {STEP_LABELS.map((label, i) => {
          const step = i + 1;
          const isActive = step === current;
          const isCompleted = step < current;
          const isLast = i === STEP_LABELS.length - 1;

          return (
            <li key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 flex-shrink-0 transition-all duration-200 ${
                    isCompleted
                      ? 'bg-[#111111] border-[#111111] text-white'
                      : isActive
                        ? 'bg-[#111111] border-[#111111] text-white'
                        : 'bg-white border-[#E0E0E0] text-[#717171]'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? <Check size={14} aria-hidden="true" /> : step}
                </div>
                <span
                  className={`text-xs font-medium text-center leading-tight hidden sm:block ${
                    isActive ? 'text-[#111111]' : 'text-[#717171]'
                  }`}
                >
                  {label}
                </span>
              </div>

              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-2 mb-5 sm:mb-0 transition-colors duration-200 ${
                    step < current ? 'bg-[#111111]' : 'bg-[#E0E0E0]'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssistedSubmissionPage() {
  const { isAuthenticated, isLoading } = useProtectedRoute();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [tender, setTender] = useState<import('@/lib/types').Tender | undefined>(undefined);
  useEffect(() => {
    fetch(`/api/tenders/${id}`).then((r) => r.ok ? r.json() : undefined).then(setTender);
  }, [id]);
  const { user } = useAuth();
  const { t } = useLanguage();

  if (isLoading || !isAuthenticated) return null;

  // ── Wizard state ──
  const [step, setStep] = useState(1);

  // Step 1: documents
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({});

  // Step 2: company info
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    companyName: 'บริษัท เทคโนโลยี ไทย จำกัด',
    registrationNumber: '0105560123456',
    taxId: '0105560123456',
    authorizedDirector: 'นายสมชาย วงศ์ประดิษฐ์',
    businessAddress: '123/45 ถนนพระราม 9 เขตห้วยขวาง กรุงเทพฯ 10310',
    contactPhone: '02-123-4567',
    contactEmail: user?.email ?? '',
  });

  // Step 3: submit
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refNumber] = useState(generateRef);

  // ── Not found ──
  if (!tender) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center py-20">
            <p className="text-2xl font-semibold text-[#111111] mb-2">Tender not found</p>
            <p className="text-[#717171] mb-6">
              The tender you are looking for does not exist or has been removed.
            </p>
            <Link href="/tenders" className="btn-primary">
              Browse Tenders
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Procurement method ──
  const method = getProcurementMethod(tender.budget);
  const needsBidBond = requiresBidBond(tender.budget);
  const REQUIRED_DOCUMENTS = needsBidBond
    ? [...BASE_DOCUMENTS, BID_BOND_DOCUMENT]
    : BASE_DOCUMENTS;

  // ── Helpers ──
  function handleDocUpload(docId: string, filename: string) {
    setUploadedDocs((prev) => ({ ...prev, [docId]: filename }));
  }

  function handleCompanyChange(field: keyof CompanyInfo, value: string) {
    setCompanyInfo((prev) => ({ ...prev, [field]: value }));
  }

  function handlePayAndSubmit() {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1500);
  }

  const allDocsUploaded = REQUIRED_DOCUMENTS.every((d) => uploadedDocs[d.id]);

  // ── Success state ──
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center bg-[#F7F7F7]">
          <div className="max-w-md w-full mx-auto px-4 py-16 text-center">
            <CheckCircle2 size={56} className="text-[#2D6A4F] mx-auto mb-4" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-[#111111] mb-2">
              Application Submitted Successfully
            </h1>
            <p className="text-sm text-[#717171] mb-3">
              Reference number:{' '}
              <span className="font-semibold text-[#111111]">{refNumber}</span>
            </p>
            <p className="text-sm text-[#717171] mb-8">
              A confirmation email has been sent. You can track your submission status in your
              dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={user?.role === 'vendor' ? '/dashboard/vendor' : '/dashboard/buyer'} className="btn-primary">
                Track in Dashboard
              </Link>
              <Link href="/tenders" className="btn-outline">
                Browse More Tenders
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Tender summary card (reused in steps 1 & 3) ──
  const TenderSummaryCard = () => (
    <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-[#111111] leading-snug">{tender.title}</h2>
      <div className="divider" />
      <div className="flex items-center gap-2 text-sm">
        <Building2 size={14} className="text-[#717171] flex-shrink-0" aria-hidden="true" />
        <span className="text-[#717171]">{tender.agency}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <CalendarDays size={14} className="text-[#717171] flex-shrink-0" aria-hidden="true" />
        <span className="text-[#717171]">Deadline:</span>
        <span
          className={`font-medium ${computeTenderStatus(tender.deadline) === 'closing_soon' ? 'text-[#B45309]' : 'text-[#111111]'}`}
        >
          {formatDate(tender.deadline)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Banknote size={14} className="text-[#717171] flex-shrink-0" aria-hidden="true" />
        <span className="text-[#717171]">Budget:</span>
        <span className="font-semibold text-[#111111]">{formatBudget(tender.budget)}</span>
      </div>
      <div className="divider" />
      <div className="flex items-start gap-2.5 p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg">
        <Info size={14} className="flex-shrink-0 text-[#1D4ED8] mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold text-[#1D4ED8]">{t('pm.method')}</p>
          <p className="text-xs text-[#1D4ED8]">{t(`pm.${method}`)}</p>
        </div>
      </div>
      <div className="flex items-start gap-2.5 p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg">
        <Info size={14} className="flex-shrink-0 text-[#B45309] mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold text-[#B45309]">Submission Fee</p>
          <p className="text-xs text-[#B45309]">
            ฿{SUBMISSION_FEE.toLocaleString('th-TH')}
          </p>
        </div>
      </div>
    </div>
  );

  // ── Step 1: Documents ──────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Left: tender summary */}
      <div className="w-full lg:w-72 flex-shrink-0">
        <TenderSummaryCard />
      </div>

      {/* Right: document upload */}
      <div className="flex-1 min-w-0 bg-white border border-[#E0E0E0] rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[#111111] mb-1">Upload Your Company Documents</h2>
        <p className="text-sm text-[#717171] mb-5">
          Documents are stored in your vendor profile for reuse in future submissions.
        </p>

        {/* Method + principles banner */}
        <div className="p-3 bg-[#F7F7F7] border border-[#E0E0E0] rounded-lg mb-5">
          <p className="text-xs font-semibold text-[#111111] mb-2">
            {t('as.methodBanner')} <span className="text-[#1D4ED8]">{t(`pm.${method}`)}</span>{' '}
            — {t(`pm.${method}.desc`)}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(['value', 'transparent', 'efficient', 'accountable'] as const).map((p) => (
              <span
                key={p}
                className="text-xs px-2 py-0.5 bg-white border border-[#E0E0E0] rounded-full text-[#717171]"
              >
                {t(`pm.principles.${p}`)}
              </span>
            ))}
          </div>
        </div>

        {/* Profile auto-load banner */}
        <div className="flex items-start gap-2.5 p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg mb-5">
          <Info size={14} className="flex-shrink-0 text-[#1D4ED8] mt-0.5" aria-hidden="true" />
          <p className="text-xs text-[#1D4ED8]">
            Saved documents from your profile will be loaded automatically.
          </p>
        </div>

        <div className="flex flex-col gap-4" role="list" aria-label="Required documents">
          {REQUIRED_DOCUMENTS.map((doc) => {
            const uploaded = uploadedDocs[doc.id];
            return (
              <div
                key={doc.id}
                role="listitem"
                className="flex items-center gap-3 p-4 bg-[#F7F7F7] border border-[#E0E0E0] rounded-xl"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#111111]">{doc.label}</p>
                  <p className="text-xs text-[#717171]">{doc.sublabel}</p>
                  {uploaded && (
                    <p className="text-xs text-[#2D6A4F] mt-0.5 truncate">{uploaded}</p>
                  )}
                </div>

                {uploaded ? (
                  <Check
                    size={18}
                    className="flex-shrink-0 text-[#2D6A4F]"
                    aria-label="Uploaded"
                  />
                ) : (
                  <label className="flex-shrink-0 cursor-pointer">
                    <span className="btn-outline text-xs py-1.5 px-3">Browse</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="sr-only"
                      aria-label={`Upload ${doc.label}`}
                      onChange={(e) => {
                        const name = e.target.files?.[0]?.name;
                        if (name) handleDocUpload(doc.id, name);
                      }}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!allDocsUploaded}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            title={!allDocsUploaded ? 'Please upload all required documents to continue' : undefined}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  // ── Step 2: Company Info Auto-fill ─────────────────────────────────────────
  const renderStep2 = () => (
    <div className="bg-white border border-[#E0E0E0] rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-[#111111] mb-1">
        Confirm Your Company Information
      </h2>
      <p className="text-sm text-[#717171] mb-6">
        This information will be submitted on your behalf.
      </p>

      <div className="flex flex-col gap-5">
        {/* Company Name */}
        <div>
          <label htmlFor="cmp-name" className="label">
            Company Name
          </label>
          <input
            id="cmp-name"
            type="text"
            className="input"
            value={companyInfo.companyName}
            onChange={(e) => handleCompanyChange('companyName', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Registration Number */}
          <div>
            <label htmlFor="cmp-reg" className="label">
              Registration Number
            </label>
            <input
              id="cmp-reg"
              type="text"
              className="input"
              value={companyInfo.registrationNumber}
              onChange={(e) => handleCompanyChange('registrationNumber', e.target.value)}
            />
          </div>

          {/* Tax ID */}
          <div>
            <label htmlFor="cmp-tax" className="label">
              Tax ID
            </label>
            <input
              id="cmp-tax"
              type="text"
              className="input"
              value={companyInfo.taxId}
              onChange={(e) => handleCompanyChange('taxId', e.target.value)}
            />
          </div>
        </div>

        {/* Authorized Director */}
        <div>
          <label htmlFor="cmp-director" className="label">
            Authorized Director
          </label>
          <input
            id="cmp-director"
            type="text"
            className="input"
            value={companyInfo.authorizedDirector}
            onChange={(e) => handleCompanyChange('authorizedDirector', e.target.value)}
          />
        </div>

        {/* Business Address */}
        <div>
          <label htmlFor="cmp-address" className="label">
            Business Address
          </label>
          <textarea
            id="cmp-address"
            rows={2}
            className="input resize-none"
            value={companyInfo.businessAddress}
            onChange={(e) => handleCompanyChange('businessAddress', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Contact Phone */}
          <div>
            <label htmlFor="cmp-phone" className="label">
              Contact Phone
            </label>
            <input
              id="cmp-phone"
              type="tel"
              className="input"
              value={companyInfo.contactPhone}
              onChange={(e) => handleCompanyChange('contactPhone', e.target.value)}
            />
          </div>

          {/* Contact Email */}
          <div>
            <label htmlFor="cmp-email" className="label">
              Contact Email
            </label>
            <input
              id="cmp-email"
              type="email"
              className="input"
              value={companyInfo.contactEmail}
              onChange={(e) => handleCompanyChange('contactEmail', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button type="button" onClick={() => setStep(1)} className="btn-outline">
          Back
        </button>
        <button type="button" onClick={() => setStep(3)} className="btn-primary">
          Next
        </button>
      </div>
    </div>
  );

  // ── Step 3: Review & Pay ───────────────────────────────────────────────────
  const renderStep3 = () => (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      {/* Submission summary card */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl p-6">
        <h2 className="text-base font-semibold text-[#111111] mb-4">Submission Summary</h2>

        <div className="flex flex-col gap-3 text-sm mb-5">
          <div className="flex items-start gap-2">
            <span className="text-[#717171] w-36 flex-shrink-0">Tender</span>
            <span className="text-[#111111] font-medium leading-snug">{tender.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#717171] w-36 flex-shrink-0">Agency</span>
            <span className="text-[#111111]">{tender.agency}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#717171] w-36 flex-shrink-0">Company</span>
            <span className="text-[#111111]">{companyInfo.companyName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#717171] w-36 flex-shrink-0">{t('pm.method')}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
              {t(`pm.${method}`)}
            </span>
          </div>
        </div>

        <div className="divider mb-4" />

        {/* Documents checklist */}
        <h3 className="text-xs font-semibold text-[#111111] uppercase tracking-wider mb-3">
          Documents
        </h3>
        <ul className="flex flex-col gap-2.5" role="list">
          {REQUIRED_DOCUMENTS.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2.5 text-sm">
              <Check size={14} className="text-[#2D6A4F] flex-shrink-0" aria-hidden="true" />
              <span className="text-[#717171]">
                {doc.label}
                {uploadedDocs[doc.id] && (
                  <span className="ml-1.5 text-xs text-[#111111]">({uploadedDocs[doc.id]})</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Fee box */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <CreditCard size={18} className="text-[#717171]" aria-hidden="true" />
            <span className="text-sm font-semibold text-[#111111]">Submission Fee</span>
          </div>
          <span className="text-lg font-bold text-[#111111]">
            ฿{SUBMISSION_FEE.toLocaleString('th-TH')}
          </span>
        </div>
        <p className="text-xs text-[#717171]">Non-refundable processing fee</p>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 p-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl">
        <AlertTriangle
          size={16}
          className="flex-shrink-0 text-[#B45309] mt-0.5"
          aria-hidden="true"
        />
        <p className="text-sm text-[#B45309]">
          Once submitted, your application cannot be withdrawn.
        </p>
      </div>

      {/* Status note */}
      <p className="text-xs text-[#717171] text-center">
        You will receive a confirmation email and can track your submission status in your
        dashboard.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="btn-outline sm:w-auto"
          disabled={submitting}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handlePayAndSubmit}
          disabled={submitting}
          className="btn-primary flex-1 justify-center disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <span
                className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
              Processing...
            </>
          ) : (
            `Pay ฿${SUBMISSION_FEE.toLocaleString('th-TH')} & Submit Application`
          )}
        </button>
      </div>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-[#F7F7F7]">
        <div className="container-app py-8">
          {/* Back link */}
          <Link
            href={`/tenders/${tender.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-[#717171] hover:text-[#111111] transition-colors mb-6 focus-ring rounded"
          >
            <span aria-hidden="true">&larr;</span>
            Back to Tender
          </Link>

          {/* Page heading */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-[#111111]">Assisted Submission</h1>
            <p className="text-sm text-[#717171] mt-1">
              We handle the paperwork. You focus on winning.
            </p>
          </div>

          {/* Step indicator */}
          <div className="max-w-lg mb-8">
            <StepIndicator current={step} />
          </div>

          {/* Step content */}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>
      </main>

      <Footer />
    </div>
  );
}
