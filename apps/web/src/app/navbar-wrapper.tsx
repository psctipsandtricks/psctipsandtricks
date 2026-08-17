'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Navbar } from '@psc/ui';
import { useAuth } from './auth-provider';
import { useTheme } from './theme-provider';

export function NavbarWrapper() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (pathname.startsWith('/admin')) {
    return null;
  }

  const navLinks = [
    { label: 'Home', href: '/', active: pathname === '/' },
    { label: 'Quiz Hub', href: '/quizzes', active: pathname.startsWith('/quizzes') },
    { label: 'E-Books', href: '/books', active: pathname.startsWith('/books') },
    { label: 'Videos', href: '/videos', active: pathname.startsWith('/videos') },
    { label: 'PDFs', href: '/pdfs', active: pathname.startsWith('/pdfs') },
    { label: 'Community', href: '/community', active: pathname.startsWith('/community') },
    { label: 'Dashboard', href: '/dashboard', active: pathname === '/dashboard' },
  ];

  return (
    <Navbar
      brandName="⚡ PSC Tips And Tricks"
      links={navLinks}
      user={mounted && user ? { name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? undefined } : undefined}
      theme={mounted ? theme : 'dark'}
      onToggleTheme={toggleTheme}
      onLogout={logout}
      onNavigate={(href, e) => {
        e.preventDefault();
        router.push(href);
      }}
    />
  );
}
