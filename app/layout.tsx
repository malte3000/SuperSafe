import type { Metadata } from 'next';
import { env } from 'cloudflare:workers';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export function generateMetadata(): Metadata {
  const origin = (env as unknown as { SITE_ORIGIN?: string }).SITE_ORIGIN || 'http://localhost:3000';
  const description = 'Utforska rapporterade fondinnehav och jämför dagsförändringar för premiepensionsfonder.';
  return {
  metadataBase: new URL(origin),
  title: 'SuperSafe – se risken bakom fonden',
  description,
  openGraph: { title: 'SuperSafe – se risken bakom fonden', description, images: ['/og.png'], type: 'website', locale: 'sv_SE' },
  twitter: { card: 'summary_large_image', title: 'SuperSafe – se risken bakom fonden', description, images: ['/og.png'] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
