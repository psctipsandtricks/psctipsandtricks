'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../auth-provider';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithTokens } = useAuth();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const redirectTarget = searchParams?.get('redirect') || '/dashboard';

    // Clear the tokens out of the URL immediately — they should never sit in browser history.
    window.history.replaceState({}, '', window.location.pathname);

    if (!accessToken || !refreshToken) {
      setErrorMsg('Sign-in failed — no session was returned.');
      return;
    }

    loginWithTokens(accessToken, refreshToken)
      .then(() => router.replace(redirectTarget))
      .catch(() => setErrorMsg('Sign-in failed while loading your profile. Please try again.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (errorMsg) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-3 px-4">
        <p className="text-sm font-semibold text-rose-500">{errorMsg}</p>
        <a href="/login" className="text-amber-500 font-bold hover:underline text-sm">
          Back to login
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-slate-500">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
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
