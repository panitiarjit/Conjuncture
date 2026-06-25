'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2, MapPin, CheckSquare, FileText, Info,
  ArrowLeft, ExternalLink, Hash, Trophy, Users, TrendingDown, Eye,
} from 'lucide-react';
import type { Tender, AwardedContract } from '@/lib/types';
import StatusPill from './StatusPill';
import { useLanguage } from '@/lib/language-context';
import { resolveProcurementType } from '@/lib/procurement';
import type { EnvelopeBuyersResponse } from '@/app/api/envelope-buyers/[id]/route';

interface Props {
  tender: Tender | null;
  tenderStatus: string;
  awardedContract?: AwardedContract | null;
}

function formatBudget(amount: number): string {
  return '฿' + amount.toLocaleString('th-TH');
}

function relativeDate(deadlineStr: string, offsetDays: number, locale: string): string {
  const d = new Date(deadlineStr);
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function TenderDetailView({ tender, tenderStatus, awardedContract }: Props) {
  const { t, lang } = useLanguage();
  const locale = lang === 'th' ? 'th-TH' : 'en-US';
  const [buyers, setBuyers] = useState<EnvelopeBuyersResponse | null>(null);

  useEffect(() => {
    if (!tender?.id) return;
    fetch(`/api/envelope-buyers/${encodeURIComponent(tender.id)}`)
      .then((r) => r.json())
      .then((d: EnvelopeBuyersResponse) => setBuyers(d))
      .catch(() => null);
  }, [tender?.id]);

  const REQUIRED_DOCUMENTS = [
    t('td.doc.registration'),
    t('td.doc.taxId'),
    t('td.doc.financials'),
    t('td.doc.portfolio'),
    t('td.doc.directorId'),
  ];

  if (!tender) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center py-20">
          <p className="text-2xl font-semibold text-[#111111] mb-2">{t('td.notFound')}</p>
          <p className="text-[#717171] mb-6">{t('td.notFoundDesc')}</p>
          <Link href="/tenders" className="btn-primary">{t('td.browseTenders')}</Link>
        </div>
      </main>
    );
  }

  const ptType = resolveProcurementType(tender.title);
  const typeKey = `pt.${ptType}` as Parameters<typeof t>[0];
  const catKey = `cat.${tender.category}` as Parameters<typeof t>[0];

  return (
    <main className="flex-1">
      <div className="container-app py-8">
        <Link
          href="/tenders"
          className="inline-flex items-center gap-1.5 text-sm text-[#717171] hover:text-[#111111] transition-colors mb-6 focus-ring rounded"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          {t('td.back')}
        </Link>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* LEFT: main content */}
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <StatusPill status={tenderStatus as import('@/lib/status').StatusValue} />
              <span className="badge">{t(catKey)}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded text-[#1D4ED8]">
                {t(typeKey)}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-semibold text-[#111111] leading-snug mb-5">
              {tender.title}
            </h1>

            {/* Key meta */}
            <div className="flex flex-col gap-3 mb-6">
              <div className="flex items-center gap-2 text-sm text-[#717171]">
                <Building2 size={15} className="flex-shrink-0 text-[#717171]" aria-hidden="true" />
                <span className="font-medium text-[#111111]">{tender.agency}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[#717171] w-[100px] flex-shrink-0">{t('td.budget')}</span>
                <span className="font-semibold text-[#111111] text-base">{formatBudget(tender.budget)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={15} className="flex-shrink-0 text-[#717171]" aria-hidden="true" />
                <span className="text-[#717171] w-[85px] flex-shrink-0">{t('td.region')}</span>
                <span className="text-[#111111]">{tender.region}</span>
              </div>
            </div>

            <div className="divider mb-6" />

            {/* About */}
            <section className="mb-8" aria-labelledby="about-heading">
              <h2 id="about-heading" className="text-base font-semibold text-[#111111] mb-3">
                {t('td.about')}
              </h2>
              <p className="text-sm text-[#717171] leading-relaxed">{tender.description}</p>
            </section>

            {/* Requirements */}
            <section className="mb-8" aria-labelledby="requirements-heading">
              <h2 id="requirements-heading" className="text-base font-semibold text-[#111111] mb-3">
                {t('td.requirements')}
              </h2>
              <ul className="flex flex-col gap-3" role="list">
                {tender.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#717171]">
                    <CheckSquare size={16} className="flex-shrink-0 text-[#2D6A4F] mt-0.5" aria-hidden="true" />
                    {req}
                  </li>
                ))}
              </ul>
            </section>

            {/* Required documents */}
            <section className="mb-8" aria-labelledby="documents-heading">
              <h2 id="documents-heading" className="text-base font-semibold text-[#111111] mb-3">
                {t('td.documents')}
              </h2>
              <ul className="flex flex-col gap-3" role="list">
                {REQUIRED_DOCUMENTS.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#717171]">
                    <FileText size={15} className="flex-shrink-0 text-[#717171] mt-0.5" aria-hidden="true" />
                    {doc}
                  </li>
                ))}
              </ul>
            </section>

            {/* Document Buyers — P7: Envelope Purchase Tracking */}
            <section className="mb-8" aria-labelledby="buyers-heading">
              <div className="flex items-center gap-2 mb-3">
                <Eye size={15} className="text-[#717171]" aria-hidden="true" />
                <h2 id="buyers-heading" className="text-base font-semibold text-[#111111]">
                  Competitors Watching This Tender
                </h2>
              </div>
              {buyers === null ? (
                <div className="h-10 bg-[#F7F7F7] rounded-lg animate-pulse" />
              ) : buyers.available ? (
                <ul className="flex flex-col gap-2">
                  {buyers.buyers.map((b, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 p-3 bg-[#F7F7F7] rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-[#111111]">{b.name}</div>
                        {b.purchaseDate && (
                          <div className="text-xs text-[#717171]">Purchased: {b.purchaseDate}</div>
                        )}
                      </div>
                      {b.businessId && (
                        <a
                          href={`https://www.dbd.go.th/main.php?filename=index&search=${encodeURIComponent(b.businessId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#3B6EA5] hover:underline flex items-center gap-0.5 flex-shrink-0"
                        >
                          DBD <ExternalLink size={11} />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-start gap-2.5 p-3 bg-[#F7F7F7] border border-[#E0E0E0] rounded-lg">
                  <Eye size={14} className="text-[#B0B0B0] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#717171]">
                    Document buyers (ผู้ซื้อซอง) data is fetched from the e-GP portal per tender.
                    Tracking is enabled for tenders in active bidding stage.
                  </p>
                </div>
              )}
            </section>

            {/* Official Reference */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Hash size={15} className="text-[#717171]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-[#111111]">{t('td.reference')}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3 p-4 bg-[#F7F7F7] border border-[#E0E0E0] rounded-xl">
                <div>
                  <p className="text-xs text-[#717171] mb-0.5">{t('td.egpRef')}</p>
                  <p className="font-mono text-sm font-semibold text-[#111111] tracking-wide">{tender.id}</p>
                </div>
                <a
                  href="https://process5.gprocurement.go.th/egp-agpc01-web/announcement"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline focus-ring rounded ml-auto"
                >
                  {t('td.searchEgp')}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>
              <p className="text-xs text-[#717171] mt-2">{t('td.refNote')}</p>
            </section>
          </div>

          {/* RIGHT: sticky sidebar */}
          <aside className="w-full lg:w-80 flex-shrink-0 lg:sticky lg:top-20 flex flex-col gap-4">
            <div className="card shadow-sm">
              {/* Fee notice */}
              <div className="flex items-start gap-2.5 p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg mb-5">
                <Info size={15} className="flex-shrink-0 text-[#B45309] mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-[#B45309]">{t('td.submissionFee')}</p>
                  <p className="text-sm text-[#B45309]">{t('td.feeAmount')}</p>
                </div>
              </div>

              <Link
                href={`/assisted-submission/${tender.id}`}
                className="btn-primary w-full justify-center mb-3"
              >
                {t('td.applyBtn')}
              </Link>
              <p className="text-xs text-[#717171] text-center">{t('td.freeBrowse')}</p>

              <div className="divider my-5" />

              {/* Key dates */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                  {t('td.keyDates')}
                </h3>
                <div className="flex justify-between text-sm">
                  <span className="text-[#717171]">{t('td.posted')}</span>
                  <span className="text-[#111111] font-medium">{relativeDate(tender.deadline, -60, locale)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#717171]">{t('td.decisionExpected')}</span>
                  <span className="text-[#111111] font-medium">{relativeDate(tender.deadline, 30, locale)}</span>
                </div>
              </div>

              <div className="divider my-5" />

              {/* Issuing agency */}
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                  {t('td.issuingAgency')}
                </h3>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#F7F7F7] border border-[#E0E0E0] flex items-center justify-center flex-shrink-0">
                    <Building2 size={14} className="text-[#717171]" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-medium text-[#111111]">{tender.agency}</span>
                </div>
                <p className="text-xs text-[#717171]">{t('td.issuingNote')}</p>
              </div>
            </div>
          </aside>
          {/* Contract Award card — shown when CGD data is available */}
          {awardedContract && (
            <aside className="w-full lg:w-80 flex-shrink-0">
              <div className="card shadow-sm border-l-4 border-l-amber-400">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy size={16} className="text-amber-500" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-[#111111] uppercase tracking-wider">
                    Contract Awarded
                  </h2>
                </div>
                <div className="flex flex-col gap-3 text-sm">
                  <div>
                    <div className="text-xs text-[#717171] mb-0.5">Winner</div>
                    <div className="font-medium text-[#111111]">{awardedContract.winnerName ?? '—'}</div>
                  </div>
                  {awardedContract.agreedPrice && (
                    <div className="flex justify-between">
                      <div>
                        <div className="text-xs text-[#717171] mb-0.5">Contract Value</div>
                        <div className="font-medium text-[#111111]">
                          {'฿' + awardedContract.agreedPrice.toLocaleString('th-TH')}
                        </div>
                      </div>
                      {awardedContract.discountFromReference !== null && (
                        <div className="text-right">
                          <div className="text-xs text-[#717171] mb-0.5">Below Reference</div>
                          <div className="flex items-center gap-1 text-emerald-700 font-medium justify-end">
                            <TrendingDown size={13} aria-hidden="true" />
                            {awardedContract.discountFromReference.toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {awardedContract.contractSignDate && (
                    <div>
                      <div className="text-xs text-[#717171] mb-0.5">Signed</div>
                      <div className="text-[#111111]">{awardedContract.contractSignDate}</div>
                    </div>
                  )}
                  {(awardedContract.losers?.length ?? 0) > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-[#717171] mb-1">
                        <Users size={12} aria-hidden="true" />
                        Losing Bidders
                      </div>
                      <ul className="flex flex-col gap-1">
                        {awardedContract.losers!.map((name) => (
                          <li key={name} className="text-xs text-[#444] bg-[#F7F7F7] rounded px-2 py-1">
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {awardedContract.winnerBusinessId && (
                    <a
                      href={`https://www.dbd.go.th/main.php?filename=index&search=${encodeURIComponent(awardedContract.winnerBusinessId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-[#3B6EA5] hover:underline"
                    >
                      <ExternalLink size={12} aria-hidden="true" />
                      Look up winner on DBD
                    </a>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
