'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, Card, Badge } from '@psc/ui';
import {
  Lock,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  FlaskConical,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { loadRazorpayScript } from '@/lib/razorpay';

/** Access verdict the API attaches to a quiz or mock test. */
export interface QuizAccessState {
  isPaid: boolean;
  hasAccess: boolean;
  price: number;
  reason: 'FREE' | 'PURCHASED' | 'STAFF' | 'LOGIN_REQUIRED' | 'PAYMENT_REQUIRED';
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
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const needsLogin = access.reason === 'LOGIN_REQUIRED';

  const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_sample_key';
  const isDemoMode =
    !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID.includes('sample_key') ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID.includes('your_key') ||
    process.env.NEXT_PUBLIC_RAZORPAY_MODE === 'test';

  const handlePay = async () => {
    setPaying(true);
    setPayError('');
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      const order: any = await ApiClient.createOrder({ quizId, amount: access.price });
      if (!order?.id) throw new Error('Could not start the payment. Please try again.');

      const activeKey = order.keyId || razorpayKey;

      const options = {
        key: activeKey,
        amount: Math.round(access.price * 100),
        currency: order.currency || 'INR',
        name: 'PSC Tips And Tricks',
        description: title,
        order_id: order.razorpayOrderId && !order.razorpayOrderId.startsWith('order_sim_') ? order.razorpayOrderId : undefined,
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
      <Card className="p-6 sm:p-8 space-y-5 text-center border border-amber-500/30">
        {isDemoMode && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Razorpay Test Mode Active</span>
            </div>
            <Badge variant="gold">TEST MODE</Badge>
          </div>
        )}

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

        <div className="py-3">
          <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">
            ₹{access.price}
          </span>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-1">
            One-time unlock
          </span>
        </div>

        {payError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{payError}</span>
          </div>
        )}

        {needsLogin ? (
          <Link href={`/login?redirect=${encodeURIComponent(loginRedirect)}`} className="block">
            <Button variant="gold" className="w-full font-bold py-3 cursor-pointer">
              Log in to unlock
            </Button>
          </Link>
        ) : (
          <Button
            variant="gold"
            className="w-full font-bold py-3 flex items-center justify-center gap-2 cursor-pointer"
            disabled={paying}
            onClick={handlePay}
          >
            <Sparkles className="w-4 h-4" />
            <span>{paying ? 'Processing payment…' : `Pay ₹${access.price} & Unlock`}</span>
          </Button>
        )}

        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Access opens as soon as the payment is confirmed.</span>
        </p>
      </Card>
    </div>
  );
}
