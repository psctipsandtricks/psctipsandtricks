'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, CardTitle, CardDescription, Input, Button } from '@psc/ui';
import { ApiClient } from '@/lib/api-client';
import { emailSchema, passwordSchema } from '@/lib/validation';
import { AuthSkeleton } from '@/app/skeletons/page-skeletons';
import { ShieldAlert, ArrowLeft, CheckCircle2, ShieldCheck, Mail, Lock } from 'lucide-react';

const emailRequestSchema = Yup.object({
  email: emailSchema,
});

const otpVerifySchema = Yup.object({
  otp: Yup.string().trim().required('Enter the 6-digit OTP code').length(6, 'OTP must be exactly 6 digits'),
});

const newPasswordSchema = Yup.object({
  newPassword: passwordSchema,
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .required('Confirm your new password'),
});

function AdminForgotPasswordContent() {
  const router = useRouter();
  // Steps: 'email' -> 'verify_otp' -> 'create_password' -> 'success'
  const [step, setStep] = useState<'email' | 'verify_otp' | 'create_password' | 'success'>('email');
  const [targetEmail, setTargetEmail] = useState('');
  const [verifiedOtp, setVerifiedOtp] = useState('');
  const [serverMsg, setServerMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown countdown timer
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Request OTP by Staff Email
  const emailFormik = useFormik({
    initialValues: { email: '' },
    validationSchema: emailRequestSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setErrorMsg('');
      setServerMsg('');
      try {
        const res = await ApiClient.adminForgotPassword({ email: values.email });
        setTargetEmail(values.email.trim());
        setServerMsg(res.message || `A 6-digit recovery OTP has been sent to ${values.email}`);
        setResendCooldown(30);
        setStep('verify_otp');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Access Denied: This email address is not registered as an active staff or administrator account.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  // Step 2: Verify the OTP sent to email
  const otpFormik = useFormik({
    initialValues: { otp: '' },
    validationSchema: otpVerifySchema,
    onSubmit: async (values, { setSubmitting }) => {
      setErrorMsg('');
      setServerMsg('');
      try {
        const res = await ApiClient.verifyOtp({
          email: targetEmail,
          otp: values.otp.trim(),
        });
        setVerifiedOtp(values.otp.trim());
        setServerMsg(res.message || 'OTP verified successfully.');
        setStep('create_password');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Invalid or expired OTP code. Please check your email and try again.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  // Step 3: Create New Password
  const passwordFormik = useFormik({
    initialValues: { newPassword: '', confirmPassword: '' },
    validationSchema: newPasswordSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setErrorMsg('');
      setServerMsg('');
      try {
        const res = await ApiClient.resetPassword({
          email: targetEmail,
          otp: verifiedOtp,
          newPassword: values.newPassword,
        });
        setServerMsg(res.message || 'Password reset successfully!');
        setStep('success');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to update password. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleResendOtp = async () => {
    if (!targetEmail || resending || resendCooldown > 0) return;
    setResending(true);
    setErrorMsg('');
    try {
      const res = await ApiClient.adminForgotPassword({ email: targetEmail });
      setServerMsg(res.message || `A new OTP has been sent to ${targetEmail}`);
      setResendCooldown(30);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-cyan-500/20 selection:text-cyan-400">
      <div className="max-w-md w-full relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-gradient-to-br from-amber-500/20 via-indigo-500/15 to-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        <Card className="p-8 space-y-6 glass-panel border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#091124]/95 shadow-2xl relative z-10 rounded-3xl">
          {/* Step Indicator */}
          {step !== 'success' && (
            <div className="flex items-center justify-between px-2 pt-1 pb-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    step === 'email'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  1
                </span>
                <span className={step === 'email' ? 'text-amber-400' : 'text-slate-500'}>Staff Email</span>
              </div>
              <div className="w-8 h-0.5 bg-slate-800" />
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    step === 'verify_otp'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : step === 'create_password'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  2
                </span>
                <span className={step === 'verify_otp' ? 'text-amber-400' : 'text-slate-500'}>Verify OTP</span>
              </div>
              <div className="w-8 h-0.5 bg-slate-800" />
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    step === 'create_password'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  3
                </span>
                <span className={step === 'create_password' ? 'text-amber-400' : 'text-slate-500'}>Password</span>
              </div>
            </div>
          )}

          {/* STEP 1: Staff Email Input */}
          {step === 'email' && (
            <>
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-amber-400/10 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 shadow-md">
                  <span className="text-2xl select-none">👑</span>
                </div>
                <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Staff Password Recovery
                </CardTitle>
                <CardDescription>
                  Enter your registered administrator or staff email address. An OTP will be dispatched only for authorized accounts.
                </CardDescription>
              </div>

              {errorMsg && (
                <div className="p-3.5 text-xs rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500 dark:text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={emailFormik.handleSubmit} className="space-y-4 pt-1" noValidate>
                <fieldset disabled={emailFormik.isSubmitting} className="contents disabled:opacity-80 disabled:pointer-events-none disabled:cursor-wait">
                <Input
                  label="Staff Email Address"
                  name="email"
                  type="email"
                  placeholder="admin@psctips.com"
                  value={emailFormik.values.email}
                  onChange={emailFormik.handleChange}
                  onBlur={emailFormik.handleBlur}
                  error={emailFormik.touched.email && emailFormik.errors.email ? emailFormik.errors.email : undefined}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full font-bold shadow-lg shadow-indigo-600/20 h-11"
                  isLoading={emailFormik.isSubmitting}
                >
                  Send Recovery OTP 📩
                </Button>
                </fieldset>
              </form>

              <div className="text-center pt-2">
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-amber-400 font-semibold transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin Login
                </Link>
              </div>
            </>
          )}

          {/* STEP 2: Verify OTP */}
          {step === 'verify_otp' && (
            <>
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 shadow-md">
                  <ShieldCheck className="w-7 h-7 text-amber-400" />
                </div>
                <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Enter Security OTP
                </CardTitle>
                <CardDescription>
                  We sent a 6-digit recovery code to <strong className="text-amber-400 font-mono">{targetEmail}</strong>. Enter it below to proceed.
                </CardDescription>
              </div>

              {serverMsg && (
                <div className="p-3 text-xs rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold text-center animate-in fade-in">
                  {serverMsg}
                </div>
              )}

              {errorMsg && (
                <div className="p-3.5 text-xs rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500 dark:text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={otpFormik.handleSubmit} className="space-y-4 pt-1" noValidate>
                <fieldset disabled={otpFormik.isSubmitting} className="contents disabled:opacity-80 disabled:pointer-events-none disabled:cursor-wait">
                <Input
                  label="6-Digit OTP Code"
                  name="otp"
                  placeholder="123456"
                  maxLength={6}
                  value={otpFormik.values.otp}
                  onChange={otpFormik.handleChange}
                  onBlur={otpFormik.handleBlur}
                  error={otpFormik.touched.otp && otpFormik.errors.otp ? otpFormik.errors.otp : undefined}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full font-bold shadow-lg shadow-indigo-600/20 h-11"
                  isLoading={otpFormik.isSubmitting}
                >
                  Verify OTP ➔
                </Button>
                </fieldset>
              </form>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setServerMsg('');
                    setStep('email');
                  }}
                  className="text-slate-400 hover:text-amber-400 font-semibold flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Change Email
                </button>

                <button
                  type="button"
                  disabled={resending || resendCooldown > 0}
                  onClick={handleResendOtp}
                  className="text-amber-500 hover:underline font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resending
                    ? 'Sending…'
                    : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend Code'}
                </button>
              </div>
            </>
          )}

          {/* STEP 3: Create New Password */}
          {step === 'create_password' && (
            <>
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-amber-400/10 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 shadow-md">
                  <Lock className="w-7 h-7 text-amber-400" />
                </div>
                <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Set New Password
                </CardTitle>
                <CardDescription>
                  OTP verified. Create a secure password for your administrative staff account.
                </CardDescription>
              </div>

              {serverMsg && (
                <div className="p-3.5 text-xs rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold leading-relaxed flex items-center justify-center gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{serverMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3.5 text-xs rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500 dark:text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={passwordFormik.handleSubmit} className="space-y-4 pt-1" noValidate>
                <fieldset disabled={passwordFormik.isSubmitting} className="contents disabled:opacity-80 disabled:pointer-events-none disabled:cursor-wait">
                <Input
                  label="New Password"
                  name="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={passwordFormik.values.newPassword}
                  onChange={passwordFormik.handleChange}
                  onBlur={passwordFormik.handleBlur}
                  error={passwordFormik.touched.newPassword && passwordFormik.errors.newPassword ? passwordFormik.errors.newPassword : undefined}
                />

                <Input
                  label="Confirm New Password"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={passwordFormik.values.confirmPassword}
                  onChange={passwordFormik.handleChange}
                  onBlur={passwordFormik.handleBlur}
                  error={passwordFormik.touched.confirmPassword && passwordFormik.errors.confirmPassword ? passwordFormik.errors.confirmPassword : undefined}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full font-bold shadow-lg shadow-indigo-600/20 h-11"
                  isLoading={passwordFormik.isSubmitting}
                >
                  Save New Password 👑
                </Button>
                </fieldset>
              </form>
            </>
          )}

          {/* STEP 4: Success State */}
          {step === 'success' && (
            <div className="text-center space-y-5 py-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-2">
                <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Password Updated!
                </CardTitle>
                <CardDescription>
                  Your staff account password has been successfully updated. You can now log in to the admin portal.
                </CardDescription>
              </div>

              <Button
                type="button"
                variant="primary"
                className="w-full font-bold shadow-lg shadow-indigo-600/20 h-11"
                onClick={() => router.push('/admin')}
              >
                Log In to Admin Panel 👑
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function AdminForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#060b18]" />}>
      <AdminForgotPasswordContent />
    </Suspense>
  );
}
