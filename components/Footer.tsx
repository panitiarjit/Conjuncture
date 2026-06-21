"use client";

import { TrendingUp, Mail, Globe, X, AtSign } from "lucide-react";
import { t, type Lang } from "@/lib/landing-translations";

interface FooterProps {
  lang: Lang;
}

export default function Footer({ lang }: FooterProps) {
  const tx = t[lang].footer;
  const isTh = lang === "th";

  return (
    <footer className="bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer grid */}
        <div className="py-14 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-2">
            <a href="#" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-md shadow-blue-500/20">
                <TrendingUp className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-black text-black text-lg tracking-tight">Conjuncture</span>
            </a>
            <p
              className={`text-sm text-slate-400 max-w-xs leading-relaxed mb-6 ${
                isTh ? "lang-th" : ""
              }`}
            >
              {tx.tagline}
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3">
              {[
                { icon: X, label: "X" },
                { icon: AtSign, label: "LinkedIn" },
                { icon: Globe, label: "Website" },
                { icon: Mail, label: "Email" },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-black transition-all"
                >
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4
              className={`text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 ${
                isTh ? "lang-th" : ""
              }`}
            >
              {tx.product}
            </h4>
            <ul className="space-y-3">
              {tx.productLinks.map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    className={`text-sm text-slate-400 hover:text-slate-300 transition-colors ${
                      isTh ? "lang-th" : ""
                    }`}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4
              className={`text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 ${
                isTh ? "lang-th" : ""
              }`}
            >
              {tx.company}
            </h4>
            <ul className="space-y-3">
              {tx.companyLinks.map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    className={`text-sm text-slate-400 hover:text-slate-300 transition-colors ${
                      isTh ? "lang-th" : ""
                    }`}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h4
              className={`text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 ${
                isTh ? "lang-th" : ""
              }`}
            >
              {tx.legal}
            </h4>
            <ul className="space-y-3">
              {tx.legalLinks.map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    className={`text-sm text-slate-400 hover:text-slate-300 transition-colors ${
                      isTh ? "lang-th" : ""
                    }`}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p
            className={`text-xs text-slate-400 ${isTh ? "lang-th text-[0.72rem]" : ""}`}
          >
            {tx.copyright}
          </p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-slow" />
            <span className="text-xs text-slate-400">
              {isTh ? "ระบบทำงานปกติ" : "All systems operational"}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
