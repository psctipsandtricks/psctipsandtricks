'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileWarning, Loader2, ChevronsDown, FileText, ShieldAlert } from 'lucide-react';
import { ReaderWatermarkOverlay } from './reader-watermark-overlay';
import { AudioSyncSegment } from '@psc/shared-types';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

interface ReaderPdfViewerProps {
  url: string;
  user?: { id?: string; name?: string; email?: string; phone?: string } | null;
  /** 1-indexed page to highlight/auto-scroll to, driven by audio progress. */
  activePage?: number | null;
  /** Normalized audio progress (0.0 to 1.0) while audio is playing. */
  audioProgress?: number | null;
  /** Whether auto-scrolling with audio is active */
  autoScrollEnabled?: boolean;
  onToggleAutoScroll?: () => void;
  onLoadSuccess?: (numPages: number) => void;
  /** Pre-computed sentence-level audio↔PDF sync data (null/absent when the unit hasn't been AI-synced yet — the reader falls back entirely to `activePage`/`audioProgress`). */
  segments?: AudioSyncSegment[] | null;
  activeSegmentIndex?: number | null;
  /** Fires when the reader clicks a highlighted sentence — the caller seeks the audio player to `time`. */
  onSeekRequest?: (time: number) => void;
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

interface SpanRange {
  span: HTMLElement;
  start: number;
  end: number;
}

/** Locates the DOM text-layer spans covering `segmentText` on a rendered page — exact normalized substring match first, falling back to a token-overlap match tolerant of OCR/whitespace drift between the stored sentence and what pdf.js actually rendered. */
function locateSegmentSpans(container: HTMLElement, segmentText: string): HTMLElement[] {
  const spans = Array.from(container.querySelectorAll<HTMLElement>('.react-pdf__Page__textLayer span'));
  if (spans.length === 0) return [];
  const target = normalizeForMatch(segmentText);
  if (!target) return [];

  let pageText = '';
  const ranges: SpanRange[] = [];
  for (const span of spans) {
    const norm = normalizeForMatch(span.textContent || '');
    if (!norm) continue;
    if (pageText) pageText += ' ';
    const start = pageText.length;
    pageText += norm;
    ranges.push({ span, start, end: pageText.length });
  }

  const idx = pageText.indexOf(target);
  if (idx !== -1) {
    const matchEnd = idx + target.length;
    return ranges.filter((r) => r.end > idx && r.start < matchEnd).map((r) => r.span);
  }

  // Fallback: any span sharing a word with the segment text, tolerant of
  // punctuation/line-break differences that break an exact substring match.
  const targetWords = new Set(target.split(' ').filter((w) => w.length > 1));
  if (targetWords.size === 0) return [];
  return ranges
    .filter((r) => {
      const words = (r.span.textContent || '').toLowerCase().split(/\s+/).filter(Boolean);
      return words.some((w) => targetWords.has(w));
    })
    .map((r) => r.span);
}

interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Absolutely-positioned highlight/click overlay for one page, rebuilt whenever the active segment or that page's segments change. */
function PageSyncOverlay({
  pageContainerRef,
  textLayerReady,
  pageSegments,
  activeSegmentIndex,
  onSeekRequest,
}: {
  pageContainerRef: React.RefObject<HTMLDivElement>;
  textLayerReady: boolean;
  pageSegments: { segment: AudioSyncSegment; globalIndex: number }[];
  activeSegmentIndex: number | null | undefined;
  onSeekRequest?: (time: number) => void;
}) {
  const [boxes, setBoxes] = useState<{ rect: HighlightRect; segment: AudioSyncSegment; isActive: boolean }[]>([]);

  useLayoutEffect(() => {
    const container = pageContainerRef.current;
    if (!container || !textLayerReady || pageSegments.length === 0) {
      setBoxes([]);
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const next: { rect: HighlightRect; segment: AudioSyncSegment; isActive: boolean }[] = [];

    for (const { segment, globalIndex } of pageSegments) {
      const spans = locateSegmentSpans(container, segment.text);
      for (const span of spans) {
        const r = span.getBoundingClientRect();
        next.push({
          rect: {
            left: r.left - containerRect.left,
            top: r.top - containerRect.top,
            width: r.width,
            height: r.height,
          },
          segment,
          isActive: globalIndex === activeSegmentIndex,
        });
      }
    }
    setBoxes(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textLayerReady, pageSegments, activeSegmentIndex]);

  if (boxes.length === 0) return null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {boxes.map((b, i) => (
        <div
          key={i}
          onClick={() => onSeekRequest?.(b.segment.startTime)}
          className={`absolute rounded-sm transition-colors cursor-pointer pointer-events-auto ${
            b.isActive
              ? 'bg-cyan-400/35 ring-1 ring-cyan-400/70'
              : 'bg-transparent hover:bg-cyan-400/10'
          }`}
          style={{ left: b.rect.left, top: b.rect.top, width: b.rect.width, height: b.rect.height }}
          title={b.isActive ? 'Currently playing' : 'Jump audio to this sentence'}
        />
      ))}
    </div>
  );
}

export function ReaderPdfViewer({
  url,
  user,
  activePage,
  audioProgress,
  autoScrollEnabled = true,
  onToggleAutoScroll,
  onLoadSuccess,
  segments,
  activeSegmentIndex,
  onSeekRequest,
}: ReaderPdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(700);
  const [retryCount, setRetryCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // One stable RefObject per page (not a plain callback into a map) so
  // PageSyncOverlay's effect always reads the live DOM node, not a stale
  // snapshot captured at a render before the node existed.
  const pageContainerRefs = useRef<Record<number, React.RefObject<HTMLDivElement>>>({});
  const getPageContainerRef = (pageNumber: number): React.RefObject<HTMLDivElement> => {
    if (!pageContainerRefs.current[pageNumber]) {
      pageContainerRefs.current[pageNumber] = React.createRef<HTMLDivElement>();
    }
    return pageContainerRefs.current[pageNumber];
  };
  const lastUserScrollTimeRef = useRef<number>(0);
  const [textLayerReadyPages, setTextLayerReadyPages] = useState<Set<number>>(new Set());

  const hasSyncSegments = Boolean(segments && segments.length > 0);
  const activeSegment =
    hasSyncSegments && activeSegmentIndex != null && activeSegmentIndex >= 0 ? segments![activeSegmentIndex] : null;
  // Sync-driven active page takes over from the proportion-heuristic `activePage` prop once real segments exist.
  const effectiveActivePage = activeSegment ? activeSegment.pageNumber : activePage;

  // Track manual wheel / touch scrolling so auto-scroll backs off while the user interacts
  useEffect(() => {
    const handleUserScroll = () => {
      lastUserScrollTimeRef.current = Date.now();
    };
    window.addEventListener('wheel', handleUserScroll, { passive: true });
    window.addEventListener('touchmove', handleUserScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleUserScroll);
      window.removeEventListener('touchmove', handleUserScroll);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(Math.min(760, el.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToActivePage = () => {
    if (!effectiveActivePage) return;
    const target = pageContainerRefs.current[effectiveActivePage]?.current;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Smart Page Tracking: smoothly center active page when audio page updates
  useEffect(() => {
    if (!effectiveActivePage || !autoScrollEnabled) return;
    if (Date.now() - lastUserScrollTimeRef.current < 2500) return;
    const target = pageContainerRefs.current[effectiveActivePage]?.current;
    if (target) {
      const rect = target.getBoundingClientRect();
      // Scroll if active page is not already nicely in view
      if (rect.top < 60 || rect.bottom > window.innerHeight) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [effectiveActivePage, autoScrollEnabled]);

  return (
    <div
      ref={containerRef}
      className="space-y-3 select-none print:hidden scroll-mt-24"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* PDF Header Toolbar with Auto-Scroll status & Re-sync button */}
      <div className="flex items-center justify-between pb-1 text-xs flex-wrap gap-2">
        <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
          <FileText className="w-4 h-4" />
          <span>PDF Notes {numPages ? `(${numPages} pages)` : ''}</span>
          {effectiveActivePage && numPages && numPages > 1 && (
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
              Page {effectiveActivePage} of {numPages}
            </span>
          )}
          {hasSyncSegments && (
            <span
              className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
              title="Text highlighting is following the actual spoken sentence, not just an estimated page"
            >
              AI Synced
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {effectiveActivePage && (
            <button
              type="button"
              onClick={scrollToActivePage}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20 transition-all cursor-pointer"
              title="Snap PDF view directly to current audio page"
            >
              <span>Re-sync Page</span>
            </button>
          )}

          {onToggleAutoScroll && (
            <button
              type="button"
              onClick={onToggleAutoScroll}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                autoScrollEnabled
                  ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
              title={autoScrollEnabled ? 'Auto-scroll is synchronizing with audio' : 'Click to enable auto-scroll with audio'}
            >
              <ChevronsDown className={`w-3 h-3 ${autoScrollEnabled ? 'text-cyan-500 animate-bounce' : 'text-slate-400'}`} />
              <span>{autoScrollEnabled ? 'Auto-Scroll ON' : 'Auto-Scroll OFF'}</span>
            </button>
          )}
        </div>
      </div>
      <Document
        key={`${url}-${retryCount}`}
        file={url}
        loading={
          <div className="flex items-center justify-center gap-2.5 py-8 text-cyan-600 dark:text-cyan-400 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800">
            <Loader2 className="w-4 h-4 animate-spin" />
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
          setTextLayerReadyPages(new Set());
          onLoadSuccess?.(n);
        }}
      >
        {numPages &&
          Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => {
            const pageSegments = hasSyncSegments
              ? segments!
                  .map((segment, globalIndex) => ({ segment, globalIndex }))
                  .filter(({ segment }) => segment.pageNumber === pageNumber)
              : [];

            return (
              <div
                key={pageNumber}
                ref={getPageContainerRef(pageNumber)}
                className={`relative rounded-lg overflow-hidden transition-all mx-auto select-none ${
                  effectiveActivePage === pageNumber
                    ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/20'
                    : 'ring-1 ring-slate-200 dark:ring-[#1e2e56]'
                }`}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              >
                {/* Dynamic User-Specific Forensic Watermark Layer */}
                <ReaderWatermarkOverlay
                  userName={user?.name}
                  userId={user?.id}
                  userIdentifier={user?.email || user?.phone}
                  opacity={0.065}
                />

                <Page
                  pageNumber={pageNumber}
                  width={containerWidth}
                  renderTextLayer={hasSyncSegments}
                  renderAnnotationLayer={false}
                  onRenderTextLayerSuccess={() => {
                    setTextLayerReadyPages((prev) => {
                      if (prev.has(pageNumber)) return prev;
                      const next = new Set(prev);
                      next.add(pageNumber);
                      return next;
                    });
                  }}
                  loading={
                    <div className="h-48 rounded-lg bg-slate-100 dark:bg-slate-900 animate-pulse flex items-center justify-center text-xs text-slate-400">
                      Loading page {pageNumber}…
                    </div>
                  }
                />

                {hasSyncSegments && pageSegments.length > 0 && (
                  <PageSyncOverlay
                    pageContainerRef={getPageContainerRef(pageNumber)}
                    textLayerReady={textLayerReadyPages.has(pageNumber)}
                    pageSegments={pageSegments}
                    activeSegmentIndex={activeSegmentIndex}
                    onSeekRequest={onSeekRequest}
                  />
                )}
              </div>
            );
          })}
      </Document>

      {/* Print Suppression Stylesheet & Blocker Notice */}
      <style jsx global>{`
        /* Text layer (only rendered once AI sync data exists) is present
           solely to compute highlight positions — never selectable/copyable,
           preserving the existing anti-copy posture. */
        .react-pdf__Page__textLayer {
          user-select: none !important;
          pointer-events: none !important;
        }
        .react-pdf__Page__textLayer span {
          user-select: none !important;
        }
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
}
