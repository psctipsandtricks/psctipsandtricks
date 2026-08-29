'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  FileWarning,
  Loader2,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Link2,
  Link2Off,
  Crosshair,
} from 'lucide-react';
import { ReaderWatermarkOverlay } from './reader-watermark-overlay';

// Worker path from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * How long a plain wheel/touch scroll suspends cue-driven page turns.
 *
 * Scrolling to glance at a figure is transient, so it self-clears. Pressing
 * PDF Back/Forward is a deliberate page choice and instead latches manual mode
 * until the reader explicitly re-follows the audio — see `manualLatched`.
 */
const SCROLL_QUIET_MS = 2500;

export interface ReaderPdfViewerHandle {
  scrollToPage: (pageNumber: number, smooth?: boolean) => void;
  scrollToRatio: (ratio: number, smooth?: boolean) => void;
  getCurrentPage: () => number;
  getNumPages: () => number;
}

interface ReaderPdfViewerProps {
  url: string;
  user?: { id?: string; name?: string; email?: string; phone?: string } | null;
  initialPage?: number;
  isAudioPlaying?: boolean;
  /**
   * Continuous audio playback progress (0.0 to 1.0) derived from currentTime / duration.
   * Drives continuous smooth document-level auto-scrolling when no explicit cue is active.
   */
  audioProgress?: number;
  /**
   * Page the sync map says belongs on screen right now, or null when no cue
   * applies.
   */
  syncPage?: number | null;
  /** False puts the reader in full manual control; cue-driven turns stop entirely. */
  autoScrollEnabled?: boolean;
  onAutoScrollChange?: (enabled: boolean) => void;
  /** True once the reader has taken manual control and sync is latched off. */
  manualLatched?: boolean;
  onManualLatchChange?: (latched: boolean) => void;
  onLoadSuccess?: (numPages: number) => void;
  onPageChange?: (pageNumber: number, numPages: number) => void;
  onScrollPositionChange?: (pageNumber: number, scrollRatio: number) => void;
}

// Highly optimized Lazy-loaded single page component
const LazyPdfPage = memo(function LazyPdfPage({
  pageNumber,
  width,
  aspectRatio,
  user,
  scale = 1.0,
  onHeightMeasured,
  onPageIntersect,
}: {
  pageNumber: number;
  width: number;
  aspectRatio: number;
  user?: { id?: string; name?: string; email?: string; phone?: string } | null;
  scale?: number;
  onHeightMeasured?: (height: number) => void;
  onPageIntersect?: (pageNumber: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Always render the first 2 pages immediately for instant first-paint
  const [isVisible, setIsVisible] = useState(pageNumber <= 2);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Viewport-aware Intersection Observer: pre-render when 400px away and track active page
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
          onPageIntersect?.(pageNumber);
        }
      },
      { rootMargin: '300px 0px -40% 0px', threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onPageIntersect]);

  const estimatedHeight = Math.round(width * (aspectRatio || 1.414));
  const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

  return (
    <div
      ref={containerRef}
      id={`reader-pdf-page-${pageNumber}`}
      data-page-number={pageNumber}
      className={`relative rounded-xl overflow-hidden select-none ring-1 ring-slate-200/90 dark:ring-[#1e2e56] bg-white dark:bg-[#070e22] shadow-sm transition-all ${
        scale <= 1.0 ? 'mx-auto' : 'ml-0'
      }`}
      style={{ width, minWidth: width, minHeight: isVisible ? undefined : estimatedHeight }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Forensic Anti-Leak Watermark Layer on EVERY page */}
      <ReaderWatermarkOverlay
        userName={user?.name}
        userId={user?.id}
        userIdentifier={user?.email || user?.phone}
      />

      {isVisible ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          devicePixelRatio={pixelRatio}
          loading={
            <div
              className="rounded-xl bg-slate-100/80 dark:bg-slate-900/60 animate-pulse flex items-center justify-center text-xs text-slate-400 font-mono"
              style={{ width, height: estimatedHeight }}
            >
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                <span>Page {pageNumber}…</span>
              </div>
            </div>
          }
          onRenderSuccess={(page) => {
            if (page.height) {
              onHeightMeasured?.(page.height);
            }
          }}
        />
      ) : (
        <div
          className="rounded-xl bg-slate-50 dark:bg-slate-900/30 flex items-center justify-center text-xs text-slate-400 font-mono"
          style={{ width, height: estimatedHeight }}
        >
          <span>Page {pageNumber}</span>
        </div>
      )}
    </div>
  );
});

