import type { Metadata, Viewport } from 'next';
import { env } from 'cloudflare:workers';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export function generateMetadata(): Metadata {
  const origin =
    (env as unknown as { SITE_ORIGIN?: string }).SITE_ORIGIN ||
    'https://supersafe-malte3000.maltelindahl.chatgpt.site';
  const description =
    'Sök svenska fonder och förstå rapporterade innehav, koncentration, överlappning och avgifternas långsiktiga effekt.';
  return {
    metadataBase: new URL(origin),
    title: 'SuperSafe – förstå vad fonden faktiskt äger',
    description,
    alternates: { canonical: '/' },
    openGraph: {
      title: 'SuperSafe – förstå vad fonden faktiskt äger',
      description,
      images: ['/og.jpg'],
      type: 'website',
      locale: 'sv_SE',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'SuperSafe – förstå vad fonden faktiskt äger',
      description,
      images: ['/og.jpg'],
    },
  };
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#071410',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
