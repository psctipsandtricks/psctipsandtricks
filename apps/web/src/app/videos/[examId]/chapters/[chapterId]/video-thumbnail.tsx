'use client';

import React, { useState } from 'react';
import { PlayCircle, FileText } from 'lucide-react';
import { Badge } from '@psc/ui';
import type { Video } from '@psc/shared-types';
import { youtubeFallbackThumbnail, youtubeMaxResThumbnail } from '@/lib/youtube';

export function VideoThumbnail({
  video,
  onPlay,
  onOpenPdf,
}: {
  video: Video;
  onPlay: (video: Video) => void;
  onOpenPdf?: (video: Video) => void;
}) {
  const [src, setSrc] = useState(() => youtubeMaxResThumbnail(video.youtubeVideoId));
  const hasPdf = Boolean(video.pdfUrl);

  return (
    <div className="group text-left rounded-2xl overflow-hidden border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#091124] shadow-sm hover:border-cyan-500/50 hover:shadow-lg transition-all flex flex-col justify-between">
      <div
        onClick={() => onPlay(video)}
        className="cursor-pointer"
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

          {hasPdf && (
            <div className="absolute top-2.5 right-2.5 z-10">
              <Badge variant="gold" className="text-[10px] font-bold shadow-md flex items-center gap-1 backdrop-blur-md bg-amber-500/90 text-slate-950 border-none">
                <FileText className="w-3 h-3" />
                <span>PDF Notes</span>
              </Badge>
            </div>
          )}
        </div>

        <div className="p-3 space-y-1">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-2">{video.title}</h3>
          {video.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{video.description}</p>
          )}
        </div>
      </div>

      {hasPdf && (
        <div className="px-3 pb-3 pt-1 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-[#1e2e56]/40">
          <button
            type="button"
            onClick={() => onPlay(video)}
            className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Watch Video</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenPdf) {
                onOpenPdf(video);
              } else {
                onPlay(video);
              }
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/25 transition-colors cursor-pointer"
          >
            <FileText className="w-3 h-3 text-amber-500" />
            <span>Read PDF</span>
          </button>
        </div>
      )}
    </div>
  );
}
