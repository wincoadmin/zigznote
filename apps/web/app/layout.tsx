import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'zigznote - Your meetings, simplified',
    template: '%s | zigznote',
  },
  description:
    'AI meeting assistant that automatically transcribes, summarizes, and extracts action items from your meetings.',
  keywords: [
    'meeting notes',
    'AI transcription',
    'meeting summary',
    'action items',
    'meeting assistant',
  ],
  authors: [{ name: 'zigznote' }],
  creator: 'zigznote',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://zigznote.com',
    title: 'zigznote - Your meetings, simplified',
    description:
      'AI meeting assistant that automatically transcribes, summarizes, and extracts action items from your meetings.',
    siteName: 'zigznote',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'zigznote - Your meetings, simplified',
    description:
      'AI meeting assistant that automatically transcribes, summarizes, and extracts action items from your meetings.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-slate-50 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
