export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProtectedShell from '@/components/layout/ProtectedShell';
import { getAllContractorIntelForPage } from '@/lib/data-service';
import ContractorIntelView from './ContractorIntelView';

export const metadata: Metadata = {
  title: 'Contractor Intelligence — Conjuncture',
  description: 'Statistical flags on contractor bidding patterns — near-ceiling clustering and single-agency concentration.',
};

export default async function ContractorIntelPage() {
  const contractors = await getAllContractorIntelForPage();
  return (
    <ProtectedShell>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <ContractorIntelView contractors={contractors} />
        </main>
        <Footer />
      </div>
    </ProtectedShell>
  );
}
