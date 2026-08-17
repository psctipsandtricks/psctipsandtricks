'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Badge, Skeleton } from '@psc/ui';
import { ArrowLeft, ExternalLink, Video as VideoIcon, X, FileText, PlayCircle } from 'lucide-react';
import type { Video } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';
import { youtubeEmbedUrl, youtubeWatchUrl } from '@/lib/youtube';
import { VideoThumbnail } from './video-thumbnail';
import { SecureVideoPdfViewer } from './secure-video-pdf-viewer';

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
  const [activeModalTab, setActiveModalTab] = useState<'VIDEO' | 'PDF'>('VIDEO');

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

  // Escape closes the player
  useEffect(() => {
    if (!playing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlaying(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playing]);

  const handlePlayVideo = (video: Video) => {
    setPlaying(video);
    setActiveModalTab('VIDEO');
  };

  const handleOpenPdf = (video: Video) => {
    setPlaying(video);
    setActiveModalTab('PDF');
  };

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
          Tap a thumbnail to start watching, or read attached PDF study notes.
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
            <VideoThumbnail
              key={video.id}
              video={video}
              onPlay={handlePlayVideo}
              onOpenPdf={handleOpenPdf}
            />
          ))}
        </div>
      )}

      {/* Video & In-App PDF Viewer Modal */}
      {playing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-2 sm:p-6 !mt-0"
          role="dialog"
          aria-modal="true"
          aria-label={playing.title}
          onClick={() => setPlaying(null)}
        >
          <div
            className={`w-full ${
              activeModalTab === 'PDF' ? 'max-w-5xl h-[90vh]' : 'max-w-4xl'
            } bg-slate-900 border border-slate-800 rounded-3xl p-3 sm:p-5 shadow-2xl overflow-hidden flex flex-col transition-all`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Title and Mode Switcher */}
            <div className="flex items-start justify-between gap-3 shrink-0 pb-2 border-b border-slate-800">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-extrabold text-white leading-snug truncate">
                    {playing.title}
                  </h2>
                  {playing.pdfUrl && (
                    <Badge variant="gold" className="text-[10px] font-bold">
                      PDF Available
                    </Badge>
                  )}
                </div>

                {/* Tabs: Video vs In-App PDF Notes */}
                {playing.pdfUrl && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setActiveModalTab('VIDEO')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeModalTab === 'VIDEO'
                          ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Watch Video</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModalTab('PDF')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeModalTab === 'PDF'
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>In-App PDF Notes</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setPlaying(null)}
                className="p-2 rounded-xl border border-white/20 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video View */}
            {activeModalTab === 'VIDEO' && (
              <div className="space-y-3 pt-3 flex-1 min-h-0 flex flex-col justify-center">
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-2xl shrink-0">
                  <iframe
                    key={playing.id}
                    src={youtubeEmbedUrl(playing.youtubeVideoId)}
                    title={playing.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>

                {playing.description && (
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-h-20 overflow-y-auto">
                    {playing.description}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <a
                    href={youtubeWatchUrl(playing.youtubeVideoId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Watch on YouTube</span>
                  </a>

                  {playing.pdfUrl && (
                    <button
                      type="button"
                      onClick={() => setActiveModalTab('PDF')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:underline cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Switch to PDF Notes →</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Secure In-App PDF Viewer View (No download buttons, canvas rendered, watermark protected) */}
            {activeModalTab === 'PDF' && playing.pdfUrl && (
              <div className="flex-1 min-h-0 flex flex-col pt-2">
                <SecureVideoPdfViewer
                  url={playing.pdfUrl}
                  title={playing.pdfFileName || playing.title}
                  user={user}
                />
              </div>
            )}
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
