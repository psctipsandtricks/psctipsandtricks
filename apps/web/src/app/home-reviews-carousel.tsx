'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import { CustomerReview } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { Reveal } from './reveal';

/** The home page is a trust marker, not an archive — cap the rail so it stays light. */
const MAX_HOME_REVIEWS = 15;

const AVATAR_TINTS = [
  'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30',
  'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30',
  'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
];

/** Stable per-name tint, so a review keeps its colour across renders and reloads. */
function tintForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={
            i < rating
              ? 'w-4 h-4 text-amber-400 fill-amber-400'
              : 'w-4 h-4 text-slate-300 dark:text-slate-700'
          }
        />
      ))}
    </div>
  );
}

function ReviewCardSkeleton() {
  return (
    <div className="shrink-0 snap-start w-[280px] sm:w-[340px] rounded-3xl bg-white dark:bg-[#0c152e] border border-slate-200/90 dark:border-[#1e2e56] shadow-lg p-5 sm:p-6 space-y-4 animate-pulse">
      <div className="h-4 w-24 rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-full rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-2/3 rounded-lg bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-28 rounded-lg bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

const AUTO_SCROLL_INTERVAL_MS = 4000;

/**
 * Owns the whole home-page reviews section, heading included, because the
 * section has to disappear as one piece: a curated rail with nothing curated
 * yet would otherwise leave a "Trusted by…" headline standing over empty
 * space. The heading itself is still composed on the server and handed down,
 * so it keeps using the same `SectionHeading` as every other home section.
 */
export function HomeReviewsCarousel({ heading }: { heading?: React.ReactNode }) {
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const railRef = useRef<HTMLDivElement>(null);
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchReviews() {
      try {
        // Already active-only and in the admin-chosen order, so the rail shows
        // the feed as-is.
        const data = await ApiClient.getActiveReviews();
        const list = Array.isArray(data) ? data : (data as any)?.data || [];
        if (isMounted) setReviews(list.slice(0, MAX_HOME_REVIEWS));
      } catch (err) {
        console.error('Failed to fetch customer reviews:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchReviews();
    return () => {
      isMounted = false;
    };
  }, []);

  // Scroll offsets the rail can actually come to rest at. The rail snaps
  // mandatorily to card starts, so an arrow that targets anything else just
  // springs back — every arrow decision below is made against these.
  const reachableStops = useCallback((rail: HTMLDivElement) => {
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    if (maxScroll <= 0) return [0];
    const origin = rail.getBoundingClientRect().left - rail.scrollLeft;
    const stops = Array.from(rail.children)
      .map((card) => Math.round((card as HTMLElement).getBoundingClientRect().left - origin))
      .filter((stop) => stop <= maxScroll);
    // Snapping is relaxed at the extremities, so the rail's far end is always
    // reachable — and it is the only stop that brings the last card fully into
    // view when the trailing cards don't add up to a whole snap step.
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
      setActiveIndex(Math.min(closestIdx, reviews.length - 1));
    }
  }, [reachableStops, reviews.length]);

  useEffect(() => {
    syncScrollState();
    window.addEventListener('resize', syncScrollState);
    return () => window.removeEventListener('resize', syncScrollState);
  }, [syncScrollState, reviews.length]);

  const scrollByPage = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const current = rail.scrollLeft;
    const desired = current + direction * rail.clientWidth * 0.85;
    const candidates = reachableStops(rail).filter((stop) =>
      direction === 1 ? stop > current + 8 : stop < current - 8,
    );
    if (candidates.length === 0) return;
    // A near-full page of cards where one exists, the last/first card otherwise.
    const target = candidates.reduce((best, stop) =>
      Math.abs(stop - desired) < Math.abs(best - desired) ? stop : best,
    );
    rail.scrollTo({ left: target, behavior: 'smooth' });
  };

  // Automatic Smooth Scrolling Carousel with wrap-around
  useEffect(() => {
    if (loading || isPaused || reviews.length <= 1) return;

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
        const cardWidth = 340 + 20; // card width + gap
        const nextScroll = Math.min(rail.scrollLeft + cardWidth, maxScroll);
        rail.scrollTo({ left: nextScroll, behavior: 'smooth' });
      }
    }, AUTO_SCROLL_INTERVAL_MS);

    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, [loading, isPaused, reviews.length]);

  const scrollToCardIndex = (index: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const cardEl = rail.children[index] as HTMLElement | undefined;
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  };

  // Nothing curated yet — drop the section entirely rather than showing an
  // empty shell, so the home page never advertises the absence of reviews.
  if (!loading && reviews.length === 0) return null;

  const averageRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <Reveal as="section" id="customer-reviews" className="space-y-6 w-full">
      {heading}

      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* ── Desktop scroll arrows ───────────────────────────────────── */}
        <button
          type="button"
          aria-label="Scroll reviews left"
          onClick={() => scrollByPage(-1)}
          disabled={!canScrollLeft}
          className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-10 h-10 rounded-full bg-white/90 dark:bg-[#0c152e]/90 backdrop-blur-md border border-slate-200/80 dark:border-[#1e2e56] text-slate-600 dark:text-slate-300 shadow-xl transition-all hover:bg-white dark:hover:bg-[#121f42] hover:text-amber-500 dark:hover:text-amber-400 disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          aria-label="Scroll reviews right"
          onClick={() => scrollByPage(1)}
          disabled={!canScrollRight}
          className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-10 h-10 rounded-full bg-white/90 dark:bg-[#0c152e]/90 backdrop-blur-md border border-slate-200/80 dark:border-[#1e2e56] text-slate-600 dark:text-slate-300 shadow-xl transition-all hover:bg-white dark:hover:bg-[#121f42] hover:text-amber-500 dark:hover:text-amber-400 disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* ── Horizontally scrollable rail ────────────────────────────── */}
        <div
          ref={railRef}
          onScroll={syncScrollState}
          role="region"
          aria-label="Customer reviews"
          tabIndex={0}
          className="flex items-stretch gap-4 sm:gap-5 overflow-x-auto scrollbar-none touch-scroll-x snap-x snap-mandatory scroll-smooth overscroll-x-contain pt-3 pb-4 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
        >
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ReviewCardSkeleton key={i} />)
            : reviews.map((review) => (
                <figure
                  key={review.id}
                  className="group shrink-0 snap-start w-[280px] sm:w-[340px] flex flex-col justify-between rounded-3xl bg-white dark:bg-[#0c152e] border border-slate-200/90 dark:border-[#1e2e56] shadow-lg hover:shadow-2xl hover:border-amber-500/40 hover-lift p-5 sm:p-6 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="space-y-3.5 relative z-10">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <StarRating rating={review.rating} />
                        <span className="text-xs font-black font-mono px-2 py-0.5 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {Number(review.rating).toFixed(1)}
                        </span>
                      </div>
                      <Quote className="w-7 h-7 shrink-0 text-amber-500/30 dark:text-amber-400/30 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <blockquote className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-6 font-medium">
                      "{review.comment}"
                    </blockquote>
                  </div>

                  <figcaption className="pt-4 mt-4 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center gap-3 relative z-10">
                    <span
                      aria-hidden="true"
                      className={`w-10 h-10 shrink-0 rounded-2xl border flex items-center justify-center text-xs font-black tracking-wide shadow-sm ${tintForName(
                        review.customerName,
                      )}`}
                    >
                      {initialsOf(review.customerName)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-black text-sm text-slate-900 dark:text-white truncate">
                        {review.customerName}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Verified Student
                      </p>
                    </div>
                  </figcaption>
                </figure>
              ))}
        </div>

        {/* ── Dots Pagination Indicator for Carousel ─────────────────── */}
        {reviews.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-2">
            {reviews.map((_, idx) => (
              <button
                key={`review_dot_${idx}`}
                type="button"
                aria-label={`Go to review ${idx + 1}`}
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
    </Reveal>
  );
}
