'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, CardTitle, CardDescription, Button, Input, Badge } from '@psc/ui';
import {
  ShoppingBag,
  Lock,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../auth-provider';
import { ApiClient } from '@/lib/api-client';
import { loadRazorpayScript } from '@/lib/razorpay';

const couponSchema = Yup.object({
  couponCode: Yup.string()
    .trim()
    .matches(/^[A-Za-z0-9]+$/, 'Coupon code can only contain letters and numbers')
    .required('Enter a coupon code'),
});

interface CheckoutItem {
  title: string;
  subtitle?: string;
  price: number;
}

function CheckoutFormContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  const itemType = searchParams?.get('type') === 'quiz' ? 'quiz' : 'book';
  const itemId = searchParams?.get('id') || '';

  useEffect(() => {
    setMounted(true);
    if (!authLoading && !user) {
      const currentQuery = window.location.search;
      router.replace(`/login?redirect=${encodeURIComponent(`/checkout${currentQuery}`)}`);
    }
  }, [user, authLoading, router]);

  const [item, setItem] = useState<CheckoutItem | null>(null);
  const [itemLoading, setItemLoading] = useState(true);
  const [itemLoadError, setItemLoadError] = useState('');

  useEffect(() => {
    if (!user || !itemId) return;
    let cancelled = false;

    (async () => {
      setItemLoading(true);
      setItemLoadError('');
      try {
        if (itemType === 'book') {
          const book = await ApiClient.getBookById(itemId);
          if (cancelled) return;
          setItem({ title: book.title, subtitle: `by ${book.author}`, price: book.price ?? 0 });
        } else {
          const quiz = await ApiClient.getQuizById(itemId);
          if (cancelled) return;
          setItem({ title: quiz.title, price: quiz.price ?? 0 });
        }
      } catch (err: any) {
        if (!cancelled) setItemLoadError(err?.message || 'This item could not be found.');
      } finally {
        if (!cancelled) setItemLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, itemId, itemType]);

  const [discountApplied, setDiscountApplied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [payError, setPayError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const couponFormik = useFormik({
    initialValues: { couponCode: '' },
    validationSchema: couponSchema,
    onSubmit: (values, { setFieldError, setSubmitting }) => {
      if (values.couponCode.toUpperCase() === 'PSC2026') {
        setDiscountApplied(true);
      } else {
        setFieldError('couponCode', 'Invalid coupon code. Try PSC2026 for 20% off!');
      }
      setSubmitting(false);
    },
  });

  if (!mounted || authLoading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!itemId) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <p className="text-slate-600 dark:text-slate-300 font-semibold">No item was specified for checkout.</p>
      </div>
    );
  }

  if (itemLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (itemLoadError || !item) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <p className="text-slate-600 dark:text-slate-300 font-semibold">{itemLoadError || 'This item could not be found.'}</p>
      </div>
    );
  }

  const basePrice = item.price;
  const finalPrice = discountApplied ? Math.round(basePrice * 0.8) : basePrice;

  const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_TOgmxfbeSFUgys';
  const isDemoMode =
    !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID.includes('sample_key') ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID.includes('your_key') ||
    process.env.NEXT_PUBLIC_RAZORPAY_MODE === 'test';

  const handleRazorpayPayment = async () => {
    setIsProcessing(true);
    setPayError('');
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      const orderPayload =
        itemType === 'book'
          ? { bookId: itemId, amount: finalPrice, couponCode: discountApplied ? 'PSC2026' : undefined }
          : { quizId: itemId, amount: finalPrice, couponCode: discountApplied ? 'PSC2026' : undefined };

      const order: any = await ApiClient.createOrder(orderPayload);
      if (!order?.id) throw new Error('Could not start the payment. Please try again.');

      let activeKey = order.keyId || razorpayKey;
      // Safeguard: Key Secret (starting with rzp_test_s... or rzp_live_s...) must NEVER be passed as key_id to browser JS SDK!
      if (activeKey && (activeKey.startsWith('rzp_test_s') || activeKey.startsWith('rzp_live_s') || activeKey.length > 30)) {
        console.warn('Razorpay Key Secret was passed as key_id. Falling back to public Key ID.');
        activeKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_TOgmxfbeSFUgys';
      }

      const options = {
        key: activeKey,
        amount: Math.round(finalPrice * 100),
        currency: order.currency || 'INR',
        name: 'Kerala PSC Tips & Tricks',
        description: item.title,
        order_id: order.razorpayOrderId && !order.razorpayOrderId.startsWith('order_sim_') ? order.razorpayOrderId : undefined,
        prefill: {
          name: user.name || '',
          email: user.email || '',
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
              setPaymentSuccess(true);
              setTimeout(() => router.push('/dashboard'), 1500);
            } else {
              throw new Error('Payment verification failed.');
            }
          } catch (err: any) {
            setPayError(err?.message || 'Payment verification failed.');
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setPayError(response.error?.description || 'Payment failed or was canceled.');
        setIsProcessing(false);
      });
      rzp.open();
    } catch (err: any) {
      setPayError(err?.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Payment Successful!</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Unlocking your content & taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 py-4 relative">
      <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
        <ShoppingBag className="w-7 h-7 text-amber-500" />
        <span>Premium Checkout</span>
      </h1>

      <Card className="space-y-6 glass-panel p-6">
        {/* Test / Demo Mode Indicator */}
        {isDemoMode && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-amber-500 shrink-0" />
              <span><strong>Razorpay Test Mode:</strong> Uses official Razorpay Test Checkout popup.</span>
            </div>
            <Badge variant="gold">TEST MODE</Badge>
          </div>
        )}

        <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">{item.title}</CardTitle>
            <CardDescription>
              {item.subtitle || (itemType === 'book' ? 'Instant digital download & unlimited access.' : 'Unlimited attempts on this premium quiz.')}
            </CardDescription>
          </div>
          <Badge variant="gold">Secure SSL</Badge>
        </div>

        {/* Authenticated Student Account Box */}
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-600 dark:text-slate-400">Purchasing as:</span>
          <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{user.name} ({user.email})</span>
        </div>

        {/* Coupon Code Section */}
        <form onSubmit={couponFormik.handleSubmit} className="flex gap-3 items-start" noValidate>
          <div className="flex-1">
            <Input
              name="couponCode"
              placeholder="Enter Coupon (e.g. PSC2026)"
              value={couponFormik.values.couponCode}
              onChange={couponFormik.handleChange}
              onBlur={couponFormik.handleBlur}
              error={
                couponFormik.touched.couponCode && couponFormik.errors.couponCode
                  ? couponFormik.errors.couponCode
                  : undefined
              }
            />
          </div>
          <Button type="submit" variant="outline" className="font-bold shrink-0">
            Apply
          </Button>
        </form>

        {discountApplied && (
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Coupon PSC2026 Applied! 20% Discount saved.</span>
          </div>
        )}

        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Subtotal</span>
            <span>₹{basePrice}</span>
          </div>
          {discountApplied && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>Coupon Discount (20%)</span>
              <span>-₹{basePrice - finalPrice}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
            <span>Total Payable</span>
            <span className="text-amber-600 dark:text-amber-400">₹{finalPrice}</span>
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
          size="lg"
          className="w-full font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
          isLoading={isProcessing}
          onClick={handleRazorpayPayment}
        >
          <Lock className="w-4 h-4" />
          <span>Pay ₹{finalPrice} via Razorpay</span>
        </Button>

        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-amber-500" />
          <span>256-Bit Encrypted Razorpay Checkout Gateway</span>
        </p>
      </Card>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-500">Loading checkout portal...</div>}>
      <CheckoutFormContent />
    </Suspense>
  );
}
