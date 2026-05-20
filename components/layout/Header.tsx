'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  const NAV_LINKS = [
    { label: t('nav.tenders'), href: '/tenders' },
    { label: t('nav.projects'), href: '/projects' },
    { label: t('nav.post'), href: '/post-project' },
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E0E0E0]">
      <div className="container-app">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link
            href="/home"
            className="flex items-center gap-2 flex-shrink-0 focus-ring rounded-md"
            aria-label="Conjuncture home"
          >
            <span className="text-[#111111] text-xl font-semibold tracking-tight leading-none">
              CONJUNCTURE
            </span>
            <span className="text-[#E0E0E0] text-lg leading-none" aria-hidden="true">
              •
            </span>
            <span className="text-lg leading-none" aria-label="Thailand" title="Thailand">
              🇹🇭
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#717171] hover:text-[#111111] hover:bg-[#F7F7F7] transition-colors duration-150 focus-ring"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Language toggle */}
            <div className="flex items-center border border-[#E0E0E0] rounded-lg overflow-hidden text-xs font-semibold">
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1.5 transition-colors duration-150 ${
                  lang === 'en'
                    ? 'bg-[#111111] text-white'
                    : 'bg-white text-[#717171] hover:bg-[#F7F7F7]'
                }`}
                aria-pressed={lang === 'en'}
              >
                EN
              </button>
              <button
                onClick={() => setLang('th')}
                className={`px-2.5 py-1.5 transition-colors duration-150 ${
                  lang === 'th'
                    ? 'bg-[#111111] text-white'
                    : 'bg-white text-[#717171] hover:bg-[#F7F7F7]'
                }`}
                aria-pressed={lang === 'th'}
              >
                TH
              </button>
            </div>

            {isAuthenticated && user ? (
              /* Authenticated user menu */
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E0E0E0] hover:border-[#222222] hover:bg-[#F7F7F7] transition-colors duration-150 focus-ring"
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                >
                  <span className="avatar" aria-hidden="true">
                    {getInitials(user.name)}
                  </span>
                  <span className="hidden sm:block text-sm font-medium text-[#111111] max-w-[140px] truncate">
                    {user.name}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-[#717171] transition-transform duration-150 ${
                      userMenuOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {/* Dropdown */}
                {userMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white border border-[#E0E0E0] rounded-xl shadow-lg py-1 z-50"
                    role="menu"
                    aria-label="User menu"
                  >
                    <div className="px-4 py-3 border-b border-[#E0E0E0]">
                      <p className="text-xs text-[#717171] font-medium uppercase tracking-wider mb-0.5">
                        {user.role === 'buyer' ? t('auth.buyer') : t('auth.vendor')}
                      </p>
                      <p className="text-sm font-semibold text-[#111111] truncate">{user.name}</p>
                      {user.company && (
                        <p className="text-xs text-[#717171] truncate mt-0.5">{user.company}</p>
                      )}
                    </div>

                    <Link
                      href={user.role === 'vendor' ? '/dashboard/vendor' : '/dashboard/buyer'}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#111111] hover:bg-[#F7F7F7] transition-colors duration-100 focus-ring"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <LayoutDashboard size={15} className="text-[#717171]" aria-hidden="true" />
                      {t('auth.dashboard')}
                    </Link>

                    <hr className="border-[#E0E0E0] my-1" />

                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#C0392B] hover:bg-[#FDE8E8] transition-colors duration-100 focus-ring"
                      role="menuitem"
                    >
                      <LogOut size={15} aria-hidden="true" />
                      {t('auth.signOut')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Unauthenticated buttons */
              <>
                <Link href="/admin" className="btn-outline hidden sm:inline-flex text-sm py-2 px-4">
                  {t('auth.signIn')}
                </Link>
                <Link href="/admin" className="btn-primary text-sm py-2 px-4">
                  {t('auth.getStarted')}
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-[#E0E0E0] hover:bg-[#F7F7F7] transition-colors duration-150 focus-ring ml-1"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
            >
              {mobileMenuOpen ? (
                <X size={18} className="text-[#111111]" aria-hidden="true" />
              ) : (
                <Menu size={18} className="text-[#111111]" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav"
          className="md:hidden border-t border-[#E0E0E0] bg-white"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="container-app py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                className="flex items-center px-4 py-3 rounded-lg text-sm font-medium text-[#111111] hover:bg-[#F7F7F7] transition-colors duration-150 focus-ring"
              >
                {link.label}
              </Link>
            ))}

            {!isAuthenticated && (
              <div className="flex flex-col gap-2 pt-3 mt-2 border-t border-[#E0E0E0]">
                <Link
                  href="/admin"
                  onClick={closeMobileMenu}
                  className="btn-outline w-full justify-center text-sm"
                >
                  {t('auth.signIn')}
                </Link>
                <Link
                  href="/admin"
                  onClick={closeMobileMenu}
                  className="btn-primary w-full justify-center text-sm"
                >
                  {t('auth.getStarted')}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
