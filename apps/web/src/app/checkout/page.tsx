'use client';

import React, { useState } from 'react';
import { Card, CardTitle, CardDescription, Button, Input, Badge } from '@psc/ui';

export default function CheckoutPage({ searchParams }: { searchParams: { type?: string; id?: string } }) {
  const [couponCode, setCouponCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const basePrice = searchParams?.type === 'book' ? 299 : 499;
  const finalPrice = discountApplied ? Math.round(basePrice * 0.8) : basePrice;

  const handleApplyCoupon = () => {
    if (couponCode.toUpperCase() === 'PSC2026') {
      setDiscountApplied(true);
    } else {
      alert('Invalid coupon code. Try PSC2026!');
    }
  };

  const handleRazorpayPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      alert('🎉 Payment Simulated Successfully via Razorpay Sandbox!');
      window.location.href = '/dashboard';
    }, 1500);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Premium Checkout</h1>

      <Card className="space-y-6">
        <div className="flex justify-between items-start border-b border-slate-800 pb-4">
          <div>
            <CardTitle className="text-lg">
              {searchParams?.type === 'book' ? 'E-Book PDF Access' : 'PSC Premium All-Access Pass'}
            </CardTitle>
            <CardDescription>Instant access to live mocks, rank cards, and PDF handbooks.</CardDescription>
          </div>
          <Badge variant="gold">Secure</Badge>
        </div>

        {/* Coupon Code Section */}
        <div className="flex gap-3">
          <Input
            placeholder="Enter Coupon (e.g. PSC2026)"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
          />
          <Button variant="outline" onClick={handleApplyCoupon}>
            Apply
          </Button>
        </div>

        {discountApplied && (
          <div className="text-xs text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-800 p-3 rounded-lg">
            ✓ Coupon PSC2026 Applied! 20% Discount saved.
          </div>
        )}

        <div className="space-y-2 pt-2 border-t border-slate-800 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span>₹{basePrice}</span>
          </div>
          {discountApplied && (
            <div className="flex justify-between text-emerald-400">
              <span>Coupon Discount (20%)</span>
              <span>-₹{basePrice - finalPrice}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-slate-800">
            <span>Total Payable</span>
            <span className="text-amber-400">₹{finalPrice}</span>
          </div>
        </div>

        <Button
          variant="gold"
          size="lg"
          className="w-full font-bold"
          isLoading={isProcessing}
          onClick={handleRazorpayPayment}
        >
          Pay ₹{finalPrice} via Razorpay 💳
        </Button>
      </Card>
    </div>
  );
}
