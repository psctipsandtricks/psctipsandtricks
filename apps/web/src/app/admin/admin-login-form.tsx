'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Input, Button } from '@psc/ui';
import { useAdminAuth } from './admin-auth-provider';
import { emailSchema, passwordSchema } from '@/lib/validation';
import { ShieldAlert, Lock } from 'lucide-react';

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
          ? `Access Denied: The account (${email}) is not registered as an active staff member in Staff Management.`
          : 'Access Denied: Your account is not registered as an active staff member in Staff Management.',
      );
    } else if (err === 'suspended_staff') {
      setErrorMsg(
        email
          ? `Access Denied: The staff account (${email}) is currently suspended. Please contact a Super Administrator.`
          : 'Access Denied: Your staff account is currently suspended. Please contact a Super Administrator.',
      );
    }
  }, [searchParams]);

  const formik = useFormik({
    initialValues: { email: '', password: '' },
    validationSchema: adminLoginSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setErrorMsg('');
      try {
        await loginAdmin(values.email.trim(), values.password);
        if (typeof window !== 'undefined') {
          try {
            window.history.replaceState({}, '', window.location.pathname);
          } catch {}
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Invalid email or password');
      } finally {
        setSubmitting(false);
      }
    },
  });

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
              Log in with your administrator or authorized staff credentials.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 text-xs rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── Password Form ─────────────────────────────────────── */}
          <form onSubmit={formik.handleSubmit} className="space-y-4 pt-2" noValidate>
            <fieldset disabled={formik.isSubmitting} className="contents disabled:opacity-80 disabled:pointer-events-none disabled:cursor-wait">
            <Input
              label="Email Address"
              name="email"
              type="email"
              placeholder="admin@psctips.com"
              value={formik.values.email}
              onChange={(e) => {
                if (errorMsg) setErrorMsg('');
                formik.handleChange(e);
              }}
              onBlur={formik.handleBlur}
              error={formik.touched.email && formik.errors.email ? formik.errors.email : undefined}
            />

            <div className="space-y-1">
              <Input
                label="Password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formik.values.password}
                onChange={(e) => {
                  if (errorMsg) setErrorMsg('');
                  formik.handleChange(e);
                }}
                onBlur={formik.handleBlur}
                error={formik.touched.password && formik.errors.password ? formik.errors.password : undefined}
              />
              <div className="flex justify-end pt-1">
                <Link
                  href="/admin/forgot-password"
                  className="text-xs font-semibold text-cyan-500 hover:text-cyan-400 hover:underline transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full font-bold shadow-lg shadow-indigo-600/20 h-11"
              isLoading={formik.isSubmitting}
            >
              Log In to Admin Panel 👑
            </Button>
            </fieldset>
          </form>

          <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 font-medium pt-1">
            Authorized personnel only. All access attempts are logged and monitored.
          </p>
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
