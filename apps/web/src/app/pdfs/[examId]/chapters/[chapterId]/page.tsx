'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, Skeleton } from '@psc/ui';
import { ArrowLeft, ExternalLink, FileText, X } from 'lucide-react';
import type { PdfDocument } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';

function formatFileSize(bytes?: number | null): string | null {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function ChapterPdfsPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params?.examId as string;
  const chapterId = params?.chapterId as string;
  const { user, isLoading: authLoading } = useAuth();

  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [chapterTitle, setChapterTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<PdfDocument | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/pdfs/${examId}/chapters/${chapterId}`)}`);
    }
  }, [user, authLoading, router, examId, chapterId]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [items, chapter] = await Promise.all([
        ApiClient.getPdfDocuments(chapterId),
        ApiClient.getPdfChapter(chapterId).catch(() => null),
      ]);
      setDocuments([...items].sort((a, b) => a.orderIndex - b.orderIndex));
      if (chapter) setChapterTitle(chapter.title);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load PDFs.');
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  useEffect(() => {
    if (user && chapterId) load();
  }, [user, chapterId, load]);

  useEffect(() => {
    if (!viewing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewing(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewing]);

  if (authLoading || !user) {
    return <PdfListSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-8 py-2 sm:py-4 px-1 sm:px-0">
      <div className="space-y-2">
        <Link
          href={`/pdfs/${examId}`}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Chapters</span>
        </Link>
        <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {chapterTitle || 'PDFs'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
          Tap a document to read it here, or open it in a new tab.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
          {error}
        </div>
      )}

      {loading ? (
        <PdfListSkeleton />
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No PDFs Yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
              No study material has been published in this chapter yet. Check back soon.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {documents.map((document) => {
            const size = formatFileSize(document.fileSizeBytes);
            return (
              <button key={document.id} type="button" onClick={() => setViewing(document)} className="text-left">
                <Card hoverEffect className="flex items-center gap-3 p-4 h-full">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-inner">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                      {document.title}
                    </h3>
                    {document.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {document.description}
                      </p>
                    )}
                    <p className="text-[11px] font-bold text-slate-400 mt-1 font-mono">
                      PDF{size ? ` · ${size}` : ''}
                    </p>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {viewing?.fileUrl && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-sm p-3 sm:p-6 !mt-0"
          role="dialog"
          aria-modal="true"
          aria-label={viewing.title}
        >
          <div className="flex items-start justify-between gap-3 pb-3 shrink-0">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-white truncate">{viewing.title}</h2>
              <a
                href={viewing.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:underline mt-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in a new tab</span>
              </a>
            </div>
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="p-2 rounded-xl border border-white/20 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-label="Close PDF"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/*
            The browser's own PDF viewer handles paging, zoom, and search for
            free. Mobile Safari and some in-app browsers refuse to render a PDF
            in a frame, which is why the "open in a new tab" link above is
            always present rather than only a fallback.
          */}
          <iframe
            key={viewing.id}
            src={viewing.fileUrl}
            title={viewing.title}
            className="flex-1 min-h-0 w-full rounded-2xl bg-white shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}

function PdfListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
      {Array.from({ length: 6 }).map((_, idx) => (
        <Skeleton key={idx} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}
