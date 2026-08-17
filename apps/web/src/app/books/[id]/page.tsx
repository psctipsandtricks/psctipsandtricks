'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@psc/ui';
import {
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Music,
  FileText,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Sliders,
  GraduationCap,
  Award,
  Globe2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuth } from '../../auth-provider';
import { ApiClient } from '@/lib/api-client';
import { Book } from '@psc/shared-types';

const SecurePdfViewer = dynamic(
  () => import('@/components/secure-pdf-viewer').then((mod) => mod.SecurePdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500 mb-3" />
        <p className="text-xs font-bold font-mono">Loading Secure Reader…</p>
      </div>
    ),
  }
);

export default function BookDetailPage({ params }: { params: { id: string } }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const bookData = await ApiClient.getBookById(params.id);
        if (!cancelled) {
          setBook(bookData);
        }
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message || 'This book could not be found.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, authLoading, user]);

  const handleBuyNow = () => {
    const targetUrl = `/checkout?type=book&id=${params.id}`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  const handleView = () => {
    const targetUrl = `/books/${params.id}/read`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
        <p className="text-xs text-slate-500 font-bold">Loading book details…</p>
      </div>
    );
  }

  if (loadError || !book) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black text-slate-900 dark:text-white">Book Not Found</h3>
          <p className="text-slate-600 dark:text-slate-400 text-xs">{loadError || 'This book could not be loaded.'}</p>
        </div>
        <Link href="/books">
          <Button variant="outline" size="sm" className="font-bold">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to E-Books Catalog
          </Button>
        </Link>
      </div>
    );
  }

  const owned = book.access ? book.access.hasAccess : false;
  const originalPrice = book.price || 0;
  const discount = book.discountPercent || 0;
  const effectivePrice =
    book.finalPrice ??
    (discount > 0 ? Math.round(originalPrice * (1 - discount / 100)) : originalPrice);
  const isFree = !book.isPremium || effectivePrice === 0;

  return (
    <div className="space-y-8 py-2 sm:py-4 w-full max-w-7xl mx-auto px-2 sm:px-0">
      {/* ── Breadcrumb & Status Bar ───────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/books"
          className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to E-Books Catalog</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            {book.category}
          </span>
          {owned && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-emerald-500 text-white shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Purchased & Active</span>
            </span>
          )}
        </div>
      </div>

      {/* ── 1. Top Cinema Hero Card (Balanced 2-Column Presentation) ─ */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] shadow-xl overflow-hidden p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Book Poster Visual (5 Cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 dark:border-[#1e2e56] shadow-xl bg-slate-950 group">
              {book.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02] block mx-auto"
                />
              ) : (
                <div className="w-full h-64 flex flex-col items-center justify-center text-amber-400 p-6 bg-gradient-to-b from-amber-950/30 to-slate-950/60">
                  <BookOpen className="w-14 h-14 stroke-[1.5] mb-2 text-amber-400/70" />
                  <span className="text-xs font-bold text-center text-slate-300">{book.title}</span>
                </div>
              )}

              {/* Badges Over Cover */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-1.5 pointer-events-none">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-950/85 backdrop-blur-md text-amber-400 border border-amber-500/30 shadow-md">
                  {book.category}
                </span>
                {discount > 0 && !isFree && !owned && (
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-500 text-white shadow-md">
                    {discount}% OFF
                  </span>
                )}
              </div>
            </div>

            {/* Quick Chips Info Strip */}
            <div className="grid grid-cols-2 gap-2.5 text-center">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0c152e] border border-slate-200/60 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Language</p>
                <p className="text-xs font-black text-slate-900 dark:text-white">Malayalam</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0c152e] border border-slate-200/60 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Access</p>
                <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {owned ? 'Unlocked' : isFree ? 'Free Access' : 'Full-Time'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Title, Author, Price & Direct Action CTA (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Kerala PSC 2026 Examination Edition</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight">
                {book.title}
              </h1>

              <p className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <span>By {book.author || 'PSC Tips and Tricks Editorial Board'}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 dark:text-slate-400 font-normal">Verified PSC Study Material</span>
              </p>
            </div>

            {/* Prominent Price & CTA Box */}
            <div
              className={`p-5 sm:p-6 rounded-2xl border ${
                owned
                  ? 'border-emerald-500/30 bg-emerald-500/[0.05] dark:bg-[#07191d]'
                  : 'border-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] via-amber-500/[0.02] to-amber-500/[0.06] dark:bg-[#0c152e]'
              } space-y-4 shadow-sm`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  {owned ? (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Purchased & Full Access Active</span>
                      </span>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        All lessons, notes & materials unlocked
                      </p>
                    </div>
                  ) : isFree ? (
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                        Free E-Book Access
                      </span>
                      <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        Free
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Special Promotional Offer
                      </span>
                      <div className="flex items-baseline gap-2 pt-0.5">
                        <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono">
                          ₹{effectivePrice}
                        </span>
                        {originalPrice > effectivePrice && (
                          <span className="text-base sm:text-lg text-slate-400 line-through font-mono">
                            ₹{originalPrice}
                          </span>
                        )}
                        {discount > 0 && (
                          <span className="text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                            Save ₹{originalPrice - effectivePrice} ({discount}% OFF)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {book.previewPdfUrl && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setPreviewModalOpen(true)}
                      className="font-bold text-sm border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 px-5 cursor-pointer shadow-xs"
                    >
                      <FileText className="w-4 h-4 mr-1.5 text-amber-500" />
                      <span>Read Free Preview</span>
                    </Button>
                  )}

                  {owned || isFree ? (
                    <Button
                      variant="gold"
                      size="lg"
                      onClick={handleView}
                      className="w-full sm:w-auto font-black text-sm shadow-xl shadow-amber-500/25 px-8 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      <span>Start Reading Now</span>
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      variant="gold"
                      size="lg"
                      onClick={handleBuyNow}
                      className="w-full sm:w-auto font-black text-sm shadow-xl shadow-amber-500/25 px-8 cursor-pointer"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      <span>Get Instant Access ⚡</span>
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800 pt-3">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Instant digital activation
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Read on Mobile, Tablet & PC
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Unlimited Audio Replay
                </span>
              </div>
            </div>

            {/* Key Syllabus Feature Highlights in 2x2 Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#0c152e] border border-slate-200/60 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  100% SCERT Textbook Syllabus Mapped
                </span>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#0c152e] border border-slate-200/60 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Synchronized Teacher Audio Narration
                </span>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#0c152e] border border-slate-200/60 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Topic-wise Previous Year Question Sets
                </span>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#0c152e] border border-slate-200/60 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Distraction-Free Protected Reader
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Two-Column Detailed Information Grid ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Syllabus & Module Overview (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] p-6 sm:p-8 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              <span>About this PSC Study Module</span>
            </h2>

            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
              {book.description}
            </div>
          </div>
        </div>

        {/* Right Column: Features & WhatsApp Support (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] p-6 sm:p-8 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Smart E-Book Features</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-amber-500/[0.06] border border-amber-500/20 space-y-1">
                <p className="font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-amber-500" />
                  <span>Synchronized Audio Playback</span>
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Listen to expert explanations while the notes automatically pace along with the teacher voice.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/[0.06] border border-amber-500/20 space-y-1">
                <p className="font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-500" />
                  <span>Voice Clarity DSP Filter</span>
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Studio audio filters for clear pronunciation of complex scientific and historical terminology.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 space-y-1">
                <p className="font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Globe2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Access on Any Device</span>
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Optimized for Android, iPhones, iPads, tablets, laptops, and desktop computers.
                </p>
              </div>
            </div>
          </div>

          {/* Need Guidance WhatsApp Support Card */}
          <div className="p-6 rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-cyan-500/10 to-amber-500/10 space-y-3 text-center sm:text-left">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-500" />
              <span>Need Help or Syllabus Guidance?</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Have questions regarding book access, payment methods, or syllabus alignment? Message our student support team on WhatsApp.
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
              <a href="https://wa.me/918891930605" target="_blank" rel="noopener noreferrer">
                <Button variant="gold" size="sm" className="font-bold text-xs shadow-md shadow-emerald-500/20">
                  <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp Us (+91 88919 30605)
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Secure Preview PDF Modal ────────────────────────────── */}
      {previewModalOpen && book.previewPdfUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-2 sm:p-6 !mt-0"
          role="dialog"
          aria-modal="true"
          aria-label={`Sample Preview: ${book.title}`}
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            className="w-full max-w-5xl h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-2xl overflow-hidden flex flex-col transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <SecurePdfViewer
              url={book.previewPdfUrl}
              title={`Preview Sample: ${book.title}`}
              user={user ? { id: user.id, name: user.name, email: user.email, phone: user.phoneNumber || undefined } : null}
              onClose={() => setPreviewModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
