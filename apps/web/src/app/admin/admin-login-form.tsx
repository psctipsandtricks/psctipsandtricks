'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, CardTitle, CardDescription, Input, Button } from '@psc/ui';
import { useAdminAuth } from './admin-auth-provider';
import { emailSchema, passwordSchema } from '@/lib/validation';
import { ShieldAlert, AlertCircle } from 'lucide-react';

const adminLoginSchema = Yup.object({
  email: emailSchema,
  password: passwordSchema,
});

function AdminLoginFormContent() {
  const searchParams = useSearchParams();
  const { loginAdmin } = useAdminAuth();
  const [errorMsg, setErrorMsg] = useState('');

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

  return (
    <div className="min-h-screen bg-[#060b18] flex items-center justify-center p-4">
      <div className="max-w-md w-full relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 ambient-glow-amber rounded-full blur-3xl pointer-events-none" />

        <Card className="p-8 space-y-6 glass-panel border-slate-800/80 shadow-2xl relative z-10">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 text-xl font-black">
              👑
            </div>
            <CardTitle className="text-2xl font-black tracking-tight text-white">Admin Portal Login</CardTitle>
            <CardDescription>Log in with your administrator or authorized staff Google account.</CardDescription>
          </div>

          {errorMsg && (
            <div className="p-3.5 text-xs rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400 font-semibold leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── Google Sign-In for Staff & Admins ─────────────────── */}
          <div className="space-y-2">
            <a
              href={googleAdminAuthUrl}
              className="flex items-center justify-center gap-3 w-full h-11 px-4 rounded-xl border border-slate-700 bg-[#091124] hover:bg-[#0e1b38] hover:border-cyan-500/50 text-slate-100 text-sm font-bold transition-all duration-200 shadow-md group cursor-pointer"
            >
              {/* Google G SVG */}
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            </a>
            <p className="text-[11px] text-center text-slate-500 font-medium">
              Only registered staff emails in Staff Management can log in.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">or sign in with password</span>
            <div className="flex-1 h-px bg-slate-800" />
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
              className="w-full font-bold shadow-lg shadow-indigo-600/20"
              isLoading={formik.isSubmitting}
            >
              Log In with Password 👑
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
