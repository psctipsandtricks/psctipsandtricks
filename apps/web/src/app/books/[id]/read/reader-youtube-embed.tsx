'use client';

import React, { useState } from 'react';
import { Play, Youtube, ExternalLink } from 'lucide-react';

export function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null;
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1] || null;
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1] || null;
    }
    return null;
  } catch {
    return null;
  }
}

interface ReaderYoutubeEmbedProps {
  id?: string;
  url: string;
  title: string;
  autoPlay?: boolean;
}

/**
 * "Lite" embed: shows YouTube's own thumbnail and only mounts the real iframe
 * once the reader clicks play. A reader page can hold dozens of topics, and
 * eagerly embedding every player would load a YouTube frame per topic.
 */
export function ReaderYoutubeEmbed({ id, url, title, autoPlay }: ReaderYoutubeEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay ?? false);

  React.useEffect(() => {
    setIsPlaying(Boolean(autoPlay));
  }, [url, autoPlay]);

  const videoId = extractYoutubeId(url);
  if (!videoId) return null;

  return (
    <div id={id} className="space-y-2 scroll-mt-28">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-600 dark:text-rose-400">
          <Youtube className="w-4 h-4" />
          <span>Attached Video Lesson</span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 transition-colors"
        >
          <span>Open on YouTube</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-[#1e2e56] bg-black aspect-video w-full group shadow-md">
        {isPlaying ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
            title={`${title} — video`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            className="absolute inset-0 w-full h-full cursor-pointer group"
            aria-label={`Play video for ${title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-14 h-14 rounded-full bg-rose-600 group-hover:bg-rose-500 flex items-center justify-center shadow-2xl transition-all duration-200 group-hover:scale-110">
                <Play className="w-6 h-6 text-white fill-white ml-0.5" />
              </span>
            </span>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-left">
              <span className="text-xs font-bold text-white drop-shadow truncate max-w-[80%]">
                {title}
              </span>
              <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-mono text-white/90">
                Play Video
              </span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
