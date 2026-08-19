'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileText,
  Loader2,
  FileWarning,
  ShieldCheck,
} from 'lucide-react';
import { ReaderWatermarkOverlay } from '@/app/books/[id]/read/reader-watermark-overlay';

// Worker path from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface SecureVideoPdfViewerProps {
  url: string;
  title?: string;
  user?: { id?: string; name?: string; email?: string; phone?: string } | null;
}

const LazyVideoPdfPage = memo(function LazyVideoPdfPage({
  pageNumber,
  width,
  aspectRatio,
  onHeightMeasured,
}: {
  pageNumber: number;
  width: number;
  aspectRatio: number;
  onHeightMeasured?: (height: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(pageNumber <= 2);

  useEffect(() => {
    if (pageNumber <= 2) return;
    const el = containerRef.current;
    if (!el) return;

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
      id={`pdf-page-${pageNumber}`}
      className="relative bg-white shadow-2xl rounded-lg overflow-hidden border border-slate-800 transition-transform duration-150"
      style={{
        width,
        minHeight: isVisible ? undefined : estimatedHeight,
        pointerEvents: 'none',
      }}
    >
      {isVisible ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          devicePixelRatio={pixelRatio}
          loading={
            <div
              style={{ width, height: estimatedHeight }}
              className="flex items-center justify-center bg-slate-900 text-slate-500 text-xs font-mono"
            >
              Loading page {pageNumber}…
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
          style={{ width, height: estimatedHeight }}
          className="flex items-center justify-center bg-slate-900 text-slate-600 text-xs font-mono"
        >
          Page {pageNumber}
        </div>
      )}
    </div>
  );
});

export function SecureVideoPdfViewer({ url, title, user }: SecureVideoPdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [containerWidth, setContainerWidth] = useState<number>(750);
  const [aspectRatio, setAspectRatio] = useState<number>(1.414);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resize observer to scale pages to available width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const w = entry.contentRect.width;
        if (w > 0) {
          setContainerWidth(Math.min(w - 32, 900));
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Block download and print shortcuts (Ctrl+S, Cmd+S, Ctrl+P, Cmd+P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.15, 2.0));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.15, 0.7));
  const handleResetZoom = () => setScale(1.0);

  const handlePrevPage = () => {
    setCurrentPage((p) => {
      const next = Math.max(p - 1, 1);
      const targetEl = document.getElementById(`pdf-page-${next}`);
      targetEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return next;
    });
  };

  const handleNextPage = () => {
    setCurrentPage((p) => {
      const next = Math.min(p + 1, numPages || 1);
      const targetEl = document.getElementById(`pdf-page-${next}`);
      targetEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return next;
    });
  };

  const handleHeightMeasured = useCallback(
    (height: number) => {
      if (height > 0 && containerWidth > 0) {
        const ratio = height / (containerWidth * scale);
        if (ratio > 0.5 && ratio < 3.0) {
          setAspectRatio(ratio);
        }
      }
    },
    [containerWidth, scale]
  );

  const documentOptions = useMemo(
    () => ({
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
    }),
    []
  );

  const finalWidth = containerWidth * scale;

  return (
    <div
      className="flex-1 min-h-0 flex flex-col select-none relative bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Secure Header Control Bar */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/95 border-b border-slate-800 text-xs text-slate-300 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 font-bold text-amber-400 truncate">
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-[200px] sm:max-w-xs">{title || 'PDF Study Material'}</span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
            <ShieldCheck className="w-3 h-3" />
            <span>Protected In-App Read</span>
          </span>
        </div>

        {/* Page & Zoom Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {numPages && (
            <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-xl font-mono text-[11px] border border-slate-700/60">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-0.5 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 text-slate-200">
                {currentPage} / {numPages}
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= (numPages || 1)}
                className="p-0.5 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-0.5 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-1 text-[10px] hover:text-white hover:bg-slate-700/50 rounded-md transition-colors cursor-pointer"
              title="Reset Zoom"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Reader Body with Virtualized Page Canvas */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 flex flex-col items-center relative bg-slate-950/90"
        style={{
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {/* Forensic anti-piracy watermark overlay */}
        <ReaderWatermarkOverlay
          userName={user?.name || 'Registered Student'}
          userId={user?.id || 'STUDENT'}
          userIdentifier={user?.email || user?.phone || undefined}
        />

        {error && (
          <div className="my-auto max-w-sm p-4 text-center space-y-2 bg-rose-500/10 border border-rose-500/30 rounded-xl">
            <FileWarning className="w-6 h-6 text-rose-500 mx-auto" />
            <p className="text-xs font-bold text-rose-300">Unable to load document</p>
            <p className="text-[11px] text-rose-400/80">{error}</p>
          </div>
        )}

        <Document
          file={url}
          options={documentOptions}
          onLoadSuccess={({ numPages: total }) => {
            setNumPages(total);
            setLoading(false);
            setError(null);
          }}
          onLoadError={(err) => {
            console.error('Failed to load PDF:', err);
            setError('The PDF file could not be loaded.');
            setLoading(false);
          }}
          loading={
            <div className="my-16 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <p className="text-xs font-mono">Rendering Secure Notes…</p>
            </div>
          }
          className="flex flex-col items-center gap-4 w-full"
        >
          {numPages &&
            Array.from({ length: numPages }, (_, index) => {
              const pageNum = index + 1;
              return (
                <LazyVideoPdfPage
                  key={`video_pdf_page_${pageNum}`}
                  pageNumber={pageNum}
                  width={finalWidth}
                  aspectRatio={aspectRatio}
                  onHeightMeasured={pageNum === 1 ? handleHeightMeasured : undefined}
                />
              );
            })}
        </Document>
      </div>

      {/* Print Guard Styles */}
      <style jsx global>{`
        @media print {
          body {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
