'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, PartyPopper, PlayCircle, X, FileText, Layers, ChevronLeft, ChevronRight, Youtube, Music, Volume2 } from 'lucide-react';
import { Button } from '@psc/ui';
import { useAuth } from '../../../auth-provider';
import { ApiClient } from '@/lib/api-client';
import { BookReaderContent } from '@psc/shared-types';
import { BookReaderSkeleton } from '../../../skeletons/page-skeletons';
import { ReaderAudioPlayer, ReaderAudioPlayerHandle } from './reader-audio-player';
import { ReaderYoutubeEmbed } from './reader-youtube-embed';
import { ReaderProgressSidebar } from './reader-progress-sidebar';
import { flattenChapters, buildChapterSummaries, ReadingUnit } from './reader-types';
import { ReaderPdfViewerHandle } from './reader-pdf-viewer';
import {
  EMPTY_SYNC_MAP,
  normalizeSyncMap,
  resolvePageAtTime,
  resolveTargetAtTime,
  targetForCue,
  hasCues,
} from './pdf-audio-sync';
import { PdfSyncMap } from '@psc/shared-types';

const ReaderPdfViewer = dynamic(() => import('./reader-pdf-viewer').then((m) => m.ReaderPdfViewer), {
  ssr: false,
  loading: () => <div className="h-48 rounded-xl bg-slate-100 dark:bg-slate-900 animate-pulse" />,
});

const PROGRESS_SAVE_DEBOUNCE_MS = 1500;
const MANUAL_SCROLL_QUIET_MS = 3000;

/** Per-user, per-unit overrides of the library's authored sync map. */
function getSyncStorageKey(userId: string, unitId: string): string {
  return `psc_reader_sync_${userId}_${unitId}`;
}

/** Whether Auto-Scroll is on, remembered per reader rather than per topic. */
function getAutoScrollStorageKey(userId: string): string {
  return `psc_reader_autoscroll_${userId}`;
}

interface DetailedReadingPosition {
  unitIndex: number;
  chapterId: string;
  topicId: string;
  pdfPage: number;
  scrollY: number;
  scrollRatio: number;
  audioCurrentTime: number;
  audioDuration: number;
  timestamp: number;
}

