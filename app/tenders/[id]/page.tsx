export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import React from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProtectedShell from '@/components/layout/ProtectedShell';
import TenderDetailView from '@/components/ui/TenderDetailView';
import { getTenderById } from '@/lib/data-service';
import { getDisplayStatus } from '@/lib/deadline';

const SITE_URL = 'https://conjuncture.work';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tender = await getTenderById(id);
  if (!tender) return { title: 'Tender Not Found' };

  const budget = '฿' + tender.budget.toLocaleString('th-TH');
  const deadline = new Date(tender.deadline).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const description = `${tender.agency} — ${budget} budget. Deadline: ${deadline}. ${tender.description.slice(0, 120)}`;

  return {
    title: tender.title,
    description,
    alternates: { canonical: `/tenders/${id}` },
    openGraph: {
      title: tender.title,
      description: `${tender.agency} | ${budget} | Deadline: ${deadline}`,
      url: `${SITE_URL}/tenders/${id}`,
      type: 'article',
    },
  };
}

export default async function TenderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tender = await getTenderById(id);
  const tenderStatus = tender ? getDisplayStatus(tender) : 'open';

  const jsonLd = tender
    ? {
        '@context': 'https://schema.org',
        '@type': 'GovernmentService',
        name: tender.title,
        provider: { '@type': 'GovernmentOrganization', name: tender.agency },
        areaServed: { '@type': 'AdministrativeArea', name: tender.region },
        offers: { '@type': 'Offer', price: tender.budget, priceCurrency: 'THB' },
        url: `${SITE_URL}/tenders/${id}`,
      }
    : null;

  return (
    <ProtectedShell>
      <div className="min-h-screen flex flex-col">
        {jsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
        <Header />
        <TenderDetailView tender={tender ?? null} tenderStatus={tenderStatus} />
        <Footer />
      </div>
    </ProtectedShell>
  );
}
