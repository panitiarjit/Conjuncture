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

export const metadata: Metadata = {
  title: "Conjuncture — Thailand's Trusted Procurement Marketplace",
  description:
    'Conjuncture connects Thai businesses and government agencies with verified vendors through transparent, competitive procurement. Browse tenders, post projects, and find trusted suppliers across Thailand.',
  keywords: [
    'Thailand procurement',
    'B2B marketplace',
    'government tenders',
    'vendor sourcing',
    'Thai suppliers',
    'ประมูล',
    'จัดซื้อจัดจ้าง',
  ],
  metadataBase: new URL('https://conjuncture.co.th'),
  openGraph: {
    title: "Conjuncture — Thailand's Trusted Procurement Marketplace",
    description:
      'Transparent competition. Trusted procurement. Connect with verified vendors and government agencies across Thailand.',
    locale: 'th_TH',
    type: 'website',
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
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
