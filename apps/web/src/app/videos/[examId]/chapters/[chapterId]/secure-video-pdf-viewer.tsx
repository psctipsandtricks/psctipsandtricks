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
} from 'lucide-react';
import { ReaderWatermarkOverlay } from '@/app/books/[id]/read/reader-watermark-overlay';

// Worker path from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface SecureVideoPdfViewerProps {
  url: string;
  title?: string;
  user?: { id?: string; name?: string; email?: string; phone?: string } | null;
}

export function SecureVideoPdfViewer({ url, title, user }: SecureVideoPdfViewerProps) {
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
          // Reserve padding
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
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[10px] font-mono text-slate-300">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer ml-0.5"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* PDF Canvas Document Viewport */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 flex flex-col items-center space-y-4 custom-scrollbar bg-slate-950/80 relative"
      >
        <Document
          file={url}
          loading={
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-xs font-bold text-slate-400">Loading protected document…</p>
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center py-20 space-y-2 text-rose-400">
              <FileWarning className="w-8 h-8" />
              <p className="text-xs font-bold">Failed to load PDF document.</p>
            </div>
          }
          onLoadSuccess={({ numPages: total }) => {
            setNumPages(total);
            setLoading(false);
          }}
        >
          {numPages &&
            Array.from({ length: numPages }, (_, index) => {
              const pageNumber = index + 1;
              return (
                <div
                  key={`page-${pageNumber}`}
                  id={`pdf-page-${pageNumber}`}
                  className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-700/80 bg-white mx-auto my-2"
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                >
                  {/* Tamper-Resistant Student Watermark */}
                  <ReaderWatermarkOverlay
                    userName={user?.name}
                    userId={user?.id}
                    userIdentifier={user?.email || (user as any)?.phoneNumber}
                    opacity={0.06}
                  />

                  <Page
                    pageNumber={pageNumber}
                    width={containerWidth * scale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading={
                      <div
                        className="w-full rounded-xl bg-slate-100 dark:bg-slate-900 animate-pulse flex items-center justify-center text-xs text-slate-400"
                        style={{ height: `${(containerWidth * scale * 1.4).toFixed(0)}px` }}
                      >
                        Loading page {pageNumber}…
                      </div>
                    }
                  />
                </div>
              );
            })}
        </Document>
      </div>

      {/* Print Suppression CSS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
            display: none !important;
          }
          #pdf-print-guard {
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
          }
        }
      `}</style>
      <div id="pdf-print-guard" className="hidden" aria-hidden="true">
        <div className="space-y-2">
          <h2 className="text-lg font-bold">Protected Material</h2>
          <p className="text-sm text-gray-600">Downloading and printing this document is restricted.</p>
        </div>
      </div>
    </div>
  );
}
