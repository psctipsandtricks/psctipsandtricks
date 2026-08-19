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
 * across PDF viewers and eBook pages without distracting text overlays.
 */
export function ReaderWatermarkOverlay({
  opacity = 0.12,
}: ReaderWatermarkOverlayProps) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none select-none z-20 overflow-hidden flex items-center justify-center"
      style={{ opacity }}
    >
      {/* Central Transparent Logo Watermark */}
      <div className="w-4/5 max-w-[380px] aspect-square flex items-center justify-center p-4">
        <img
          src="/watermark-logo.svg"
          alt=""
          className="w-full h-full object-contain select-none pointer-events-none"
          draggable={false}
        />
      </div>
    </div>
  );
}

