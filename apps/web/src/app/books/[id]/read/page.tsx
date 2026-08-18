'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, PartyPopper, PlayCircle, X, FileText, Layers, ChevronLeft, ChevronRight, Youtube, Music, Shield } from 'lucide-react';
import { Button } from '@psc/ui';
import { useAuth } from '../../../auth-provider';
import { ApiClient } from '@/lib/api-client';
import { BookReaderContent } from '@psc/shared-types';
import { BookReaderSkeleton } from '../../../skeletons/page-skeletons';
import { ReaderAudioPlayer, ReaderAudioPlayerHandle } from './reader-audio-player';
import { ReaderYoutubeEmbed } from './reader-youtube-embed';
import { ReaderProgressSidebar } from './reader-progress-sidebar';
import { useReaderProtection } from './use-reader-protection';
import { flattenChapters, buildChapterSummaries, ReadingUnit } from './reader-types';

const ReaderPdfViewer = dynamic(() => import('./reader-pdf-viewer').then((m) => m.ReaderPdfViewer), {
  ssr: false,
  loading: () => <div className="h-48 rounded-xl bg-slate-100 dark:bg-slate-900 animate-pulse" />,
});

const PROGRESS_SAVE_DEBOUNCE_MS = 1500;
const MANUAL_SCROLL_QUIET_MS = 4000;

