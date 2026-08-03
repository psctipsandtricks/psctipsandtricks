'use client';

import React from 'react';
import Link from 'next/link';
import { Card, Button, Badge } from '@psc/ui';

export default function BookDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link href="/books" className="text-sm text-indigo-400 hover:underline inline-flex items-center gap-1">
        ← Back to E-Books Catalog
      </Link>

      <Card className="p-8 space-y-6">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 h-80 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 font-bold border border-slate-700">
            📖 Book Cover Preview
          </div>
          <div className="flex-1 space-y-4">
            <Badge variant="gold">Kerala PSC LDC / Secretariat Assistant</Badge>
            <h1 className="text-3xl font-extrabold text-white">Kerala PSC Master Question Bank 2026</h1>
            <p className="text-amber-400 text-sm font-semibold">Author: PSC Tips Expert Team</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Comprehensive collection of 10,000+ previous year questions with detailed explanations, shortcut tricks, and topic-wise breakdown. Ideal for LDC, CPO, Fireman, Village Field Assistant, and Secretariat Assistant examinations.
            </p>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">Instant PDF Download</span>
                <span className="text-3xl font-black text-amber-400">₹299</span>
              </div>
              <Link href="/checkout?type=book&id=book-1">
                <Button variant="gold" size="lg" className="font-bold">
                  Buy & Download Now ⚡
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
