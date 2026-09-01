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
      // `overflow-x-clip`, not `-hidden`: hidden computes overflow-y to `auto`,
      // which makes this element a scroll container and silently breaks
      // `position: sticky` for the reader's sidebar and header — they would
      // stick to this box instead of the viewport, i.e. not at all. Clip holds
      // back the horizontal scrollbar without creating a scrollport.
      <main className="flex-1 w-full max-w-[1700px] mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-4 relative overflow-x-clip">
        {children}
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative overflow-x-hidden">
      {children}
    </main>
  );
}
