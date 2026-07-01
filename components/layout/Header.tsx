'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

const INSIGHTS_LINK_KEYS = [
  { key: 'nav.market-intel'      as const, href: '/intelligence' },
  { key: 'nav.agency-intel'      as const, href: '/agency' },
  { key: 'nav.contractor-intel'  as const, href: '/contractor-intel' },
  { key: 'nav.plans'             as const, href: '/plans' },
];

const REPORT_NAV = { labelTh: 'รายงาน', labelEn: 'Report', href: '/report' };

export default function Header({ dark = false }: { dark?: boolean }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const insightsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (insightsRef.current && !insightsRef.current.contains(e.target as Node)) {
        setInsightsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  const d = dark;
  const linkCls = d
    ? "px-3 py-2 rounded-lg text-sm font-medium text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1A2B48] transition-colors duration-150 focus-ring"
    : "px-3 py-2 rounded-lg text-sm font-medium text-[#717171] hover:text-[#111111] hover:bg-[#F7F7F7] transition-colors duration-150 focus-ring";

  return (
    <header className={`sticky top-0 z-50 border-b ${d ? 'bg-[#0D1628] border-[#1A2B48]' : 'bg-white border-[#E0E0E0]'}`}>
      <div className="container-app">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link
            href="/home"
            className="flex items-center gap-2 flex-shrink-0 focus-ring rounded-md"
            aria-label="Conjuncture home"
          >
            <span className={`text-xl font-semibold tracking-tight leading-none ${d ? 'text-[#E2E8F0]' : 'text-[#111111]'}`}>
              CONJUNCTURE
            </span>
            <span className={`text-lg leading-none ${d ? 'text-[#1A2B48]' : 'text-[#E0E0E0]'}`} aria-hidden="true">•</span>
            <span className="text-lg leading-none" aria-label="Thailand" title="Thailand">🇹🇭</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5" aria-label="Main navigation">
            {/* Insights dropdown */}
            <div className="relative" ref={insightsRef}>
              <button
                onClick={() => setInsightsOpen(v => !v)}
                className={`${linkCls} flex items-center gap-1`}
                aria-haspopup="true"
                aria-expanded={insightsOpen}
              >
                {t('nav.insights.label')}
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-150 ${insightsOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
              {insightsOpen && (
                <div
                  className={`absolute top-full left-0 mt-1 w-52 border rounded-xl shadow-lg py-1 z-50 ${d ? 'bg-[#0D1628] border-[#1A2B48]' : 'bg-white border-[#E0E0E0]'}`}
                  role="menu"
                >
                  {INSIGHTS_LINK_KEYS.map(link => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block px-4 py-2.5 text-sm transition-colors duration-100 ${d ? 'text-[#C4D3E8] hover:bg-[#1A2B48]' : 'text-[#111111] hover:bg-[#F7F7F7]'}`}
                      role="menuitem"
                      onClick={() => setInsightsOpen(false)}
                    >
                      {t(link.key)}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link href="/bidtool" className={linkCls}>{t('nav.bid-tool')}</Link>
            <Link href="/report" className={linkCls}>{lang === 'th' ? REPORT_NAV.labelTh : REPORT_NAV.labelEn}</Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* GitHub */}
            <a
              href="https://github.com/panitiarjit/Conjuncture"
              target="_blank"
              rel="noopener noreferrer"
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${d ? 'border-[#1A2B48] text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1A2B48]' : 'border-slate-200 text-slate-500 hover:text-black hover:bg-slate-50'}`}
              aria-label="View on GitHub"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z"/>
              </svg>
              GitHub
            </a>

            {/* Language toggle */}
            <div className={`flex items-center border rounded-lg overflow-hidden text-xs font-semibold ${d ? 'border-[#1A2B48]' : 'border-[#E0E0E0]'}`}>
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1.5 transition-colors duration-150 ${
                  lang === 'en'
                    ? d ? 'bg-[#2563EB] text-white' : 'bg-[#111111] text-white'
                    : d ? 'bg-transparent text-[#64748B] hover:bg-[#1A2B48]' : 'bg-white text-[#717171] hover:bg-[#F7F7F7]'
                }`}
                aria-pressed={lang === 'en'}
              >
                EN
              </button>
              <button
                onClick={() => setLang('th')}
                className={`px-2.5 py-1.5 transition-colors duration-150 ${
                  lang === 'th'
                    ? d ? 'bg-[#2563EB] text-white' : 'bg-[#111111] text-white'
                    : d ? 'bg-transparent text-[#64748B] hover:bg-[#1A2B48]' : 'bg-white text-[#717171] hover:bg-[#F7F7F7]'
                }`}
                aria-pressed={lang === 'th'}
              >
                TH
              </button>
            </div>

            {isAuthenticated && user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(prev => !prev)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors duration-150 focus-ring ${d ? 'border-[#1A2B48] hover:border-[#3B82F6] hover:bg-[#1A2B48]' : 'border-[#E0E0E0] hover:border-[#222222] hover:bg-[#F7F7F7]'}`}
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                >
                  <span className="avatar" aria-hidden="true">{getInitials(user.name)}</span>
                  <span className={`hidden sm:block text-sm font-medium max-w-[140px] truncate ${d ? 'text-[#E2E8F0]' : 'text-[#111111]'}`}>
                    {user.name}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-150 ${d ? 'text-[#64748B]' : 'text-[#717171]'} ${userMenuOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {userMenuOpen && (
                  <div
                    className={`absolute right-0 mt-2 w-56 border rounded-xl shadow-lg py-1 z-50 ${d ? 'bg-[#0D1628] border-[#1A2B48]' : 'bg-white border-[#E0E0E0]'}`}
                    role="menu"
                    aria-label="User menu"
                  >
                    <div className={`px-4 py-3 border-b ${d ? 'border-[#1A2B48]' : 'border-[#E0E0E0]'}`}>
                      <p className={`text-sm font-semibold truncate ${d ? 'text-[#E2E8F0]' : 'text-[#111111]'}`}>{user.name}</p>
                      {user.company && (
                        <p className={`text-xs truncate mt-0.5 ${d ? 'text-[#64748B]' : 'text-[#717171]'}`}>{user.company}</p>
                      )}
                    </div>

                    <hr className={`my-1 ${d ? 'border-[#1A2B48]' : 'border-[#E0E0E0]'}`} />

                    <button
                      onClick={() => { logout(); setUserMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-100 focus-ring ${d ? 'text-red-400 hover:bg-red-950/40' : 'text-[#C0392B] hover:bg-[#FDE8E8]'}`}
                      role="menuitem"
                    >
                      <LogOut size={15} aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" className={`hidden sm:inline-flex text-sm py-2 px-4 rounded-lg border font-medium transition-colors ${d ? 'border-[#1A2B48] text-[#C4D3E8] hover:bg-[#1A2B48]' : 'btn-outline'}`}>
                  Sign in
                </Link>
                <Link href="/register" className={d ? 'inline-flex text-sm py-2 px-4 rounded-lg bg-[#2563EB] text-white font-medium hover:bg-[#1D4ED8] transition-colors' : 'btn-primary text-sm py-2 px-4'}>
                  Register
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              className={`md:hidden flex items-center justify-center w-9 h-9 rounded-lg border transition-colors duration-150 focus-ring ml-1 ${d ? 'border-[#1A2B48] hover:bg-[#1A2B48]' : 'border-[#E0E0E0] hover:bg-[#F7F7F7]'}`}
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
            >
              {mobileMenuOpen ? (
                <X size={18} className={d ? 'text-[#E2E8F0]' : 'text-[#111111]'} aria-hidden="true" />
              ) : (
                <Menu size={18} className={d ? 'text-[#E2E8F0]' : 'text-[#111111]'} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav"
          className={`md:hidden border-t ${d ? 'bg-[#0D1628] border-[#1A2B48]' : 'bg-white border-[#E0E0E0]'}`}
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="container-app py-4 flex flex-col gap-1">
            {([
              { key: 'nav.market-intel',     href: '/intelligence' },
              { key: 'nav.agency-intel',     href: '/agency' },
              { key: 'nav.contractor-intel', href: '/contractor-intel' },
              { key: 'nav.plans',            href: '/plans' },
              { key: 'nav.bid-tool',         href: '/bidtool' },
            ] as const).map((link) => ({...link, label: t(link.key)})).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-150 focus-ring ${d ? 'text-[#C4D3E8] hover:bg-[#1A2B48]' : 'text-[#111111] hover:bg-[#F7F7F7]'}`}
              >
                {link.label}
              </Link>
            ))}

            <Link
              href="/report"
              onClick={closeMobileMenu}
              className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-150 focus-ring ${d ? 'text-[#C4D3E8] hover:bg-[#1A2B48]' : 'text-[#111111] hover:bg-[#F7F7F7]'}`}
            >
              {lang === 'th' ? 'รายงาน' : 'Report'}
            </Link>

            {!isAuthenticated && (
              <div className={`flex flex-col gap-2 pt-3 mt-2 border-t ${d ? 'border-[#1A2B48]' : 'border-[#E0E0E0]'}`}>
                <Link href="/login" onClick={closeMobileMenu} className={`w-full justify-center text-sm rounded-lg border px-4 py-2 font-medium text-center ${d ? 'border-[#1A2B48] text-[#C4D3E8] hover:bg-[#1A2B48]' : 'btn-outline'}`}>
                  Sign in
                </Link>
                <Link href="/register" onClick={closeMobileMenu} className={`w-full justify-center text-sm rounded-lg px-4 py-2 font-medium text-center ${d ? 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]' : 'btn-primary'}`}>
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
