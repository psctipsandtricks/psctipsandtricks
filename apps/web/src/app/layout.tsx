import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Malayalam } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Self-hosted at build time. Only the Malayalam subset is loaded, so next/font
// emits an @font-face scoped to `unicode-range: U+0D00–0D7F`. That lets this
// family sit FIRST in the stack (see tailwind.config.js) without touching Latin
// text: the browser only reaches for it on Malayalam codepoints, which the
// system UI font on many platforms mis-shapes (broken chillu / vowel signs).
const notoSansMalayalam = Noto_Sans_Malayalam({
  subsets: ['malayalam'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-malayalam',
  display: 'swap',
  fallback: ['sans-serif'],
});
import { AnnouncementPopupHost } from './announcement-popup';
import { NavbarWrapper } from './navbar-wrapper';
import { FooterWrapper } from './footer-wrapper';
import { MainWrapper } from './main-wrapper';
import { JsonLd } from '@/components/json-ld';
import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  organizationJsonLd,
  websiteJsonLd,
} from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'education',
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_IN',
    url: '/',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
  icons: {
    icon: [
      { url: '/icon.svg?v=3', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png?v=3', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png?v=3', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico?v=3', sizes: 'any' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=3', sizes: '180x180' }],
    shortcut: ['/favicon.ico?v=3'],
  },
};

const API_ORIGIN = new URL(process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').origin;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#081328' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={notoSansMalayalam.variable}>
      <head>
        {/* Book covers and catalog data come from the API on first paint — open the connection early. */}
        <link rel="preconnect" href={API_ORIGIN} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={API_ORIGIN} />
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('psc_theme');
                  var theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
                  document.documentElement.classList.remove('dark', 'light');
                  document.documentElement.classList.add(theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col font-sans relative overflow-x-hidden">
        <Providers>
          <AnnouncementPopupHost />
          <NavbarWrapper />
          <MainWrapper>{children}</MainWrapper>
          <FooterWrapper />
        </Providers>
      </body>
    </html>
  );
}