function getStorageKey(userId: string, bookId: string): string {
  return `psc_reader_pos_${userId}_${bookId}`;
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function BookReaderContentView({ bookId }: { bookId: string }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoResume = searchParams?.get('resume') === '1';

  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState<BookReaderContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedUnitIndex, setSavedUnitIndex] = useState<number | null>(null);
  const [savedPosition, setSavedPosition] = useState<DetailedReadingPosition | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);
  const [maxReadIndex, setMaxReadIndex] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [autoPlayVideo, setAutoPlayVideo] = useState(false);
  const [currentAudioProgress, setCurrentAudioProgress] = useState<number>(0);

  const [initialAudioTime, setInitialAudioTime] = useState<number>(0);
  const [initialPdfPage, setInitialPdfPage] = useState<number>(1);

  // --- PDF ↔ audio synchronization -----------------------------------------
  const [syncMap, setSyncMap] = useState<PdfSyncMap>(EMPTY_SYNC_MAP);
  const [audioTimeMs, setAudioTimeMs] = useState(0);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  // Off until asked for: a page that starts moving on its own the moment
  // narration begins takes the reading position away from the reader before
  // they have decided they want that. A stored preference is read below and
  // wins over this, and only the toggle ever writes one.
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false);
  const [manualLatched, setManualLatched] = useState(false);
  const [pdfNumPages, setPdfNumPages] = useState(0);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const syncMapRef = useRef<PdfSyncMap>(EMPTY_SYNC_MAP);

  useEffect(() => {
    syncMapRef.current = syncMap;
  }, [syncMap]);

  /// How tall the reader's own sticky header is, so the PDF toolbar can stick
  /// directly beneath it. Measured rather than hard-coded: the header's height
  /// moves with the topic title's font metrics and the browser's text size, and
  /// a stale constant would leave the toolbar either floating in a gap or
  /// tucked behind the header.
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
  const headerObserverRef = useRef<ResizeObserver | null>(null);

  // A callback ref, not an effect: the header does not exist on the first
  // render (the skeleton is up), so an effect keyed on mount would measure null.
  const measureStickyHeader = useCallback((node: HTMLDivElement | null) => {
    headerObserverRef.current?.disconnect();
    headerObserverRef.current = null;
    if (!node) return;
    const sync = () => setStickyHeaderHeight(node.getBoundingClientRect().height);
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    headerObserverRef.current = observer;
    sync();
  }, []);

  useEffect(() => () => headerObserverRef.current?.disconnect(), []);

  const audioRefs = useRef<Record<number, ReaderAudioPlayerHandle | null>>({});
  const pdfViewerRef = useRef<ReaderPdfViewerHandle | null>(null);
  const currentlyPlayingIndexRef = useRef<number | null>(null);
  const pendingAutoPlayRef = useRef<number | null>(null);
  const lastManualInteractionRef = useRef(0);
  const hasAutoResumedRef = useRef(false);
  const progressSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxUnitReachedRef = useRef(0);

  const currentAudioTimeRef = useRef(0);
  const currentAudioDurationRef = useRef(0);
  const activePdfPageRef = useRef(1);
  const activeScrollRatioRef = useRef(0);
  const activeUnitIndexRef = useRef(0);

  useEffect(() => {
    activeUnitIndexRef.current = activeUnitIndex;
  }, [activeUnitIndex]);

  useEffect(() => setMounted(true), []);

  const units: ReadingUnit[] = useMemo(() => (content ? flattenChapters(content.chapters) : []), [content]);
  const chapterSummaries = useMemo(() => (content ? buildChapterSummaries(content.chapters, units) : []), [content, units]);

  // Synchronous Save to Local Storage and Debounced Backend Sync
  const savePosition = useCallback(() => {
    if (!user || units.length === 0) return;
    const currentIdx = activeUnitIndexRef.current;
    const currentUnit = units[currentIdx];
    if (!currentUnit) return;

    const audioPlayer = audioRefs.current[currentIdx];
    const audioCurrentTime = audioPlayer ? audioPlayer.getCurrentTime() : currentAudioTimeRef.current;
    const audioDuration = audioPlayer ? audioPlayer.getDuration() : currentAudioDurationRef.current;

    const pos: DetailedReadingPosition = {
      unitIndex: currentIdx,
      chapterId: currentUnit.chapterId,
      topicId: currentUnit.topicId,
      pdfPage: pdfViewerRef.current ? pdfViewerRef.current.getCurrentPage() : activePdfPageRef.current,
      scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
      scrollRatio: activeScrollRatioRef.current,
      audioCurrentTime: Math.max(0, audioCurrentTime || 0),
      audioDuration: Math.max(0, audioDuration || 0),
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(getStorageKey(user.id, bookId), JSON.stringify(pos));
    } catch {}

    // Debounced Backend Progress Update
    if (progressSaveTimerRef.current) clearTimeout(progressSaveTimerRef.current);
    progressSaveTimerRef.current = setTimeout(() => {
      const newMax = Math.max(maxUnitReachedRef.current, currentIdx);
      ApiClient.upsertReadingProgress({
        bookId,
        chapterId: currentUnit.chapterId,
        topicId: currentUnit.topicId,
        progressPercent: Math.round(((newMax + 1) / units.length) * 100),
      }).catch(() => {});
    }, PROGRESS_SAVE_DEBOUNCE_MS);
  }, [user, bookId, units]);

  // Track direct user manual gestures (wheel, touch, pointer, keys) so programmatic scroll is never blocked
  useEffect(() => {
    const handleUserGesture = () => {
      lastManualInteractionRef.current = Date.now();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
        lastManualInteractionRef.current = Date.now();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        savePosition();
      }
    };
    const handleBeforeUnload = () => {
      savePosition();
    };

    window.addEventListener('wheel', handleUserGesture, { passive: true });
    window.addEventListener('touchmove', handleUserGesture, { passive: true });
    window.addEventListener('pointerdown', handleUserGesture, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('wheel', handleUserGesture);
      window.removeEventListener('touchmove', handleUserGesture);
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [savePosition]);

  // Load Book Content and Restore Exact Reading Position
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

        // 1. Check local storage for high-precision exact position (page + scroll + audio time)
        let detailedPos: DetailedReadingPosition | null = null;
        try {
          const raw = localStorage.getItem(getStorageKey(user.id, bookId));
          if (raw) {
            detailedPos = JSON.parse(raw);
          }
        } catch {}

        let resumeIndex = -1;
        if (detailedPos && detailedPos.unitIndex >= 0 && detailedPos.unitIndex < flatUnits.length) {
          resumeIndex = detailedPos.unitIndex;
          setSavedPosition(detailedPos);
        } else if (progress?.topicId) {
          const found = flatUnits.findIndex((u) => u.kind === 'topic' && u.id === progress.topicId);
          if (found >= 0) resumeIndex = found;
        } else if (progress?.chapterId) {
          const found = flatUnits.findIndex((u) => u.chapterId === progress.chapterId);
          if (found >= 0) resumeIndex = found;
        }

        if (resumeIndex >= 0) {
          setSavedUnitIndex(resumeIndex);
          maxUnitReachedRef.current = resumeIndex;
          setMaxReadIndex(resumeIndex);

          if (autoResume) {
            hasAutoResumedRef.current = true;
            setActiveUnitIndex(resumeIndex);
            if (detailedPos) {
              setInitialAudioTime(detailedPos.audioCurrentTime || 0);
              setInitialPdfPage(detailedPos.pdfPage || 1);
              currentAudioTimeRef.current = detailedPos.audioCurrentTime || 0;
              activePdfPageRef.current = detailedPos.pdfPage || 1;
              if (detailedPos.scrollY > 0) {
                setTimeout(() => {
                  window.scrollTo({ top: detailedPos.scrollY, behavior: 'smooth' });
                }, 300);
              }
            }
          } else if (resumeIndex > 0 || (detailedPos && (detailedPos.pdfPage > 1 || detailedPos.audioCurrentTime > 5))) {
            setShowResumeBanner(true);
          }
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

  const jumpToUnit = useCallback((unitIndex: number, restoreExact = false) => {
    savePosition();
    setActiveUnitIndex(unitIndex);
    setAutoPlayVideo(false);
    const newMax = Math.max(maxUnitReachedRef.current, unitIndex);
    setMaxReadIndex(newMax);
    maxUnitReachedRef.current = newMax;

    if (!restoreExact) {
      setInitialAudioTime(0);
      setInitialPdfPage(1);
      setCurrentAudioProgress(0);
      currentAudioTimeRef.current = 0;
      activePdfPageRef.current = 1;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    ApiClient.upsertReadingProgress({
      bookId,
      chapterId: units[unitIndex]?.chapterId,
      topicId: units[unitIndex]?.topicId,
      progressPercent: Math.round(((newMax + 1) / units.length) * 100),
    }).catch(() => {});
  }, [bookId, units, savePosition]);

  // Apply Resume Action when User Clicks Resume Banner
  const handleResumeClick = useCallback(() => {
    if (savedUnitIndex === null || !units[savedUnitIndex]) return;
    setShowResumeBanner(false);

    if (savedPosition && savedPosition.unitIndex === savedUnitIndex) {
      setInitialAudioTime(savedPosition.audioCurrentTime || 0);
      setInitialPdfPage(savedPosition.pdfPage || 1);
      currentAudioTimeRef.current = savedPosition.audioCurrentTime || 0;
      activePdfPageRef.current = savedPosition.pdfPage || 1;
      jumpToUnit(savedUnitIndex, true);
      if (savedPosition.scrollY > 0) {
        setTimeout(() => {
          window.scrollTo({ top: savedPosition.scrollY, behavior: 'smooth' });
        }, 200);
      }
    } else {
      jumpToUnit(savedUnitIndex);
    }
  }, [savedUnitIndex, units, savedPosition, jumpToUnit]);

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
    setInitialAudioTime(0);
    setInitialPdfPage(1);
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
    savePosition();
  }, [savePosition]);

  // Synchronize PDF auto-scroll with audio playback time update
  const handleAudioTimeUpdate = useCallback((currentTime: number, duration: number) => {
    currentAudioTimeRef.current = currentTime;
    currentAudioDurationRef.current = duration;

    if (duration > 0) {
      const ratio = currentTime / duration;
      setCurrentAudioProgress(ratio);
    }
  }, []);

  /**
   * Millisecond playhead — the only input to cue resolution. Page turns are
   * derived from this in render, so pause/resume/seek all stay consistent
   * without any extra bookkeeping: the same time always yields the same page.
   */
  const handleAudioTimeUpdateMs = useCallback((ms: number, durationMs: number) => {
    setAudioTimeMs(ms);
    if (durationMs > 0) setAudioDurationMs(durationMs);
  }, []);

  // Seeking only moves the audio; the cue map decides the page from the new
  // playhead, so there is nothing to scroll imperatively here.
  const handleAudioSeek = useCallback((seekTime: number, duration: number) => {
    currentAudioTimeRef.current = seekTime;
    currentAudioDurationRef.current = duration;
    if (duration > 0) {
      setCurrentAudioProgress(seekTime / duration);
    }
    savePosition();
  }, [savePosition]);

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

  const handlePdfPageChange = useCallback((pageNumber: number, numPages: number) => {
    activePdfPageRef.current = pageNumber;
    activeScrollRatioRef.current = numPages > 0 ? pageNumber / numPages : 0;
    setPdfCurrentPage(pageNumber);
  }, []);

  const handlePdfScrollPositionChange = useCallback((pageNumber: number, scrollRatio: number) => {
    activePdfPageRef.current = pageNumber;
    activeScrollRatioRef.current = scrollRatio;
    setPdfCurrentPage(pageNumber);
  }, []);

  const activeUnitForSync = units[activeUnitIndex];
  const activeUnitId = activeUnitForSync?.id;

  /**
   * Load the timing map for the unit being read: the reader's own saved
   * correction wins over the library's authored map, so a student who fixed a
   * drift keeps their fix even after staff publish an update.
   */
  useEffect(() => {
    if (!activeUnitId) return;
    setManualLatched(false);

    const authored = normalizeSyncMap(activeUnitForSync?.syncCues ?? null);
    let chosen = authored;

    if (user) {
      try {
        const raw = localStorage.getItem(getSyncStorageKey(user.id, activeUnitId));
        if (raw) {
          const local = normalizeSyncMap(JSON.parse(raw));
          if (hasCues(local) || local.offsetMs !== 0) chosen = local;
        }
      } catch {}
    }
    setSyncMap(chosen);
  }, [activeUnitId, activeUnitForSync?.syncCues, user]);

  // Restore the Auto-Scroll preference once per reader.
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(getAutoScrollStorageKey(user.id));
      if (raw !== null) setAutoScrollEnabled(raw === '1');
    } catch {}
  }, [user]);

  const handleAutoScrollChange = useCallback((enabled: boolean) => {
    setAutoScrollEnabled(enabled);
    // Turning Auto-Scroll back on is itself the "follow the audio again"
    // instruction, so it clears any latched manual page choice.
    if (enabled) setManualLatched(false);
    if (user) {
      try {
        localStorage.setItem(getAutoScrollStorageKey(user.id), enabled ? '1' : '0');
      } catch {}
    }
  }, [user]);

  /** Page the cue map calls for right now — null means "hold position". */
  const resolvedSyncPage = useMemo(
    () => resolvePageAtTime(syncMap, audioTimeMs),
    [syncMap, audioTimeMs],
  );

  /**
   * Which cue the audio is inside. A number rather than the target itself, so
   * the memo below only produces a new object when the cue actually changes —
   * handing the viewer a fresh target on every timeupdate would have it
   * re-evaluating scroll sixty times a minute for nothing.
   */
  const activeCueIndex = useMemo(
    () => resolveTargetAtTime(syncMap, audioTimeMs)?.cueIndex ?? null,
    [syncMap, audioTimeMs],
  );

  /** Page *and region* the cue map points at, for region-level following. */
  const resolvedSyncTarget = useMemo(
    () => targetForCue(syncMap, activeCueIndex),
    [syncMap, activeCueIndex],
  );

  /** Continuous audio progress ratio (0.0 to 1.0) */
  const audioProgress = useMemo(() => {
    if (audioDurationMs > 0) {
      return Math.max(0, Math.min(1, audioTimeMs / audioDurationMs));
    }
    return 0;
  }, [audioTimeMs, audioDurationMs]);

  /** Persist locally on every edit so a refresh never loses hand-tuned timing. */
  const persistSyncLocally = useCallback((map: PdfSyncMap) => {
    if (!user || !activeUnitId) return;
    try {
      localStorage.setItem(getSyncStorageKey(user.id, activeUnitId), JSON.stringify(map));
    } catch {}
  }, [user, activeUnitId]);

  const furthestIndex = maxReadIndex;
  const overallPercent = units.length > 0 ? Math.round(((furthestIndex + 1) / units.length) * 100) : 0;
  const activeUnit = units[activeUnitIndex];
  const isFinished = units.length > 0 && furthestIndex >= units.length - 1;

  if (!mounted || authLoading || loading) {
    return <BookReaderSkeleton />;
  }

  if (!content) return null;

  return (
    <div
      className="pb-16 w-full"
      style={
        {
          // Where anything else that wants to stick below the header should sit:
          // the header's own `top-3` inset, its measured height, then a gap.
          '--reader-sticky-top': `calc(0.75rem + ${stickyHeaderHeight}px + 0.5rem)`,
        } as React.CSSProperties
      }
    >
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* Left-most Chapters & Lessons Sidebar */}
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

        {/* Main Content & PDF Area taking all remaining width */}
        <div className="flex-1 min-w-0 w-full space-y-4 sm:space-y-6">
          {/* Sticky header aligned with reading content column at the top of the viewport */}
          <div ref={measureStickyHeader} className="sticky top-1 sm:top-3 z-30 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-white/95 dark:bg-[#050a17]/95 backdrop-blur-xl border border-slate-200/90 dark:border-[#1e2e56] rounded-2xl shadow-md">
            <div className="flex items-center justify-between gap-1.5 sm:gap-3">
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <Link
                  href={`/books/${bookId}`}
                  className="inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold text-white transition-all cursor-pointer p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border border-cyan-500/40 active:scale-95 shadow-sm shadow-cyan-500/25"
                  title="Back to Book Details"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back</span>
                </Link>

                <div className="flex items-center gap-0.5 ml-0.5">
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

              <div className="min-w-0 flex-1 text-center px-1 sm:px-2">
                <div className="hidden sm:flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-extrabold text-cyan-600 dark:text-cyan-400 truncate">
                  <BookOpen className="w-3 h-3 shrink-0" />
                  <span className="truncate">{content.book.title}</span>
                </div>
                {activeUnit ? (
                  <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                    Ch {activeUnit.chapterNumber} · {activeUnit.title}
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">{content.book.title}</p>
                )}
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {isFinished && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                <span className="text-[10px] sm:text-[11px] font-mono font-extrabold px-1.5 sm:px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 tabular-nums">
                  {overallPercent}%
                </span>
              </div>
            </div>
            <div className="mt-1 sm:mt-1.5 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
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
                className="w-24 h-16 sm:w-28 sm:h-18 rounded-xl object-cover object-center border border-slate-200/90 dark:border-[#1e2e56] shadow-sm shrink-0"
              />
            ) : (
              <div className="w-24 h-16 sm:w-28 sm:h-18 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col items-center justify-center text-cyan-400 shrink-0">
                <BookOpen className="w-5 h-5 opacity-60" />
                <span className="text-[8px] font-mono text-slate-400 mt-1">No Cover</span>
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
            <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 dark:bg-cyan-500/[0.07] shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-500 shrink-0">
                <PlayCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Pick up where you left off</span>
                </p>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  <span className="font-bold text-cyan-600 dark:text-cyan-400 truncate max-w-[200px]">
                    Ch {units[savedUnitIndex].chapterNumber} · {units[savedUnitIndex].title}
                  </span>
                  {savedPosition && savedPosition.pdfPage > 1 && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono text-[10px] font-bold">
                      <FileText className="w-2.5 h-2.5" />
                      Page {savedPosition.pdfPage}
                    </span>
                  )}
                  {savedPosition && savedPosition.audioCurrentTime > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-mono text-[10px] font-bold">
                      <Volume2 className="w-2.5 h-2.5" />
                      {formatAudioTime(savedPosition.audioCurrentTime)}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="gold"
                size="sm"
                className="font-black shrink-0 shadow-md shadow-amber-500/20 cursor-pointer"
                onClick={handleResumeClick}
              >
                Resume Book
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
                      key={`audio-${activeUnit.id}`}
                      ref={(handle) => {
                        audioRefs.current[activeUnitIndex] = handle;
                      }}
                      src={activeUnit.audioUrl}
                      topicTitle={activeUnit.title}
                      chapterTitle={`Chapter ${activeUnit.chapterNumber} · ${activeUnit.chapterTitle}`}
                      initialTime={initialAudioTime}
                      onPlay={() => handleAudioPlay(activeUnitIndex)}
                      onPause={() => handleAudioPause(activeUnitIndex)}
                      onTimeUpdate={handleAudioTimeUpdate}
                      onTimeUpdateMs={handleAudioTimeUpdateMs}
                      onSeek={handleAudioSeek}
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
                      key={`pdf-${activeUnit.id}`}
                      ref={pdfViewerRef}
                      url={activeUnit.pdfUrl}
                      user={user}
                      initialPage={initialPdfPage}
                      isAudioPlaying={isPlayingAudio}
                      audioProgress={audioProgress}
                      syncPage={resolvedSyncPage}
                      syncTarget={resolvedSyncTarget}
                      autoScrollEnabled={autoScrollEnabled}
                      onAutoScrollChange={handleAutoScrollChange}
                      manualLatched={manualLatched}
                      onManualLatchChange={setManualLatched}
                      onLoadSuccess={setPdfNumPages}
                      onPageChange={handlePdfPageChange}
                      onScrollPositionChange={handlePdfScrollPositionChange}
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
      </div>
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
