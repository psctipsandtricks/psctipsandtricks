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
  logoutAdmin: () => void;
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

  useEffect(() => {
    try {
      const token = localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
      const storedUser = localStorage.getItem(ADMIN_USER_KEY);
      if (token && storedUser) {
        setAdminUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error('Error restoring admin session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleExpired = () => setAdminUser(null);
    window.addEventListener('psc:admin-session-expired', handleExpired);
    return () => window.removeEventListener('psc:admin-session-expired', handleExpired);
  }, []);

  const loginAdmin = async (email: string, password: string) => {
    const response = await ApiClient.login({ email, password });
    if (response.user.role !== 'ADMIN' && response.user.role !== 'STAFF') {
      // Deliberately never touch admin storage — a valid student login
      // attempted here must not create any admin session, partial or otherwise.
      throw new Error('This account does not have admin access.');
    }
    localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, response.refreshToken);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(response.user));
    setAdminUser(response.user);
  };

  const logoutAdmin = () => {
    setAdminUser(null);
    localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
    localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  };

  return (
    <AdminAuthContext.Provider value={{ adminUser, isLoading, loginAdmin, logoutAdmin }}>
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
