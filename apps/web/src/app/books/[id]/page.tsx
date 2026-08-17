'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge } from '@psc/ui';
import {
  ShoppingCart,
  Eye,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Music,
  FileText,
  Youtube,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ListTree,
  ChevronDown,
  Phone,
  MessageCircle,
  Sliders,
  GraduationCap,
  Award,
  Globe2,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../auth-provider';
import { ApiClient } from '@/lib/api-client';
import { Book } from '@psc/shared-types';

export default function BookDetailPage({ params }: { params: { id: string } }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [bookData, chaptersData] = await Promise.all([
          ApiClient.getBookById(params.id),
          ApiClient.getChapters(params.id).catch(() => []),
        ]);
        if (!cancelled) {
          setBook(bookData);
          setChapters(Array.isArray(chaptersData) ? chaptersData : []);
          if (Array.isArray(chaptersData) && chaptersData.length > 0) {
            setExpandedChapterId(chaptersData[0].id);
          }
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
          className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 inline-flex items-center gap-1.5 transition-colors"
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Column: Book Poster Visual (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 dark:border-[#1e2e56] shadow-2xl bg-slate-900 group">
              {book.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="w-full h-auto max-h-[460px] object-contain transition-transform duration-500 group-hover:scale-[1.02] block mx-auto"
                />
              ) : (
                <div className="w-full h-72 flex flex-col items-center justify-center text-cyan-400 p-6 bg-gradient-to-b from-cyan-950/30 to-slate-950/60">
                  <BookOpen className="w-16 h-16 stroke-[1.5] mb-2 text-cyan-400/70" />
                  <span className="text-xs font-bold text-center text-slate-300">{book.title}</span>
                </div>
              )}

              {/* Badges Over Cover */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-1.5 pointer-events-none">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-950/85 backdrop-blur-md text-amber-400 border border-amber-500/30 shadow-md">
                  {book.category}
                </span>
                {discount > 0 && !isFree && (
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-500 text-white shadow-md">
                    {discount}% OFF
                  </span>
                )}
              </div>

              {/* Multimedia Features Pill Over Cover */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-around bg-slate-950/90 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-[11px] text-white">
                <span className="flex items-center gap-1 font-bold text-cyan-400">
                  <Music className="w-3.5 h-3.5" /> Audio Lessons
                </span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1 font-bold text-amber-400">
                  <FileText className="w-3.5 h-3.5" /> PDF Notes
                </span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1 font-bold text-rose-400">
                  <Youtube className="w-3.5 h-3.5" /> Video
                </span>
              </div>
            </div>

            {/* Quick Metadata Info Strip */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0c152e] border border-slate-200/60 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Chapters</p>
                <p className="text-sm font-black text-slate-900 dark:text-white font-mono">{chapters.length || '10+'}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0c152e] border border-slate-200/60 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Language</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">Malayalam</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0c152e] border border-slate-200/60 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Access</p>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {owned ? 'Unlocked' : isFree ? 'Free' : 'Full-Time'}
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
            <div className="p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] via-cyan-500/[0.04] to-amber-500/[0.06] dark:bg-[#0c152e] space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    {owned ? 'Your Entitlement Status' : 'Special Promotional Offer'}
                  </span>
                  {isFree ? (
                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      Free Access
                    </span>
                  ) : (
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
                  )}
                </div>

                <div>
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
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-500 flex items-center justify-center shrink-0">
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

      {/* ── 2. Two-Column Detailed Breakdown (Syllabus & TOC) ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Syllabus Description & Curriculum Accordion (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Detailed Syllabus & Description Card */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] p-6 sm:p-8 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              <span>About this PSC Study Module</span>
            </h2>

            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
              {book.description}
            </div>
          </div>

          {/* Curriculum Breakdown / Chapters & Topics Accordion */}
          {chapters.length > 0 && (
            <div className="rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] p-6 sm:p-8 shadow-sm space-y-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <ListTree className="w-5 h-5 text-cyan-500" />
                  <span>Table of Contents ({chapters.length} Chapters)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Click any chapter to inspect all subtopics, audio lessons, and PDF materials.
                </p>
              </div>

              <div className="space-y-2.5">
                {chapters.map((chapter, idx) => {
                  const isExpanded = expandedChapterId === chapter.id;
                  const topics = chapter.topics || [];

                  return (
                    <div
                      key={chapter.id}
                      className="rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#0c152e]/50 overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedChapterId(isExpanded ? null : chapter.id)}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100/70 dark:hover:bg-[#0c152e] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono font-black text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                              {chapter.title}
                            </h3>
                            {chapter.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {chapter.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold font-mono bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                            {topics.length} {topics.length === 1 ? 'Topic' : 'Topics'}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180 text-cyan-500' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {/* Expanded Topics List */}
                      {isExpanded && (
                        <div className="p-3 pt-0 border-t border-slate-200/60 dark:border-slate-800/80 space-y-1.5 mt-1">
                          {topics.length > 0 ? (
                            topics.map((t: any, tIdx: number) => (
                              <div
                                key={t.id}
                                className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#070e22] border border-slate-200/60 dark:border-slate-800 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-[11px] font-bold text-cyan-600 dark:text-cyan-400 shrink-0">
                                    {idx + 1}.{tIdx + 1}
                                  </span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {t.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {t.audioUrl && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                                      <Music className="w-2.5 h-2.5" /> Audio
                                    </span>
                                  )}
                                  {t.pdfUrl && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                      <FileText className="w-2.5 h-2.5" /> Notes
                                    </span>
                                  )}
                                  {t.youtubeUrl && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-500">
                                      <Youtube className="w-2.5 h-2.5" /> Video
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 text-center py-2">No topics in this chapter.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Why Choose + Helpline (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Multimedia Reader Advantage Card */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] p-6 sm:p-8 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Smart E-Book Features</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-cyan-500/[0.06] border border-cyan-500/20 space-y-1">
                <p className="font-black text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-cyan-500" />
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
                  Built-in audio filter clears background hiss for crystal-clear teacher voices during bus & travel study.
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

          {/* Need Guidance Hotline Card */}
          <div className="p-6 rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-cyan-500/10 to-amber-500/10 space-y-3 text-center sm:text-left">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
              <Phone className="w-4 h-4 text-amber-500" />
              <span>Need Help or Syllabus Guidance?</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Have questions regarding book access, payment methods, or syllabus alignment? Chat directly with our student support team.
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
              <a href="https://wa.me/918891930605" target="_blank" rel="noopener noreferrer">
                <Button variant="gold" size="sm" className="font-bold text-xs">
                  <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp Us
                </Button>
              </a>
              <a href="tel:+918891930605">
                <Button variant="outline" size="sm" className="font-bold text-xs">
                  <Phone className="w-3.5 h-3.5 mr-1" /> +91 88919 30605
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
