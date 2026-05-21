'use client';

import { EyeOff, Lock, Scale, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import WaitlistFormLoader from '@/components/WaitlistFormLoader';

const featureIcons = [EyeOff, Lock, Scale, ShieldCheck];
const featureKeys = ['f1', 'f2', 'f3', 'f4'] as const;

export default function WaitlistPageContent() {
  const { t } = useLanguage();

  const features = featureKeys.map((k, i) => ({
    Icon: featureIcons[i],
    h: t(`waitlist.${k}.h` as Parameters<typeof t>[0]),
    d: t(`waitlist.${k}.d` as Parameters<typeof t>[0]),
  }));

  const headlineParts = t('waitlist.headline').split('\n');

  return (
    <main className="flex-1">
      {/* Hero + form */}
      <section className="section bg-white">
        <div className="container-app">
          <div className="max-w-lg mx-auto flex flex-col items-center text-center gap-6">
            <span className="badge">{t('waitlist.badge')}</span>
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-[#111111] leading-[1.35]">
              {headlineParts[0]}
              {headlineParts[1] && <><br />{headlineParts[1]}</>}
            </h1>
            <p className="text-base text-[#717171] leading-relaxed max-w-md">
              {t('waitlist.sub')}
            </p>
            <WaitlistFormLoader />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section bg-[#F7F7F7]">
        <div className="container-app">
          <h2 className="text-2xl font-semibold text-center text-[#111111] mb-10">
            {t('waitlist.featuresTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {features.map((f) => (
              <div key={f.h} className="card flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#111111] text-white flex items-center justify-center flex-shrink-0">
                  <f.Icon size={20} aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-[#111111] text-base">{f.h}</h3>
                <p className="text-sm text-[#717171] leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
