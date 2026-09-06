'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './theme-provider';
import { AuthProvider } from './auth-provider';
import { DropGuard } from './drop-guard';
import { NotificationsProvider } from './notifications-data';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          {/* Inside the query client (it fetches) and inside auth (it keys read
              state by student), so both are available to it. */}
          <NotificationsProvider>
            <DropGuard />
            {children}
          </NotificationsProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

