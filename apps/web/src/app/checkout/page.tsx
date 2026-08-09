'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, CardTitle, CardDescription, Button, Input, Badge } from '@psc/ui';
import { ShoppingBag, Lock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../auth-provider';

const couponSchema = Yup.object({
  couponCode: Yup.string()
    .trim()
    .matches(/^[A-Za-z0-9]+$/, 'Coupon code can only contain letters and numbers')
    .required('Enter a coupon code'),
});

function CheckoutFormContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  const itemType = searchParams?.get('type');
  const itemId = searchParams?.get('id');

  useEffect(() => {
    setMounted(true);
    if (!authLoading && !user) {
      const currentQuery = window.location.search;
      router.replace(`/login?redirect=${encodeURIComponent(`/checkout${currentQuery}`)}`);
    }
  }, [user, authLoading, router]);

  const [discountApplied, setDiscountApplied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const basePrice = itemType === 'book' ? 299 : 499;
  const finalPrice = discountApplied ? Math.round(basePrice * 0.8) : basePrice;

  const handleRazorpayPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      alert('🎉 Payment Simulated Successfully via Razorpay Sandbox!');
      router.push('/dashboard');
    }, 1500);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 py-4">
      <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
        <ShoppingBag className="w-7 h-7 text-amber-500" />
        <span>Premium Checkout</span>
      </h1>

      <Card className="space-y-6 glass-panel p-6">
        <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
              {itemType === 'book' ? 'E-Book PDF Access & Handbook' : 'PSC Premium All-Access Pass'}
            </CardTitle>
            <CardDescription>Instant digital download & unlimited student mock tests.</CardDescription>
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

        <Button
          variant="gold"
          size="lg"
          className="w-full font-bold shadow-lg shadow-amber-500/20"
          isLoading={isProcessing}
          onClick={handleRazorpayPayment}
        >
          Pay ₹{finalPrice} via Razorpay 💳
        </Button>
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
