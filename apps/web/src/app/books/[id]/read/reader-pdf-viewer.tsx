'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileWarning, Loader2, FileText, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';
import { ReaderWatermarkOverlay } from './reader-watermark-overlay';

// Worker path from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface ReaderPdfViewerProps {
  url: string;
  user?: { id?: string; name?: string; email?: string; phone?: string } | null;
  onLoadSuccess?: (numPages: number) => void;
}

// Highly optimized Lazy-loaded single page component
const LazyPdfPage = memo(function LazyPdfPage({
  pageNumber,
  width,
  aspectRatio,
  user,
  scale = 1.0,
  onHeightMeasured,
}: {
  pageNumber: number;
  width: number;
  aspectRatio: number;
  user?: { id?: string; name?: string; email?: string; phone?: string } | null;
  scale?: number;
  onHeightMeasured?: (height: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Always render the first 2 pages immediately for instant first-paint
  const [isVisible, setIsVisible] = useState(pageNumber <= 2);

  useEffect(() => {
    if (pageNumber <= 2) return;
    const el = containerRef.current;
    if (!el) return;

    // Viewport-aware Intersection Observer: pre-render when 400px away
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber]);

  const estimatedHeight = Math.round(width * (aspectRatio || 1.414));
  const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

  return (
    <div
      ref={containerRef}
      id={`reader-pdf-page-${pageNumber}`}
      className={`relative rounded-xl overflow-hidden select-none ring-1 ring-slate-200/90 dark:ring-[#1e2e56] bg-white dark:bg-[#070e22] shadow-sm transition-all ${
        scale <= 1.0 ? 'mx-auto' : 'ml-0'
      }`}
      style={{ width, minWidth: width, minHeight: isVisible ? undefined : estimatedHeight }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Forensic Anti-Leak Watermark Layer */}
      <ReaderWatermarkOverlay
        userName={user?.name}
        userId={user?.id}
        userIdentifier={user?.email || user?.phone}
        opacity={0.065}
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

export function ReaderPdfViewer({ url, user, onLoadSuccess }: ReaderPdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(720);
  const [aspectRatio, setAspectRatio] = useState(1.414); // Standard A4 ratio default
  const [retryCount, setRetryCount] = useState(0);
  const [scale, setScale] = useState(1.0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const startPosRef = useRef({ x: 0, scrollLeft: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(Math.max(300, el.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
      {/* Reader Sticky Header with Zoom Controls */}
      <div className="sticky top-16 z-30 flex items-center justify-between gap-3 p-2 sm:p-2.5 rounded-2xl bg-white/95 dark:bg-[#070e22]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/90 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <span>PDF Notes {numPages ? `(${numPages} pages)` : ''}</span>
          {scale > 1.0 && (
            <span className="hidden sm:inline-block text-[10px] text-slate-400 dark:text-slate-500 font-normal">
              (Drag or scroll horizontally to pan)
            </span>
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
            className={`w-full max-w-full overflow-x-auto overflow-y-visible pb-6 pt-1 touch-pan-x ${
              scale > 1.0 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
            }`}
            style={{
              WebkitOverflowScrolling: 'touch',
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
}
