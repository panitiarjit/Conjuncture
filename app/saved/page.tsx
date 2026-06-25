'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark, Trash2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import TenderCard from '@/components/ui/TenderCard';
import { getTenders } from '@/lib/data-service-client';
import { useBookmarks } from '@/lib/use-bookmarks';
import type { Tender } from '@/lib/types';

export default function SavedPage() {
  const { bookmarks, toggle } = useBookmarks();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTenders().then((all) => {
      setTenders(all);
      setLoading(false);
    });
  }, []);

  const saved = tenders.filter((t) => bookmarks.has(t.id));

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
          <div className="container-app py-8">
            <nav className="flex items-center gap-2 text-sm text-[#717171] mb-3">
              <Link href="/" className="hover:text-[#111111] transition-colors">Home</Link>
              <span>/</span>
              <span className="text-[#111111] font-medium">Saved Tenders</span>
            </nav>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-[#111111] mb-1">Saved Tenders</h1>
                <p className="text-[#717171] text-sm">
                  {loading ? 'Loading…' : `${saved.length} bookmarked tender${saved.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              {saved.length > 0 && (
                <button
                  onClick={() => { for (const t of saved) toggle(t.id); }}
                  className="flex items-center gap-1.5 text-sm text-[#717171] hover:text-[#B91C1C] transition-colors"
                >
                  <Trash2 size={14} />
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="container-app py-8">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-56 bg-[#F7F7F7] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : saved.length === 0 ? (
            <div className="text-center py-20">
              <Bookmark size={40} className="mx-auto mb-4 text-[#E0E0E0]" />
              <p className="text-[#717171] text-sm mb-4">No saved tenders yet.</p>
              <Link href="/tenders" className="btn-primary text-sm py-2 px-5">
                Browse tenders
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {saved.map((t) => (
                <TenderCard key={t.id} tender={t} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
