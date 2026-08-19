'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Skeleton } from '@psc/ui';
import { ArrowLeft, ChevronRight, FolderOpen } from 'lucide-react';
import { useAuth } from './auth-provider';

export interface BrowsableFolder {
  id: string;
  title: string;
  description?: string | null;
  orderIndex: number;
}

export interface LibraryFolderGridProps {
  heading: string;
  subheading: string;
  /** Plural noun for the empty state, e.g. "exams" or "chapters". */
  nounPlural: string;
  /** Where an unauthenticated visitor is sent back to after logging in. */
  loginRedirect: string;
  backHref?: string;
  backLabel?: string;
  fetchFolders: () => Promise<BrowsableFolder[]>;
  getChildHref: (folder: BrowsableFolder) => string;
  /** What the folder holds, e.g. "12 videos" — shown on the card. */
  getSummary?: (folder: BrowsableFolder) => string | null;
  /** Tailwind classes for the folder icon tile, so videos and PDFs read differently at a glance. */
  accentClassName?: string;
}

/**
 * Student-facing folder browser, shared by the video and PDF libraries at both
 * the exam and chapter levels. The two libraries are separate modules with
 * separate data; only this presentation is common.
 */
export function LibraryFolderGrid({
  heading,
  subheading,
  nounPlural,
  loginRedirect,
  backHref,
  backLabel,
  fetchFolders,
  getChildHref,
  getSummary,
  accentClassName = 'bg-cyan-500/10 border-cyan-500/20 text-cyan-500',
}: LibraryFolderGridProps) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [folders, setFolders] = useState<BrowsableFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(loginRedirect)}`);
    }
  }, [user, authLoading, router, loginRedirect]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchFolders();
      const nonEmptyFolders = (data || []).filter((folder: any) => {
        if (typeof folder.documentCount === 'number' && folder.documentCount === 0) return false;
        if (typeof folder.videoCount === 'number' && folder.videoCount === 0) return false;
        if (typeof folder.quizCount === 'number' && folder.quizCount === 0) return false;
        if (typeof folder.itemCount === 'number' && folder.itemCount === 0) return false;
        return true;
      });
      setFolders([...nonEmptyFolders].sort((a, b) => a.orderIndex - b.orderIndex));
      setError('');
    } catch (err: any) {
      setError(err.message || `Failed to load ${nounPlural}.`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Every endpoint here needs a bearer token, so loading is deferred until
    // the restored session is known — otherwise the first request 401s.
    if (user) load();
  }, [user, load]);

  if (authLoading || !user) {
    return <LibraryFolderGridSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-8 py-2 sm:py-4 px-1 sm:px-0">
      <div className="space-y-2">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </Link>
        )}
        <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">{heading}</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">{subheading}</p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
          {error}
        </div>
      )}

      {loading ? (
        <LibraryFolderGridSkeleton />
      ) : folders.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Nothing Here Yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
              No {nounPlural} have been published yet. Check back soon.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {folders.map((folder) => {
            const summary = getSummary?.(folder);
            return (
              <Link key={folder.id} href={getChildHref(folder)}>
                <Card hoverEffect className="flex items-center gap-3 p-4 sm:p-5 h-full">
                  <div
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-inner ${accentClassName}`}
                  >
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                      {folder.title}
                    </h3>
                    {folder.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {folder.description}
                      </p>
                    )}
                    {summary && (
                      <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-1">{summary}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LibraryFolderGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
      {Array.from({ length: 6 }).map((_, idx) => (
        <Skeleton key={idx} className="h-24 w-full rounded-2xl" />
      ))}
    </div>
  );
}
