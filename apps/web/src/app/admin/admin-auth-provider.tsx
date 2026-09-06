'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { ADMIN_ACCESS_TOKEN_KEY, ADMIN_REFRESH_TOKEN_KEY, ADMIN_USER_KEY } from '@/lib/api-client';

interface AdminAuthContextType {
  adminUser: User | null;
  isLoading: boolean;
  /** Throws with a user-facing message on failure; never persists a session for a non-admin account. */
  loginAdmin: (email: string, password: string) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken: string) => Promise<User>;
  logoutAdmin: () => void;
  refreshAdminUser: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

/**
 * A session entirely independent of the student site's AuthProvider — its own
 * storage keys, its own hydration, its own expiry handling. Being logged in
 * as a student (even an admin's own account on the student site) must never
 * imply admin access; this context is the only thing that can grant it, and
 * only after its own email/password check confirms an ADMIN or STAFF role.
 */
export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAdminUser = async () => {
    try {
      const stored = localStorage.getItem(ADMIN_USER_KEY);
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.id) {
          const profile = await ApiClient.getUserProfile(u.id);
          if (profile) {
            if (profile.status === 'SUSPENDED') {
              logoutAdmin();
              return;
            }
            localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(profile));
            setAdminUser(profile as any);
          }
        }
      }
    } catch (err) {
      console.warn('Could not refresh admin user profile:', err);
    }
  };

  useEffect(() => {
    try {
      const token = localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
      const storedUser = localStorage.getItem(ADMIN_USER_KEY);
      if (token && storedUser) {
        const u = JSON.parse(storedUser);
        if (u?.status === 'SUSPENDED') {
          logoutAdmin();
        } else {
          setAdminUser(u);
          refreshAdminUser();
        }
      }
    } catch (err) {
      console.error('Error restoring admin session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleExpired = () => setAdminUser(null);
    const handleRefresh = () => refreshAdminUser();
    window.addEventListener('psc:admin-session-expired', handleExpired);
    window.addEventListener('psc:admin-session-refresh', handleRefresh);

    // Cross-tab synchronization for admin panel: detect when admin/staff logs out in another tab
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ADMIN_ACCESS_TOKEN_KEY || e.key === ADMIN_USER_KEY) {
        if (!e.newValue) {
          // Logged out in another tab
          setAdminUser(null);
          const pathname = window.location.pathname;
          if (pathname.startsWith('/admin') && pathname !== '/admin') {
            window.location.href = '/admin';
          }
        } else if (e.key === ADMIN_USER_KEY && e.newValue) {
          // Logged in in another tab
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed?.status === 'SUSPENDED') {
              logoutAdmin();
            } else {
              setAdminUser(parsed);
              refreshAdminUser();
            }
          } catch (err) {
            console.error('Error syncing admin user from storage event:', err);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('psc:admin-session-expired', handleExpired);
      window.removeEventListener('psc:admin-session-refresh', handleRefresh);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const loginAdmin = async (email: string, password: string) => {
    const response = await ApiClient.login({ email: email.trim(), password });
    if (response.user.role !== 'ADMIN' && response.user.role !== 'STAFF') {
      // Deliberately never touch admin storage — a valid student login
      // attempted here must not create any admin session, partial or otherwise.
      throw new Error('Access Denied: This account does not have administrative access.');
    }
    if ((response.user as any).status === 'SUSPENDED') {
      logoutAdmin();
      throw new Error('Access Denied: Your account is currently suspended. Please contact a Super Administrator.');
    }
    localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, response.refreshToken);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(response.user));
    setAdminUser(response.user);
    if (typeof window !== 'undefined') {
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {}
    }
  };

  const loginWithTokens = async (accessToken: string, refreshToken: string): Promise<User> => {
    localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, refreshToken);

    try {
      let sub = '';
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        sub = payload.sub || '';
      } catch {
        sub = '';
      }

      if (!sub) {
        logoutAdmin();
        throw new Error('Invalid authentication token payload.');
      }

      const profile = await ApiClient.getUserProfile(sub);
      if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'STAFF')) {
        logoutAdmin();
        throw new Error('Access denied. Your account is not registered as an authorized staff member.');
      }

      if (profile.status === 'SUSPENDED') {
        logoutAdmin();
        throw new Error('Access denied. Your staff account has been suspended.');
      }

      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(profile));
      setAdminUser(profile as any);
      return profile as any;
    } catch (err) {
      logoutAdmin();
      throw err;
    }
  };

  const logoutAdmin = () => {
    setAdminUser(null);
    localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
    localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  };

  return (
    <AdminAuthContext.Provider
      value={{ adminUser, isLoading, loginAdmin, loginWithTokens, logoutAdmin, refreshAdminUser }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
