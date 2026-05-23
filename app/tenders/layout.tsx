import type { Metadata } from 'next';
import ProtectedShell from '@/components/layout/ProtectedShell';

export const metadata: Metadata = {
  title: 'Government Tenders',
  description:
    'Browse Thai government procurement announcements aggregated from e-GP. Filter by category, region, and budget. Free to browse.',
  alternates: { canonical: '/tenders' },
  openGraph: {
    title: 'Government Tenders | Conjuncture',
    description:
      'Thai government procurement opportunities from ministries, state enterprises, and local agencies across all 77 provinces.',
    url: 'https://conjuncture.work/tenders',
  },
};

export default function TendersLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
