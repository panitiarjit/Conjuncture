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
    default: "Conjuncture — Thai Government Procurement Intelligence",
    template: '%s | Conjuncture',
  },
  description:
    'Conjuncture (conjuncture.work) helps Thai contractors win government tenders — price-to-win benchmarking, competitor tracking, and bid analytics from 153,685 real e-GP contracts.',
  keywords: [
    'Conjuncture',
    'conjuncture.work',
    'ConjunctureTH',
    'Conjuncture Thailand',
    'conjuncturework',
    'BidTool',
    'Thai government procurement',
    'Thailand e-GP tenders',
    'Thai contractor bid analytics',
    'price to win Thailand',
    'government tender benchmark Thailand',
    'จัดซื้อจัดจ้างภาครัฐ',
    'ประมูลงานราชการ',
    'ราคากลาง',
    'ผู้รับเหมาภาครัฐ',
    'e-GP ประเทศไทย',
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
    title: "Conjuncture — Thai Government Procurement Intelligence",
    description:
      'Price-to-win benchmarking and bid analytics for Thai contractors — powered by 153,685 real e-GP awarded contracts.',
    locale: 'th_TH',
    alternateLocale: ['en_US'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Conjuncture — Thai Government Procurement Intelligence",
    description:
      'Price-to-win benchmarking and bid analytics for Thai contractors — powered by 153,685 real e-GP awarded contracts.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Conjuncture',
  alternateName: ['conjuncture.work', 'ConjunctureTH'],
  url: SITE_URL,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Thai government procurement analytics platform — price-to-win benchmarking and bid analytics from 153,685 real e-GP awarded contracts.',
  offers: {
    '@type': 'Offer',
    priceCurrency: 'THB',
    availability: 'https://schema.org/InStock',
  },
  provider: {
    '@type': 'Organization',
    name: 'Conjuncture',
    url: SITE_URL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Bangkok',
      addressCountry: 'TH',
    },
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
