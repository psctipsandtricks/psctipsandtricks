'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Zap, MessageCircle, MapPin } from 'lucide-react';

const CONTACT_PHONE_DISPLAY = '+91 88919 30605';
const CONTACT_PHONE_WHATSAPP = 'https://wa.me/918891930605';

const QUICK_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Quiz Hub', href: '/quizzes' },
  { label: 'E-Books', href: '/books' },
  { label: 'Community', href: '/community' },
  { label: 'Dashboard', href: '/dashboard' },
];

const RESOURCE_LINKS = [
  { label: 'Mock Tests & Rank Lists', href: '/quizzes' },
  { label: 'Previous Year Questions', href: '/books' },
  { label: 'Study Circles', href: '/community' },
  { label: 'Create Free Account', href: '/signup' },
];

export function FooterWrapper() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin') || pathname.startsWith('/community')) {
    return null;
  }

  return (
    <footer className="glass-header border-t border-slate-200/80 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 mt-12 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="space-y-3 sm:col-span-2 lg:col-span-1">
          <Link href="/" className="flex items-center space-x-2.5 font-black text-lg text-slate-900 dark:text-white group">
            <img
              src="/logo.svg"
              alt="PSC Tips and Tricks Logo"
              className="w-7 h-7 rounded-full object-contain shadow-xs ring-1 ring-cyan-500/30 group-hover:scale-105 transition-transform"
            />
            <span>PSC Tips And Tricks</span>
          </Link>
          <p className="text-sm leading-relaxed max-w-xs">
            Helping Kerala PSC aspirants learn, practice, and take mock tests with real-time rank tracking — built
            for serious, focused exam preparation.
          </p>
        </div>

        {/* Quick Links */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
            Quick Links
          </h3>
          <ul className="space-y-2 text-sm">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Resources */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
            Resources
          </h3>
          <ul className="space-y-2 text-sm">
            {RESOURCE_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
            Contact Us
          </h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <a
                href={CONTACT_PHONE_WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-emerald-500 transition-colors font-bold"
              >
                <MessageCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>WhatsApp Us ({CONTACT_PHONE_DISPLAY})</span>
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0 text-amber-500" />
              Kerala, India
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200/80 dark:border-slate-800/80 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center font-medium text-xs sm:text-sm">
          © {new Date().getFullYear()} PSC Tips And Tricks. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
