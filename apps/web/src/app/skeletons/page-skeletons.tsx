'use client';

import React from 'react';
import { Skeleton, Card } from '@psc/ui';

/**
 * Quiz Hub Skeleton:
 * Matches the featured quiz carousel, category tabs, filter search,
 * and the 3-column liquid-glass quiz cards grid.
 */
export function QuizHubSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8 py-2 sm:py-4 px-1 sm:px-0 animate-in fade-in duration-300 w-full max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 sm:h-9 w-64 sm:w-80 rounded-xl" />
          <Skeleton className="h-4 w-full max-w-lg rounded-lg" />
        </div>
        <Skeleton className="h-9 w-44 rounded-xl shrink-0" />
      </div>

      {/* Live & Upcoming Mock Test Banner Card Skeleton */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center space-x-2.5">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="h-5 w-52 rounded-lg" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        <div className="w-full rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] shadow-sm space-y-4">
          {/* Top badges strip */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>

          {/* Title & Subtitle */}
          <div className="space-y-2 pt-1">
            <Skeleton className="h-7 w-3/4 max-w-md rounded-xl" />
            <Skeleton className="h-4 w-1/2 max-w-xs rounded-md" />
          </div>

          {/* Meta Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Skeleton className="h-7 w-36 rounded-xl" />
            <Skeleton className="h-7 w-24 rounded-xl" />
            <Skeleton className="h-7 w-28 rounded-xl" />
            <Skeleton className="h-7 w-24 rounded-xl" />
          </div>

          {/* Exam room / timer box */}
          <div className="h-20 w-full rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#070e20]/60 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-2xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-3 w-56 rounded-md" />
              </div>
            </div>
          </div>

          {/* Bottom actions row */}
          <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
            <Skeleton className="h-4 w-48 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Browse Question Banks Section Skeleton */}
      <div className="space-y-4 sm:space-y-5">
        <div className="flex items-center space-x-2">
          <Skeleton className="w-4 h-4 rounded-md" />
          <Skeleton className="h-5 w-48 rounded-lg" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] shadow-sm space-y-4 relative overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="w-12 h-12 rounded-2xl" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>

              <div className="space-y-2 pt-2">
                <Skeleton className="h-6 w-36 rounded-xl" />
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-2/3 rounded-md" />
              </div>

              <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="w-5 h-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Quiz Folder Grid Skeleton:
 * Stands in for the folder cards while the hub is still asking the API which
 * folders exist. Mirrors FolderCard: accent bar, icon tile, count pill, title
 * and footer row.
 */
export function QuizFolderGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 animate-in fade-in duration-300">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative p-6 rounded-3xl border border-slate-200/90 dark:border-[#1e2e56] bg-white/90 dark:bg-[#0c152e]/90 shadow-lg shadow-slate-200/40 dark:shadow-2xl dark:shadow-black/40 overflow-hidden space-y-4"
        >
          <Skeleton className="h-1.5 w-full absolute top-0 left-0 rounded-none" />
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="space-y-2 pt-1">
            <Skeleton className="h-5 w-2/3 rounded-lg" />
            <Skeleton className="h-3.5 w-full rounded-md" />
          </div>
          <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="w-5 h-5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Quiz Card Grid Skeleton:
 * Shown inside a folder while that folder's quizzes are loading. Mirrors
 * QuizCardItem: 16:9 cover, badge row, title, meta chips and the action button.
 */
export function QuizCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
      {Array.from({ length: count }).map((_, i) => (
        <Card
          key={i}
          className="flex flex-col justify-between space-y-4 bg-white dark:bg-[#0c152e] border border-slate-200/90 dark:border-[#1e2e56] p-5 rounded-2xl"
        >
          <div className="space-y-3">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-full rounded-lg" />
              <Skeleton className="h-5 w-3/5 rounded-lg" />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Skeleton className="h-6 w-24 rounded-lg" />
              <Skeleton className="h-6 w-20 rounded-lg" />
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
        </Card>
      ))}
    </div>
  );
}

/**
 * Quiz Taking Skeleton:
 * Matches the countdown timer, question card, option selectors, and navigation footer.
 */
