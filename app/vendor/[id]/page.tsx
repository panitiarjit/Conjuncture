'use client';
import { useProtectedRoute } from '@/lib/use-protected-route';

import React, { useState, use } from 'react';
import {
  Building2,
  Star,
  MapPin,
  Briefcase,
  CheckCircle2,
  MessageCircle,
  Clock,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { getVendorById } from '@/lib/data-service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatYear(dateStr: string): string {
  return new Date(dateStr).getFullYear().toString();
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    construction: 'Construction',
    technology: 'Technology',
    logistics: 'Logistics',
    agriculture: 'Agriculture',
    cleaning: 'Cleaning',
    consulting: 'Consulting',
    renovation: 'Renovation',
    other: 'General',
  };
  return map[cat] ?? cat;
}

function getInitials(name: string): string {
  return name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={13}
          className={i <= Math.round(rating) ? 'star-filled' : 'star-empty'}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = (value / 5) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[#717171] w-36 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#111111] rounded-full"
          style={{ width: `${pct}%` }}
          aria-label={`${value} out of 5`}
        />
      </div>
      <span className="text-sm font-medium text-[#111111] w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

// ─── Bio text by category ─────────────────────────────────────────────────────

function getBio(companyName: string, categories: string[]): string {
  const cat = categories[0] ?? 'other';
  const bios: Record<string, string> = {
    technology:
      `${companyName} is a full-service technology and consulting firm based in Bangkok. ` +
      'The team specialises in enterprise software development, IT infrastructure, and digital transformation for mid-market and enterprise clients across Thailand. ' +
      'With a track record spanning multiple industries, the company delivers robust, scalable systems that integrate seamlessly with existing business operations.',
    construction:
      `${companyName} is a licensed construction and engineering contractor operating throughout Thailand. ` +
      'The company manages projects from concept through completion, including commercial buildings, industrial facilities, and infrastructure works. ' +
      'All projects are managed by certified civil engineers with proven experience in both private-sector and government contracts.',
    logistics:
      `${companyName} provides comprehensive freight, warehousing, and last-mile delivery services across Thailand. ` +
      'The company operates a modern fleet and a real-time shipment tracking platform, serving clients in manufacturing, retail, and e-commerce. ' +
      'Cold-chain and hazardous-goods logistics are supported with full regulatory compliance.',
    cleaning:
      `${companyName} is a professional facility cleaning company serving commercial, industrial, and healthcare environments. ` +
      'The team is trained to international hygiene standards and carries full liability insurance. ' +
      'Services cover daily maintenance cleaning, deep cleaning, and post-construction clean-ups.',
    agriculture:
      `${companyName} specialises in precision agriculture technology and irrigation systems. ` +
      'The company designs and installs smart drip-irrigation, soil-monitoring sensors, and automated control systems for farms across northern Thailand. ' +
      'Solutions are tailored to crop type and farm scale, from small holdings to commercial plantations.',
    consulting:
      `${companyName} is a strategy and finance consulting firm advising Thai and regional businesses on growth, structuring, and cross-border expansion. ` +
      'The team includes certified public accountants, legal advisers, and former investment-banking professionals. ' +
      'Services cover financial due diligence, tax planning, M&A advisory, and fundraising support.',
    renovation:
      `${companyName} delivers commercial renovation and interior fit-out projects across Bangkok and surrounding provinces. ` +
      'The company manages every aspect of refurbishment work including structural modifications, MEP systems, and interior design. ' +
      'Projects range from single-floor office renovations to multi-storey building upgrades.',
    other:
      `${companyName} is an established service provider with experience delivering projects for both private and public-sector clients across Thailand. ` +
      'The team is known for reliable execution, transparent communication, and consistent quality across all engagements.',
  };
  return bios[cat] ?? bios.other;
}

const SERVICE_AREAS: Record<string, string[]> = {
  technology: [
    'Bangkok Metropolitan Region',
    'Chiang Mai',
    'Phuket',
    'Eastern Economic Corridor (EEC)',
    'Remote / Nationwide',
  ],
  construction: [
    'Bangkok & Surrounding Provinces',
    'Central Region',
    'Eastern Region',
    'Northern Region',
  ],
  logistics: [
    'Nationwide — all 77 provinces',
    'Thailand–CLMV cross-border routes',
    'EEC Industrial Estates',
  ],
  cleaning: ['Bangkok Metropolitan Region', 'Samut Prakan', 'Pathum Thani', 'Nonthaburi'],
  agriculture: ['Chiang Mai', 'Chiang Rai', 'Lamphun', 'Northern Highland Region'],
  consulting: ['Bangkok', 'Regional offices — Chiang Mai, Phuket', 'Remote / Online'],
  renovation: ['Bangkok', 'Nonthaburi', 'Samut Prakan', 'Central Region'],
  other: ['Bangkok Metropolitan Region', 'Central Region'],
};

const MOCK_BIDS = [
  {
    project: 'IT Infrastructure Setup — 5-Star Hotel Chiang Mai',
    bidAmount: '฿2,450,000',
    status: 'Under Consideration',
    date: '12 May 2025',
  },
  {
    project: 'Mobile App Development — Food Ordering Platform',
    bidAmount: '฿420,000',
    status: 'Pending Review',
    date: '8 May 2025',
  },
  {
    project: 'ERP System Integration — Manufacturing Plant',
    bidAmount: '฿890,000',
    status: 'Accepted',
    date: '2 May 2025',
  },
];

type Tab = 'overview' | 'reviews' | 'portfolio' | 'bids';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'bids', label: 'Active Bids' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const vendor = getVendorById(id);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { isAuthenticated, isLoading } = useProtectedRoute();

  if (isLoading || !isAuthenticated) return null;

  if (!vendor) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center py-24">
            <p className="text-[#717171] text-lg">Vendor not found.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Compute average sub-ratings across all reviews
  const reviewCount = vendor.reviews.length;
  const avgQuality =
    reviewCount > 0
      ? vendor.reviews.reduce((s, r) => s + r.quality, 0) / reviewCount
      : 0;
  const avgComm =
    reviewCount > 0
      ? vendor.reviews.reduce((s, r) => s + r.communication, 0) / reviewCount
      : 0;
  const avgTime =
    reviewCount > 0
      ? vendor.reviews.reduce((s, r) => s + r.timeliness, 0) / reviewCount
      : 0;
  const avgPrice =
    reviewCount > 0
      ? vendor.reviews.reduce((s, r) => s + r.priceAccuracy, 0) / reviewCount
      : 0;

  const serviceAreas = SERVICE_AREAS[vendor.categories[0] ?? 'other'] ?? SERVICE_AREAS.other;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F7]">
      <Header />

      <main className="flex-1">
        <div className="container-app py-8 max-w-5xl mx-auto">

          {/* ── Profile Header Card ── */}
          <div className="bg-white border-b border-[#E0E0E0] rounded-xl mb-6 p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">

              {/* Left: logo + name */}
              <div className="flex items-start gap-4">
                <div
                  className="w-20 h-20 rounded-lg bg-[#F7F7F7] border border-[#E0E0E0] flex items-center justify-center flex-shrink-0"
                  aria-label="Company logo placeholder"
                >
                  <Building2 size={32} className="text-[#717171]" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h1 className="text-2xl font-semibold text-[#111111] leading-tight">
                    {vendor.companyName}
                  </h1>
                  <div className="flex items-center gap-1.5 text-sm text-[#717171]">
                    <MapPin size={14} aria-hidden="true" />
                    <span>{vendor.location}</span>
                  </div>
                  <div className="mt-1">
                    <VerifiedBadge tier={vendor.verified} />
                  </div>
                </div>
              </div>

              {/* Right: stats */}
              <div className="flex flex-wrap gap-4 sm:flex-nowrap">
                {[
                  { label: 'Jobs Completed', value: vendor.completedJobs.toString() },
                  { label: 'Rating', value: `${vendor.rating.toFixed(1)} / 5.0` },
                  { label: 'Response Rate', value: `${vendor.responseRate}%` },
                  { label: 'Member Since', value: formatYear(vendor.memberSince) },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex flex-col items-center text-center min-w-[76px] px-4 py-3 rounded-lg bg-[#F7F7F7] border border-[#E0E0E0]"
                  >
                    <span className="text-xl font-semibold text-[#111111]">{stat.value}</span>
                    <span className="text-xs text-[#717171] mt-0.5 whitespace-nowrap">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category tags */}
            {vendor.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-[#E0E0E0]">
                {vendor.categories.map((cat) => (
                  <span key={cat} className="badge">
                    {categoryLabel(cat)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Tabs ── */}
          <div className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-[#E0E0E0] overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 border-b-2 ${
                    activeTab === tab.key
                      ? 'border-[#111111] text-[#111111]'
                      : 'border-transparent text-[#717171] hover:text-[#111111] hover:bg-[#F7F7F7]'
                  }`}
                  aria-selected={activeTab === tab.key}
                  role="tab"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-6">

              {/* OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="flex flex-col gap-8">
                  {/* About */}
                  <section>
                    <h2 className="text-base font-semibold text-[#111111] mb-3">About</h2>
                    <p className="text-sm text-[#717171] leading-relaxed">
                      {getBio(vendor.companyName, vendor.categories)}
                    </p>
                  </section>

                  {/* Service areas */}
                  <section>
                    <h2 className="text-base font-semibold text-[#111111] mb-3">Service Areas</h2>
                    <ul className="flex flex-col gap-1.5">
                      {serviceAreas.map((area) => (
                        <li key={area} className="flex items-center gap-2 text-sm text-[#717171]">
                          <ChevronRight size={14} className="text-[#E0E0E0] flex-shrink-0" aria-hidden="true" />
                          {area}
                        </li>
                      ))}
                    </ul>
                  </section>

                  {/* Certifications */}
                  <section>
                    <h2 className="text-base font-semibold text-[#111111] mb-3">Certifications</h2>
                    {vendor.verified !== 'new' ? (
                      <div className="flex flex-wrap gap-2">
                        {['ISO 9001:2015 — Quality Management', 'Conjuncture Identity Verified'].map((cert) => (
                          <span
                            key={cert}
                            className="inline-flex items-center gap-1.5 badge badge-success"
                          >
                            <CheckCircle2 size={12} aria-hidden="true" />
                            {cert}
                          </span>
                        ))}
                        {vendor.verified === 'verified_pro' && (
                          <span className="inline-flex items-center gap-1.5 badge badge-success">
                            <CheckCircle2 size={12} aria-hidden="true" />
                            Conjuncture Pro — Background Checked
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-[#717171]">No certifications listed.</p>
                    )}
                  </section>

                  {/* Contact CTA */}
                  <div className="pt-2">
                    <button className="btn-primary">Contact This Vendor</button>
                  </div>
                </div>
              )}

              {/* REVIEWS */}
              {activeTab === 'reviews' && (
                <div className="flex flex-col gap-8">
                  {/* Overall rating summary */}
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-10">
                    <div className="flex flex-col items-center justify-center gap-1 min-w-[100px]">
                      <span className="text-5xl font-semibold text-[#111111]">
                        {vendor.rating.toFixed(1)}
                      </span>
                      <StarRow rating={vendor.rating} />
                      <span className="text-xs text-[#717171] mt-1">
                        ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col gap-3 max-w-md">
                      <RatingBar label="Quality" value={avgQuality} />
                      <RatingBar label="Communication" value={avgComm} />
                      <RatingBar label="Timeliness" value={avgTime} />
                      <RatingBar label="Price Accuracy" value={avgPrice} />
                    </div>
                  </div>

                  {/* Individual reviews */}
                  <div className="flex flex-col gap-5">
                    {vendor.reviews.map((review) => (
                      <article
                        key={review.id}
                        className="flex gap-4 pt-5 border-t border-[#E0E0E0] first:border-t-0 first:pt-0"
                      >
                        <span
                          className="avatar flex-shrink-0"
                          aria-label={review.author}
                        >
                          {getInitials(review.author)}
                        </span>
                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-medium text-[#111111]">{review.author}</span>
                            <StarRow rating={review.rating} />
                            <span className="text-xs text-[#717171]">{formatDate(review.date)}</span>
                          </div>
                          <p className="text-sm text-[#717171] leading-relaxed">{review.comment}</p>
                        </div>
                      </article>
                    ))}

                    {vendor.reviews.length === 0 && (
                      <p className="text-sm text-[#717171]">No reviews yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* PORTFOLIO */}
              {activeTab === 'portfolio' && (
                <div>
                  {vendor.portfolio.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {vendor.portfolio.map((item) => (
                        <div key={item.id} className="card p-0 overflow-hidden">
                          <div
                            className="h-40 bg-[#F7F7F7] border-b border-[#E0E0E0] flex items-center justify-center"
                            aria-label="Portfolio image placeholder"
                          >
                            <Briefcase size={32} className="text-[#E0E0E0]" aria-hidden="true" />
                          </div>
                          <div className="p-4">
                            <p className="text-sm font-medium text-[#111111] leading-snug">{item.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-[#717171] text-sm">
                      No portfolio items yet.
                    </div>
                  )}
                </div>
              )}

              {/* ACTIVE BIDS */}
              {activeTab === 'bids' && (
                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E0E0E0]">
                          <th className="text-left py-2.5 pr-4 font-medium text-[#717171]">Project</th>
                          <th className="text-left py-2.5 pr-4 font-medium text-[#717171]">Bid Amount</th>
                          <th className="text-left py-2.5 pr-4 font-medium text-[#717171]">Status</th>
                          <th className="text-left py-2.5 font-medium text-[#717171]">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MOCK_BIDS.map((bid, i) => {
                          const statusClasses: Record<string, string> = {
                            'Pending Review': 'badge',
                            'Under Consideration': 'badge badge-warning',
                            Accepted: 'badge badge-success',
                            Declined: 'badge badge-destructive',
                          };
                          return (
                            <tr key={i} className="border-b border-[#E0E0E0] last:border-0">
                              <td className="py-3 pr-4 text-[#111111] font-medium">{bid.project}</td>
                              <td className="py-3 pr-4 text-[#111111]">{bid.bidAmount}</td>
                              <td className="py-3 pr-4">
                                <span className={statusClasses[bid.status] ?? 'badge'}>{bid.status}</span>
                              </td>
                              <td className="py-3 text-[#717171]">{bid.date}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
