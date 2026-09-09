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
  Highlighter,
  Eraser,
  Check,
} from 'lucide-react';
import { ReaderWatermarkOverlay } from './reader-watermark-overlay';
import { ReaderHighlightLayer } from './reader-highlight-layer';
import {
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_HIGHLIGHT_WIDTH,
  type AnnotationTool,
  type ReaderHighlight,
} from './reader-highlights';
import { ApiClient } from '@/lib/api-client';
import { decideSyncScroll, type ResolvedSyncTarget, type Span } from './pdf-audio-sync';

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

/**
 * How often the region the audio points at is re-checked while playing.
 *
 * The check itself is cheap — a `getBoundingClientRect` and some arithmetic —
 * but running it on every `timeupdate` would tie scrolling to however often the
 * browser feels like firing that event. On a fixed beat it also catches the two
 * things a cue change alone would miss: a page that has only just rendered at
 * its real height, and a region the reader has scrolled away from.
 */
const SYNC_CHECK_MS = 400;

/**
 * How hard the proportional follow pulls towards where the audio is, per
 * 60fps frame. Roughly a 140ms time constant: close enough to feel attached to
 * the narration, loose enough that a seek glides rather than snaps.
 *
 * Applied frame-rate independently, so a 120Hz screen and a struggling laptop
 * travel at the same speed rather than the fast one scrolling twice as quickly.
 */
const FOLLOW_EASE_PER_FRAME = 0.12;