export const ReaderPdfViewer = React.forwardRef<ReaderPdfViewerHandle, ReaderPdfViewerProps>(
  function ReaderPdfViewer({
    url,
    user,
    initialPage,
    isAudioPlaying,
    audioProgress,
    syncPage,
    autoScrollEnabled = true,
    onAutoScrollChange,
    manualLatched = false,
    onManualLatchChange,
    onLoadSuccess,
    onPageChange,
    onScrollPositionChange,
  }, ref) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(initialPage || 1);
    const [containerWidth, setContainerWidth] = useState(720);
    const [aspectRatio, setAspectRatio] = useState(1.414); // Standard A4 ratio default
    const [retryCount, setRetryCount] = useState(0);
    const [scale, setScale] = useState(1.0);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isPanning, setIsPanning] = useState(false);
    const startPosRef = useRef({ x: 0, scrollLeft: 0 });
    const initialPageScrolledRef = useRef(false);
    const lastUserGestureTimeRef = useRef(0);

    // Track user physical touch/wheel gestures on document to respect manual reading
    useEffect(() => {
      const onGesture = (e: Event) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest?.('button') || target?.closest?.('input') || target?.closest?.('[role="slider"]')) {
          return;
        }
        lastUserGestureTimeRef.current = Date.now();
      };
      window.addEventListener('wheel', onGesture, { passive: true });
      window.addEventListener('touchmove', onGesture, { passive: true });
      return () => {
        window.removeEventListener('wheel', onGesture);
        window.removeEventListener('touchmove', onGesture);
      };
    }, []);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const update = () => setContainerWidth(Math.max(300, el.clientWidth));
      update();
      const observer = new ResizeObserver(update);
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    const scrollToPage = useCallback((pageNumber: number, smooth = true) => {
      const targetPage = Math.max(1, Math.min(pageNumber, numPages || 1));
      setCurrentPage(targetPage);
      const pageEl = document.getElementById(`reader-pdf-page-${targetPage}`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
        if (numPages) onPageChange?.(targetPage, numPages);
      }
    }, [numPages, onPageChange]);

    const scrollToRatio = useCallback((ratio: number, smooth = true) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const containerTop = rect.top + scrollTop;
      const containerHeight = container.offsetHeight;

      const clampedRatio = Math.max(0, Math.min(1, ratio));
      // Total scrollable range of the PDF in document
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
      const maxScroll = Math.max(0, containerHeight - (viewportHeight * 0.45));
      const targetY = Math.max(0, containerTop + (clampedRatio * maxScroll) - 80);

      window.scrollTo({
        top: targetY,
        behavior: smooth ? 'smooth' : 'auto',
      });

      if (numPages && numPages > 0) {
        const targetPage = Math.min(Math.floor(clampedRatio * numPages) + 1, numPages);
        setCurrentPage(targetPage);
        onScrollPositionChange?.(targetPage, clampedRatio);
      }
    }, [numPages, onScrollPositionChange]);

    // Expose methods to parent
    React.useImperativeHandle(ref, () => ({
      scrollToPage,
      scrollToRatio,
      getCurrentPage: () => currentPage,
      getNumPages: () => numPages || 0,
    }), [scrollToPage, scrollToRatio, currentPage, numPages]);

    // Handle initial page restoration on load
    useEffect(() => {
      if (numPages && initialPage && initialPage > 0 && !initialPageScrolledRef.current) {
        initialPageScrolledRef.current = true;
        setTimeout(() => {
          scrollToPage(initialPage, false);
        }, 150);
      }
    }, [numPages, initialPage, scrollToPage]);

    /**
     * Cue-driven page turns (when authored cue map exists).
     */
    const lastSyncedPageRef = useRef<number | null>(null);

    useEffect(() => {
      if (!manualLatched && autoScrollEnabled) {
        lastUserGestureTimeRef.current = 0;
        lastSyncedPageRef.current = null;
      }
    }, [manualLatched, autoScrollEnabled]);

    // 1. Explicit authored cue page turns
    useEffect(() => {
      if (!autoScrollEnabled || manualLatched) return;
      if (typeof syncPage !== 'number' || syncPage < 1) return;
      if (!numPages) return;

      const target = Math.max(1, Math.min(syncPage, numPages));
      if (lastSyncedPageRef.current === target && currentPage === target) return;
      if (Date.now() - lastUserGestureTimeRef.current < SCROLL_QUIET_MS) return;

      lastSyncedPageRef.current = target;
      scrollToPage(target, true);
    }, [syncPage, autoScrollEnabled, manualLatched, numPages, currentPage, scrollToPage]);

    // 2. Continuous playback auto-scrolling (in sync with audio playback)
    useEffect(() => {
      if (!autoScrollEnabled || manualLatched || !isAudioPlaying) return;
      if (typeof syncPage === 'number' && syncPage >= 1) return;
      if (typeof audioProgress !== 'number' || audioProgress < 0) return;
      if (Date.now() - lastUserGestureTimeRef.current < SCROLL_QUIET_MS) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const containerTop = rect.top + scrollTop;
      const containerHeight = container.offsetHeight;

      const clampedRatio = Math.max(0, Math.min(1, audioProgress));
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
      const maxScroll = Math.max(0, containerHeight - (viewportHeight * 0.45));
      const targetY = Math.max(0, containerTop + (clampedRatio * maxScroll) - 80);

      if (Math.abs(window.scrollY - targetY) > 4) {
        window.scrollTo({
          top: targetY,
          behavior: 'auto',
        });
      }

      if (numPages && numPages > 0) {
        const targetPage = Math.min(Math.floor(clampedRatio * numPages) + 1, numPages);
        if (currentPage !== targetPage) {
          setCurrentPage(targetPage);
          onPageChange?.(targetPage, numPages);
        }
        onScrollPositionChange?.(targetPage, clampedRatio);
      }
    }, [
      audioProgress,
      isAudioPlaying,
      syncPage,
      autoScrollEnabled,
      manualLatched,
      numPages,
      currentPage,
      onPageChange,
      onScrollPositionChange,
    ]);

    /**
     * Step one page without touching audio — the audio keeps playing, untouched.
     *
     * Steps from a ref rather than `currentPage` state: two quick taps land in
     * one React batch, and reading state would make both compute the same
     * target, so a double-tap forward would advance a single page.
     */
    const currentPageRef = useRef(currentPage);
    useEffect(() => {
      currentPageRef.current = currentPage;
    }, [currentPage]);

    const goToRelativePage = useCallback(
      (delta: number) => {
        const total = numPages || 1;
        const target = Math.max(1, Math.min(currentPageRef.current + delta, total));
        if (target === currentPageRef.current) return;
        currentPageRef.current = target;
        // Latch manual mode: this is a deliberate choice, not a stray scroll,
        // so cue-driven turns stay suspended until the reader re-follows.
        onManualLatchChange?.(true);
        lastUserGestureTimeRef.current = Date.now();
        scrollToPage(target, true);
      },
      [numPages, scrollToPage, onManualLatchChange],
    );

    const canGoBack = currentPage > 1;
    const canGoForward = Boolean(numPages && currentPage < numPages);

    const handlePageIntersect = useCallback((page: number) => {
      setCurrentPage(page);
      if (numPages) {
        onPageChange?.(page, numPages);
        onScrollPositionChange?.(page, page / numPages);
      }
    }, [numPages, onPageChange, onScrollPositionChange]);

  const handleZoomIn = () => {
    setScale((s) => Math.min(2.5, +(s + 0.15).toFixed(2)));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(0.6, +(s - 0.15).toFixed(2)));
  };

  const handleResetZoom = () => {
    setScale(1.0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1.0 || !scrollContainerRef.current) return;
    setIsPanning(true);
    startPosRef.current = {
      x: e.clientX,
      scrollLeft: scrollContainerRef.current.scrollLeft,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !scrollContainerRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    scrollContainerRef.current.scrollLeft = startPosRef.current.scrollLeft - dx;
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  const handleHeightMeasured = useCallback(
    (height: number) => {
      if (height > 0 && containerWidth > 0) {
        const ratio = height / containerWidth;
        if (ratio > 0.5 && ratio < 3.0) {
          setAspectRatio(ratio);
        }
      }
    },
    [containerWidth]
  );

  const documentOptions = useMemo(
    () => ({
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
    }),
    []
  );

  const finalPageWidth = Math.round(containerWidth * scale);

  return (
    <div
      ref={containerRef}
      className="space-y-4 select-none print:hidden scroll-mt-24 w-full"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Reader Sticky Header with Page, Sync and Zoom Controls */}
      <div className="sticky top-[50px] sm:top-[60px] z-20 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-white/95 dark:bg-[#070e22]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/90 shadow-sm mx-1 sm:mx-0">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 min-w-0">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <span className="truncate text-[11px] sm:text-xs">PDF Notes {numPages ? `(${numPages} pages)` : ''}</span>
          {scale > 1.0 && (
            <span className="hidden lg:inline-block text-[10px] text-slate-400 dark:text-slate-500 font-normal">
              (Drag or scroll horizontally to pan)
            </span>
          )}
        </div>

        {/* PDF Back / Page / Forward — moves pages without disturbing audio */}
        <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-[#0c152e] p-1 rounded-xl border border-slate-200/90 dark:border-[#1e2e56]">
          <button
            type="button"
            onClick={() => goToRelativePage(-1)}
            disabled={!canGoBack}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shadow-xs"
            title="PDF Back — previous page (audio keeps playing)"
            aria-label="Previous PDF page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-1.5 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap min-w-[54px] text-center">
            {currentPage} / {numPages || '—'}
          </span>
          <button
            type="button"
            onClick={() => goToRelativePage(1)}
            disabled={!canGoForward}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shadow-xs"
            title="PDF Forward — next page (audio keeps playing)"
            aria-label="Next PDF page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sync state: Auto-Scroll switch + explicit re-follow */}
        <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-[#0c152e] p-1 rounded-xl border border-slate-200/90 dark:border-[#1e2e56]">
          <button
            type="button"
            onClick={() => onAutoScrollChange?.(!autoScrollEnabled)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer shadow-xs ${
              autoScrollEnabled
                ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-transparent'
            }`}
            title={
              autoScrollEnabled
                ? 'Auto-Scroll is ON — PDF follows the audio cues. Click to take full manual control.'
                : 'Auto-Scroll is OFF — you control PDF pages manually. Click to follow the audio again.'
            }
            aria-pressed={autoScrollEnabled}
          >
            {autoScrollEnabled ? <Link2 className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Auto-Scroll {autoScrollEnabled ? 'ON' : 'OFF'}</span>
            <span className="sm:hidden">{autoScrollEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/*
            Only meaningful while sync is available but latched off by a manual
            page choice — this is the "explicitly choose to sync" affordance.
          */}
          {autoScrollEnabled && manualLatched && (
            <button
              type="button"
              onClick={() => onManualLatchChange?.(false)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer shadow-xs animate-in fade-in duration-200"
              title="Jump the PDF back to the page the audio is currently on"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Follow audio</span>
            </button>
          )}
        </div>

        {/* Zoom Controls Pill */}
        <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-[#0c152e] p-1 rounded-xl border border-slate-200/90 dark:border-[#1e2e56]">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.6}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shadow-xs"
            title="Zoom out (–)"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 py-0.5 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer min-w-[50px] text-center shadow-xs"
            title="Reset to 100% width"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 2.5}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shadow-xs"
            title="Zoom in (+)"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {scale !== 1.0 && (
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-cyan-600 dark:text-cyan-400 transition-all cursor-pointer"
              title="Reset Zoom (Fit Width)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <Document
        key={`${url}-${retryCount}`}
        file={url}
        options={documentOptions}
        loading={
          <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-cyan-600 dark:text-cyan-400 text-xs font-bold rounded-2xl bg-slate-50 dark:bg-[#070e22]/50 border border-slate-200/60 dark:border-slate-800 shadow-xs">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
            <span>Loading PDF notes…</span>
          </div>
        }
        error={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold">
              <FileWarning className="w-4 h-4 shrink-0" />
              <span>Could not load PDF content. Please check connection.</span>
            </div>
            <button
              type="button"
              onClick={() => setRetryCount((c) => c + 1)}
              className="px-3 py-1 rounded-lg bg-rose-500 text-white font-bold hover:bg-rose-600 transition-colors cursor-pointer text-xs shrink-0"
            >
              Retry
            </button>
          </div>
        }
        onLoadSuccess={({ numPages: n }) => {
          setNumPages(n);
          onLoadSuccess?.(n);
        }}
      >
        {numPages && (
          <div
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className={`w-full max-w-full overflow-x-auto overflow-y-visible pb-12 pt-1 touch-pan-y ${
              scale > 1.0 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
            }`}
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: scale > 1.0 ? 'pan-x pan-y' : 'pan-y',
            }}
          >
            <div
              className="space-y-4 transition-[width] duration-150 ease-out"
              style={{
                width: finalPageWidth,
                minWidth: finalPageWidth,
                margin: scale <= 1.0 ? '0 auto' : '0',
              }}
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
                <LazyPdfPage
                  key={pageNumber}
                  pageNumber={pageNumber}
                  width={finalPageWidth}
                  aspectRatio={aspectRatio}
                  user={user}
                  scale={scale}
                  onHeightMeasured={pageNumber === 1 ? handleHeightMeasured : undefined}
                  onPageIntersect={handlePageIntersect}
                />
              ))}
            </div>
          </div>
        )}
      </Document>

      {/* Print Suppression Stylesheet & Blocker Notice */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
            display: none !important;
          }
          #ebook-print-guard {
            visibility: visible !important;
            display: flex !important;
            position: fixed !important;
            inset: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            z-index: 999999 !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            padding: 40px !important;
            font-family: sans-serif !important;
          }
        }
      `}</style>
      <div id="ebook-print-guard" className="hidden" aria-hidden="true">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Protected Material</h2>
          <p className="text-sm text-gray-600">
            Printing and exporting this eBook is prohibited by copyright protection policies.
          </p>
          <p className="text-xs text-gray-400">
            Account: {user?.name || 'Registered User'} ({user?.id || ''})
          </p>
        </div>
      </div>
    </div>
  );
});
