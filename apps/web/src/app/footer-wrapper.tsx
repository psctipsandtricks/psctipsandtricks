'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export function FooterWrapper() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin') || pathname.startsWith('/community')) {
    return null;
  }

  return (
    <footer className="glass-header border-t border-slate-200/80 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 text-sm py-8 mt-12 transition-all">
      <div className="max-w-7xl mx-auto px-4 text-center font-medium">
        © {new Date().getFullYear()} PSC Tips & Tricks. All rights reserved.
      </div>
    </footer>
  );
}
