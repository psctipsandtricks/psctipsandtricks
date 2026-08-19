'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Admin and Community pages manage their own layout / full-page containers
  if (pathname.startsWith('/admin') || pathname.startsWith('/community')) {
    return <main className="flex-1 w-full overflow-hidden">{children}</main>;
  }

  if (pathname.includes('/read')) {
    return (
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6 relative">
        {children}
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
      {children}
    </main>
  );
}
