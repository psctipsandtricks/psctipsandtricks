import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { NavbarWrapper } from './navbar-wrapper';
import { FooterWrapper } from './footer-wrapper';
import { MainWrapper } from './main-wrapper';

export const metadata: Metadata = {
  title: 'PSC Tips And Tricks — Ed-Tech Platform for Kerala PSC & SSC',
  description:
    'Crack Kerala PSC, SSC, and UPSC exams with interactive mock tests, question banks, e-books, and real-time rank tracking.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png' }],
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
          <NavbarWrapper />
          <MainWrapper>{children}</MainWrapper>
          <FooterWrapper />
        </Providers>
      </body>
    </html>
  );
}
