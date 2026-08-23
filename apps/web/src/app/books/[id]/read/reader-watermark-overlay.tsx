'use client';

import React from 'react';

interface ReaderWatermarkOverlayProps {
  userName?: string | null;
  userId?: string | null;
  userIdentifier?: string | null;
  opacity?: number;
}

/**
 * Renders a clean, transparent watermark of the original PSC Tips and Tricks logo
 * across every PDF page and eBook reader view.
 * Properly sized, centered, and optimized for both desktop and mobile viewports.
 */
export function ReaderWatermarkOverlay({
  opacity = 0.18,
}: ReaderWatermarkOverlayProps) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none select-none z-20 overflow-hidden flex items-center justify-center"
      style={{ opacity }}
    >
      {/* Central Transparent Logo Watermark - Scaled for clear visibility without obscuring text */}
      <div className="w-[88%] max-w-[500px] sm:max-w-[560px] aspect-square flex items-center justify-center p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/watermark-logo.svg"
          alt=""
          className="w-full h-full object-contain select-none pointer-events-none filter drop-shadow-xs"
          draggable={false}
        />
      </div>
    </div>
  );
}
