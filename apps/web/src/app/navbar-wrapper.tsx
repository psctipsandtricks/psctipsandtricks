'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Navbar } from '@psc/ui';
import { useAuth } from './auth-provider';
import { useTheme } from './theme-provider';

const MAIN_NAV_ROUTES = [
  '/',
  '/quizzes',
  '/books',
  '/videos',
  '/pdfs',
  '/community',
  '/dashboard',
  '/profile',
  '/orders',
];

export function NavbarWrapper() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Warm up all main navigation routes immediately so clicks respond in 0ms
    MAIN_NAV_ROUTES.forEach((route) => {
      try {
        router.prefetch(route);
      } catch {
        // Ignore prefetch error
      }
    });
  }, [router]);

  if (pathname.startsWith('/admin')) {
    return null;
  }

  const navLinks = [
    { label: 'Home', href: '/', active: pathname === '/' },
    { label: 'Quiz Hub', href: '/quizzes', active: pathname.startsWith('/quizzes') },
    { label: 'E-Books', href: '/books', active: pathname.startsWith('/books') },
    ...(user
      ? [
          { label: 'Videos', href: '/videos', active: pathname.startsWith('/videos') },
          { label: 'PDFs', href: '/pdfs', active: pathname.startsWith('/pdfs') },
          { label: 'Community', href: '/community', active: pathname.startsWith('/community') },
          { label: 'Dashboard', href: '/dashboard', active: pathname === '/dashboard' },
        ]
      : []),
  ];

  return (
    <Navbar
      brandName="PSC Tips And Tricks"
      logoUrl="/logo.svg"
      links={navLinks}
      linkComponent={Link}
      onPrefetch={(href) => {
        try {
          router.prefetch(href);
        } catch {}
      }}
      user={
        mounted && user
          ? {
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl ?? undefined,
              role: user.role,
              isPremium: user.isPremium,
            }
          : undefined
      }
      theme={mounted ? theme : 'dark'}
      onToggleTheme={toggleTheme}
      onLogout={logout}
    />
  );
}
