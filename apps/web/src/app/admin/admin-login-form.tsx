'use client';

import React from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, CardTitle, CardDescription, Input, Button } from '@psc/ui';
import { useAdminAuth } from './admin-auth-provider';
import { emailSchema, passwordSchema } from '@/lib/validation';

const adminLoginSchema = Yup.object({
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Rendered by AdminLayout in place of the panel whenever there is no valid,
 * separately-authenticated admin session — regardless of whether the visitor
 * is logged in on the student site, and regardless of their account's role.
 * A student's own credentials will authenticate against /auth/login just
 * fine; loginAdmin is what actually refuses them a session.
 */
export function AdminLoginForm() {
  const { loginAdmin } = useAdminAuth();
  const [errorMsg, setErrorMsg] = React.useState('');

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
            <CardDescription>Log in with your administrator or staff credentials.</CardDescription>
          </div>

          {errorMsg && (
            <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold text-center">
              {errorMsg}
            </div>
          )}

          <form onSubmit={formik.handleSubmit} className="space-y-4 pt-1" noValidate>
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
              Log In to Admin Panel 👑
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