/** Below this the document is where it should be; writing again would only jitter. */
const FOLLOW_SETTLE_PX = 0.5;

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
   * applies. Used only when no `syncTarget` is supplied — a map authored
   * before regions existed still turns pages this way.
   */
  syncPage?: number | null;
  /**
   * Page *and region* the sync map points at right now. When present this
   * supersedes `syncPage`: the viewer scrolls to the rectangle rather than to
   * the top of the page, which is what lets a figure half way down a page be
   * followed as precisely as a paragraph.
   */
  syncTarget?: ResolvedSyncTarget | null;
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
  tool = 'none',
  highlights,
  onDraw,
  onErase,
}: {
  pageNumber: number;
  width: number;
  aspectRatio: number;
  user?: { id?: string; name?: string; email?: string; phone?: string } | null;
  scale?: number;
  onHeightMeasured?: (height: number) => void;
  onPageIntersect?: (pageNumber: number) => void;
  tool?: AnnotationTool;
  highlights?: ReaderHighlight[];
  onDraw?: (page: number, points: number[]) => void;
  onErase?: (ids: string[]) => void;
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
      {/* Brand watermark on every page. */}
      <ReaderWatermarkOverlay />

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

      {/* The marker layer, a child of the page itself — so it scrolls, zooms
          and reflows with the page rather than being positioned against it. */}
      {onDraw && onErase && (
        <ReaderHighlightLayer
          // Zero-based on the wire; react-pdf counts from one.
          page={pageNumber - 1}
          tool={tool}
          highlights={highlights ?? []}
          aspectRatio={aspectRatio}
          color={DEFAULT_HIGHLIGHT_COLOR}
          strokeWidth={DEFAULT_HIGHLIGHT_WIDTH}
          onDraw={(points) => onDraw(pageNumber - 1, points)}
          onErase={onErase}
        />
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
    syncTarget,
    // Off unless a caller asks for it, matching the reader's own default.
    autoScrollEnabled = false,
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

    /* ── Marker and eraser ─────────────────────────────────────────────
       Strokes live on the server keyed by the document's url, which is the
       same identity the app uses — so a highlight made on a phone is already
       here when the page loads, and one made here is on the phone next time
       it opens the topic. */
    const [tool, setTool] = useState<AnnotationTool>('none');
    const [highlights, setHighlights] = useState<ReaderHighlight[]>([]);
    const [toolMenuOpen, setToolMenuOpen] = useState(false);
    const toolMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      let cancelled = false;
      setHighlights([]);
      ApiClient.getPdfHighlights(url)
        .then((rows) => {
          if (cancelled) return;
          setHighlights(
            (rows ?? [])
              .filter((r: any) => Array.isArray(r?.points) && r.points.length >= 2)
              .map((r: any) => ({
                id: String(r.id),
                page: Number(r.page) || 0,
                points: r.points.map((n: any) => Number(n) || 0),
                color: Number(r.color) || DEFAULT_HIGHLIGHT_COLOR,
                width: Number(r.width) || DEFAULT_HIGHLIGHT_WIDTH,
                createdAt: r.createdAt,
              }))
          );
        })
        // Signed out, offline, or the request failed. The page reads perfectly
        // well without anyone's marks on it; nothing here is worth an error.
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [url]);

    /** Draws at once, saves behind. The server assigns the id, so the local
        one is a placeholder swapped for the real thing when the save lands —
        without that the eraser would later quote an id nobody has heard of. */
    const handleDraw = useCallback(
      (page: number, points: number[]) => {
        const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimistic: ReaderHighlight = {
          id: localId,
          page,
          points,
          color: DEFAULT_HIGHLIGHT_COLOR,
          width: DEFAULT_HIGHLIGHT_WIDTH,
        };
        setHighlights((prev) => [...prev, optimistic]);

        ApiClient.createPdfHighlight({
          documentKey: url,
          page,
          points,
          color: DEFAULT_HIGHLIGHT_COLOR,
          width: DEFAULT_HIGHLIGHT_WIDTH,
        })
          .then((saved) => {
            if (!saved?.id) return;
            setHighlights((prev) =>
              prev.map((h) => (h.id === localId ? { ...h, id: String(saved.id) } : h))
            );
          })
          .catch(() => {
            // Could not be saved, so it is not really there — taking it back
            // beats leaving a mark that vanishes on the next reload with no
            // explanation.
            setHighlights((prev) => prev.filter((h) => h.id !== localId));
          });
      },
      [url]
    );

    const handleErase = useCallback((ids: string[]) => {
      if (ids.length === 0) return;
      setHighlights((prev) => prev.filter((h) => !ids.includes(h.id)));
      // A stroke that never reached the server has no id to delete.
      const saved = ids.filter((id) => !id.startsWith('local-'));
      if (saved.length > 0) ApiClient.erasePdfHighlights(saved).catch(() => {});
    }, []);

    // Close the tool menu on an outside click, the way the rest of the admin
    // and reader menus behave.
    useEffect(() => {
      if (!toolMenuOpen) return;
      const onDocClick = (e: MouseEvent) => {
        if (!toolMenuRef.current?.contains(e.target as Node)) setToolMenuOpen(false);
      };
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }, [toolMenuOpen]);

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

    /* ── Region-level follow-the-audio ────────────────────────────────────
       Audio time → cue → page → region → scroll, with the decision itself
       living in `pdf-audio-sync.ts` so the phone runs the identical rules.
       ──────────────────────────────────────────────────────────────────── */

    /** The cue this viewer has already acted on — not every cue moves the page. */
    const appliedCueRef = useRef<number | null>(null);

    /**
     * The target region's extent in document coordinates, or null while its
     * page has no measurable box yet.
     *
     * A page that has scrolled out of view renders as a placeholder at its
     * estimated height rather than unmounting, so a region several pages away
     * still resolves to a usable position; the periodic re-check corrects the
     * landing once the real page renders.
     */
    const regionSpanFor = useCallback(
      (page: number, region: { y: number; height: number }): Span | null => {
        const pageEl = document.getElementById(`reader-pdf-page-${page}`);
        if (!pageEl) return null;
        const rect = pageEl.getBoundingClientRect();
        if (rect.height <= 0) return null;
        const docTop = rect.top + window.scrollY;
        return {
          top: docTop + region.y * rect.height,
          bottom: docTop + (region.y + region.height) * rect.height,
        };
      },
      [],
    );

    const evaluateRegionSync = useCallback(() => {
      if (!autoScrollEnabled || manualLatched) return;
      if (!syncTarget || !numPages) return;
      // A reader who has just touched the page owns it for a moment.
      if (Date.now() - lastUserGestureTimeRef.current < SCROLL_QUIET_MS) return;

      const page = Math.max(1, Math.min(syncTarget.page, numPages));
      const decision = decideSyncScroll({
        target: syncTarget,
        appliedCueIndex: appliedCueRef.current,
        regionSpan: regionSpanFor(page, syncTarget.region),
        viewport: { top: window.scrollY, bottom: window.scrollY + window.innerHeight },
        documentExtent: document.documentElement.scrollHeight,
      });

      // Recorded even when nothing moved, so a region already on screen counts
      // as handled and does not get re-considered every tick.
      appliedCueRef.current = decision.cueIndex;
      if (decision.scrollTo === null) return;

      window.scrollTo({ top: decision.scrollTo, behavior: 'smooth' });
      if (page !== currentPage) {
        setCurrentPage(page);
        onPageChange?.(page, numPages);
      }
    }, [
      autoScrollEnabled,
      manualLatched,
      syncTarget,
      numPages,
      currentPage,
      onPageChange,
      regionSpanFor,
    ]);

    // Act the moment the cue changes, so a seek lands immediately rather than
    // waiting out the beat below.
    useEffect(() => {
      if (!syncTarget) return;
      evaluateRegionSync();
    }, [syncTarget?.cueIndex, evaluateRegionSync, syncTarget]);

    // …and keep checking on a fixed beat while playing, which is what catches
    // a page that has only just rendered and a region scrolled out of view.
    useEffect(() => {
      if (!syncTarget || !isAudioPlaying) return;
      if (!autoScrollEnabled || manualLatched) return;
      const timer = setInterval(evaluateRegionSync, SYNC_CHECK_MS);
      return () => clearInterval(timer);
    }, [syncTarget, isAudioPlaying, autoScrollEnabled, manualLatched, evaluateRegionSync]);

    // Taking manual control, or turning follow back on, clears what was applied
    // so re-following starts by moving to wherever the audio now is.
    useEffect(() => {
      appliedCueRef.current = null;
    }, [manualLatched, autoScrollEnabled]);

    // 1. Explicit authored cue page turns — only for maps with no regions,
    //    where `syncTarget` is not supplied.
    useEffect(() => {
      if (syncTarget) return;
      if (!autoScrollEnabled || manualLatched) return;
      if (typeof syncPage !== 'number' || syncPage < 1) return;
      if (!numPages) return;

      const target = Math.max(1, Math.min(syncPage, numPages));
      if (lastSyncedPageRef.current === target && currentPage === target) return;
      if (Date.now() - lastUserGestureTimeRef.current < SCROLL_QUIET_MS) return;

      lastSyncedPageRef.current = target;
      scrollToPage(target, true);
    }, [syncTarget, syncPage, autoScrollEnabled, manualLatched, numPages, currentPage, scrollToPage]);

    /* ── 2. Continuous follow, for a clip with no sync map ─────────────────
       Proportional: the document is dragged along at the fraction the audio is
       through the clip. Where the audio *should* be and where the document
       actually is are kept apart on purpose — the first is recomputed whenever
       playback reports a new time, the second is eased towards it a frame at a
       time. Writing the position straight to the window on every `timeupdate`,
       as this did before, is a teleport a few pixels long several times a
       second, which is the stutter that reads as the page jumping about while
       narration plays.
       ─────────────────────────────────────────────────────────────────────── */

    /** Where proportional following wants the window, or null when it is off. */
    const followTargetRef = useRef<number | null>(null);

    // An authored map — pages or regions — always beats dragging the document
    // by the clock, so this is strictly the fallback for a clip with neither.
    const proportionalFollowActive =
      Boolean(autoScrollEnabled) &&
      !manualLatched &&
      Boolean(isAudioPlaying) &&
      !syncTarget &&
      !(typeof syncPage === 'number' && syncPage >= 1);

    useEffect(() => {
      if (!proportionalFollowActive) {
        followTargetRef.current = null;
        return;
      }
      if (typeof audioProgress !== 'number' || audioProgress < 0) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const containerTop = rect.top + scrollTop;
      const containerHeight = container.offsetHeight;

      const clampedRatio = Math.max(0, Math.min(1, audioProgress));
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
      const maxScroll = Math.max(0, containerHeight - (viewportHeight * 0.45));
      followTargetRef.current = Math.max(
        0,
        containerTop + clampedRatio * maxScroll - 80,
      );

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
      proportionalFollowActive,
      numPages,
      currentPage,
      onPageChange,
      onScrollPositionChange,
    ]);

    // The frame loop. It exists only while narration is actually playing, so a
    // pause stops the document dead, and starting again picks the chase up
    // from wherever the reader now is rather than snapping to the audio.
    useEffect(() => {
      if (!proportionalFollowActive) return;

      let frame = 0;
      let previous = performance.now();

      const step = (now: number) => {
        frame = requestAnimationFrame(step);

        const target = followTargetRef.current;
        // A tab that was in the background hands back one enormous delta;
        // clamping it keeps the catch-up a glide rather than a leap.
        const elapsed = Math.min(64, now - previous);
        previous = now;

        if (target === null) return;
        // A reader who has just touched the page owns it for a moment.
        if (Date.now() - lastUserGestureTimeRef.current < SCROLL_QUIET_MS) return;

        const current = window.scrollY;
        const gap = target - current;
        if (Math.abs(gap) < FOLLOW_SETTLE_PX) return;

        const ease = 1 - Math.pow(1 - FOLLOW_EASE_PER_FRAME, elapsed / 16.667);
        window.scrollTo({ top: current + gap * ease, behavior: 'auto' });
      };

      frame = requestAnimationFrame(step);
      return () => cancelAnimationFrame(frame);
    }, [proportionalFollowActive]);

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
    // A tool in hand owns the drag; panning a zoomed page would pull the
    // document out from under the stroke being drawn on it.
    if (tool !== 'none') return;
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

  // Served from public/ by scripts/copy-pdf-worker.js, so these always match
  // the installed pdfjs-dist. They were previously pinned to a CDN copy of
  // 3.11.174 while the engine moved on to 5.x — a mismatch that drops glyphs
  // (Malayalam among them) rather than raising an error.
  const documentOptions = useMemo(
    () => ({
      cMapUrl: '/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/pdfjs/standard_fonts/',
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
      {/* Reader PDF Controls Header: clean inline header above PDF content.

          Sticky from `lg` up, parked just under the page's own sticky header
          via the offset that header publishes. Page number and zoom are only
          useful while you can see the page they act on, and a 22-page document
          scrolls them far out of reach. Left static on phones and tablets,
          where a second permanent bar would cost more of the short viewport
          than it returns.

          Stickiness lives inside the viewer's own box, so the bar is released
          once the document has scrolled past rather than following on into the
          next topic. */}
      <div
        className="relative mb-3.5 lg:sticky lg:z-20 flex items-center justify-between gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-2xl bg-white/95 dark:bg-[#070e22]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 shadow-sm mx-0"
        style={{ top: 'var(--reader-sticky-top, 0.75rem)' }}
      >
        {/* Left: Notes badge (desktop) + Page Nav (all) */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 shrink-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span className="truncate text-[11px] sm:text-xs">Notes {numPages ? `(${numPages}p)` : ''}</span>
          </div>

          {/* PDF Back / Page / Forward — moves pages without disturbing audio */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100/90 dark:bg-[#0c152e] p-0.5 sm:p-1 rounded-xl border border-slate-200/90 dark:border-[#1e2e56]">
            <button
              type="button"
              onClick={() => goToRelativePage(-1)}
              disabled={!canGoBack}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
              title="Previous PDF page"
              aria-label="Previous PDF page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 sm:px-1.5 text-[10px] sm:text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap min-w-[48px] sm:min-w-[54px] text-center">
              {currentPage} / {numPages || '—'}
            </span>
            <button
              type="button"
              onClick={() => goToRelativePage(1)}
              disabled={!canGoForward}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
              title="Next PDF page"
              aria-label="Next PDF page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right side: Marker, Auto-scroll & Zoom in single line */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* One icon holding both tools, the same shape as the app's control:
              the icon shows which tool is in hand and lights up while one is
              held, and picking the tool already held puts it down. */}
          <div className="relative" ref={toolMenuRef}>
            <button
              type="button"
              onClick={() => setToolMenuOpen((o) => !o)}
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black transition-all cursor-pointer shadow-xs border ${
                tool !== 'none'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
              title={
                tool === 'marker'
                  ? 'Marker in hand — drag to highlight'
                  : tool === 'eraser'
                    ? 'Eraser in hand — drag over a highlight'
                    : 'Marker and eraser'
              }
              aria-haspopup="menu"
              aria-expanded={toolMenuOpen}
            >
              {tool === 'eraser' ? (
                <Eraser className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              ) : (
                <Highlighter className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              )}
              <span className="hidden sm:inline">
                {tool === 'marker' ? 'Marker' : tool === 'eraser' ? 'Eraser' : 'Mark'}
              </span>
            </button>

            {toolMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1.5 z-40 w-44 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] shadow-lg overflow-hidden"
              >
                {(
                  [
                    { value: 'marker', label: 'Marker', hint: 'Drag to highlight', Icon: Highlighter },
                    { value: 'eraser', label: 'Eraser', hint: 'Drag over a highlight', Icon: Eraser },
                  ] as const
                ).map(({ value, label, hint, Icon }) => {
                  const selected = tool === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => {
                        setTool((current) => (current === value ? 'none' : value));
                        setToolMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                    >
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          selected ? 'text-amber-500' : 'text-slate-400'
                        }`}
                      />
                      <span className="flex-1 min-w-0">
                        <span
                          className={`block text-[12px] font-extrabold ${
                            selected
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {label}
                        </span>
                        <span className="block text-[10px] text-slate-400">{hint}</span>
                      </span>
                      {selected && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sync state: Auto-Scroll switch + explicit re-follow */}
          <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-[#0c152e] p-0.5 sm:p-1 rounded-xl border border-slate-200/90 dark:border-[#1e2e56]">
            <button
              type="button"
              onClick={() => onAutoScrollChange?.(!autoScrollEnabled)}
              className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black transition-all cursor-pointer shadow-xs ${
                autoScrollEnabled
                  ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-transparent'
              }`}
              title={
                autoScrollEnabled
                  ? 'Auto-Scroll is ON — PDF follows the audio cues. Click to turn OFF.'
                  : 'Auto-Scroll is OFF — click to follow audio again.'
              }
              aria-pressed={autoScrollEnabled}
            >
              {autoScrollEnabled ? <Link2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Link2Off className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
              <span>Auto {autoScrollEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {autoScrollEnabled && manualLatched && (
              <button
                type="button"
                onClick={() => onManualLatchChange?.(false)}
                className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer shadow-xs animate-in fade-in duration-200"
                title="Jump the PDF back to current audio page"
              >
                <Crosshair className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Sync</span>
              </button>
            )}
          </div>

          {/* Zoom Controls Pill */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100/90 dark:bg-[#0c152e] p-0.5 sm:p-1 rounded-xl border border-slate-200/90 dark:border-[#1e2e56]">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 0.6}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleResetZoom}
              className="px-1 sm:px-2 py-0.5 text-[10px] sm:text-xs font-mono font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer min-w-[40px] sm:min-w-[48px] text-center"
              title="Reset to 100% width"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 2.5}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
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
              scale > 1.0 && tool === 'none'
                ? isPanning
                  ? 'cursor-grabbing'
                  : 'cursor-grab'
                : ''
            }`}
            style={{
              WebkitOverflowScrolling: 'touch',
              // With a tool in hand the drag belongs to the marker, not to
              // panning a zoomed page — otherwise a stroke would drag the
              // document out from under itself.
              touchAction: tool !== 'none' ? 'none' : scale > 1.0 ? 'pan-x pan-y' : 'pan-y',
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
                  tool={tool}
                  highlights={highlights}
                  onDraw={handleDraw}
                  onErase={handleErase}
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
