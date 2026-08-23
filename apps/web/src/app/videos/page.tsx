'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiClient } from '@/lib/api-client';
import { Card, Input, Button, Badge } from '@psc/ui';
import {
  Video as VideoIcon,
  Folder,
  FolderOpen,
  Search,
  Play,
  ArrowLeft,
  ChevronRight,
  FileText,
  X,
  ExternalLink,
  GraduationCap,
} from 'lucide-react';
import type { VideoFolder, Video } from '@psc/shared-types';
import { useAuth } from '../auth-provider';

function VideoFolderSkeleton() {
  return (
    <div className="p-5 rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] space-y-3 shadow-xs animate-pulse">
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="space-y-1.5">
        <div className="h-4 w-3/4 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800/60" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
        <div className="h-3 w-20 rounded bg-slate-100 dark:bg-slate-800/60" />
        <div className="h-3 w-16 rounded bg-slate-100 dark:bg-slate-800/60" />
      </div>
    </div>
  );
}

function VideoCardSkeleton() {
  return (
    <div className="p-3 rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] space-y-2.5 shadow-xs animate-pulse flex flex-col justify-between">
      <div className="space-y-2.5">
        <div className="aspect-video rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-4/5 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800/60" />
        </div>
      </div>
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

function VideosContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFolderId = searchParams.get('folderId') || '';

  const [loading, setLoading] = useState(true);
  const [currentFolderData, setCurrentFolderData] = useState<{
    folder?: VideoFolder;
    breadcrumbs: { id: string; name: string }[];
    subFolders: VideoFolder[];
    videos: Video[];
  }>({ breadcrumbs: [], subFolders: [], videos: [] });

  const [topLevelFolders, setTopLevelFolders] = useState<VideoFolder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Video[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Video Modal
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [user, authLoading, router]);

  // Load Folder Content
  const loadContent = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      if (currentFolderId) {
        const folderRes = await ApiClient.getVideoFolder(currentFolderId);
        setCurrentFolderData({
          folder: folderRes,
          breadcrumbs: folderRes.breadcrumbs || [],
          subFolders: folderRes.children || [],
          videos: folderRes.videos || [],
        });
      } else {
        const [rootFolders, rootVideos] = await Promise.all([
          ApiClient.getVideoFolders('root'),
          ApiClient.getVideos({ folderId: '' }),
        ]);
        setTopLevelFolders(rootFolders || []);
        setCurrentFolderData({
          breadcrumbs: [],
          subFolders: rootFolders || [],
          videos: rootVideos || [],
        });
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, user]);

  useEffect(() => {
    if (user) {
      loadContent();
    }
  }, [loadContent, user]);

  // Handle Search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const results = await ApiClient.getVideos({ search: searchTerm.trim() });
        setSearchResults(results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSelectFolder = (id: string) => {
    setSearchTerm('');
    setSearchResults(null);
    router.push(id ? `/videos?folderId=${encodeURIComponent(id)}` : '/videos');
  };

  // Only show folders with at least 1 video
  const visibleSubFolders = currentFolderData.subFolders.filter(
    (folder) => (folder.videoCount || 0) > 0
  );

  return (
    <div className="space-y-6 py-2 sm:py-4 w-full max-w-7xl mx-auto px-2 sm:px-0">
      {/* Header Banner */}
      <div className="rounded-3xl glass-panel p-6 sm:p-8 space-y-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-md">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Free Digital Video Classes</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Video Classes & Masterclasses
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Browse organized topic-wise PSC video lessons and expert tutorials.
            </p>
          </div>

          <div className="relative w-full md:w-80 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <Input
              placeholder="Search video lectures..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 text-xs bg-slate-50 dark:bg-[#0c152e]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumb Bar */}
        {currentFolderId && (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex-wrap">
            <button
              type="button"
              onClick={() => handleSelectFolder('')}
              className="hover:text-rose-500 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Video Categories</span>
            </button>
            {currentFolderData.breadcrumbs.map((bc, idx) => (
              <React.Fragment key={bc.id}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                {idx === currentFolderData.breadcrumbs.length - 1 ? (
                  <span className="text-slate-900 dark:text-white font-black truncate max-w-xs">
                    {bc.name}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelectFolder(bc.id)}
                    className="hover:text-rose-500 truncate max-w-xs cursor-pointer"
                  >
                    {bc.name}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading || authLoading || !user ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="h-4 w-44 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <VideoFolderSkeleton key={i} />
              ))}
            </div>
          </div>
          {currentFolderId && (
            <div className="space-y-3 pt-2">
              <div className="h-4 w-40 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <VideoCardSkeleton key={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : searchResults !== null ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Search Results ({searchResults.length})
            </h2>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-xs font-bold text-rose-500 hover:underline cursor-pointer"
            >
              Clear Search
            </button>
          </div>

          {searching ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#091124]">
              <p className="text-xs font-bold text-slate-400">No video lessons matched "{searchTerm}".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {searchResults.map((vid) => (
                <div
                  key={vid.id}
                  className="rounded-3xl glass-card hover-lift overflow-hidden space-y-2 p-3 group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={vid.thumbnailUrl} alt={vid.title} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setSelectedVideo(vid)}
                        className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                      >
                        <Play className="w-10 h-10 fill-white" />
                      </button>
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 dark:text-white truncate">{vid.title}</h3>
                      {vid.description && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{vid.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedVideo(vid)}
                      className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-rose-500" />
                      <span>Watch</span>
                    </button>
                    {vid.pdfUrl && (
                      <a
                        href={vid.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Notes</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Subfolders Grid */}
          {visibleSubFolders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                {currentFolderId ? 'Sub-Folders' : 'Explore by Category'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {visibleSubFolders.map((folder) => (
                  <div
                    key={folder.id}
                    onClick={() => handleSelectFolder(folder.id)}
                    className="p-5 rounded-3xl glass-card hover-lift space-y-3 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 group-hover:scale-105 transition-transform shadow-inner">
                        <Folder className="w-6 h-6" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-rose-500 transition-colors truncate">
                        {folder.name}
                      </h3>
                      {folder.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">{folder.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-400">
                      <span>{folder.videoCount || 0} videos</span>
                      {folder.subFolderCount ? <span>{folder.subFolderCount} subfolders</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Videos in Current Folder */}
          {currentFolderId && (
            <div className="space-y-3 pt-2">
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Video Lessons ({currentFolderData.videos.length})
              </h2>

              {currentFolderData.videos.length === 0 ? (
                visibleSubFolders.length === 0 ? (
                  <div className="p-12 text-center rounded-3xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#091124]">
                    <p className="text-xs font-bold text-slate-400">
                      No video lessons found in this category.
                    </p>
                  </div>
                ) : (
                  <div className="p-12 text-center rounded-3xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#091124]">
                    <p className="text-xs font-bold text-slate-400">
                      No videos directly inside this folder. Explore the subfolders above.
                    </p>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {currentFolderData.videos.map((vid) => (
                    <div
                      key={vid.id}
                      className="rounded-3xl glass-card hover-lift overflow-hidden space-y-2.5 p-3 group flex flex-col justify-between"
                    >
                      <div className="space-y-2.5">
                        <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={vid.thumbnailUrl} alt={vid.title} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setSelectedVideo(vid)}
                            className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                          >
                            <Play className="w-12 h-12 fill-white" />
                          </button>
                        </div>

                        <div>
                          <h3 className="text-xs font-black text-slate-900 dark:text-white line-clamp-2 leading-snug">
                            {vid.title}
                          </h3>
                          {vid.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{vid.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedVideo(vid)}
                          className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-rose-500" />
                          <span>Watch Now</span>
                        </button>

                        {vid.pdfUrl && (
                          <a
                            href={vid.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Notes PDF</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Root empty state if no folders or videos available */}
          {!currentFolderId && visibleSubFolders.length === 0 && currentFolderData.videos.length === 0 && (
            <div className="p-12 text-center rounded-3xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#091124]">
              <p className="text-xs font-bold text-slate-400">
                No video classes available at the moment.
              </p>
            </div>
          )}
        </>
      )}

      {/* YouTube Player Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-6 !mt-0"
          role="dialog"
          aria-modal="true"
          aria-label={`Video Player: ${selectedVideo.title}`}
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm sm:text-base font-black text-white truncate">{selectedVideo.title}</h3>
              <button
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-inner">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${selectedVideo.youtubeVideoId}?autoplay=1`}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentVideosPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 py-2 sm:py-4 w-full max-w-7xl mx-auto px-2 sm:px-0">
          <div className="space-y-3">
            <div className="h-4 w-44 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <VideoFolderSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <VideosContent />
    </Suspense>
  );
}