function BookReaderContentView({ bookId }: { bookId: string }) {
  const { user, isLoading: authLoading } = useAuth();
  const { isObscured, resumeReading } = useReaderProtection();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoResume = searchParams?.get('resume') === '1';

  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState<BookReaderContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedUnitIndex, setSavedUnitIndex] = useState<number | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);
  const [maxReadIndex, setMaxReadIndex] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [autoPlayVideo, setAutoPlayVideo] = useState(false);

  const unitRefs = useRef<(HTMLElement | null)[]>([]);
  const audioRefs = useRef<Record<number, ReaderAudioPlayerHandle | null>>({});
  const currentlyPlayingIndexRef = useRef<number | null>(null);
  const pendingAutoPlayRef = useRef<number | null>(null);
  const lastManualInteractionRef = useRef(0);
  const ratiosRef = useRef<Map<number, number>>(new Map());
  const hasAutoResumedRef = useRef(false);
  const progressSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Progress is "furthest reached", never the live scroll position — scrolling
  // back to re-read an earlier topic must not undo what's already been read.
  const maxUnitReachedRef = useRef(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/books/${bookId}/read`)}`);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [readerContent, progressRows] = await Promise.all([
          ApiClient.getBookReaderContent(bookId),
          ApiClient.getReadingProgress(bookId).catch(() => []),
        ]);
        if (cancelled) return;
        setContent(readerContent);

        const flatUnits = flattenChapters(readerContent.chapters);
        const progress = progressRows[0];
        let resumeIndex = -1;
        if (progress?.topicId) {
          const found = flatUnits.findIndex((u) => u.kind === 'topic' && u.id === progress.topicId);
          if (found >= 0) resumeIndex = found;
        }
        if (resumeIndex < 0 && progress?.chapterId) {
          const found = flatUnits.findIndex((u) => u.chapterId === progress.chapterId);
          if (found >= 0) resumeIndex = found;
        }
        if (resumeIndex > 0) {
          setSavedUnitIndex(resumeIndex);
          maxUnitReachedRef.current = resumeIndex;
          setMaxReadIndex(resumeIndex);
          // Coming from the dashboard's "Continue Reading" the intent is
          // explicit, so jump straight there; otherwise offer it as a banner
          // and let the reader start at chapter 1 as usual.
          if (!autoResume) setShowResumeBanner(true);
        }
      } catch {
        if (!cancelled) router.replace(`/books/${bookId}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookId, user, authLoading, router, autoResume]);

  const units: ReadingUnit[] = useMemo(() => (content ? flattenChapters(content.chapters) : []), [content]);
  const chapterSummaries = useMemo(() => (content ? buildChapterSummaries(content.chapters, units) : []), [content, units]);

  const jumpToUnit = useCallback((unitIndex: number) => {
    setActiveUnitIndex(unitIndex);
    setAutoPlayVideo(false);
    const newMax = Math.max(maxUnitReachedRef.current, unitIndex);
    setMaxReadIndex(newMax);
    maxUnitReachedRef.current = newMax;
    ApiClient.upsertReadingProgress({
      bookId,
      chapterId: units[unitIndex]?.chapterId,
      topicId: units[unitIndex]?.topicId,
      progressPercent: Math.round(((newMax + 1) / units.length) * 100),
    }).catch(() => {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [bookId, units]);

  // Dashboard "Continue Reading" deep-link: jump once the units have mounted.
  useEffect(() => {
    if (!autoResume || hasAutoResumedRef.current) return;
    if (savedUnitIndex === null || units.length === 0) return;
    hasAutoResumedRef.current = true;
    setActiveUnitIndex(savedUnitIndex);
  }, [autoResume, savedUnitIndex, units.length]);

  // Handle pending autoplay after topic change
  useEffect(() => {
    if (pendingAutoPlayRef.current !== null && pendingAutoPlayRef.current === activeUnitIndex) {
      const target = pendingAutoPlayRef.current;
      pendingAutoPlayRef.current = null;
      const timer = setTimeout(() => {
        audioRefs.current[target]?.play();
        setIsPlayingAudio(true);
        currentlyPlayingIndexRef.current = target;
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeUnitIndex]);

  const handleNextTopic = useCallback(() => {
    if (activeUnitIndex >= units.length - 1) return;
    const nextIdx = activeUnitIndex + 1;
    jumpToUnit(nextIdx);
  }, [activeUnitIndex, units.length, jumpToUnit]);

  const handlePrevTopic = useCallback(() => {
    if (activeUnitIndex <= 0) return;
    const prevIdx = activeUnitIndex - 1;
    setAutoPlayVideo(false);
    setActiveUnitIndex(prevIdx);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeUnitIndex]);

  const handleAudioPlay = useCallback((unitIndex: number) => {
    if (currentlyPlayingIndexRef.current !== null && currentlyPlayingIndexRef.current !== unitIndex) {
      audioRefs.current[currentlyPlayingIndexRef.current]?.pause();
    }
    currentlyPlayingIndexRef.current = unitIndex;
    setIsPlayingAudio(true);
  }, []);

  const handleAudioPause = useCallback((unitIndex: number) => {
    if (currentlyPlayingIndexRef.current === unitIndex) {
      setIsPlayingAudio(false);
    }
  }, []);

  const handleTogglePlayAudio = useCallback((unitIndex: number) => {
    if (activeUnitIndex === unitIndex) {
      if (isPlayingAudio) {
        audioRefs.current[unitIndex]?.pause();
        setIsPlayingAudio(false);
      } else {
        audioRefs.current[unitIndex]?.play();
        setIsPlayingAudio(true);
        currentlyPlayingIndexRef.current = unitIndex;
      }
    } else {
      pendingAutoPlayRef.current = unitIndex;
      jumpToUnit(unitIndex);
    }
  }, [activeUnitIndex, isPlayingAudio, jumpToUnit]);

  const handlePlayYoutubeVideo = useCallback((unitIndex: number) => {
    setAutoPlayVideo(true);
    setActiveUnitIndex(unitIndex);
    const newMax = Math.max(maxUnitReachedRef.current, unitIndex);
    setMaxReadIndex(newMax);
    maxUnitReachedRef.current = newMax;
    ApiClient.upsertReadingProgress({
      bookId,
      chapterId: units[unitIndex]?.chapterId,
      topicId: units[unitIndex]?.topicId,
      progressPercent: Math.round(((newMax + 1) / units.length) * 100),
    }).catch(() => {});
    setTimeout(() => {
      const videoEl = document.getElementById(`youtube-video-${unitIndex}`);
      if (videoEl) {
        videoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Reset autoplay flag so subsequent navigation to any other topic does NOT autoplay
      setAutoPlayVideo(false);
    }, 200);
  }, [bookId, units]);

  const handleAudioEnded = useCallback(
    (unitIndex: number) => {
      if (currentlyPlayingIndexRef.current === unitIndex) {
        currentlyPlayingIndexRef.current = null;
        setIsPlayingAudio(false);
      }
      if (unitIndex < units.length - 1) {
        handleNextTopic();
      }
    },
    [units.length, handleNextTopic],
  );

  const furthestIndex = maxReadIndex;
  const overallPercent = units.length > 0 ? Math.round(((furthestIndex + 1) / units.length) * 100) : 0;
  const activeUnit = units[activeUnitIndex];
  const isFinished = units.length > 0 && furthestIndex >= units.length - 1;

  if (!mounted || authLoading || loading) {
    return <BookReaderSkeleton />;
  }

  if (!content) return null;

  return (
    <div className="pb-16">
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 max-w-3xl space-y-6">
          {/* Sticky header aligned with reading content column */}
          <div className="sticky top-[72px] z-20 px-3 sm:px-5 py-2.5 bg-white/95 dark:bg-[#050a17]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href={`/books/${bookId}`}
                  className="inline-flex items-center space-x-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Back to Book"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back</span>
                </Link>

                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    type="button"
                    disabled={activeUnitIndex <= 0}
                    onClick={handlePrevTopic}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-500 hover:bg-cyan-500/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Previous Topic"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={activeUnitIndex >= units.length - 1}
                    onClick={handleNextTopic}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-500 hover:bg-cyan-500/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Next Topic"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="min-w-0 flex-1 text-center px-2">
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-extrabold text-cyan-600 dark:text-cyan-400 truncate">
                  <BookOpen className="w-3 h-3 shrink-0" />
                  <span className="truncate">{content.book.title}</span>
                </div>
                {activeUnit ? (
                  <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                    Chapter {activeUnit.chapterNumber} · {activeUnit.title}
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">{content.book.title}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isFinished && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                <span className="text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 tabular-nums">
                  {overallPercent}%
                </span>
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isFinished ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                }`}
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>

          {/* Book Title Banner Card */}
          <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-slate-200/80 dark:border-[#1e2e56] bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-[#0c152e] dark:via-[#091124] dark:to-[#0c152e] shadow-xs">
            {content.book.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={content.book.coverUrl}
                alt={content.book.title}
                className="w-12 h-16 rounded-xl object-cover object-top border border-slate-200/90 dark:border-[#1e2e56] shadow-sm shrink-0"
              />
            ) : (
              <div className="w-12 h-16 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  {content.book.category}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">by {content.book.author}</span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug mt-1">
                {content.book.title}
              </h1>
            </div>
          </div>

          {/* Resume banner */}
          {showResumeBanner && savedUnitIndex !== null && units[savedUnitIndex] && savedUnitIndex !== activeUnitIndex && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 dark:bg-cyan-500/[0.07]">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-500 shrink-0">
                <PlayCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-slate-900 dark:text-white">Pick up where you left off</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Chapter {units[savedUnitIndex].chapterNumber} · {units[savedUnitIndex].title}
                </p>
              </div>
              <Button
                variant="gold"
                size="sm"
                className="font-bold shrink-0"
                onClick={() => {
                  jumpToUnit(savedUnitIndex);
                  setShowResumeBanner(false);
                }}
              >
                Resume
              </Button>
              <button
                type="button"
                onClick={() => setShowResumeBanner(false)}
                className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {units.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Content Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                This book doesn&apos;t have any chapters published yet. Check back soon.
              </p>
            </div>
          ) : activeUnit ? (
            <div className="space-y-6">
              {/* Chapter Header */}
              <div className="flex items-center gap-3 pt-2">
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs font-black flex items-center justify-center shadow-md shadow-cyan-500/20">
                    {activeUnit.chapterNumber}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Chapter {activeUnit.chapterNumber}</p>
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">
                      {activeUnit.chapterTitle}
                    </h2>
                  </div>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-[#1e2e56] to-transparent" />
              </div>

              {/* Single Active Unit Content Card — only 1 PDF loaded in memory! */}
              <section className={`rounded-2xl border bg-white dark:bg-[#091124] p-4 sm:p-6 space-y-4 border-cyan-500/40 shadow-sm ${
                activeUnit.kind === 'subtopic' ? 'ml-3 sm:ml-6' : ''
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span
                      className={`mt-0.5 shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                        activeUnit.kind === 'subtopic'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                      }`}
                    >
                      {activeUnit.kind === 'subtopic' ? <Layers className="w-3 h-3" /> : activeUnit.topicNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {activeUnit.kind === 'subtopic' && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sub-topic</span>
                        )}
                        <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug">
                          {activeUnit.title}
                        </h3>
                      </div>
                      {activeUnit.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{activeUnit.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Topic Media Badges */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {activeUnit.youtubeUrl && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <Youtube className="w-3 h-3" /> Video Lesson
                      </span>
                    )}
                    {activeUnit.audioUrl && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                        <Music className="w-3 h-3" /> Audio
                      </span>
                    )}
                    {activeUnit.pdfUrl && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <FileText className="w-3 h-3" /> PDF Notes
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-5 pt-2">
                  {activeUnit.audioUrl && (
                    <ReaderAudioPlayer
                      ref={(handle) => {
                        audioRefs.current[activeUnitIndex] = handle;
                      }}
                      src={activeUnit.audioUrl}
                      topicTitle={activeUnit.title}
                      chapterTitle={`Chapter ${activeUnit.chapterNumber} · ${activeUnit.chapterTitle}`}
                      onPlay={() => handleAudioPlay(activeUnitIndex)}
                      onPause={() => handleAudioPause(activeUnitIndex)}
                      onEnded={() => handleAudioEnded(activeUnitIndex)}
                    />
                  )}

                  {activeUnit.youtubeUrl && (
                    <ReaderYoutubeEmbed
                      key={activeUnit.youtubeUrl}
                      id={`youtube-video-${activeUnitIndex}`}
                      url={activeUnit.youtubeUrl}
                      title={activeUnit.title}
                      autoPlay={autoPlayVideo}
                    />
                  )}

                  {activeUnit.pdfUrl && (
                    <ReaderPdfViewer
                      key={activeUnit.pdfUrl}
                      url={activeUnit.pdfUrl}
                      user={user}
                    />
                  )}

                  {!activeUnit.audioUrl && !activeUnit.youtubeUrl && !activeUnit.pdfUrl && (
                    <div className="flex items-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-400">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span>No content uploaded for this topic yet.</span>
                    </div>
                  )}

                  {/* Linear Step-by-Step Bottom Navigation Controls */}
                  <div className="pt-6 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
                    {activeUnitIndex > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handlePrevTopic}
                        className="inline-flex items-center gap-1.5 font-bold cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="truncate max-w-[140px] sm:max-w-[220px]">Prev: {units[activeUnitIndex - 1]?.title}</span>
                      </Button>
                    ) : <div />}

                    {activeUnitIndex < units.length - 1 ? (
                      <Button
                        type="button"
                        variant="gold"
                        size="sm"
                        onClick={handleNextTopic}
                        className="inline-flex items-center gap-1.5 font-black ml-auto cursor-pointer shadow-md shadow-amber-500/20"
                      >
                        <span className="truncate max-w-[140px] sm:max-w-[220px]">Next: {units[activeUnitIndex + 1]?.title}</span>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    ) : (
                      <div className="ml-auto flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" /> You have reached the end of this book!
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {/* End-of-book completion card */}
          {isFinished && units.length > 0 && activeUnitIndex >= units.length - 1 && (
            <div className="flex flex-col items-center text-center gap-3 p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/[0.07]">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-500">
                <PartyPopper className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">Book Completed!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  You&apos;ve reached the end of {content.book.title}.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button variant="outline" size="sm" className="font-bold" onClick={() => jumpToUnit(0)}>
                  Back to Start
                </Button>
                <Link href="/books">
                  <Button variant="gold" size="sm" className="font-bold">
                    Browse More Books
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {units.length > 0 && (
          <ReaderProgressSidebar
            bookTitle={content.book.title}
            chapters={chapterSummaries}
            activeUnitIndex={activeUnitIndex}
            totalUnits={units.length}
            playingUnitIndex={currentlyPlayingIndexRef.current}
            isPlayingAudio={isPlayingAudio}
            onJumpToUnit={jumpToUnit}
            onTogglePlayAudio={handleTogglePlayAudio}
            onPlayYoutubeVideo={handlePlayYoutubeVideo}
          />
        )}
      </div>

      {/* Focus & Screenshot Deterrence Blur Shield */}
      {isObscured && (
        <div
          onClick={resumeReading}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 cursor-pointer select-none animate-in fade-in duration-200"
          title="Click to resume reading"
        >
          <div className="max-w-sm p-6 rounded-2xl border border-cyan-500/30 bg-[#070e22]/95 shadow-2xl space-y-3.5">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
              <Shield className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-white">Reading Session Paused</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Protected eBook material is shielded while the window is in the background.
              </p>
            </div>
            <button
              type="button"
              onClick={resumeReading}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Click to Resume Reading
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookReaderPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<BookReaderSkeleton />}>
      <BookReaderContentView bookId={params.id} />
    </Suspense>
  );
}
