'use client';

import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import app from '@/lib/firebase';

type Role = 'buyer' | 'vendor';
type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function WaitlistForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('buyer');
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setFormState('submitting');
    setErrorMsg('');
    try {
      const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const db = getFirestore(app!);
      await addDoc(collection(db, 'waitlist'), { email, role, createdAt: serverTimestamp() });
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

  if (formState === 'success') {
    return (
      <div className="w-full rounded-[12px] border border-[#b7e4c7] bg-[#d8f3dc] px-8 py-10 flex flex-col items-center gap-3">
        <CheckCircle2 size={36} className="text-[#2D6A4F]" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-[#2D6A4F]">{t('waitlist.successHeadline')}</h2>
        <p className="text-sm text-[#2D6A4F]/80 leading-relaxed">{t('waitlist.successSub')}</p>
      </div>
    );
  }

  return (
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
            role === 'buyer' ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white text-[#717171] border-[#E0E0E0] hover:border-[#222222] hover:bg-[#F7F7F7]'
          }`}
          aria-pressed={role === 'buyer'}
        >
          {t('waitlist.roleBuyer')}
        </button>
        <button
          type="button"
          onClick={() => setRole('vendor')}
          className={`py-2.5 px-4 rounded-[8px] text-sm font-medium border transition-colors duration-150 ${
            role === 'vendor' ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white text-[#717171] border-[#E0E0E0] hover:border-[#222222] hover:bg-[#F7F7F7]'
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
  );
}
