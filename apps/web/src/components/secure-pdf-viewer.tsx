'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Loader2,
  FileWarning,
  ShieldCheck,
  X,
} from 'lucide-react';
import { ReaderWatermarkOverlay } from '@/app/books/[id]/read/reader-watermark-overlay';

// Worker path from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface SecurePdfViewerProps {
  url: string;
  title?: string;
  user?: { id?: string; name?: string; email?: string; phone?: string } | null;
  onClose?: () => void;
}

export function SecurePdfViewer({ url, title, user, onClose }: SecurePdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [containerWidth, setContainerWidth] = useState<number>(750);
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

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.15, 2.2));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.15, 0.7));
  const handleResetZoom = () => setScale(1.0);

  const handlePrevPage = () => {
    setCurrentPage((p) => {
      const next = Math.max(p - 1, 1);
      const targetEl = document.getElementById(`preview-pdf-page-${next}`);
      targetEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return next;
    });
  };

  const handleNextPage = () => {
    setCurrentPage((p) => {
      const next = Math.min(p + 1, numPages || 1);
      const targetEl = document.getElementById(`preview-pdf-page-${next}`);
      targetEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return next;
    });
  };

  return (
    <div
      className="flex-1 min-h-0 flex flex-col select-none relative bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Secure Header Control Bar */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/95 border-b border-slate-800 text-xs text-slate-300 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 font-bold text-amber-400 truncate">
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-[220px] sm:max-w-md">{title || 'Preview Study Material'}</span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
            <ShieldCheck className="w-3 h-3" /> Secure Reader
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-1.5 py-0.5 text-[10px] font-mono font-bold hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-white cursor-pointer"
              title="Reset zoom"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Page navigation */}
          {numPages && numPages > 1 && (
            <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-[10px] font-mono font-bold text-slate-300 whitespace-nowrap">
                {currentPage} / {numPages}
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= numPages}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700 transition-colors ml-1 cursor-pointer"
              title="Close viewer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Reader Body with Canvas Rendering */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 flex flex-col items-center relative bg-slate-950/90"
        style={{
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {/* Anti-theft watermark overlay */}
        <ReaderWatermarkOverlay
          userName={user?.name || 'Preview Reader'}
          userId={user?.id || 'GUEST-PREVIEW'}
          userIdentifier={user?.email || user?.phone || undefined}
        />

        {error && (
          <div className="my-auto max-w-sm p-6 text-center space-y-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl">
            <FileWarning className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-rose-300">Unable to load document</p>
            <p className="text-xs text-rose-400/80">{error}</p>
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={({ numPages: total }) => {
            setNumPages(total);
            setLoading(false);
            setError(null);
          }}
          onLoadError={(err) => {
            console.error('Failed to load PDF:', err);
            setError('The PDF file could not be loaded or is in an unsupported format.');
            setLoading(false);
          }}
          loading={
            <div className="my-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-xs font-bold font-mono">Rendering Secure Preview…</p>
            </div>
          }
          className="flex flex-col items-center gap-4 w-full"
        >
          {Array.from(new Array(numPages || 0), (_, index) => {
            const pageNum = index + 1;
            return (
              <div
                key={`page_${pageNum}`}
                id={`preview-pdf-page-${pageNum}`}
                className="relative bg-white shadow-2xl rounded-lg overflow-hidden border border-slate-800 transition-transform duration-150"
                style={{
                  pointerEvents: 'none', // Prevents image drag/drop and context menu
                }}
              >
                <Page
                  pageNumber={pageNum}
                  width={containerWidth * scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={
                    <div
                      style={{ width: containerWidth * scale, height: (containerWidth * scale * 1.4) }}
                      className="flex items-center justify-center bg-slate-900 text-slate-500 text-xs"
                    >
                      Loading page {pageNum}…
                    </div>
                  }
                />
              </div>
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
