'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Lock, ShieldCheck, EyeOff, Scale } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

type Role = 'buyer' | 'vendor';
type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function WaitlistPage() {
  const { lang, setLang, t } = useLanguage();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('buyer');
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('[waitlist] submit fired, email:', email);
    if (!email) { console.log('[waitlist] empty email, returning'); return; }
    setFormState('submitting');
    setErrorMsg('');

    try {
      await addDoc(collection(db, 'waitlist'), {
        email,
        role,
        createdAt: serverTimestamp(),
      });
      // Fire-and-forget email — don't block success on it
      fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      }).catch(console.error);
      setFormState('success');
    } catch (err) {
      console.error('[waitlist] failed:', err);
      setErrorMsg('Something went wrong. Please try again.');
      setFormState('error');
    }
  }

  const features = [
    { icon: <EyeOff size={20} aria-hidden="true" />, h: t('waitlist.f1.h'), d: t('waitlist.f1.d') },
    { icon: <Lock size={20} aria-hidden="true" />, h: t('waitlist.f2.h'), d: t('waitlist.f2.d') },
    { icon: <Scale size={20} aria-hidden="true" />, h: t('waitlist.f3.h'), d: t('waitlist.f3.d') },
    { icon: <ShieldCheck size={20} aria-hidden="true" />, h: t('waitlist.f4.h'), d: t('waitlist.f4.d') },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ── Minimal header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E0E0E0]">
        <div className="container-app">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 focus-ring rounded-md" aria-label="Conjuncture home">
              <span className="text-[#111111] text-xl font-semibold tracking-tight leading-none">CONJUNCTURE</span>
              <span className="text-[#E0E0E0] text-lg leading-none" aria-hidden="true">•</span>
              <span className="text-lg leading-none" aria-label="Thailand" title="Thailand">🇹🇭</span>
            </Link>

            <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-xs text-[#717171] hover:text-[#111111] transition-colors duration-150"
            >
              Sign in
            </Link>
            <div className="flex items-center border border-[#E0E0E0] rounded-lg overflow-hidden text-xs font-semibold">
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1.5 transition-colors duration-150 ${lang === 'en' ? 'bg-[#111111] text-white' : 'bg-white text-[#717171] hover:bg-[#F7F7F7]'}`}
                aria-pressed={lang === 'en'}
              >
                EN
              </button>
              <button
                onClick={() => setLang('th')}
                className={`px-2.5 py-1.5 transition-colors duration-150 ${lang === 'th' ? 'bg-[#111111] text-white' : 'bg-white text-[#717171] hover:bg-[#F7F7F7]'}`}
                aria-pressed={lang === 'th'}
              >
                TH
              </button>
            </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero + form ─────────────────────────────────────────────── */}
        <section className="section bg-white">
          <div className="container-app">
            <div className="max-w-lg mx-auto flex flex-col items-center text-center gap-6">
              <span className="badge">{t('waitlist.badge')}</span>

              <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-[#111111] leading-[1.35] whitespace-pre-line">
                {t('waitlist.headline')}
              </h1>

              <p className="text-base text-[#717171] leading-relaxed max-w-md">
                {t('waitlist.sub')}
              </p>

              {formState === 'success' ? (
                <div className="w-full rounded-[12px] border border-[#b7e4c7] bg-[#d8f3dc] px-8 py-10 flex flex-col items-center gap-3">
                  <CheckCircle2 size={36} className="text-[#2D6A4F]" aria-hidden="true" />
                  <h2 className="text-lg font-semibold text-[#2D6A4F]">{t('waitlist.successHeadline')}</h2>
                  <p className="text-sm text-[#2D6A4F]/80 leading-relaxed">{t('waitlist.successSub')}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3" noValidate>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('waitlist.emailPlaceholder')}
                    required
                    className="input"
                    autoComplete="email"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('buyer')}
                      className={`py-2.5 px-4 rounded-[8px] text-sm font-medium border transition-colors duration-150 ${
                        role === 'buyer'
                          ? 'bg-[#111111] text-white border-[#111111]'
                          : 'bg-white text-[#717171] border-[#E0E0E0] hover:border-[#222222] hover:bg-[#F7F7F7]'
                      }`}
                      aria-pressed={role === 'buyer'}
                    >
                      {t('waitlist.roleBuyer')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('vendor')}
                      className={`py-2.5 px-4 rounded-[8px] text-sm font-medium border transition-colors duration-150 ${
                        role === 'vendor'
                          ? 'bg-[#111111] text-white border-[#111111]'
                          : 'bg-white text-[#717171] border-[#E0E0E0] hover:border-[#222222] hover:bg-[#F7F7F7]'
                      }`}
                      aria-pressed={role === 'vendor'}
                    >
                      {t('waitlist.roleVendor')}
                    </button>
                  </div>

                  {formState === 'error' && (
                    <p className="text-sm text-[#C0392B]" role="alert">{errorMsg}</p>
                  )}

                  <button
                    type="submit"
                    disabled={formState === 'submitting' || !email}
                    className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {formState === 'submitting' ? t('waitlist.submitting') : t('waitlist.cta')}
                  </button>

                  <p className="text-xs text-[#717171]">{t('waitlist.privacy')}</p>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────── */}
        <section className="section bg-[#F7F7F7]">
          <div className="container-app">
            <h2 className="text-2xl font-semibold text-center text-[#111111] mb-10">
              {t('waitlist.featuresTitle')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
              {features.map((f) => (
                <div key={f.h} className="card flex flex-col gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#111111] text-white flex items-center justify-center flex-shrink-0">
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-[#111111] text-base">{f.h}</h3>
                  <p className="text-sm text-[#717171] leading-relaxed">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Minimal footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-[#E0E0E0] bg-white">
        <div className="container-app py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#717171]">
              &copy; 2025 Conjuncture Co., Ltd. &nbsp;|&nbsp; Bangkok, Thailand
            </p>
            <p className="text-xs text-[#717171]">
              Regulated under Thai procurement law
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
