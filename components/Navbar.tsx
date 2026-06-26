"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, Menu, X } from "lucide-react";
import { type Lang } from "@/lib/landing-translations";

interface NavbarProps { lang: Lang; setLang: (l: Lang) => void; }

export default function Navbar({ lang, setLang }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const isTh = lang === "th";

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = isTh ? [
    { label: "ผลการวิจัย", href: "#findings" },
    { label: "จำลองราคา", href: "#simulator" },
    { label: "รายงาน", href: "/report" },
  ] : [
    { label: "Findings", href: "#findings" },
    { label: "Simulator", href: "#simulator" },
    { label: "Report", href: "/report" },
  ];

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-200 ${scrolled ? "bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm" : "bg-white"}`}>
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-black text-black text-lg tracking-tight">CONJUNCTURE</span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(l => (
              l.href.startsWith("#") ? (
                <a key={l.href} href={l.href}
                  className={`px-4 py-2 text-sm font-medium text-slate-500 hover:text-black rounded-lg hover:bg-slate-50 transition-colors ${isTh ? "lang-th" : ""}`}>
                  {l.label}
                </a>
              ) : (
                <Link key={l.href} href={l.href}
                  className={`px-4 py-2 text-sm font-medium text-slate-500 hover:text-black rounded-lg hover:bg-slate-50 transition-colors ${isTh ? "lang-th" : ""}`}>
                  {l.label}
                </Link>
              )
            ))}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* GitHub */}
            <a
              href="https://github.com/panitiarjit/Conjuncture"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-black border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              aria-label="View on GitHub"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z"/>
              </svg>
              GitHub
            </a>

            {/* Lang switcher */}
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
              {(["en", "th"] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-3 py-1.5 text-xs font-bold transition-all ${lang === l ? "bg-black text-white" : "bg-white text-slate-500 hover:text-black"}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            <Link
              href="/login"
              className={`hidden md:inline-flex px-4 py-2 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 hover:text-black transition-colors ${isTh ? "lang-th" : ""}`}
            >
              {isTh ? "เข้าสู่ระบบ" : "Login"}
            </Link>
            <Link
              href="/register"
              className={`hidden md:inline-flex px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors ${isTh ? "lang-th" : ""}`}
            >
              {isTh ? "ลงทะเบียน" : "Register"}
            </Link>

            <button className="md:hidden p-2 text-slate-500 hover:text-black" onClick={() => setOpen(!open)}>
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`md:hidden border-t border-slate-100 bg-white overflow-hidden transition-all duration-200 ${open ? "max-h-72" : "max-h-0"}`}>
        <div className="px-6 py-4 space-y-1">
          {links.map(l => (
            l.href.startsWith("#") ? (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}
                className={`block px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-black rounded-lg hover:bg-slate-50 ${isTh ? "lang-th" : ""}`}>
                {l.label}
              </a>
            ) : (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                className={`block px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-black rounded-lg hover:bg-slate-50 ${isTh ? "lang-th" : ""}`}>
                {l.label}
              </Link>
            )
          ))}
          <div className="mt-2 flex gap-2">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={`flex-1 text-center px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 ${isTh ? "lang-th" : ""}`}
            >
              {isTh ? "เข้าสู่ระบบ" : "Login"}
            </Link>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className={`flex-1 text-center px-4 py-2.5 bg-black text-white text-sm font-semibold rounded-lg ${isTh ? "lang-th" : ""}`}
            >
              {isTh ? "ลงทะเบียน" : "Register"}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
