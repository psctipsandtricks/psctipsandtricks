'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, CardTitle, CardDescription, Input, Button } from '@psc/ui';
import { useAuth } from '../auth-provider';
import { AuthSkeleton } from '../skeletons/page-skeletons';
import { emailSchema, passwordSchema } from '@/lib/validation';

const signupSchema = Yup.object({
  name: Yup.string().trim().required('Full name is required'),
  email: emailSchema,
  password: passwordSchema,
});

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_not_configured: 'That sign-in method isn’t set up yet. Please use email & password, or try another option.',
  oauth_failed: 'Sign-in failed. Please try again.',
};

function SignupFormContent() {
  const searchParams = useSearchParams();
  const redirectTarget = searchParams?.get('redirect') || '/dashboard';
  const [errorMsg, setErrorMsg] = useState('');
  const { register } = useAuth();

  useEffect(() => {
    const oauthError = searchParams?.get('error');
    if (oauthError) {
      setErrorMsg(OAUTH_ERROR_MESSAGES[oauthError] || 'Sign-in failed. Please try again.');
    }
  }, [searchParams]);

  const formik = useFormik({
    initialValues: { name: '', email: '', password: '' },
    validationSchema: signupSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setErrorMsg('');
      try {
        await register(values.email, values.password, values.name);
        window.location.href = '/dashboard';
      } catch (err: any) {
        setErrorMsg(err?.message || 'Could not create account');
        setSubmitting(false);
      }
    },
  });

  return (
    <div className="max-w-md mx-auto py-12 px-4 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 ambient-glow-indigo rounded-full blur-3xl pointer-events-none" />

      <Card className="p-8 space-y-6 glass-panel border-slate-200/80 dark:border-slate-800/80 shadow-2xl relative z-10">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 text-xl font-black">
            🎓
          </div>
          <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Create Account</CardTitle>
          <CardDescription>Join 50,000+ Kerala PSC aspirants studying smart.</CardDescription>
        </div>

        {errorMsg && (
          <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 font-semibold text-center">
            {errorMsg}
          </div>
        )}

        {/* Social Authentication Buttons */}
        <div className="space-y-3 pt-2">
          <a
            href={`${API_BASE_URL}/auth/google?state=${encodeURIComponent(redirectTarget)}`}
            className="w-full flex items-center justify-center space-x-3 h-11 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-amber-500/40 transition-all duration-200 shadow-sm cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign up with Google</span>
          </a>

          <a
            href={`${API_BASE_URL}/auth/apple`}
            className="w-full flex items-center justify-center space-x-3 h-11 rounded-xl border border-slate-900 dark:border-slate-700 bg-slate-950 text-white font-semibold text-sm hover:bg-slate-900 transition-all duration-200 shadow-sm cursor-pointer"
          >
            <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 170 170">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.85.13-9.71-1.94-14.59-6.22-3.17-2.64-7.05-7.23-11.64-13.77-6.07-8.63-11-18.42-14.79-29.35-3.79-10.93-5.69-21.2-5.69-30.82 0-14.62 3.84-26.6 11.53-35.95 7.69-9.35 17.15-14.15 28.38-14.4 4.72 0 9.87 1.18 15.45 3.55 5.58 2.38 9.38 3.57 11.4 3.57 1.76 0 5.68-1.25 11.77-3.75 6.09-2.5 11.14-3.63 15.15-3.38 11.31.63 20.61 4.95 27.89 12.97-10.18 6.16-15.15 14.75-14.9 25.77.25 8.64 3.52 16.03 9.8 22.18 6.28 6.16 13.9 9.77 22.86 10.83-2.26 6.66-5.27 13.39-9.03 20.19zM119.22 31.84c0-7.16 2.64-14.07 7.92-20.73 5.28-6.66 11.97-10.68 20.08-12.06.25 1.01.38 1.89.38 2.64 0 7.16-2.58 14.13-7.74 20.92-5.16 6.79-11.88 10.93-20.17 12.43-.12-1.13-.47-2.2-4.47-3.2z" />
            </svg>
            <span>Sign up with Apple</span>
          </a>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200/80 dark:border-slate-800/80 w-full" />
          <span className="bg-slate-50 dark:bg-slate-900 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider absolute">
            or email
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={formik.handleSubmit} className="space-y-4 pt-1" noValidate>
          <Input
            label="Full Name"
            name="name"
            placeholder="Rahul V. Nair"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
          />
          <Input
            label="Email Address"
            name="email"
            type="email"
            placeholder="aspirant@psctips.com"
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
          <Button type="submit" variant="gold" className="w-full font-bold shadow-lg shadow-amber-500/20" isLoading={formik.isSubmitting}>
            Create Account ⚡
          </Button>
        </form>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
          Already registered?{' '}
          <Link href="/login" className="text-amber-500 font-bold hover:underline">
            Log In
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <SignupFormContent />
    </Suspense>
  );
}
