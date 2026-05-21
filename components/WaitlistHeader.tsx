'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/language-context';

export default function WaitlistHeader() {
  const { lang, setLang } = useLanguage();
  return (
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
              >EN</button>
              <button
                onClick={() => setLang('th')}
                className={`px-2.5 py-1.5 transition-colors duration-150 ${lang === 'th' ? 'bg-[#111111] text-white' : 'bg-white text-[#717171] hover:bg-[#F7F7F7]'}`}
                aria-pressed={lang === 'th'}
              >TH</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
