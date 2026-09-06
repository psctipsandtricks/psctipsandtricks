'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@psc/ui';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileQuestion,
  Lock,
  Radio,
  ShoppingCart,
  Timer,
  Award,
  Sparkles,
  Unlock,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from './auth-provider';

/** A quiz created within this many days wears the "NEW" badge. */
const NEW_QUIZ_WINDOW_DAYS = 7;
/** Maximum 10 premium quizzes on the homepage prioritized by newest. */
const MAX_HOME_QUIZZES = 10;
/** Automatic scroll advance interval in milliseconds. */
const AUTO_SCROLL_INTERVAL_MS = 3800;

interface HomeQuiz {
  id: string;
  title: string;
  folderName: string | null;
  questions: number;
  duration: number;
  totalMarks: number;
  isLive: boolean;
  isPaid: boolean;
  price: number;
  imageUrl?: string | null;
  hasAccess: boolean;
  createdAt: string;
}

function isRecentlyUploaded(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= NEW_QUIZ_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function QuizCardSkeleton() {
  return (
    <div className="shrink-0 snap-start w-[280px] sm:w-[320px] rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] p-5 space-y-4 animate-pulse shadow-lg flex flex-col justify-between">
      <div className="space-y-3">
        <div className="aspect-video w-full rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-24 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-1.5">
          <div className="h-5 w-full rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-5 w-3/4 rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-12 w-full rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
      </div>
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
        <div className="h-10 w-full rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export function HomeQuizCarousel() {
  const { user } = useAuth();
  const router = useRouter();

  const [quizzes, setQuizzes] = useState<HomeQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const railRef = useRef<HTMLDivElement>(null);
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchQuizzes() {
      try {
        const data = (await ApiClient.getPublishedQuizzes()) as any[];
        
        // Filter strictly for Premium Quizzes (isPaid or accessType === 'PAID' or isPremium)
        const premiumQuizzes = (data || []).filter((q) => {
          const isPaid = q.access?.isPaid ?? (q.accessType === 'PAID' || q.isPremium);
          return isPaid;
        });

        // Prioritize the most recently added quizzes (descending order) and limit to max 10
        const sorted = premiumQuizzes.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        const mapped: HomeQuiz[] = sorted.slice(0, MAX_HOME_QUIZZES).map((q) => ({
          id: q.id,
          title: q.title,
          folderName:
            !q.folderName || q.folderName === 'Root' || q.folderName === 'Root / No Folder'
              ? null
              : q.folderName,
          questions: q.totalQuestions || (q.questions?.length ?? 0),
          duration: q.durationMinutes,
          totalMarks: q.totalMarks,
          isLive: !!q.isLiveMock,
          isPaid: true,
          // The admin's discounted "Final Student Price" overrides the base
          // price — prefer the server-resolved access.price, then finalPrice.
          price: q.access?.price ?? (q.finalPrice && q.finalPrice > 0 ? q.finalPrice : q.price) ?? 0,
          imageUrl: q.imageUrl || null,
          hasAccess: q.access?.hasAccess ?? false,
          createdAt: q.createdAt,
        }));

        if (isMounted) setQuizzes(mapped);
      } catch (err) {
        console.error('Failed to fetch premium quizzes for home carousel:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchQuizzes();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const reachableStops = useCallback((rail: HTMLDivElement) => {
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    if (maxScroll <= 0) return [0];
    const origin = rail.getBoundingClientRect().left - rail.scrollLeft;
    const stops = Array.from(rail.children)
      .map((card) => Math.round((card as HTMLElement).getBoundingClientRect().left - origin))
      .filter((stop) => stop <= maxScroll);
    if (maxScroll - (stops[stops.length - 1] ?? 0) > 24) stops.push(maxScroll);
    return stops;
  }, []);

  const syncScrollState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const current = rail.scrollLeft;
    const stops = reachableStops(rail);
    setCanScrollLeft(stops.some((stop) => stop < current - 8));
    setCanScrollRight(stops.some((stop) => stop > current + 8));

    // Calculate active card index for dots indicator
    if (stops.length > 0) {
      let closestIdx = 0;
      let minDiff = Infinity;
      stops.forEach((stop, idx) => {
        const diff = Math.abs(stop - current);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      setActiveIndex(Math.min(closestIdx, quizzes.length - 1));
    }
  }, [reachableStops, quizzes.length]);

  useEffect(() => {
    syncScrollState();
    window.addEventListener('resize', syncScrollState);
    return () => window.removeEventListener('resize', syncScrollState);
  }, [syncScrollState, quizzes.length]);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const current = rail.scrollLeft;
    const desired = current + direction * (rail.clientWidth * 0.85);
    const candidates = reachableStops(rail).filter((stop) =>
      direction === 1 ? stop > current + 8 : stop < current - 8,
    );
    if (candidates.length === 0) return;
    const target = candidates.reduce((best, stop) =>
      Math.abs(stop - desired) < Math.abs(best - desired) ? stop : best,
    );
    rail.scrollTo({ left: target, behavior: 'smooth' });
  }, [reachableStops]);

  // Automatic Smooth Scrolling Carousel with wrap-around
  useEffect(() => {
    if (loading || isPaused || quizzes.length <= 1) return;

    autoScrollTimerRef.current = setInterval(() => {
      const rail = railRef.current;
      if (!rail) return;

      const maxScroll = rail.scrollWidth - rail.clientWidth;
      if (maxScroll <= 0) return;

      // If at or near the end, loop smoothly back to beginning
      if (rail.scrollLeft >= maxScroll - 16) {
        rail.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        // Move to the next card
        const cardWidth = 320 + 20; // card width + gap
        const nextScroll = Math.min(rail.scrollLeft + cardWidth, maxScroll);
        rail.scrollTo({ left: nextScroll, behavior: 'smooth' });
      }
    }, AUTO_SCROLL_INTERVAL_MS);

    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, [loading, isPaused, quizzes.length]);

  const scrollToCardIndex = (index: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const cardEl = rail.children[index] as HTMLElement | undefined;
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  };

  const handleStartQuiz = (quiz: HomeQuiz) => {
    const targetUrl =
      quiz.isPaid && !quiz.hasAccess ? `/checkout?type=quiz&id=${quiz.id}` : `/quizzes/${quiz.id}`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  const showEmptyState = !loading && quizzes.length === 0;

  return (
    <div
      className="space-y-6 w-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* ── Trust markers ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Premium PSC Mock Tests
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Negative Marking
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Live State Rank List
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Step-by-Step Explanations
        </span>
      </div>

      {showEmptyState ? (
        <div className="text-center py-12 space-y-3 bg-slate-100/50 dark:bg-[#091124]/50 rounded-3xl border border-slate-200/80 dark:border-slate-800/80">
          <FileQuestion className="w-12 h-12 mx-auto text-slate-400" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            Premium mock tests are being prepared.
          </p>
          <p className="text-xs text-slate-400">
            Check the full quiz catalog for daily practice and subject tests.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* ── Desktop scroll arrows ─────────────────────────────────── */}
          <button
            type="button"
            aria-label="Scroll quizzes left"
            onClick={() => scrollByPage(-1)}
            disabled={!canScrollLeft}
            className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-[#0c152e] border border-slate-200 dark:border-[#1e2e56] text-slate-600 dark:text-slate-300 shadow-lg transition-all hover:bg-slate-50 dark:hover:bg-[#121f42] hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Scroll quizzes right"
            onClick={() => scrollByPage(1)}
            disabled={!canScrollRight}
            className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-[#0c152e] border border-slate-200 dark:border-[#1e2e56] text-slate-600 dark:text-slate-300 shadow-lg transition-all hover:bg-slate-50 dark:hover:bg-[#121f42] hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* ── Horizontally scrollable rail ──────────────────────────── */}
          <div
            ref={railRef}
            onScroll={syncScrollState}
            role="region"
            aria-label="Premium quizzes carousel"
            tabIndex={0}
            className="flex items-stretch gap-4 sm:gap-5 overflow-x-auto scrollbar-none touch-scroll-x snap-x snap-mandatory scroll-smooth overscroll-x-contain pt-3 pb-4 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
          >
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <QuizCardSkeleton key={i} />)
              : quizzes.map((quiz) => {
                  const isNew = isRecentlyUploaded(quiz.createdAt);
                  const needsPurchase = quiz.isPaid && !quiz.hasAccess;
                  const displayImage = quiz.imageUrl || '/default-quiz-cover.svg';

                  return (
                    <div
                      key={quiz.id}
                      className="group shrink-0 snap-start w-[280px] sm:w-[320px] md:w-[330px] flex flex-col justify-between rounded-3xl glass-card p-4 sm:p-5 hover-lift transition-all duration-300 relative overflow-hidden"
                    >
                      <div className="space-y-3 relative z-10">
                        {/* ── Visual Section: Image Cover (Uploaded or Default Placeholder) ── */}
                        <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/40 dark:border-white/10 bg-slate-950 group/img shadow-md">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={displayImage}
                            alt={quiz.title}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/default-quiz-cover.svg';
                            }}
                            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                          />
                          {/* Gradient Overlay for Readability */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />

                          {/* Badges Over Image */}
                          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
                            <div className="flex items-center gap-1.5">
                              {isNew && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-lg shadow-emerald-950/40">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                  New
                                </span>
                              )}
                              {quiz.isLive && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-lg shadow-rose-950/40">
                                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                                  Live
                                </span>
                              )}
                            </div>
                            {needsPurchase ? (
                              <span className="px-2.5 py-1 rounded-xl text-[10px] font-black font-mono bg-slate-950/85 backdrop-blur-md text-amber-400 border border-amber-500/30 shadow-lg flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5 text-amber-400" />
                                <span>₹{quiz.price}</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-950/85 backdrop-blur-md text-emerald-400 border border-emerald-500/30 shadow-lg flex items-center gap-1">
                                <Unlock className="w-2.5 h-2.5 text-emerald-400" />
                                <span>Unlocked</span>
                              </span>
                            )}
                          </div>

                          {/* Bottom Info on Image */}
                          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] text-slate-200 font-mono font-bold">
                            <span className="px-2.5 py-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/15 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                              {quiz.folderName || 'Kerala PSC'}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/15 text-slate-200 text-[10px] font-bold shadow-sm">
                              <Timer className="w-3 h-3 text-amber-400" />
                              {quiz.duration}m
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="font-black text-slate-900 dark:text-white text-base leading-snug line-clamp-2 min-h-[2.75rem] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors pt-0.5">
                          {quiz.title}
                        </h3>

                        {/* Structured Liquid Glass Metadata Box */}
                        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-white/40 dark:bg-white/[0.04] backdrop-blur-md border border-white/60 dark:border-white/10 shadow-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500 shrink-0">
                              <FileQuestion className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Questions</p>
                              <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                                {quiz.questions} Qs
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-500 shrink-0">
                              <Award className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Total Marks</p>
                              <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                                {quiz.totalMarks} Marks
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-3.5 mt-3.5 border-t border-slate-200/60 dark:border-slate-800/80 relative z-10">
                        {needsPurchase ? (
                          <Button
                            size="md"
                            variant="gold"
                            onClick={() => handleStartQuiz(quiz)}
                            className="w-full font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer h-10 transition-all hover:scale-[1.01]"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Buy Now</span>
                          </Button>
                        ) : (
                          <Button
                            size="md"
                            variant="primary"
                            onClick={() => handleStartQuiz(quiz)}
                            className="w-full font-black text-xs rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-400 text-slate-950 shadow-lg shadow-amber-500/25 flex items-center justify-center gap-1.5 cursor-pointer h-10 transition-all hover:scale-[1.01]"
                          >
                            <span>Start Quiz</span>
                            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>

          {/* ── Dots Pagination Indicator for Carousel ─────────────────── */}
          {quizzes.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-2">
              {quizzes.map((_, idx) => (
                <button
                  key={`dot_${idx}`}
                  type="button"
                  aria-label={`Go to quiz ${idx + 1}`}
                  onClick={() => scrollToCardIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    activeIndex === idx
                      ? 'w-6 bg-amber-500'
                      : 'w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Browse-all CTA ────────────────────────────────────────────── */}
      <div className="flex justify-center pt-1">
        <Link href="/quizzes">
          <Button
            size="lg"
            variant="outline"
            className="font-extrabold px-8 rounded-2xl border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-all shadow-md cursor-pointer"
          >
            <span>Browse All Quizzes &amp; Mock Tests</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
