'use client';

import React from 'react';

interface ReaderWatermarkOverlayProps {
  opacity?: number;
}

/**
 * Brand watermark drawn over every rendered page.
 *
 * This used to also tile the reader's name, email and a timestamp edge to edge
 * so that a leaked screenshot could be traced back to the account it came
 * from. That was dropped on request: over Malayalam study material the tiled
 * text sat directly on top of the words and made pages hard to read, and
 * legibility of the thing students paid for wins over forensics. What remains
 * marks the material as ours without obstructing it.
 *
 * Note that nothing here prevents a screenshot — no browser exposes an API for
 * that — so with the identity layer gone, a capture is no longer attributable.
 */
export function ReaderWatermarkOverlay({
  opacity = 0.2,
}: ReaderWatermarkOverlayProps) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none select-none z-20 overflow-hidden"
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ opacity: opacity * 0.9 }}
      >
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
    </div>
  );
}
