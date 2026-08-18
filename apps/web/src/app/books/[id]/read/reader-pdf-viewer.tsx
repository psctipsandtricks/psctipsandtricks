'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileWarning, Loader2, FileText } from 'lucide-react';
import { ReaderWatermarkOverlay } from './reader-watermark-overlay';

// A plain static path, not `new URL(..., import.meta.url)`: that pattern makes
// webpack emit the worker as a build asset and then run it through Terser during
// production builds, which fails on the worker's `import.meta` usage. The file
// itself is copied into public/ at install/build time — see scripts/copy-pdf-worker.js.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface ReaderPdfViewerProps {
  url: string;
  user?: { id?: string; name?: string; email?: string; phone?: string } | null;
  onLoadSuccess?: (numPages: number) => void;
}

export function ReaderPdfViewer({ url, user, onLoadSuccess }: ReaderPdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(700);
  const [retryCount, setRetryCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(Math.min(760, el.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="space-y-3 select-none print:hidden scroll-mt-24"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-1.5 pb-1 text-xs font-bold text-amber-600 dark:text-amber-400">
        <FileText className="w-4 h-4" />
        <span>PDF Notes {numPages ? `(${numPages} pages)` : ''}</span>
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
          onLoadSuccess?.(n);
        }}
      >
        {numPages &&
          Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
            <div
              key={pageNumber}
              className="relative rounded-lg overflow-hidden mx-auto select-none ring-1 ring-slate-200 dark:ring-[#1e2e56]"
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
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={
                  <div className="h-48 rounded-lg bg-slate-100 dark:bg-slate-900 animate-pulse flex items-center justify-center text-xs text-slate-400">
                    Loading page {pageNumber}…
                  </div>
                }
              />
            </div>
          ))}
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
