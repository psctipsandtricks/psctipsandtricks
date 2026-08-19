'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, CardTitle, CardDescription, Input, Button } from '@psc/ui';
import { useAdminAuth } from './admin-auth-provider';
import { emailSchema, passwordSchema } from '@/lib/validation';
import { ShieldAlert, AlertCircle, Loader2 } from 'lucide-react';

const adminLoginSchema = Yup.object({
  email: emailSchema,
  password: passwordSchema,
});

function AdminLoginFormContent() {
  const searchParams = useSearchParams();
  const { loginAdmin } = useAdminAuth();
  const [errorMsg, setErrorMsg] = useState('');
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);

  useEffect(() => {
    const err = searchParams?.get('error');
    const email = searchParams?.get('email');
    if (err === 'unauthorized_staff') {
      setErrorMsg(
        email
          ? `Access Denied: The Google account (${email}) is not registered as an active staff member in Staff Management.`
          : 'Access Denied: Your Google account is not registered as an active staff member in Staff Management.',
      );
    } else if (err === 'suspended_staff') {
      setErrorMsg(
        email
          ? `Access Denied: The staff account (${email}) is currently suspended. Please contact a Super Administrator.`
          : 'Access Denied: Your staff account is currently suspended. Please contact a Super Administrator.',
      );
    } else if (err === 'oauth_failed') {
      setErrorMsg('Google Sign-In failed or was cancelled. Please try again.');
    }
  }, [searchParams]);

  const formik = useFormik({
    initialValues: { email: '', password: '' },
    validationSchema: adminLoginSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setErrorMsg('');
      try {
        await loginAdmin(values.email, values.password);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Invalid email or password');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const googleAdminAuthUrl = `${apiBaseUrl}/auth/google?state=/admin`;
  const appleAdminAuthUrl = `${apiBaseUrl}/auth/apple?state=/admin`;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-cyan-500/20 selection:text-cyan-400">
      <div className="max-w-md w-full relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-gradient-to-br from-amber-500/20 via-indigo-500/15 to-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        <Card className="p-8 space-y-6 glass-panel border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#091124]/95 shadow-2xl relative z-10 rounded-3xl">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-amber-400/10 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 shadow-md">
              <span className="text-2xl select-none">👑</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Admin Portal Login
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Log in with your administrator or authorized staff account.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 text-xs rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── Social Single Sign-On ─────────────────────────────── */}
          <div className="space-y-2.5">
            {/* Google Button */}
            <button
              type="button"
              disabled={oauthLoading !== null}
              onClick={() => {
                setOauthLoading('google');
                window.location.href = googleAdminAuthUrl;
              }}
              className="flex items-center justify-center gap-3 w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-[#060c1d] hover:bg-slate-50 dark:hover:bg-[#0d1733] hover:border-slate-400 dark:hover:border-cyan-500/50 text-slate-800 dark:text-slate-100 text-sm font-bold disabled:opacity-75 disabled:pointer-events-none transition-all duration-200 shadow-sm cursor-pointer"
            >
              {oauthLoading === 'google' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-500 shrink-0" />
                  <span>Connecting to Google…</span>
                </>
              ) : (
                <>
                  <svg width="20" height="20" className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Apple Button */}
            <button
              type="button"
              disabled={oauthLoading !== null}
              onClick={() => {
                setOauthLoading('apple');
                window.location.href = appleAdminAuthUrl;
              }}
              className="flex items-center justify-center gap-3 w-full h-11 px-4 rounded-xl border border-black dark:border-slate-700 bg-black hover:bg-neutral-900 text-white text-sm font-bold disabled:opacity-75 disabled:pointer-events-none transition-all duration-200 shadow-sm cursor-pointer"
            >
              {oauthLoading === 'apple' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white shrink-0" />
                  <span>Connecting to Apple…</span>
                </>
              ) : (
                <>
                  <svg width="20" height="20" className="w-5 h-5 fill-current shrink-0 -mt-0.5" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.02.63-2.66 1.38-.57.65-1.06 1.73-.93 2.76 1.05.08 2.06-.52 2.67-1.27z" />
                  </svg>
                  <span>Continue with Apple</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 font-medium pt-0.5">
              Only registered staff emails in Staff Management can log in.
            </p>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
            <span className="bg-white dark:bg-[#091124] px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest absolute">
              or sign in with password
            </span>
          </div>

          {/* ── Password Form ─────────────────────────────────────── */}
          <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email Address"
              name="email"
              type="email"
              placeholder="psctipsandtricksapp@gmail.com"
              value={formik.values.email}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.email && formik.errors.email ? formik.errors.email : undefined}
            />
            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={formik.values.password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.password && formik.errors.password ? formik.errors.password : undefined}
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full font-bold shadow-lg shadow-indigo-600/20 h-11"
              isLoading={formik.isSubmitting}
            >
              Log In to Admin Panel 👑
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function AdminLoginForm() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#060b18]" />}>
      <AdminLoginFormContent />
    </Suspense>
  );
}
