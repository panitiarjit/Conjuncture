'use client';

import React, { useState, useRef } from 'react';
import {
  Hammer, Monitor, Truck, Leaf, Sparkles, Building2, Briefcase,
  MoreHorizontal, Shield, Upload, X, CheckCircle2, Check,
  Stethoscope, GraduationCap, UtensilsCrossed,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useProtectedRoute } from '@/lib/use-protected-route';
import { useLanguage } from '@/lib/language-context';
import { ALL_THAI_PROVINCES, getProvinceName } from '@/lib/data-utils';

interface FormData {
  category: string;
  title: string;
  description: string;
  location: string;
  startTimeline: string;
  projectDuration: string;
  budgetPreset: string;
  budgetMin: string;
  budgetMax: string;
  files: string[];
}

const BUDGET_PRESETS = [
  { id: '50k-200k', label: '฿50K – ฿200K' },
  { id: '200k-500k', label: '฿200K – ฿500K' },
  { id: '500k-1m', label: '฿500K – ฿1M' },
  { id: '1m-5m', label: '฿1M – ฿5M' },
  { id: '5m+', label: '฿5M+' },
];

const INITIAL_FORM: FormData = {
  category: '',
  title: '',
  description: '',
  location: '',
  startTimeline: '',
  projectDuration: '',
  budgetPreset: '',
  budgetMin: '',
  budgetMax: '',
  files: [],
};

