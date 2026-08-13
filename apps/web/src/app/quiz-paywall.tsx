'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, Card, Badge, Input } from '@psc/ui';
import {
  Lock,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  FlaskConical,
  CheckCircle2,
  X,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { loadRazorpayScript } from '@/lib/razorpay';
import { useAuth } from '@/app/auth-provider';

/** Access verdict the API attaches to a quiz or mock test. */
export interface QuizAccessState {
  isPaid: boolean;
  hasAccess: boolean;
  price: number;
  reason: 'FREE' | 'PURCHASED' | 'STAFF' | 'LOGIN_REQUIRED' | 'PAYMENT_REQUIRED';
}

/** A coupon the API accepted, kept so the summary can show what it saves. */
interface AppliedCoupon {
  code: string;
  discountPercent: number;
  maxDiscountAmount: number;
}

interface QuizPaywallProps {
  quizId: string;
  title: string;
  access: QuizAccessState;
  /** Where to send the student to log in, when that is what's missing. */
  loginRedirect: string;
  /** Called after the payment settles, so the caller can refetch and unlock. */
  onUnlocked: () => void | Promise<void>;
  subtitle?: string;
}

/**
 * Shown in place of a premium quiz until the student has paid for it.
 */
export function QuizPaywall({
  quizId,
  title,
  access,
  loginRedirect,
  onUnlocked,
  subtitle,
}: QuizPaywallProps) {
  const { user } = useAuth();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const needsLogin = access.reason === 'LOGIN_REQUIRED';

  const basePrice = access.price;
  // Mirrors the server's rule in orders.service.ts — percentage off, capped at
  // the coupon's maxDiscountAmount — so the total shown is the amount charged.
  const discount = coupon
    ? Math.min((basePrice * coupon.discountPercent) / 100, coupon.maxDiscountAmount)
    : 0;
  const finalPrice = Math.max(0, Math.round(basePrice - discount));
  const savings = basePrice - finalPrice;

  const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_sample_key';
  const isDemoMode =
    !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID.includes('sample_key') ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID.includes('your_key') ||
    process.env.NEXT_PUBLIC_RAZORPAY_MODE === 'test';

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    setCouponError('');

    if (!code) {
      setCouponError('Enter a coupon code');
      return;
    }
    if (!/^[A-Za-z0-9]+$/.test(code)) {
      setCouponError('Coupon code can only contain letters and numbers');
      return;
    }

    setCheckingCoupon(true);
    try {
      const validated = await ApiClient.validateCoupon(code);
      setCoupon({
        code: validated.code,
        discountPercent: validated.discountPercent,
        maxDiscountAmount: validated.maxDiscountAmount,
      });
      setCouponInput('');
    } catch (err: any) {
      setCoupon(null);
      setCouponError(err?.message || 'Invalid or inactive coupon code');
    } finally {
      setCheckingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCoupon(null);
    setCouponError('');
  };

  const handlePay = async () => {
    setPaying(true);
    setPayError('');
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      const order: any = await ApiClient.createOrder({
        quizId,
        amount: finalPrice,
        couponCode: coupon?.code,
      });
      if (!order?.id) throw new Error('Could not start the payment. Please try again.');

      let activeKey = order.keyId || razorpayKey;
      // Safeguard: the Key Secret must never reach the browser SDK as key_id.
      if (
        activeKey &&
        (activeKey.startsWith('rzp_test_s') || activeKey.startsWith('rzp_live_s') || activeKey.length > 30)
      ) {
        console.warn('Razorpay Key Secret was passed as key_id. Falling back to public Key ID.');
        activeKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || razorpayKey;
      }

      // The server recomputes the price from the quiz and the coupon, so its
      // amount — not the locally derived one — is what the popup must charge.
      const payableRupees = typeof order.amount === 'number' ? order.amount : finalPrice;

      const options = {
        key: activeKey,
        amount: Math.round(payableRupees * 100),
        currency: order.currency || 'INR',
        name: 'PSC Tips And Tricks',
        description: title,
        order_id: order.razorpayOrderId && !order.razorpayOrderId.startsWith('order_sim_') ? order.razorpayOrderId : undefined,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: {
          color: '#f59e0b',
        },
        handler: async function (response: any) {
          try {
            const settled: any = await ApiClient.verifyPayment({
              orderId: order.id,
              paymentId: response.razorpay_payment_id || `pay_${Date.now()}`,
              razorpayOrderId: response.razorpay_order_id || order.razorpayOrderId,
              razorpaySignature: response.razorpay_signature || `sig_${Date.now()}`,
            });

            if (settled?.status === 'SUCCESS') {
              await onUnlocked();
            } else {
              throw new Error('Payment verification failed.');
            }
          } catch (err: any) {
            setPayError(err?.message || 'Payment verification failed.');
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: function () {
            setPaying(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setPayError(response.error?.description || 'Payment failed or was canceled.');
        setPaying(false);
      });
      rzp.open();
    } catch (err: any) {
      setPayError(err?.message || 'Payment failed. This quiz stays locked until payment completes.');
      setPaying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 sm:py-16 px-4 relative">
      <Card className="p-6 sm:p-8 space-y-5 border border-amber-500/30">
        {isDemoMode && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Razorpay Test Mode Active</span>
            </div>
            <Badge variant="gold">TEST MODE</Badge>
          </div>
        )}

        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Premium Mock Test
            </h2>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {subtitle ||
                'This test is based on a premium question bank. Complete the payment to unlock the questions and take part in the live rank list.'}
            </p>
          </div>
        </div>

        {/* Everything below only applies once we know who is buying. */}
        {needsLogin ? (
          <>
            <div className="py-3 text-center">
              <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                ₹{basePrice}
              </span>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                One-time unlock
              </span>
            </div>
            <Link href={`/login?redirect=${encodeURIComponent(loginRedirect)}`} className="block">
              <Button variant="gold" className="w-full font-bold py-3 cursor-pointer">
                Log in to unlock
              </Button>
            </Link>
          </>
        ) : (
          <>
            {user && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] flex flex-wrap items-center justify-between gap-1.5 text-xs font-semibold">
                <span className="text-slate-600 dark:text-slate-400">Purchasing as:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 font-mono break-all">
                  {user.name} ({user.email})
                </span>
              </div>
            )}

            {/* Coupon code */}
            {coupon ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <span className="flex items-start gap-1.5 min-w-0 flex-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-px" />
                  <span className="leading-snug">
                    Coupon {coupon.code} applied — {coupon.discountPercent}% off
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  aria-label={`Remove coupon ${coupon.code}`}
                  className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-3 items-start" noValidate>
                <div className="flex-1">
                  <Input
                    name="couponCode"
                    placeholder="Enter Coupon (e.g. PSC2026)"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value);
                      if (couponError) setCouponError('');
                    }}
                    error={couponError || undefined}
                    aria-label="Coupon code"
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="font-bold shrink-0"
                  isLoading={checkingCoupon}
                >
                  Apply
                </Button>
              </form>
            )}

            {/* Price summary */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#1e2e56] text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono">₹{basePrice}</span>
              </div>
              {coupon && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Coupon Discount ({coupon.discountPercent}%)</span>
                  <span className="font-mono">-₹{savings}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-[#1e2e56]">
                <span>Total Payable</span>
                <span className="text-amber-600 dark:text-amber-400 font-mono">₹{finalPrice}</span>
              </div>
            </div>

            {payError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{payError}</span>
              </div>
            )}

            <Button
              variant="gold"
              className="w-full font-bold py-3 flex items-center justify-center gap-2 cursor-pointer"
              disabled={paying}
              onClick={handlePay}
            >
              <Sparkles className="w-4 h-4" />
              <span>{paying ? 'Processing payment…' : `Pay ₹${finalPrice} & Unlock`}</span>
            </Button>
          </>
        )}

        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 text-center">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Access opens as soon as the payment is confirmed.</span>
        </p>
      </Card>
    </div>
  );
}
