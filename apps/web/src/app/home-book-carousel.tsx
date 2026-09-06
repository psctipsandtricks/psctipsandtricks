'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  BookOpen,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Layers,
  Smartphone,
} from 'lucide-react';
import { Button } from '@psc/ui';
import { Book } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { extractDominantColors } from '@/lib/dominant-color';
import { useAuth } from './auth-provider';

const REFRESH_INTERVAL_MS = 30_000;
const SLIDE_INTERVAL_MS = 5000;
const DEFAULT_GLOW: [string, string] = ['#f59e0b', '#06b6d4'];

export function HomeBookCarousel({ initialBooks }: { initialBooks?: Book[] }) {
  const router = useRouter();
  const { user } = useAuth();

  const handleExplore = (bookId: string) => {
    const targetUrl = `/books/${bookId}`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  const [books, setBooks] = useState<Book[]>(() => {
    if (initialBooks && initialBooks.length > 0) {
      return initialBooks.filter((b: Book) => b.isPublished && (!!b.heroCoverUrl || !!b.coverUrl));
    }
    return [];
  });
  const [loading, setLoading] = useState(() => (initialBooks ? initialBooks.length === 0 : true));
  const [activeIndex, setActiveIndex] = useState(0);
  const [palettes, setPalettes] = useState<Record<string, [string, string]>>({});
  const isPausedRef = useRef(false);
  const extractingRef = useRef<Set<string>>(new Set());
  const touchStartXRef = useRef<number | null>(null);

  const fetchActiveBooks = useCallback(async () => {
    try {
      const res = await ApiClient.getBooks();
      const list: Book[] = Array.isArray(res) ? res : res?.data || [];
      const active = list.filter((b: Book) => b.isPublished && (!!b.heroCoverUrl || !!b.coverUrl));
      setBooks(active);
    } catch {
      // keep previous books on transient network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveBooks();
    const interval = setInterval(fetchActiveBooks, REFRESH_INTERVAL_MS);
    const onFocus = () => fetchActiveBooks();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchActiveBooks]);

  useEffect(() => {
    if (activeIndex >= books.length && books.length > 0) {
      setActiveIndex(0);
    }
  }, [books.length, activeIndex]);

  // Extract ambient colors from covers
  useEffect(() => {
    books.forEach((book) => {
      if (palettes[book.id] || extractingRef.current.has(book.id)) return;
      extractingRef.current.add(book.id);
      const coverImage = book.heroCoverUrl || book.coverUrl;
      if (!coverImage) return;
      extractDominantColors(coverImage).then((colors) => {
        extractingRef.current.delete(book.id);
        setPalettes((prev) => (prev[book.id] ? prev : { ...prev, [book.id]: colors }));
      });
    });
  }, [books, palettes]);

  // Automatic slow rotation
  useEffect(() => {
    if (books.length <= 1) return;
    const timer = setInterval(() => {
      if (isPausedRef.current) return;
      setActiveIndex((prev) => (prev + 1) % books.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [books.length]);

  const goTo = (idx: number) => {
    if (books.length === 0) return;
    setActiveIndex((idx + books.length) % books.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    if (Math.abs(deltaX) > 40) {
      if (deltaX > 0) {
        goTo(activeIndex - 1);
      } else {
        goTo(activeIndex + 1);
      }
    }
    touchStartXRef.current = null;
  };

  const activeBook = books[activeIndex] || null;
  const [activeGlowA, activeGlowB] =
    activeBook && palettes[activeBook.id] ? palettes[activeBook.id] : DEFAULT_GLOW;

  return (
    <section className="relative w-full py-4 sm:py-8 lg:py-10 overflow-hidden">
      {/* ── Dynamic Ambient Cinematic Glow behind Hero ─────────────────── */}
      <div
        aria-hidden="true"
        className="glow-pulse absolute -top-10 -right-10 w-[340px] sm:w-[480px] lg:w-[620px] h-[340px] sm:h-[480px] lg:h-[620px] rounded-full pointer-events-none transition-[background] duration-1000 ease-out"
        style={
          {
            background: `radial-gradient(circle at 50% 50%, ${activeGlowA} 0%, ${activeGlowB} 35%, transparent 70%)`,
            filter: 'blur(90px)',
            '--glow-low': '0.12',
            '--glow-high': '0.22',
          } as React.CSSProperties
        }
      />
      <div
        aria-hidden="true"
        className="glow-pulse absolute -bottom-12 left-1/4 w-[260px] sm:w-[380px] h-[260px] sm:h-[380px] rounded-full pointer-events-none transition-[background] duration-1000 ease-out"
        style={
          {
            background: `radial-gradient(circle at 50% 50%, ${activeGlowB} 0%, transparent 65%)`,
            filter: 'blur(80px)',
            // Offset so the two glows never swell in unison.
            animationDelay: '-4.5s',
            '--glow-low': '0.07',
            '--glow-high': '0.15',
          } as React.CSSProperties
        }
      />

      {/* ── 2-Column Hero Layout ──────────────────────────────────────── */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        {/* ── Left Column: Headline, Copy & CTAs (Order 2 on Mobile, Order 1 on Desktop) ── */}
        <div className="order-2 lg:order-1 lg:col-span-6 xl:col-span-6 space-y-6 text-center lg:text-left">
          {/* Subtle Top Pill */}
          <div className="reveal-fade-up reveal-step-1 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-cyan-500/10 dark:bg-cyan-400/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 dark:border-cyan-400/20 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
            <span>Interactive E-Books & Multimedia Notes</span>
          </div>

          {/* Main Headline */}
          <h1 className="reveal-fade-up reveal-step-2 text-3xl sm:text-5xl xl:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.14] sm:leading-[1.14]">
            Your Smart Way to{' '}
            <span className="text-gradient-flow bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
              Prepare for Kerala PSC
            </span>
          </h1>

          {/* Supporting Copy */}
          <p className="reveal-fade-up reveal-step-3 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto lg:mx-0">
            Learn smarter with interactive E-Books, audio explanations, comprehensive study materials, and
            video lessons designed for Kerala PSC preparation.
          </p>

          {/* Compact Primary CTAs */}
          <div className="reveal-fade-up reveal-step-4 flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-1">
            <Link href="#books-catalog">
              <Button
                size="lg"
                variant="gold"
                className="font-bold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 group text-sm sm:text-base px-6 h-12 rounded-xl transition-all"
              >
                <BookOpen className="w-4.5 h-4.5 mr-2 transition-transform group-hover:scale-110" />
                <span>Explore E-Books</span>
              </Button>
            </Link>
            <Link href="/books">
              <Button
                size="lg"
                variant="outline"
                className="font-semibold text-slate-700 dark:text-slate-200 border-slate-300 dark:border-[#1e2e56] bg-white/70 dark:bg-[#0c152e]/60 hover:bg-slate-100 dark:hover:bg-[#121f42] text-sm sm:text-base px-6 h-12 rounded-xl backdrop-blur-sm transition-all"
              >
                <span>View All Study Materials</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Subtle Key Highlights */}
          <div className="reveal-fade-up reveal-step-5 flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 pt-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
            <div className="inline-flex items-center gap-1.5">
              <Headphones className="w-4 h-4 text-cyan-500 shrink-0" />
              <span>Audio Narrations</span>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Chapter-wise Notes</span>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Instant Online/Offline</span>
            </div>
          </div>
        </div>

        {/* ── Right Column: Dynamic E-Book Digital Bookshelf Showcase (Order 1 on Mobile, Order 2 on Desktop) ──── */}
        <div
          className="order-1 lg:order-2 lg:col-span-6 xl:col-span-6 flex flex-col items-center justify-center"
          onMouseEnter={() => {
            isPausedRef.current = true;
          }}
          onMouseLeave={() => {
            isPausedRef.current = false;
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {loading ? (
            <div className="w-full max-w-[340px] sm:max-w-[380px] aspect-[3/4] rounded-2xl bg-slate-200/80 dark:bg-slate-800/60 animate-pulse border border-slate-300/50 dark:border-slate-700/50" />
          ) : books.length === 0 ? null : (
            <div className="w-full max-w-[420px] min-[420px]:max-w-[480px] sm:max-w-[540px] md:max-w-[580px] flex flex-col items-center">
              {/* 3D Showcase Viewport */}
              <div className="group/showcase relative w-full h-[340px] min-[420px]:h-[380px] sm:h-[440px] md:h-[470px] flex items-center justify-center [perspective:1200px]">
                {/* Ambient Soft Glow Behind Active Book */}
                <div
                  aria-hidden="true"
                  className="glow-pulse absolute w-[240px] sm:w-[320px] md:w-[360px] h-[300px] sm:h-[420px] md:h-[460px] rounded-full transition-[background] duration-700 ease-out pointer-events-none"
                  style={
                    {
                      background: `radial-gradient(circle, ${activeGlowA} 0%, ${activeGlowB} 55%, transparent 75%)`,
                      filter: 'blur(50px)',
                      animationDelay: '-2s',
                      '--glow-low': '0.45',
                      '--glow-high': '0.65',
                    } as React.CSSProperties
                  }
                />

                {/* Render 3D Sliding Carousel Books */}
                {books.map((book, idx) => {
                  const total = books.length;
                  // Calculate shortest circular offset from activeIndex
                  let offset = (idx - activeIndex) % total;
                  if (offset > total / 2) offset -= total;
                  if (offset < -total / 2) offset += total;

                  const isCenter = offset === 0;
                  const isLeft = offset === -1 || (total === 2 && offset === 1 && idx !== activeIndex);
                  const isRight = offset === 1 && total > 2;

                  let transformStyle = '';
                  let zIndex = 5;
                  let opacity = 0;
                  let pointerEvents: 'auto' | 'none' = 'none';

                  if (isCenter) {
                    transformStyle = 'translateX(0%) translateZ(0px) scale(1) rotateY(0deg)';
                    zIndex = 30;
                    opacity = 1;
                    pointerEvents = 'auto';
                  } else if (isLeft) {
                    transformStyle = 'translateX(-38%) translateZ(-30px) scale(0.85) rotateY(14deg)';
                    zIndex = 15;
                    opacity = 0.65;
                    pointerEvents = 'auto';
                  } else if (isRight) {
                    transformStyle = 'translateX(38%) translateZ(-30px) scale(0.85) rotateY(-14deg)';
                    zIndex = 15;
                    opacity = 0.65;
                    pointerEvents = 'auto';
                  } else if (offset < 0) {
                    transformStyle = 'translateX(-90%) translateZ(-80px) scale(0.7) rotateY(20deg)';
                    zIndex = 5;
                    opacity = 0;
                    pointerEvents = 'none';
                  } else {
                    transformStyle = 'translateX(90%) translateZ(-80px) scale(0.7) rotateY(-20deg)';
                    zIndex = 5;
                    opacity = 0;
                    pointerEvents = 'none';
                  }

                  return (
                    <div
                      key={book.id}
                      onClick={() => {
                        if (!isCenter) goTo(idx);
                      }}
                      className={`absolute top-1/2 -translate-y-1/2 will-change-transform ${
                        isCenter ? 'cursor-default' : 'cursor-pointer hover:opacity-90'
                      }`}
                      style={{
                        transform: `translateY(-50%) ${transformStyle}`,
                        zIndex,
                        opacity,
                        pointerEvents,
                        transformStyle: 'preserve-3d',
                        transition:
                          'transform 650ms cubic-bezier(0.22, 1, 0.36, 1), opacity 650ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    >
                      <div
                        tabIndex={isCenter ? 0 : -1}
                        className={`group block relative cursor-pointer ${isCenter ? 'float-soft' : ''}`}
                        onClick={(e) => {
                          if (!isCenter) {
                            e.preventDefault();
                            goTo(idx);
                          } else {
                            handleExplore(book.id);
                          }
                        }}
                      >
                        {/* Book Container with Realistic Depth & 3D Hardcover Styling */}
                        <div
                          className={`relative w-[215px] min-[420px]:w-[250px] sm:w-[290px] md:w-[320px] lg:w-[320px] xl:w-[340px] aspect-[3/4] rounded-xl sm:rounded-2xl overflow-hidden bg-slate-900 transition-all duration-500 ${
                            isCenter
                              ? 'cover-sheen shadow-[0_22px_60px_rgba(0,0,0,0.4)] dark:shadow-[0_28px_70px_rgba(0,0,0,0.85)] ring-1 ring-white/20 group-hover:scale-[1.02] group-hover:-translate-y-1.5'
                              : 'shadow-xl ring-1 ring-white/10'
                          }`}
                        >
                          {/* 3D Book Spine Highlight & Emboss Overlay */}
                          <div className="absolute inset-y-0 left-0 w-3.5 sm:w-5 bg-gradient-to-r from-black/50 via-white/15 to-transparent z-10 pointer-events-none" />
                          <div className="absolute inset-y-0 right-0 w-2.5 bg-gradient-to-l from-black/30 to-transparent z-10 pointer-events-none" />

                          {/* Real Book Cover Image (Book Size Cover) */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={book.heroCoverUrl || book.coverUrl}
                            alt={book.title}
                            className="w-full h-full object-cover object-center select-none"
                            draggable={false}
                            loading={idx === 0 ? 'eager' : 'lazy'}
                            fetchPriority={idx === 0 ? 'high' : 'auto'}
                          />

                          {/* Subtle Bottom Vignette on Cover */}
                          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* ── Prev / Next Controls (pointer devices) ─────────── */}
                {books.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => goTo(activeIndex - 1)}
                      aria-label="Previous book"
                      className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-40 items-center justify-center w-10 h-10 rounded-full bg-white/80 dark:bg-[#0c152e]/80 backdrop-blur-md border border-slate-200/80 dark:border-[#1e2e56] text-slate-600 dark:text-slate-300 shadow-lg opacity-0 group-hover/showcase:opacity-100 focus-visible:opacity-100 hover:text-cyan-600 dark:hover:text-cyan-400 hover:scale-105 transition-all duration-300 cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => goTo(activeIndex + 1)}
                      aria-label="Next book"
                      className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-40 items-center justify-center w-10 h-10 rounded-full bg-white/80 dark:bg-[#0c152e]/80 backdrop-blur-md border border-slate-200/80 dark:border-[#1e2e56] text-slate-600 dark:text-slate-300 shadow-lg opacity-0 group-hover/showcase:opacity-100 focus-visible:opacity-100 hover:text-cyan-600 dark:hover:text-cyan-400 hover:scale-105 transition-all duration-300 cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* ── Active Book Info Minimal Card ────────────────────── */}
              {activeBook && (
                <div key={activeBook.id} className="w-full mt-2 text-center space-y-1 px-4 reveal-fade-up">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 line-clamp-1">
                    {activeBook.category || 'Kerala PSC'}
                  </p>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white line-clamp-1">
                    {activeBook.title}
                  </h3>
                  <div className="flex items-center justify-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleExplore(activeBook.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 transition-colors group cursor-pointer"
                    >
                      <span>Explore Book</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Pagination Indicator Dots ────────────────────────── */}
              {books.length > 1 && (
                <div className="flex items-center justify-center gap-1 mt-3" role="tablist" aria-label="Featured books">
                  {books.map((book, idx) => (
                    // The button is padded out to a 32px touch target while the
                    // visible dot stays small.
                    <button
                      key={book.id}
                      type="button"
                      role="tab"
                      aria-selected={idx === activeIndex}
                      onClick={() => goTo(idx)}
                      aria-label={`Switch to ${book.title}`}
                      className="group/dot flex items-center justify-center h-8 px-1 cursor-pointer"
                    >
                      <span
                        className={`block h-2 rounded-full transition-all duration-500 ease-out ${
                          idx === activeIndex
                            ? 'w-7 bg-gradient-to-r from-amber-500 to-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.45)]'
                            : 'w-2 bg-slate-300 dark:bg-slate-700 group-hover/dot:bg-slate-400 dark:group-hover/dot:bg-slate-600 group-hover/dot:w-3'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
