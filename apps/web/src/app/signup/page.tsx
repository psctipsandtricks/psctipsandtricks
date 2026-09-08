'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, CardTitle, CardDescription, Input, Button } from '@psc/ui';
import { useAuth } from '../auth-provider';
import { AuthSkeleton } from '../skeletons/page-skeletons';
import { emailSchema, passwordSchema } from '@/lib/validation';
import { Loader2, MailCheck, ArrowLeft, RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react';

const signupSchema = Yup.object({
  name: Yup.string().trim().required('Full name is required'),
  email: emailSchema,
  password: passwordSchema,
});

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_not_configured: 'That sign-in method isn’t set up yet. Please use email & password, or try another option.',
  oauth_failed: 'Sign-in failed. Please try again.',
};

function SignupFormContent() {
  const searchParams = useSearchParams();
  const redirectTarget = searchParams?.get('redirect') || '/dashboard';
  const [step, setStep] = useState<'FORM' | 'OTP'>('FORM');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredName, setRegisteredName] = useState('');
  const [registeredPassword, setRegisteredPassword] = useState('');

  const { user, isLoading: authLoading, sendRegisterOtp, verifyRegisterOtp } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const oauthError = searchParams?.get('error');
    if (oauthError) {
      setErrorMsg(OAUTH_ERROR_MESSAGES[oauthError] || 'Sign-in failed. Please try again.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTarget);
    }
  }, [user, authLoading, redirectTarget, router]);

  // Resend cooldown timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formik = useFormik({
    initialValues: { name: '', email: '', password: '' },
    validationSchema: signupSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setErrorMsg('');
      setSuccessMsg('');
      try {
        await sendRegisterOtp(values.email, values.password, values.name);
        setRegisteredEmail(values.email.trim());
        setRegisteredName(values.name.trim());
        setRegisteredPassword(values.password);
        setStep('OTP');
        setResendCooldown(30);
        setSuccessMsg(`A 6-digit verification code has been sent to ${values.email.trim()}`);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Unable to verify email address. Please check and try again.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMsg('Please enter the 6-digit verification code sent to your email.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setOtpSubmitting(true);
    try {
      await verifyRegisterOtp(registeredEmail, otpCode.trim());
      setSuccessMsg('OTP verified successfully.');
      setTimeout(() => {
        window.location.href = redirectTarget;
      }, 500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid or expired verification code. Please check your email.');
      setOtpSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !registeredEmail) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await sendRegisterOtp(registeredEmail, registeredPassword, registeredName);
      setResendCooldown(30);
      setSuccessMsg(`New 6-digit verification code sent to ${registeredEmail}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to resend verification code. Please try again.');
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 ambient-glow-indigo rounded-full blur-3xl pointer-events-none" />

      <Card className="p-8 space-y-6 glass-panel border-slate-200/80 dark:border-slate-800/80 shadow-2xl relative z-10 rounded-3xl">
        {step === 'FORM' ? (
          <>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 text-xl font-black shadow-xs">
                🎓
              </div>
              <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Create Account
              </CardTitle>
              <CardDescription>Join 50,000+ Kerala PSC aspirants studying smart.</CardDescription>
            </div>

            {errorMsg && (
              <div className="p-3.5 text-xs rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Social Authentication Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={oauthLoading !== null}
                onClick={() => {
                  setOauthLoading('google');
                  window.location.href = `${API_BASE_URL}/auth/google?state=${encodeURIComponent(redirectTarget)}`;
                }}
                className="w-full flex items-center justify-center space-x-3 h-11 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-cyan-500/40 disabled:opacity-75 disabled:pointer-events-none transition-all duration-200 shadow-xs cursor-pointer"
              >
                {oauthLoading === 'google' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-500 shrink-0" />
                    <span>Connecting to Google…</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Sign up with Google</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={oauthLoading !== null}
                onClick={() => {
                  setOauthLoading('apple');
                  window.location.href = `${API_BASE_URL}/auth/apple?state=${encodeURIComponent(redirectTarget)}`;
                }}
                className="w-full flex items-center justify-center space-x-3 h-11 rounded-xl border border-black dark:border-slate-700 bg-black text-white font-semibold text-sm hover:bg-neutral-900 disabled:opacity-75 disabled:pointer-events-none transition-all duration-200 shadow-xs cursor-pointer"
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
                    <span>Sign up with Apple</span>
                  </>
                )}
              </button>
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
                onChange={(e) => {
                  if (errorMsg) setErrorMsg('');
                  formik.handleChange(e);
                }}
                onBlur={formik.handleBlur}
                error={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
              />
              <Input
                label="Email Address"
                name="email"
                type="email"
                placeholder="aspirant@psctips.com"
                value={formik.values.email}
                onChange={(e) => {
                  if (errorMsg) setErrorMsg('');
                  formik.handleChange(e);
                }}
                onBlur={formik.handleBlur}
                error={formik.touched.email && formik.errors.email ? formik.errors.email : undefined}
              />
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
              <Button
                type="submit"
                variant="gold"
                className="w-full font-bold shadow-lg shadow-amber-500/20 h-11"
                isLoading={formik.isSubmitting}
              >
                Create Account ⚡
              </Button>
            </form>

            <p className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
              Already registered?{' '}
              <Link href="/login" className="text-amber-500 font-bold hover:underline">
                Log In
              </Link>
            </p>
          </>
        ) : (
          /* Step 2: Email OTP Verification */
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-500 shadow-md">
                <MailCheck className="w-7 h-7" />
              </div>
              <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Verify Your Email
              </CardTitle>
              <CardDescription>
                We have sent a 6-digit verification code to{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">{registeredEmail}</span>.
              </CardDescription>
            </div>

            {successMsg && (
              <div className="p-3.5 text-xs rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold leading-relaxed flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 text-xs rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold leading-relaxed flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4 pt-1">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-center">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  placeholder="• • • • • •"
                  value={otpCode}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(cleaned);
                    if (errorMsg) setErrorMsg('');
                  }}
                  className="w-full text-center text-3xl font-mono tracking-[0.4em] font-black h-14 rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:outline-hidden focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 transition-all shadow-inner"
                />
              </div>

              <Button
                type="submit"
                variant="gold"
                className="w-full font-black shadow-lg shadow-amber-500/20 h-11 text-sm"
                isLoading={otpSubmitting}
                disabled={otpCode.length !== 6}
              >
                Verify & Activate Account ⚡
              </Button>
            </form>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setStep('FORM');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>

              <button
                type="button"
                disabled={resendCooldown > 0}
                onClick={handleResendOtp}
                className={`inline-flex items-center gap-1 font-bold cursor-pointer transition-colors ${
                  resendCooldown > 0
                    ? 'text-slate-400 cursor-not-allowed'
                    : 'text-cyan-500 hover:text-cyan-400 hover:underline'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resendCooldown > 0 ? 'opacity-50' : ''}`} />
                <span>{resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}</span>
              </button>
            </div>
          </div>
        )}
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