function budgetDisplay(formData: FormData): string {
  if (formData.budgetPreset === 'custom') {
    const min = formData.budgetMin ? `฿${Number(formData.budgetMin).toLocaleString('th-TH')}` : '';
    const max = formData.budgetMax ? `฿${Number(formData.budgetMax).toLocaleString('th-TH')}` : '';
    if (min && max) return `${min} – ${max}`;
    if (min) return `From ${min}`;
    if (max) return `Up to ${max}`;
    return '—';
  }
  return BUDGET_PRESETS.find((b) => b.id === formData.budgetPreset)?.label ?? '—';
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <nav aria-label="Form progress" className="mb-10">
      <ol className="flex items-center gap-0">
        {steps.map((label, i) => {
          const step = i + 1;
          const isActive = step === current;
          const isCompleted = step < current;
          const isLast = i === steps.length - 1;
          return (
            <li key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 flex-shrink-0 transition-all duration-200 ${
                    isCompleted || isActive
                      ? 'bg-[#111111] border-[#111111] text-white'
                      : 'bg-white border-[#E0E0E0] text-[#717171]'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? <Check size={14} aria-hidden="true" /> : <span>{step}</span>}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${isActive ? 'text-[#111111]' : 'text-[#717171]'}`}>
                  {label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-2 mb-5 sm:mb-0 transition-colors duration-200 ${step < current ? 'bg-[#111111]' : 'bg-[#E0E0E0]'}`}
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

// ─── Step 1 ──────────────────────────────────────────────────────────────────

function Step1({ formData, onChange, onNext }: {
  formData: FormData;
  onChange: (field: keyof FormData, value: string) => void;
  onNext: () => void;
}) {
  const { t } = useLanguage();

  const categories = [
    { id: 'construction', icon: <Building2 size={32} aria-hidden="true" />, label: t('post.cat.construction'), desc: t('post.cat.construction.d') },
    { id: 'medical', icon: <Stethoscope size={32} aria-hidden="true" />, label: t('post.cat.medical'), desc: t('post.cat.medical.d') },
    { id: 'technology', icon: <Monitor size={32} aria-hidden="true" />, label: t('post.cat.technology'), desc: t('post.cat.technology.d') },
    { id: 'renovation', icon: <Hammer size={32} aria-hidden="true" />, label: t('post.cat.renovation'), desc: t('post.cat.renovation.d') },
    { id: 'education', icon: <GraduationCap size={32} aria-hidden="true" />, label: t('post.cat.education'), desc: t('post.cat.education.d') },
    { id: 'food', icon: <UtensilsCrossed size={32} aria-hidden="true" />, label: t('post.cat.food'), desc: t('post.cat.food.d') },
    { id: 'logistics', icon: <Truck size={32} aria-hidden="true" />, label: t('post.cat.logistics'), desc: t('post.cat.logistics.d') },
    { id: 'security', icon: <Shield size={32} aria-hidden="true" />, label: t('post.cat.security'), desc: t('post.cat.security.d') },
    { id: 'cleaning', icon: <Sparkles size={32} aria-hidden="true" />, label: t('post.cat.cleaning'), desc: t('post.cat.cleaning.d') },
    { id: 'consulting', icon: <Briefcase size={32} aria-hidden="true" />, label: t('post.cat.consulting'), desc: t('post.cat.consulting.d') },
    { id: 'agriculture', icon: <Leaf size={32} aria-hidden="true" />, label: t('post.cat.agriculture'), desc: t('post.cat.agriculture.d') },
    { id: 'other', icon: <MoreHorizontal size={32} aria-hidden="true" />, label: t('post.cat.other'), desc: t('post.cat.other.d') },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#111111] mb-2">{t('post.s1.title')}</h2>
      <p className="text-sm text-[#717171] mb-6">{t('post.s1.desc')}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8" role="radiogroup" aria-label="Project category">
        {categories.map((cat) => {
          const selected = formData.category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange('category', cat.id)}
              className={`flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 focus-ring ${
                selected ? 'border-[#111111] shadow-sm bg-white' : 'border-[#E0E0E0] bg-[#F7F7F7] hover:border-[#C4C4C4] hover:bg-white'
              }`}
            >
              <span className={selected ? 'text-[#111111]' : 'text-[#717171]'}>{cat.icon}</span>
              <div>
                <p className="text-sm font-semibold text-[#111111]">{cat.label}</p>
                <p className="text-xs text-[#717171] mt-0.5 leading-relaxed">{cat.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onNext} disabled={!formData.category} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
          {t('common.next')}
        </button>
      </div>
    </div>
  );
}

// ─── Step 2 ──────────────────────────────────────────────────────────────────

function Step2({ formData, onChange, onBack, onNext }: {
  formData: FormData;
  onChange: (field: keyof FormData, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t, lang } = useLanguage();
  const descLength = formData.description.trim().length;
  const canProceed =
    formData.title.trim().length > 0 &&
    descLength >= 20 &&
    formData.location &&
    formData.startTimeline &&
    formData.projectDuration;

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#111111] mb-2">{t('post.s2.title')}</h2>
      <p className="text-sm text-[#717171] mb-6">{t('post.s2.desc')}</p>
      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="proj-title" className="label">
            {t('post.s2.projTitle')} <span className="text-[#C0392B]" aria-hidden="true">*</span>
          </label>
          <input id="proj-title" type="text" className="input" placeholder={t('post.s2.projTitlePlaceholder')} value={formData.title} onChange={(e) => onChange('title', e.target.value)} />
        </div>
        <div>
          <label htmlFor="proj-desc" className="label">
            {t('post.s2.description')} <span className="text-[#C0392B]" aria-hidden="true">*</span>
          </label>
          <textarea id="proj-desc" rows={5} className="input resize-none" placeholder={t('post.s2.descPlaceholder')} value={formData.description} onChange={(e) => onChange('description', e.target.value)} />
          <p className={`text-xs mt-1.5 ${descLength >= 20 ? 'text-[#2D6A4F]' : 'text-[#717171]'}`}>
            {descLength} / 20 characters minimum
          </p>
        </div>
        <div>
          <label htmlFor="proj-location" className="label">
            {t('post.s2.location')} <span className="text-[#C0392B]" aria-hidden="true">*</span>
          </label>
          <select id="proj-location" className="input" value={formData.location} onChange={(e) => onChange('location', e.target.value)}>
            <option value="">{t('post.s2.locationDefault')}</option>
            {ALL_THAI_PROVINCES.map((province) => (
              <option key={province} value={province}>
                {getProvinceName(province, lang)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="proj-start" className="label">
            {t('post.s2.startTimeline')} <span className="text-[#C0392B]" aria-hidden="true">*</span>
          </label>
          <input
            id="proj-start"
            type="date"
            className="input"
            value={formData.startTimeline}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => onChange('startTimeline', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="proj-duration" className="label">
            {t('post.s2.duration')} <span className="text-[#C0392B]" aria-hidden="true">*</span>
          </label>
          <select id="proj-duration" className="input" value={formData.projectDuration} onChange={(e) => onChange('projectDuration', e.target.value)}>
            <option value="">{t('post.s2.durationDefault')}</option>
            <option value="lt-1-week">{t('post.dur.lt1w')}</option>
            <option value="1-4-weeks">{t('post.dur.1to4w')}</option>
            <option value="1-3-months">{t('post.dur.1to3m')}</option>
            <option value="3-6-months">{t('post.dur.3to6m')}</option>
            <option value="gt-6-months">{t('post.dur.gt6m')}</option>
          </select>
        </div>
      </div>
      <div className="flex justify-between mt-8">
        <button type="button" onClick={onBack} className="btn-outline">{t('common.back')}</button>
        <button type="button" onClick={onNext} disabled={!canProceed} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">{t('common.next')}</button>
      </div>
    </div>
  );
}

// ─── Step 3 ──────────────────────────────────────────────────────────────────

function Step3({ formData, onChange, onBack, onNext }: {
  formData: FormData;
  onChange: (field: keyof FormData, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useLanguage();
  const canProceed =
    formData.budgetPreset !== '' &&
    (formData.budgetPreset !== 'custom' || formData.budgetMin || formData.budgetMax);

  const allPresets = [...BUDGET_PRESETS, { id: 'custom', label: t('post.s3.custom') }];

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#111111] mb-1">{t('post.s3.title')}</h2>
      <p className="text-sm text-[#717171] mb-6">{t('post.s3.desc')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6" role="radiogroup" aria-label="Budget range">
        {allPresets.map((preset) => {
          const selected = formData.budgetPreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange('budgetPreset', preset.id)}
              className={`py-3 px-4 rounded-xl border-2 text-sm font-medium text-center transition-all duration-150 focus-ring ${
                selected ? 'border-[#111111] bg-white text-[#111111] shadow-sm' : 'border-[#E0E0E0] bg-[#F7F7F7] text-[#717171] hover:border-[#C4C4C4] hover:bg-white hover:text-[#111111]'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      {formData.budgetPreset === 'custom' && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label htmlFor="budget-min" className="label">{t('post.s3.budgetMin')}</label>
            <input id="budget-min" type="number" className="input" placeholder="e.g. 100000" min={0} value={formData.budgetMin} onChange={(e) => onChange('budgetMin', e.target.value)} />
          </div>
          <div className="flex-1">
            <label htmlFor="budget-max" className="label">{t('post.s3.budgetMax')}</label>
            <input id="budget-max" type="number" className="input" placeholder="e.g. 500000" min={0} value={formData.budgetMax} onChange={(e) => onChange('budgetMax', e.target.value)} />
          </div>
        </div>
      )}
      <div className="flex items-start gap-3 p-4 bg-[#F7F7F7] border border-[#E0E0E0] rounded-xl mb-8">
        <Shield size={18} className="text-[#2D6A4F] flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-[#717171]">{t('post.s3.escrow')}</p>
      </div>
      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="btn-outline">{t('common.back')}</button>
        <button type="button" onClick={onNext} disabled={!canProceed} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">{t('common.next')}</button>
      </div>
    </div>
  );
}

// ─── Step 4 ──────────────────────────────────────────────────────────────────

function Step4({ formData, onFilesChange, onBack, onNext }: {
  formData: FormData;
  onFilesChange: (files: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected) return;
    const names = Array.from(selected).map((f) => f.name);
    onFilesChange([...formData.files, ...names]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(index: number) {
    onFilesChange(formData.files.filter((_, i) => i !== index));
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#111111] mb-1">
        {t('post.s4.title')}
        <span className="ml-2 text-sm font-normal text-[#717171]">{t('post.s4.optional')}</span>
      </h2>
      <p className="text-sm text-[#717171] mb-6">{t('post.s4.desc')}</p>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full border-2 border-dashed border-[#E0E0E0] rounded-xl p-10 flex flex-col items-center gap-3 hover:border-[#C4C4C4] hover:bg-[#F7F7F7] transition-colors duration-150 focus-ring mb-4"
        aria-label="Upload files"
      >
        <Upload size={28} className="text-[#717171]" aria-hidden="true" />
        <div className="text-center">
          <p className="text-sm font-medium text-[#111111]">{t('post.s4.drag')}</p>
          <p className="text-xs text-[#717171] mt-1">{t('post.s4.fileTypes')}</p>
        </div>
      </button>
      <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handleFileInput} />
      {formData.files.length > 0 && (
        <ul className="flex flex-col gap-2 mb-4" role="list" aria-label="Attached files">
          {formData.files.map((name, i) => (
            <li key={`${name}-${i}`} className="flex items-center justify-between gap-3 p-3 bg-[#F7F7F7] border border-[#E0E0E0] rounded-lg">
              <span className="text-sm text-[#111111] truncate">{name}</span>
              <button type="button" onClick={() => removeFile(i)} className="flex-shrink-0 text-[#717171] hover:text-[#C0392B] transition-colors focus-ring rounded" aria-label={`Remove ${name}`}>
                <X size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[#717171] mb-8">{t('post.s4.privacy')}</p>
      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="btn-outline">{t('common.back')}</button>
        <button type="button" onClick={onNext} className="btn-primary">{t('common.next')}</button>
      </div>
    </div>
  );
}

// ─── Step 5 ──────────────────────────────────────────────────────────────────

function Step5({ formData, onBack, onPublish, published }: {
  formData: FormData;
  onBack: () => void;
  onPublish: () => void;
  published: boolean;
}) {
  const { t } = useLanguage();

  const formatStartDate = (dateStr: string) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';

  const durationLabel: Record<string, string> = {
    'lt-1-week': t('post.dur.lt1w'),
    '1-4-weeks': t('post.dur.1to4w'),
    '1-3-months': t('post.dur.1to3m'),
    '3-6-months': t('post.dur.3to6m'),
    'gt-6-months': t('post.dur.gt6m'),
  };

  const catLabel = (id: string) => t(`post.cat.${id}` as Parameters<typeof t>[0]);

  if (published) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 size={52} className="text-[#2D6A4F] mx-auto mb-4" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-[#111111] mb-2">{t('post.s5.successTitle')}</h2>
        <p className="text-sm text-[#717171] max-w-sm mx-auto">{t('post.s5.successDesc')}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#111111] mb-2">{t('post.s5.title')}</h2>
      <p className="text-sm text-[#717171] mb-6">{t('post.s5.desc')}</p>
      <div className="card mb-5">
        <dl className="flex flex-col gap-4">
          <div>
            <dt className="label mb-0.5">{t('post.s5.category')}</dt>
            <dd className="text-sm text-[#111111]">{catLabel(formData.category)}</dd>
          </div>
          <div className="divider" />
          <div>
            <dt className="label mb-0.5">{t('post.s5.projTitle')}</dt>
            <dd className="text-sm text-[#111111]">{formData.title || '—'}</dd>
          </div>
          <div>
            <dt className="label mb-0.5">{t('post.s5.description')}</dt>
            <dd className="text-sm text-[#717171] leading-relaxed whitespace-pre-wrap">{formData.description || '—'}</dd>
          </div>
          <div className="divider" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <dt className="label mb-0.5">{t('post.s5.location')}</dt>
              <dd className="text-sm text-[#111111]">{formData.location || '—'}</dd>
            </div>
            <div>
              <dt className="label mb-0.5">{t('post.s5.startTimeline')}</dt>
              <dd className="text-sm text-[#111111]">{formatStartDate(formData.startTimeline)}</dd>
            </div>
            <div>
              <dt className="label mb-0.5">{t('post.s5.duration')}</dt>
              <dd className="text-sm text-[#111111]">{durationLabel[formData.projectDuration] ?? '—'}</dd>
            </div>
          </div>
          <div className="divider" />
          <div>
            <dt className="label mb-0.5">{t('post.s5.budget')}</dt>
            <dd className="text-sm font-semibold text-[#111111]">{budgetDisplay(formData)}</dd>
          </div>
          {formData.files.length > 0 && (
            <>
              <div className="divider" />
              <div>
                <dt className="label mb-1">{t('post.s5.documents')}</dt>
                <dd>
                  <ul className="flex flex-col gap-1" role="list">
                    {formData.files.map((name, i) => (
                      <li key={i} className="text-sm text-[#717171]">{name}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>
      <div className="flex items-start gap-3 p-4 bg-[#F7F7F7] border border-[#E0E0E0] rounded-xl mb-8">
        <Shield size={18} className="text-[#2D6A4F] flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-[#717171]">{t('post.s5.escrow')}</p>
      </div>
      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="btn-outline">{t('common.back')}</button>
        <button type="button" onClick={onPublish} className="btn-primary">{t('post.s5.publish')}</button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PostProjectPage() {
  const { isAuthenticated, isLoading } = useProtectedRoute();
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [published, setPublished] = useState(false);

  if (isLoading || !isAuthenticated) return null;

  const stepLabels = [
    t('post.step1'),
    t('post.step2'),
    t('post.step3'),
    t('post.step4'),
    t('post.step5'),
  ];

  function handleChange(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleFilesChange(files: string[]) {
    setFormData((prev) => ({ ...prev, files }));
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-[#F7F7F7]">
        <div className="container-app py-10">
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-[#111111]">{t('post.title')}</h1>
              <p className="text-sm text-[#717171] mt-1">{t('post.subtitle')}</p>
            </div>
            <StepIndicator current={currentStep} steps={stepLabels} />
            <div className="bg-white border border-[#E0E0E0] rounded-2xl p-6 sm:p-8">
              {currentStep === 1 && <Step1 formData={formData} onChange={handleChange} onNext={() => setCurrentStep(2)} />}
              {currentStep === 2 && <Step2 formData={formData} onChange={handleChange} onBack={() => setCurrentStep(1)} onNext={() => setCurrentStep(3)} />}
              {currentStep === 3 && <Step3 formData={formData} onChange={handleChange} onBack={() => setCurrentStep(2)} onNext={() => setCurrentStep(4)} />}
              {currentStep === 4 && <Step4 formData={formData} onFilesChange={handleFilesChange} onBack={() => setCurrentStep(3)} onNext={() => setCurrentStep(5)} />}
              {currentStep === 5 && <Step5 formData={formData} onBack={() => setCurrentStep(4)} onPublish={() => setPublished(true)} published={published} />}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
