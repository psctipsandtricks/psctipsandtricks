'use client';

import React, { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import type { Video } from '@psc/shared-types';
import { youtubeFallbackThumbnail, youtubeMaxResThumbnail } from '@/lib/youtube';

/**
 * `maxresdefault` is sharp but only exists for videos uploaded at 720p or
 * better; YouTube answers with a placeholder for the rest. Starting high and
 * dropping to `hqdefault` on the error event gets the best available image
 * without asking the server which one exists.
 */
export function VideoThumbnail({ video, onPlay }: { video: Video; onPlay: (video: Video) => void }) {
  const [src, setSrc] = useState(() => youtubeMaxResThumbnail(video.youtubeVideoId));

  return (
    <button
      type="button"
      onClick={() => onPlay(video)}
      className="group text-left rounded-2xl overflow-hidden border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#091124] shadow-sm hover:border-rose-500/50 hover:shadow-lg transition-all cursor-pointer"
    >
      <div className="relative aspect-video bg-slate-200 dark:bg-slate-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setSrc(youtubeFallbackThumbnail(video.youtubeVideoId))}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25 opacity-0 group-hover:opacity-100 transition-opacity">
          <PlayCircle className="w-12 h-12 text-white drop-shadow-lg" />
        </div>
      </div>
      <div className="p-3 space-y-1">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-2">{video.title}</h3>
        {video.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{video.description}</p>
        )}
      </div>
    </button>
  );
}
