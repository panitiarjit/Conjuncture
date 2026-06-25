export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProtectedShell from '@/components/layout/ProtectedShell';
import { getAwardedContracts } from '@/lib/data-service';
import IntelligenceView from './IntelligenceView';

export const metadata: Metadata = {
  title: 'Market Intelligence — Conjuncture',
  description: 'Awarded government contracts with winner analysis and competitor intelligence.',
};

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const keyword = q ?? 'จ้างเหมา';
  const contracts = await getAwardedContracts(keyword);

  const totalBudget = contracts.reduce((s, c) => s + (c.budget ?? 0), 0);
  const withDiscountContracts = contracts.filter(
    (c) => c.discountFromReference !== null && c.discountFromReference >= -100 && c.discountFromReference <= 100,
  );
  const avgDiscount = withDiscountContracts.length > 0
    ? withDiscountContracts.reduce((s, c) => s + c.discountFromReference!, 0) / withDiscountContracts.length
    : null;
  const withLosers = contracts.filter((c) => (c.losers?.length ?? 0) > 0).length;

  const exportUrl      = `/api/export-prospects?keyword=${encodeURIComponent(keyword)}`;
  const exportLosersUrl = `/api/export-prospects?keyword=${encodeURIComponent(keyword)}&losers=true`;

  return (
    <ProtectedShell>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <IntelligenceView
            contracts={contracts}
            keyword={keyword}
            totalBudget={totalBudget}
            avgDiscount={avgDiscount}
            withLosers={withLosers}
            exportUrl={exportUrl}
            exportLosersUrl={exportLosersUrl}
          />
        </main>
        <Footer />
      </div>
    </ProtectedShell>
  );
}
