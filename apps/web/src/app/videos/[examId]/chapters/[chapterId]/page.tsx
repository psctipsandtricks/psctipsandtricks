'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@psc/ui';
import { ArrowLeft, ExternalLink, Video as VideoIcon, X } from 'lucide-react';
import type { Video } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';
import { youtubeEmbedUrl, youtubeWatchUrl } from '@/lib/youtube';
import { VideoThumbnail } from './video-thumbnail';

export default function ChapterVideosPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params?.examId as string;
  const chapterId = params?.chapterId as string;
  const { user, isLoading: authLoading } = useAuth();

  const [videos, setVideos] = useState<Video[]>([]);
  const [chapterTitle, setChapterTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState<Video | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/videos/${examId}/chapters/${chapterId}`)}`);
    }
  }, [user, authLoading, router, examId, chapterId]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [items, chapter] = await Promise.all([
        ApiClient.getVideos(chapterId),
        ApiClient.getVideoChapter(chapterId).catch(() => null),
      ]);
      setVideos([...items].sort((a, b) => a.orderIndex - b.orderIndex));
      if (chapter) setChapterTitle(chapter.title);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load videos.');
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  useEffect(() => {
    if (user && chapterId) load();
  }, [user, chapterId, load]);

  // Escape closes the player, which is the reflex for a full-screen overlay.
  useEffect(() => {
    if (!playing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlaying(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playing]);

  if (authLoading || !user) {
    return <VideoGridSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-8 py-2 sm:py-4 px-1 sm:px-0">
      <div className="space-y-2">
        <Link
          href={`/videos/${examId}`}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Chapters</span>
        </Link>
        <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {chapterTitle || 'Videos'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
          Tap a thumbnail to start watching.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
          {error}
        </div>
      )}

      {loading ? (
        <VideoGridSkeleton />
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-inner">
            <VideoIcon className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Videos Yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
              No videos have been published in this chapter yet. Check back soon.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {videos.map((video) => (
            <VideoThumbnail key={video.id} video={video} onPlay={setPlaying} />
          ))}
        </div>
      )}

      {playing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-6 !mt-0"
          role="dialog"
          aria-modal="true"
          aria-label={playing.title}
          onClick={() => setPlaying(null)}
        >
          {/* The panel swallows clicks so only the backdrop closes the player. */}
          <div
            className="w-full max-w-4xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base sm:text-lg font-extrabold text-white leading-snug">{playing.title}</h2>
              <button
                type="button"
                onClick={() => setPlaying(null)}
                className="p-2 rounded-xl border border-white/20 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                aria-label="Close video"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-2xl">
              <iframe
                key={playing.id}
                src={youtubeEmbedUrl(playing.youtubeVideoId)}
                title={playing.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            {playing.description && (
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{playing.description}</p>
            )}

            <a
              href={youtubeWatchUrl(playing.youtubeVideoId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Watch on YouTube</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
      {Array.from({ length: 6 }).map((_, idx) => (
        <Skeleton key={idx} className="aspect-video w-full rounded-2xl" />
      ))}
    </div>
  );
}
