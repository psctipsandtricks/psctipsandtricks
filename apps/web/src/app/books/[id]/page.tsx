'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge } from '@psc/ui';
import { ShoppingCart } from 'lucide-react';
import { useAuth } from '../../auth-provider';

export default function BookDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const router = useRouter();

  const handleBuyNow = () => {
    const targetUrl = `/checkout?type=book&id=${params.id}`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link href="/books" className="text-sm text-indigo-500 font-semibold hover:underline inline-flex items-center gap-1">
        ← Back to E-Books Catalog
      </Link>

      <Card className="p-8 space-y-6 glass-panel">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 h-80 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 flex flex-col items-center justify-center text-slate-700 dark:text-slate-300 font-bold border border-slate-300 dark:border-slate-700 shadow-md">
            <span className="text-4xl mb-2">📖</span>
            <span className="text-xs font-mono">PDF Preview</span>
          </div>
          <div className="flex-1 space-y-4">
            <Badge variant="gold">Kerala PSC LDC / Secretariat Assistant</Badge>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Kerala PSC Master Question Bank 2026</h1>
            <p className="text-amber-600 dark:text-amber-400 text-sm font-semibold">Author: PSC Tips Expert Team</p>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              Comprehensive collection of 10,000+ previous year questions with detailed explanations, shortcut tricks, and topic-wise breakdown. Ideal for LDC, CPO, Fireman, Village Field Assistant, and Secretariat Assistant examinations.
            </p>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Instant PDF Download</span>
                <span className="text-3xl font-black text-slate-900 dark:text-white">₹299</span>
              </div>
              <Button variant="gold" size="lg" onClick={handleBuyNow} className="font-bold flex items-center space-x-2">
                <ShoppingCart className="w-5 h-5" />
                <span>Buy & Download Now ⚡</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
