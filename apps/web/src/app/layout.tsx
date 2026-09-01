import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { AnnouncementPopupHost } from './announcement-popup';
import { NavbarWrapper } from './navbar-wrapper';
import { FooterWrapper } from './footer-wrapper';
import { MainWrapper } from './main-wrapper';

export const metadata: Metadata = {
  title: 'PSC Tips And Tricks — Ed-Tech Platform for Kerala PSC & SSC',
  description:
    'Crack Kerala PSC, SSC, and UPSC exams with interactive mock tests, question banks, e-books, and real-time rank tracking.',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/icon.svg?v=3" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=3" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=3" />
        <link rel="shortcut icon" href="/favicon.ico?v=3" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=3" />
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
