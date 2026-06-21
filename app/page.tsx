"use client";

import { useState } from "react";
import type { Lang } from "@/lib/landing-translations";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import BiddingSimulator from "@/components/BiddingSimulator";
import Features from "@/components/Features";
import CaseStudy from "@/components/CaseStudy";
export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  return (
    <>
      <main>
        <Navbar lang={lang} setLang={setLang} />
        <Hero lang={lang} />
        <BiddingSimulator lang={lang} />
        <Features lang={lang} />
        <CaseStudy lang={lang} />
      </main>
      <footer className="border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Conjuncture Co., Ltd. &nbsp;|&nbsp; Bangkok, Thailand
          </p>
          <p className="text-xs text-slate-400">Regulated under Thai procurement law</p>
        </div>
      </footer>
    </>
  );
}
