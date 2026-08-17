'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../auth-provider';
import { ApiClient, ADMIN_ACCESS_TOKEN_KEY, ADMIN_REFRESH_TOKEN_KEY, ADMIN_USER_KEY } from '@/lib/api-client';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithTokens } = useAuth();
  const [errorMsg, setErrorMsg] = useState('');
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const executedRef = useRef(false);

  useEffect(() => {
    if (executedRef.current) return;
    executedRef.current = true;

    const errorParam = searchParams?.get('error');
    const redirectTarget = searchParams?.get('redirect') || '/dashboard';
    const isAdmin = redirectTarget.startsWith('/admin');
    setIsAdminLogin(isAdmin);

    if (errorParam === 'unauthorized_staff') {
      const email = searchParams?.get('email');
      setErrorMsg(
        email
          ? `Access denied. The Google account (${email}) is not registered as an active staff member.`
          : 'Access denied. Your Google account is not registered as an active staff member in Staff Management.',
      );
      return;
    }

    if (errorParam === 'suspended_staff') {
      setErrorMsg('Access denied. Your staff account has been suspended. Please contact a system administrator.');
      return;
    }

    if (errorParam) {
      setErrorMsg('Google Sign-In failed. Please try again.');
      return;
    }

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get('accessToken') || searchParams?.get('accessToken');
    const refreshToken = hashParams.get('refreshToken') || searchParams?.get('refreshToken');

    if (!accessToken || !refreshToken) {
      setErrorMsg('Sign-in failed — no session credentials returned.');
      return;
    }

    // Clean URL bar
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch {
      // Ignore if history replacement fails
    }

    if (isAdmin) {
      (async () => {
        try {
          let sub = '';
          try {
            const payload = JSON.parse(atob(accessToken.split('.')[1]));
            sub = payload.sub || '';
          } catch {
            sub = '';
          }

          if (!sub) throw new Error('Invalid token payload.');

          localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, accessToken);
          localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, refreshToken);

          const profile = await ApiClient.getUserProfile(sub);
          if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'STAFF')) {
            localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
            localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
            localStorage.removeItem(ADMIN_USER_KEY);
            setErrorMsg(
              `Access denied. ${profile?.email || 'This account'} is not registered as an authorized staff member in Staff Management.`,
            );
            return;
          }

          if (profile.status === 'SUSPENDED') {
            localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
            localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
            localStorage.removeItem(ADMIN_USER_KEY);
            setErrorMsg('Access denied. Your staff account has been suspended.');
            return;
          }

          localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(profile));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('psc:admin-session-refresh'));
          }
          router.replace(redirectTarget);
        } catch (err: any) {
          localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
          localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
          localStorage.removeItem(ADMIN_USER_KEY);
          setErrorMsg(err.message || 'Failed to authenticate admin session. Please try again.');
        }
      })();
    } else {
      loginWithTokens(accessToken, refreshToken)
        .then(() => router.replace(redirectTarget))
        .catch(() => setErrorMsg('Sign-in failed while loading your student profile. Please try again.'));
    }
  }, [searchParams, router, loginWithTokens]);

  if (errorMsg) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4 px-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 text-xl font-bold">
          ✕
        </div>
        <div className="space-y-1.5 max-w-md">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Authentication Failed</h3>
          <p className="text-xs text-rose-500 dark:text-rose-400 font-medium leading-relaxed">{errorMsg}</p>
        </div>
        <a
          href={isAdminLogin ? '/admin' : '/login'}
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold text-xs hover:opacity-90 transition-opacity"
        >
          {isAdminLogin ? 'Return to Admin Login' : 'Return to Student Login'}
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-slate-500">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-500">Signing you in...</div>}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
