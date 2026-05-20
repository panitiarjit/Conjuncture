'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import strings from './translations';

export type Language = 'en' | 'th';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('th');

  useEffect(() => {
    const stored = localStorage.getItem('conjuncture-lang') as Language | null;
    if (stored === 'en' || stored === 'th') setLangState(stored);
  }, []);

  function setLang(l: Language) {
    setLangState(l);
    localStorage.setItem('conjuncture-lang', l);
  }

  function t(key: string): string {
    return strings[lang][key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
