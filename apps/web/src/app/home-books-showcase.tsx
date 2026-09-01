'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button } from '@psc/ui';
import {
  BookOpen,
  Music,
  FileText,
  Youtube,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Book } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from './auth-provider';

const NEW_BOOK_WINDOW_DAYS = 7;
const AUTO_SCROLL_INTERVAL_MS = 4200;

function isRecentlyUploaded(createdAt?: string): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= NEW_BOOK_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function BookCardSkeleton() {
  return (
    <div className="shrink-0 snap-start w-[280px] sm:w-[320px] rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] shadow-lg flex flex-col overflow-hidden animate-pulse">
      <div className="aspect-video w-full bg-slate-200 dark:bg-slate-800/60" />
      <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-5 w-full rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="h-6 w-16 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-8 w-20 rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

export function HomeBooksShowcase({ initialBooks }: { initialBooks?: Book[] }) {
  const [books, setBooks] = useState<Book[]>(() => {
    if (initialBooks && initialBooks.length > 0) {
      return initialBooks.filter((b) => b.isPublished);
    }
    return [];
  });
  const [loading, setLoading] = useState(() => (initialBooks && initialBooks.length > 0 ? false : true));
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const railRef = useRef<HTMLDivElement>(null);
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    const fetchBooks = async () => {
      try {
        const res = await ApiClient.getBooks();
        const list: Book[] = Array.isArray(res) ? res : res?.data || [];
        const published = list.filter((b: Book) => b.isPublished);
        if (isMounted) {
          setBooks(published);
        }
      } catch {
        // Keep previous or initial books on error
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchBooks();
    return () => {
      isMounted = false;
    };
  }, [initialBooks, user]);

  // Helper to determine if a book is purchased / owned by the current user
  const isBookPurchased = (b: Book) => {
    if (!user) return false;
    return (
      b.access?.reason === 'PURCHASED' ||
      b.access?.reason === 'STAFF' ||
      (b.access?.hasAccess && (b.isPremium || (b.finalPrice ?? b.price ?? 0) > 0))
    );
  };

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
      setActiveIndex(Math.min(closestIdx, books.length - 1));
    }
  }, [reachableStops, books.length]);

  useEffect(() => {
    syncScrollState();
    window.addEventListener('resize', syncScrollState);
    return () => window.removeEventListener('resize', syncScrollState);
  }, [syncScrollState, books.length]);

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
    if (loading || isPaused || books.length <= 1) return;

    autoScrollTimerRef.current = setInterval(() => {
      const rail = railRef.current;
      if (!rail) return;

      const maxScroll = rail.scrollWidth - rail.clientWidth;
      if (maxScroll <= 0) return;

      if (rail.scrollLeft >= maxScroll - 16) {
        rail.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const cardWidth = 320 + 24; // card width + gap
        const nextScroll = Math.min(rail.scrollLeft + cardWidth, maxScroll);
        rail.scrollTo({ left: nextScroll, behavior: 'smooth' });
      }
    }, AUTO_SCROLL_INTERVAL_MS);

    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, [loading, isPaused, books.length]);

  const scrollToCardIndex = (index: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const cardEl = rail.children[index] as HTMLElement | undefined;
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  };

  const handleOpenBook = (bookId: string) => {
    const targetUrl = `/books/${bookId}/read?resume=1`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  const handleDetails = (bookId: string, isOwnedOrFree: boolean) => {
    const targetUrl = isOwnedOrFree ? `/books/${bookId}/read` : `/books/${bookId}`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  const handleBuyBook = (bookId: string) => {
    const targetUrl = `/checkout?type=book&id=${bookId}`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  if (loading) {
    return (
      <div className="w-full">
        <div className="flex gap-6 overflow-hidden pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <BookCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* ── Trust markers ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-5 gap-y-1.5 sm:gap-y-2 text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 text-center">
        <span className="inline-flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
          <Sparkles className="w-3.5 h-3.5 text-cyan-500 shrink-0" /> Interactive E-Books
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Audio Narrations
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Topic Notes &amp; Diagrams
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Offline Reading Mode
        </span>
      </div>

      {books.length === 0 ? (
        <div className="text-center py-12 space-y-3 bg-slate-100/50 dark:bg-[#091124]/50 rounded-3xl border border-slate-200/80 dark:border-slate-800/80">
          <BookOpen className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm font-semibold text-slate-500">No books available at the moment.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Desktop Left Scroll Arrow */}
          <button
            type="button"
            aria-label="Scroll books left"
            onClick={() => scrollByPage(-1)}
            disabled={!canScrollLeft}
            className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-[#0c152e] border border-slate-200 dark:border-[#1e2e56] text-slate-600 dark:text-slate-300 shadow-lg transition-all hover:bg-slate-50 dark:hover:bg-[#121f42] hover:text-cyan-600 dark:hover:text-cyan-400 disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Desktop Right Scroll Arrow */}
          <button
            type="button"
            aria-label="Scroll books right"
            onClick={() => scrollByPage(1)}
            disabled={!canScrollRight}
            className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-[#0c152e] border border-slate-200 dark:border-[#1e2e56] text-slate-600 dark:text-slate-300 shadow-lg transition-all hover:bg-slate-50 dark:hover:bg-[#121f42] hover:text-cyan-600 dark:hover:text-cyan-400 disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Scrollable Horizontal Rail */}
          <div
            ref={railRef}
            onScroll={syncScrollState}
            className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none touch-scroll-x snap-x snap-mandatory scroll-smooth overscroll-x-contain pt-2 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
            tabIndex={0}
            role="region"
            aria-label="Featured PSC E-Books"
          >
            {books.map((book) => {
              const originalPrice = book.price || 0;
              const discount = book.discountPercent || 0;
              const effectivePrice = book.finalPrice ?? (discount > 0 ? Math.round(originalPrice * (1 - discount / 100)) : originalPrice);
              const isFree = !book.isPremium || effectivePrice === 0;
              const isPurchased = !isFree && isBookPurchased(book);
              const isNew = isRecentlyUploaded(book.createdAt);

              return (
                <div
                  key={book.id}
                  className="shrink-0 snap-start w-[275px] xs:w-[295px] sm:w-[320px] lg:w-[calc((100%-48px)/3)] rounded-3xl hover-lift transition-all duration-300 flex flex-col overflow-hidden p-0 border border-slate-200/90 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] shadow-lg hover:shadow-2xl hover:border-cyan-500/40"
                >
                  {/* Cover Image & Badges Container — 16:9 Thumbnail Aspect Ratio */}
                  <div
                    onClick={() => handleDetails(book.id, isPurchased || isFree)}
                    className="relative aspect-video w-full bg-slate-100 dark:bg-slate-900 overflow-hidden cursor-pointer"
                  >
                    {book.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="w-full h-full object-cover object-center transition-transform duration-500 hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-cyan-400 p-6 bg-gradient-to-b from-cyan-950/30 to-slate-950/60">
                        <BookOpen className="w-16 h-16 stroke-[1.5] mb-2 text-cyan-400/70" />
                        <span className="text-xs font-bold text-center text-slate-300 line-clamp-2">{book.title}</span>
                      </div>
                    )}

                    {/* Top Badge Overlay */}
                    <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 right-2.5 sm:right-3 flex items-center justify-between gap-1.5 pointer-events-none">
                      <div className="flex items-center gap-1.5">
                        {isNew && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-lg shadow-emerald-950/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            New
                          </span>
                        )}
                        <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-slate-950/80 backdrop-blur-md text-amber-400 border border-amber-500/30 shadow-md">
                          {book.category || 'PSC Special'}
                        </span>
                      </div>
                      {isPurchased ? (
                        <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-black bg-emerald-500 text-white shadow-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> PURCHASED
                        </span>
                      ) : isFree ? (
                        <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-black bg-emerald-500 text-white shadow-md">
                          FREE
                        </span>
                      ) : discount > 0 ? (
                        <span className="px-2 py-0.5 sm:px-2 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-black bg-rose-500 text-white shadow-md">
                          {discount}% OFF
                        </span>
                      ) : null}
                    </div>

                    {/* Multimedia Feature Pill Overlay */}
                    <div className="absolute bottom-2.5 sm:bottom-3 left-2.5 sm:left-3 right-2.5 sm:right-3 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-white/10 text-[9px] sm:text-[10px] text-white">
                      <span className="flex items-center gap-1 font-bold text-cyan-400">
                        <Music className="w-3 h-3" /> Audio
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="flex items-center gap-1 font-bold text-amber-400">
                        <FileText className="w-3 h-3" /> Notes
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="flex items-center gap-1 font-bold text-rose-400">
                        <Youtube className="w-3 h-3" /> Video
                      </span>
                    </div>
                  </div>

                  {/* Content Body */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3 sm:space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium">By {book.author || 'PSC Editorial Board'}</p>
                      <h3
                        onClick={() => handleDetails(book.id, isPurchased || isFree)}
                        className="font-black text-slate-900 dark:text-white text-sm sm:text-base leading-snug line-clamp-2 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
                      >
                        {book.title}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {book.description}
                      </p>
                    </div>

                    {/* Pricing & CTA */}
                    <div className="pt-2.5 sm:pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <div>
                        {isPurchased ? (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Purchased
                          </span>
                        ) : isFree ? (
                          <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">Free Access</span>
                        ) : (
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                              ₹{effectivePrice}
                            </span>
                            {originalPrice > effectivePrice && (
                              <span className="text-[11px] sm:text-xs text-slate-400 line-through font-mono">
                                ₹{originalPrice}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isPurchased || isFree ? (
                          <Button
                            size="sm"
                            variant="gold"
                            onClick={() => handleOpenBook(book.id)}
                            className="font-bold text-xs shadow-md shadow-amber-500/10 cursor-pointer flex items-center"
                          >
                            <BookOpen className="w-3.5 h-3.5 mr-1" />
                            <span>Read</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="gold"
                            onClick={() => handleBuyBook(book.id)}
                            className="font-bold text-xs shadow-md shadow-amber-500/10 cursor-pointer flex items-center"
                          >
                            <ShoppingBag className="w-3.5 h-3.5 mr-1" />
                            <span>Buy Now</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dots navigation */}
          {books.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-2">
              {books.map((b, idx) => (
                <button
                  key={b.id || idx}
                  type="button"
                  aria-label={`Go to book ${idx + 1}`}
                  onClick={() => scrollToCardIndex(idx)}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === activeIndex
                      ? 'w-6 bg-cyan-500'
                      : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* View All E-Books Link */}
      <div className="flex justify-center pt-2">
        <Link href="/books">
          <Button size="lg" variant="outline" className="font-extrabold px-8 rounded-2xl border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 transition-all shadow-md cursor-pointer">
            <span>Explore Full E-Book Catalog</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

