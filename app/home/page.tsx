'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Lock,
  ShieldCheck,
  EyeOff,
  Scale,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import TenderCard from '@/components/ui/TenderCard';
import ProjectCard from '@/components/ui/ProjectCard';
import { TENDERS, PROJECTS } from '@/lib/mock-data';
import { useProtectedRoute } from '@/lib/use-protected-route';
import { useLanguage } from '@/lib/language-context';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useProtectedRoute();
  const { t } = useLanguage();
  if (isLoading || !isAuthenticated) return null;
  const featuredTenders = TENDERS.slice(0, 3);
  const featuredProjects = PROJECTS.slice(0, 3);

  const buyerSteps = [
    { n: '1', h: t('how.buyers.s1.h'), d: t('how.buyers.s1.d') },
    { n: '2', h: t('how.buyers.s2.h'), d: t('how.buyers.s2.d') },
    { n: '3', h: t('how.buyers.s3.h'), d: t('how.buyers.s3.d') },
  ];

  const vendorSteps = [
    { n: '1', h: t('how.vendors.s1.h'), d: t('how.vendors.s1.d') },
    { n: '2', h: t('how.vendors.s2.h'), d: t('how.vendors.s2.d') },
    { n: '3', h: t('how.vendors.s3.h'), d: t('how.vendors.s3.d') },
  ];

  const buyerFeatures = [
    t('val.buyers.f1'),
    t('val.buyers.f2'),
    t('val.buyers.f3'),
    t('val.buyers.f4'),
  ];

  const vendorFeatures = [
    t('val.vendors.f1'),
    t('val.vendors.f2'),
    t('val.vendors.f3'),
    t('val.vendors.f4'),
  ];

  const trustItems = [
    { icon: <Lock size={22} aria-hidden="true" />, h: t('trust.escrow.h'), d: t('trust.escrow.d') },
    { icon: <ShieldCheck size={22} aria-hidden="true" />, h: t('trust.verified.h'), d: t('trust.verified.d') },
    { icon: <EyeOff size={22} aria-hidden="true" />, h: t('trust.sealed.h'), d: t('trust.sealed.d') },
    { icon: <Scale size={22} aria-hidden="true" />, h: t('trust.dispute.h'), d: t('trust.dispute.d') },
  ];

  return (
    <>
      <Header />

      <main>
        {/* ── 1. HERO ─────────────────────────────────────────────────────── */}
        <section className="section bg-white">
          <div className="container-app">
            <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
              <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-[#111111] leading-[1.1]">
                {t('hero.headline')}
              </h1>
              <p className="text-lg text-[#717171] max-w-xl leading-relaxed">
                {t('hero.sub')}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href="/post-project" className="btn-primary px-6 py-3 text-base">
                  {t('hero.postProject')}
                </Link>
                <Link href="/projects" className="btn-outline px-6 py-3 text-base">
                  {t('hero.findWork')}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. HOW IT WORKS ─────────────────────────────────────────────── */}
        <section className="section bg-[#F7F7F7]">
          <div className="container-app">
            <h2 className="text-3xl font-semibold text-center text-[#111111] mb-12">
              {t('how.title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="card flex flex-col gap-6">
                <div>
                  <span className="badge mb-3">{t('how.buyers.badge')}</span>
                  <h3 className="text-xl font-semibold text-[#111111]">{t('how.buyers.title')}</h3>
                </div>
                <ol className="flex flex-col gap-5">
                  {buyerSteps.map((step) => (
                    <li key={step.n} className="flex items-start gap-4">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#111111] text-white text-sm font-semibold flex items-center justify-center">
                        {step.n}
                      </span>
                      <div>
                        <p className="font-medium text-[#111111] text-sm">{step.h}</p>
                        <p className="text-sm text-[#717171] mt-0.5 leading-relaxed">{step.d}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="card flex flex-col gap-6">
                <div>
                  <span className="badge mb-3">{t('how.vendors.badge')}</span>
                  <h3 className="text-xl font-semibold text-[#111111]">{t('how.vendors.title')}</h3>
                </div>
                <ol className="flex flex-col gap-5">
                  {vendorSteps.map((step) => (
                    <li key={step.n} className="flex items-start gap-4">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#111111] text-white text-sm font-semibold flex items-center justify-center">
                        {step.n}
                      </span>
                      <div>
                        <p className="font-medium text-[#111111] text-sm">{step.h}</p>
                        <p className="text-sm text-[#717171] mt-0.5 leading-relaxed">{step.d}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. VALUE PROPS ──────────────────────────────────────────────── */}
        <section className="section bg-white">
          <div className="container-app">
            <h2 className="text-3xl font-semibold text-center text-[#111111] mb-12">
              {t('val.title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="rounded-[12px] p-8 flex flex-col gap-6" style={{ backgroundColor: '#111111' }}>
                <div>
                  <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-white/10 text-white border border-white/20 mb-3">
                    {t('val.buyers.badge')}
                  </span>
                  <h3 className="text-xl font-semibold text-white">{t('val.buyers.title')}</h3>
                </div>
                <ul className="flex flex-col gap-3">
                  {buyerFeatures.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm text-white/90">
                      <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#d8f3dc' }} aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card flex flex-col gap-6">
                <div>
                  <span className="badge mb-3">{t('val.vendors.badge')}</span>
                  <h3 className="text-xl font-semibold text-[#111111]">{t('val.vendors.title')}</h3>
                </div>
                <ul className="flex flex-col gap-3">
                  {vendorFeatures.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm text-[#717171]">
                      <CheckCircle2 size={16} className="text-[#2D6A4F] flex-shrink-0 mt-0.5" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. GOVERNMENT TENDERS ───────────────────────────────────────── */}
        <section className="section bg-[#F7F7F7]">
          <div className="container-app">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-semibold text-[#111111]">{t('tenders.title')}</h2>
                <p className="text-[#717171] mt-2 max-w-xl text-sm leading-relaxed">{t('tenders.desc')}</p>
              </div>
              <Link
                href="/tenders"
                className="text-sm font-medium text-[#111111] hover:text-[#717171] transition-colors duration-150 flex-shrink-0 flex items-center gap-1"
              >
                {t('tenders.browseAll')}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredTenders.map((tender) => (
                <TenderCard key={tender.id} tender={tender} />
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. PRIVATE PROJECTS ─────────────────────────────────────────── */}
        <section className="section bg-white">
          <div className="container-app">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-semibold text-[#111111]">{t('projects.title')}</h2>
                <p className="text-[#717171] mt-2 max-w-xl text-sm leading-relaxed">{t('projects.desc')}</p>
              </div>
              <Link
                href="/projects"
                className="text-sm font-medium text-[#111111] hover:text-[#717171] transition-colors duration-150 flex-shrink-0 flex items-center gap-1"
              >
                {t('projects.browseAll')}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </section>

        {/* ── 6. TRUST SIGNALS ────────────────────────────────────────────── */}
        <section className="section bg-[#F7F7F7]">
          <div className="container-app">
            <h2 className="text-3xl font-semibold text-center text-[#111111] mb-10">
              {t('trust.title')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {trustItems.map((item) => (
                <div key={item.h} className="card flex flex-col gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#111111] text-white flex items-center justify-center flex-shrink-0">
                    {item.icon}
                  </div>
                  <h3 className="font-semibold text-[#111111] text-base">{item.h}</h3>
                  <p className="text-sm text-[#717171] leading-relaxed">{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
