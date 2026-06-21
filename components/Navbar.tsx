"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Menu, X } from "lucide-react";
import { t, type Lang } from "@/lib/landing-translations";

interface NavbarProps { lang: Lang; setLang: (l: Lang) => void; }

export default function Navbar({ lang, setLang }: NavbarProps) {
  const tx = t[lang].nav;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const isTh = lang === "th";

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    { label: tx.features, href: "#features" },
    { label: tx.simulator, href: "#simulator" },
    { label: tx.caseStudy, href: "#case-study" },
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
            <span className="font-black text-black text-lg tracking-tight">{tx.logo}</span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <a key={l.href} href={l.href}
                className={`px-4 py-2 text-sm font-medium text-slate-500 hover:text-black rounded-lg hover:bg-slate-50 transition-colors ${isTh ? "lang-th" : ""}`}>
                {l.label}
              </a>
            ))}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Lang switcher */}
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
              {(["en", "th"] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-3 py-1.5 text-xs font-bold transition-all ${lang === l ? "bg-black text-white" : "bg-white text-slate-500 hover:text-black"}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            <a href="mailto:panitiarjit@gmail.com?subject=Demo%20Request&body=Hi%2C%0A%0AI%27d%20like%20to%20request%20a%20demo%20of%20Conjuncture."
              className={`hidden md:inline-flex px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors ${isTh ? "lang-th" : ""}`}>
              {tx.requestDemo}
            </a>

            <button className="md:hidden p-2 text-slate-500 hover:text-black" onClick={() => setOpen(!open)}>
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`md:hidden border-t border-slate-100 bg-white overflow-hidden transition-all duration-200 ${open ? "max-h-64" : "max-h-0"}`}>
        <div className="px-6 py-4 space-y-1">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={`block px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-black rounded-lg hover:bg-slate-50 ${isTh ? "lang-th" : ""}`}>
              {l.label}
            </a>
          ))}
          <a href="mailto:panitiarjit@gmail.com?subject=Demo%20Request&body=Hi%2C%0A%0AI%27d%20like%20to%20request%20a%20demo%20of%20Conjuncture."
            className={`mt-2 block text-center px-4 py-2.5 bg-black text-white text-sm font-semibold rounded-lg ${isTh ? "lang-th" : ""}`}>
            {tx.requestDemo}
          </a>
        </div>
      </div>
    </nav>
  );
}
