'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@psc/shared-types';
import { ApiClient } from '../lib/api-client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_STORAGE_KEY = 'psc_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from a previously stored JWT + user record
  useEffect(() => {
    try {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (token && storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error('Error restoring auth session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const determineLoginMethod = (email: string, oauthIdentities?: Array<{ provider: string }>): 'Email' | 'Google' | 'Apple' => {
    if (Array.isArray(oauthIdentities) && oauthIdentities.length > 0) {
      const prov = oauthIdentities[0].provider?.toUpperCase();
      if (prov === 'GOOGLE') return 'Google';
      if (prov === 'APPLE') return 'Apple';
    }
    if (email) {
      const lower = email.toLowerCase();
      if (lower.endsWith('@gmail.com') || lower.endsWith('@googlemail.com')) {
        return 'Google';
      }
      if (lower.endsWith('@icloud.com') || lower.endsWith('@apple.com')) {
        return 'Apple';
      }
    }
    return 'Email';
  };

  const persistSession = (response: { accessToken: string; refreshToken: string; user: User }) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
    setUser(response.user);

    // Sync student user into registered students list for admin dashboard
    if (response.user && response.user.email) {
      try {
        const stored = localStorage.getItem('psc_registered_students');
        let students: any[] = stored ? JSON.parse(stored) : [];
        const exists = students.some((s: any) => s.email.toLowerCase() === response.user.email.toLowerCase());
        const loginMethod = determineLoginMethod(response.user.email, (response.user as any).oauthIdentities);
        if (!exists) {
          const newStudent = {
            id: response.user.id || `usr-${Date.now()}`,
            name: response.user.name || response.user.email.split('@')[0],
            email: response.user.email,
            loginMethod,
            registeredAt: new Date().toISOString().split('T')[0],
            status: 'Active',
            subscription: response.user.isPremium ? 'VIP Unlimited' : 'Free Tier',
          };
          students.unshift(newStudent);
          localStorage.setItem('psc_registered_students', JSON.stringify(students));
        }
      } catch (e) {
        console.error('Error syncing student user to admin list:', e);
      }
    }
  };

  const login = async (email: string, password: string) => {
    const response = await ApiClient.login({ email, password });
    persistSession(response);
  };

  const register = async (email: string, password: string, name: string) => {
    const response = await ApiClient.register({ email, password, name });
    persistSession(response);
  };

  // Used by the OAuth callback page — we already have a token pair from the
  // backend redirect, just need to fetch the profile that goes with it.
  const loginWithTokens = async (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    const me = await ApiClient.getMe();
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me));
    setUser(me);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    window.location.href = '/';
  };

  const updateUser = (updatedData: Partial<User>) => {
    if (!user) return;
    const newUserData = { ...user, ...updatedData };
    setUser(newUserData);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUserData));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, loginWithTokens, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
