import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@psc/ui';

export const metadata: Metadata = {
  title: 'PSC Tips & Tricks — Ed-Tech Platform for Kerala PSC & SSC',
  description: 'Crack Kerala PSC, SSC, and UPSC exams with interactive mock tests, question banks, e-books, and real-time rank tracking.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Quiz Hub', href: '/quizzes' },
    { label: 'E-Books', href: '/books' },
    { label: 'Dashboard', href: '/dashboard' },
  ];

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col font-sans">
        <Providers>
          <Navbar brandName="⚡ PSC Tips & Tricks" links={navLinks} />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <footer className="border-t border-slate-800 bg-slate-900 text-slate-400 text-sm py-8 mt-12">
            <div className="max-w-7xl mx-auto px-4 text-center">
              © {new Date().getFullYear()} PSC Tips & Tricks. All rights reserved. Powered by NestJS, Next.js & Flutter.
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