export function QuizTakingSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 animate-in fade-in duration-300">
      {/* Top Timer & Progress Bar Skeleton */}
      <div className="flex items-center justify-between bg-white/90 dark:bg-[#070e22]/90 border border-slate-200 dark:border-[#1e2e56] p-4 rounded-2xl shadow-md">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>
        </div>
        <div className="flex items-center space-x-3 text-right">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <Skeleton className="w-10 h-10 rounded-xl" />
        </div>
      </div>

      {/* Question Card Skeleton */}
      <div className="p-6 sm:p-8 space-y-6 rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] shadow-md">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>

        <div className="space-y-2.5">
          <Skeleton className="h-6 w-full rounded-lg" />
          <Skeleton className="h-6 w-4/5 rounded-lg" />
        </div>

        {/* 4 Option Buttons Skeleton */}
        <div className="space-y-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="w-full flex items-center space-x-3.5 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30"
            >
              <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
              <Skeleton className="h-5 w-3/4 rounded-md" />
            </div>
          ))}
        </div>

        {/* Footer Navigation Buttons Skeleton */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-200/80 dark:border-slate-800">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Book Catalog Skeleton:
 * Matches the header, search, category pills, and 3-column liquid glass book cards.
 */
export function BookCatalogSkeleton() {
  return (
    <div className="space-y-8 py-4 animate-in fade-in duration-300 w-full max-w-7xl mx-auto px-2 sm:px-0">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 sm:w-80 rounded-xl" />
          <Skeleton className="h-4 w-full max-w-md rounded-lg" />
        </div>
        <Skeleton className="h-11 w-full sm:w-72 rounded-xl" />
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-xl shrink-0" />
        ))}
      </div>

      {/* Book Cards Grid (16:9 Aspect Ratio Covers) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-3xl p-5 space-y-4 flex flex-col justify-between border border-slate-200/80 dark:border-[#1e2e56] bg-white/70 dark:bg-[#0c152e]/70 shadow-sm backdrop-blur-md"
          >
            {/* 16:9 Cover Image Skeleton */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800">
              <Skeleton className="w-full h-full rounded-2xl" />
              <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-5 w-14 rounded-md" />
              </div>
            </div>

            {/* Title & Author */}
            <div className="space-y-2">
              <Skeleton className="h-5 w-4/5 rounded-lg" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
            </div>

            {/* Description lines */}
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-full rounded-md" />
              <Skeleton className="h-3.5 w-3/4 rounded-md" />
            </div>

            {/* Price Strip & Actions */}
            <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
              <div className="space-y-1">
                <Skeleton className="h-3 w-12 rounded-md" />
                <Skeleton className="h-6 w-20 rounded-lg" />
              </div>
              <Skeleton className="h-10 w-28 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Book Detail Skeleton:
 * Matches the breadcrumb bar, 2-column Cinema Hero Card, and curriculum accordion.
 */
export function BookDetailSkeleton() {
  return (
    <div className="space-y-8 py-2 sm:py-4 w-full max-w-7xl mx-auto px-2 sm:px-0 animate-in fade-in duration-300">
      {/* Breadcrumb & Badges Bar */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-44 rounded-lg" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-lg" />
          <Skeleton className="h-6 w-24 rounded-lg" />
        </div>
      </div>

      {/* Cinema Hero Card (2 Columns) */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white/70 dark:bg-[#0c152e]/70 p-6 sm:p-8 shadow-xl backdrop-blur-md">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Column: 16:9 Cover + Info Chips (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Skeleton className="w-full aspect-video rounded-2xl" />
            <div className="grid grid-cols-2 gap-2.5">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>

          {/* Right Column: Title, Pricing, Features, CTA (7 Cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-8 w-4/5 rounded-xl" />
              <Skeleton className="h-4 w-1/3 rounded-md" />
            </div>

            {/* Price Box */}
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-7 w-28 rounded-lg" />
              </div>
              <Skeleton className="h-10 w-36 rounded-xl" />
            </div>

            {/* Description lines */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Chapters & Lessons Accordion Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48 rounded-lg" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-xl" />
                  <Skeleton className="h-5 w-48 rounded-lg" />
                </div>
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              <div className="pl-11 space-y-2">
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-4 w-1/2 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Book Reader Skeleton:
 * Mirrors the reader's real geometry — the same sidebar width, the same sticky
 * offsets, the same card padding — so content landing swaps grey for ink
 * without anything jumping.
 *
 * The offsets matter more than they look: the navbar is hidden on `/read`
 * (see `navbar-wrapper.tsx`), so both sticky columns start near the top of the
 * viewport rather than below a header.
 */
export function BookReaderSkeleton() {
  return (
    <div className="pb-16 w-full animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* Left Sidebar — matches ReaderProgressSidebar's desktop panel */}
        <div className="hidden lg:flex flex-col w-80 xl:w-[21rem] shrink-0 max-h-[calc(100vh-2rem)] sticky top-4 self-start border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] shadow-sm overflow-hidden">
          <div className="p-4 space-y-2 border-b border-slate-200/80 dark:border-[#1e2e56]">
            <Skeleton className="h-5 w-3/4 rounded-lg" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="space-y-2.5 flex-1 px-3 py-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-1/2 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Column */}
        <div className="flex-1 min-w-0 w-full space-y-4 sm:space-y-6">
          {/* Top Sticky Header — back button, topic title, percent, progress bar */}
          <div className="sticky top-1 sm:top-3 z-30 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-white/95 dark:bg-[#050a17]/95 backdrop-blur-xl border border-slate-200/90 dark:border-[#1e2e56] rounded-2xl shadow-md">
            <div className="flex items-center justify-between gap-1.5 sm:gap-3">
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <Skeleton className="h-8 w-8 sm:w-20 rounded-xl" />
                <Skeleton className="h-7 w-14 rounded-lg" />
              </div>
              <div className="min-w-0 flex-1 flex flex-col items-center gap-1 px-1 sm:px-2">
                <Skeleton className="hidden sm:block h-3 w-40 rounded-md" />
                <Skeleton className="h-4 w-56 max-w-full rounded-md" />
              </div>
              <Skeleton className="h-5 w-11 rounded-lg shrink-0" />
            </div>
            <div className="mt-1 sm:mt-1.5 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* Book Title Banner */}
          <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-[#0c152e] dark:via-[#091124] dark:to-[#0c152e] shadow-xs">
            <Skeleton className="w-24 h-16 sm:w-28 sm:h-18 rounded-xl shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-3 w-28 rounded-md" />
              </div>
              <Skeleton className="h-6 w-3/4 rounded-lg" />
            </div>
          </div>

          {/* Chapter Header */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center gap-2.5 shrink-0">
              <Skeleton className="w-8 h-8 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-20 rounded-md" />
                <Skeleton className="h-4 w-40 rounded-md" />
              </div>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-[#1e2e56] to-transparent" />
          </div>

          {/* Active Unit Card */}
          <div className="rounded-2xl border border-cyan-500/40 bg-white dark:bg-[#091124] p-4 sm:p-6 space-y-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <Skeleton className="mt-0.5 w-6 h-6 rounded-lg shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-2/3 rounded-lg" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-lg shrink-0" />
            </div>

            <div className="space-y-5 pt-2">
              {/* Audio Player */}
              <Skeleton className="h-14 w-full rounded-xl" />

              {/* PDF Notes: the controls bar, then the page itself */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#070e22] shadow-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Skeleton className="hidden sm:block w-7 h-7 rounded-lg shrink-0" />
                    <Skeleton className="hidden sm:block h-3.5 w-20 rounded-md" />
                    <Skeleton className="h-8 w-28 rounded-xl shrink-0" />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Skeleton className="h-8 w-20 rounded-xl" />
                    <Skeleton className="h-8 w-28 rounded-xl" />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50 dark:bg-[#070e22] h-[520px] flex flex-col items-center justify-center p-8 space-y-4">
                  <Skeleton className="w-12 h-12 rounded-2xl" />
                  <Skeleton className="h-5 w-48 rounded-lg" />
                  <div className="w-full max-w-md space-y-2">
                    <Skeleton className="h-3 w-full rounded-md" />
                    <Skeleton className="h-3 w-4/5 rounded-md" />
                    <Skeleton className="h-3 w-3/5 rounded-md" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * PDF / Video Library Skeleton:
 * Matches folder grid, document cards, category filters, and search bar.
 */
export function MediaLibrarySkeleton({ isVideo = false }: { isVideo?: boolean }) {
  return (
    <div className="space-y-8 py-4 animate-in fade-in duration-300 w-full max-w-7xl mx-auto px-2 sm:px-0">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 sm:w-80 rounded-xl" />
          <Skeleton className="h-4 w-full max-w-md rounded-lg" />
        </div>
        <Skeleton className="h-11 w-full sm:w-72 rounded-xl" />
      </div>

      {/* Folders Section */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-white/70 dark:bg-[#0c152e]/70 flex items-center gap-3.5"
            >
              <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-1/2 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Media Cards Grid */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-36 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl p-4 space-y-3 border border-slate-200/80 dark:border-[#1e2e56] bg-white/70 dark:bg-[#0c152e]/70 shadow-sm"
            >
              <Skeleton className={`w-full ${isVideo ? 'aspect-video' : 'h-36'} rounded-xl`} />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-4/5 rounded-lg" />
                <Skeleton className="h-3.5 w-1/2 rounded-md" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800">
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Checkout Skeleton:
 * Matches the 2-column order summary, coupon input box, and payment gateway options.
 */
export function CheckoutSkeleton() {
  return (
    <div className="max-w-xl mx-auto space-y-6 py-4 animate-in fade-in duration-300">
      {/* Title Skeleton */}
      <div className="flex items-center space-x-2">
        <Skeleton className="w-7 h-7 rounded-lg" />
        <Skeleton className="h-8 w-56 rounded-xl" />
      </div>

      {/* Checkout Card Skeleton */}
      <div className="p-6 rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] space-y-6 shadow-md">
        {/* Item Header */}
        <div className="flex justify-between items-start border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>

        {/* Authenticated account pill */}
        <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-44 rounded-md" />
        </div>

        {/* Coupon Form Input */}
        <div className="flex gap-3">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-20 rounded-xl" />
        </div>

        {/* Price Breakdown */}
        <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
            <Skeleton className="h-6 w-28 rounded-lg" />
            <Skeleton className="h-6 w-20 rounded-lg" />
          </div>
        </div>

        {/* Pay Button */}
        <Skeleton className="h-12 w-full rounded-2xl" />

        {/* Security badge footer */}
        <div className="flex justify-center items-center gap-1.5 pt-1">
          <Skeleton className="h-3.5 w-60 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Admin Table Skeleton:
 * Matches admin tables (Books, Quizzes, Users, Orders, Coupons, Reviews, Announcements)
 * with top action bar, filter pills, table header, data rows, and pagination bar.
 */
export function AdminTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6 py-2 animate-in fade-in duration-300">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-48 rounded-xl" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-white/70 dark:bg-[#0c152e]/70">
        <Skeleton className="h-10 w-full sm:w-72 rounded-xl" />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] overflow-hidden shadow-sm">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800 text-xs font-bold">
          <div className="col-span-4"><Skeleton className="h-4 w-24 rounded-md" /></div>
          <div className="col-span-3"><Skeleton className="h-4 w-20 rounded-md" /></div>
          <div className="col-span-2"><Skeleton className="h-4 w-16 rounded-md" /></div>
          <div className="col-span-2"><Skeleton className="h-4 w-16 rounded-md" /></div>
          <div className="col-span-1 text-right"><Skeleton className="h-4 w-8 rounded-md ml-auto" /></div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
              <div className="col-span-4 flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                </div>
              </div>
              <div className="col-span-3">
                <Skeleton className="h-4 w-24 rounded-md" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
              <div className="col-span-1 flex justify-end">
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>

        {/* Table Pagination Footer */}
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded-md" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="w-8 h-8 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Admin Folder Detail Skeleton:
 * Matches admin folder pages (/admin/videos/folder/[id], /admin/pdfs/folder/[id], /admin/quizzes/folder/[name]).
 */
export function AdminFolderDetailSkeleton() {
  return (
    <div className="space-y-6 py-2 animate-in fade-in duration-300">
      {/* Breadcrumb & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-md" />
          <span className="text-slate-400">/</span>
          <Skeleton className="h-5 w-36 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Subfolder Tree / Cards Skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-white/70 dark:bg-[#0c152e]/70 flex items-center gap-3"
            >
              <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
              <div className="space-y-1 flex-1 min-w-0">
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-1/3 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contents Table Skeleton */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 gap-4 px-6 py-3.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800 text-xs font-bold">
          <div className="col-span-5"><Skeleton className="h-4 w-24 rounded-md" /></div>
          <div className="col-span-3"><Skeleton className="h-4 w-20 rounded-md" /></div>
          <div className="col-span-2"><Skeleton className="h-4 w-16 rounded-md" /></div>
          <div className="col-span-2 text-right"><Skeleton className="h-4 w-12 rounded-md ml-auto" /></div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
              <div className="col-span-5 flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                <div className="space-y-1 flex-1 min-w-0">
                  <Skeleton className="h-4 w-4/5 rounded-md" />
                  <Skeleton className="h-3 w-1/3 rounded-md" />
                </div>
              </div>
              <div className="col-span-3"><Skeleton className="h-4 w-20 rounded-md" /></div>
              <div className="col-span-2"><Skeleton className="h-6 w-16 rounded-full" /></div>
              <div className="col-span-2 flex justify-end gap-1.5">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded-md" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="w-8 h-8 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthSkeleton() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md p-6 sm:p-8 space-y-6 rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white/80 dark:bg-[#091124]/80 shadow-2xl backdrop-blur-xl">
        <div className="text-center space-y-2">
          <Skeleton className="w-14 h-14 rounded-2xl mx-auto" />
          <Skeleton className="h-7 w-48 mx-auto rounded-xl" />
          <Skeleton className="h-4 w-64 mx-auto rounded-md" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
