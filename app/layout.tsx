import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Sans_Thai } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { LanguageProvider } from '@/lib/language-context';
import './globals.css';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-ibm-plex-sans',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  variable: '--font-ibm-plex-sans-thai',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const SITE_URL = 'https://conjuncture.work';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Conjuncture — Procurement Data & Bidding Insights",
    template: '%s | Conjuncture',
  },
  description:
    'Conjuncture gives Thai contractors procurement intelligence from 153,685 government projects — benchmark your bids, track competitors, and win more with real e-GP data.',
  keywords: [
    'Conjuncture',
    'ConjunctureTH',
    'Conjuncture.work',
    'conjunctureth',
    'conjuncturework',
    'Thailand procurement',
    'Thai government tenders',
    'B2B marketplace Thailand',
    'vendor sourcing Thailand',
    'sealed bid procurement',
    'escrow payments Thailand',
    'Thai suppliers',
    'ประมูล',
    'จัดซื้อจัดจ้าง',
    'ผู้รับเหมา',
  ],
  alternates: {
    canonical: '/',
  },
  verification: {
    google: 'qXZ49b6kVe0ZqgquTuxA8lukl9qudXbfD6VjDBsEh1g',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Conjuncture',
    title: "Conjuncture — Procurement Data & Bidding Insights",
    description:
      'Procurement intelligence from 153,685 Thai government projects — benchmark bids, track competitors, and win more with real e-GP data.',
    locale: 'th_TH',
    alternateLocale: ['en_US'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Conjuncture — Procurement Data & Bidding Insights",
    description:
      'Procurement intelligence from 153,685 Thai government projects — benchmark bids, track competitors, and win more with real e-GP data.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Conjuncture',
  url: SITE_URL,
  description:
    'Procurement intelligence from 153,685 Thai government projects — benchmark bids, track competitors, and win more with real e-GP data.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Bangkok',
    addressCountry: 'TH',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${ibmPlexSans.variable} ${ibmPlexSansThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-[#111111]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
