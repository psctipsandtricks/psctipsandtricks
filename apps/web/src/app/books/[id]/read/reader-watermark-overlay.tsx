'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface ReaderWatermarkOverlayProps {
  userName?: string | null;
  userId?: string | null;
  userIdentifier?: string | null;
  opacity?: number;
}

/** Keeps the tile readable when a name or email runs long. */
function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * Text drawn into an SVG tile has to be XML-safe — a name containing `&` or a
 * stray angle bracket would otherwise break the whole pattern and leave the
 * page unmarked, which is the one failure mode this layer cannot have.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Forensic anti-leak watermark drawn over every rendered page.
 *
 * Screenshots cannot be blocked on the web — no browser exposes an API for it
 * — so this layer targets the next best thing: making any capture traceable
 * back to the account that took it. The identity is tiled edge to edge and set
 * at a diagonal, so cropping to a "clean" region is not possible without also
 * cropping away the content.
 *
 * Rendered as a single repeating SVG background rather than a grid of nodes:
 * a long book puts this over hundreds of pages at once, and one painted layer
 * per page keeps that affordable.
 */
export function ReaderWatermarkOverlay({
  userName,
  userId,
  userIdentifier,
  opacity = 0.2,
}: ReaderWatermarkOverlayProps) {
  // Deferred to the client so the stamp cannot differ between the server and
  // client renders (a hydration mismatch would blank the layer).
  const [stamp, setStamp] = useState<string | null>(null);
  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    setStamp(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
        now.getHours()
      )}:${pad(now.getMinutes())}`
    );
  }, []);

  const label = useMemo(() => {
    const parts: string[] = [];
    if (userName) parts.push(truncate(userName, 28));
    if (userIdentifier) parts.push(truncate(userIdentifier, 32));
    // A short id still pins the account down, without a 36-char uuid dominating
    // the tile.
    if (userId) parts.push(userId.slice(0, 8).toUpperCase());
    // Never render an empty mark: an unattributable capture is the case this
    // exists to prevent, so fall back to something that still says "licensed".
    return parts.length > 0 ? parts.join('  ·  ') : 'PSC TIPS & TRICKS — LICENSED COPY';
  }, [userName, userIdentifier, userId]);

  const tile = useMemo(() => {
    const line1 = escapeXml(label);
    const line2 = escapeXml(stamp ? `${stamp}  ·  Do not share` : 'Do not share');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260" viewBox="0 0 420 260">
<g transform="rotate(-30 210 130)" font-family="system-ui,-apple-system,Segoe UI,sans-serif" text-anchor="middle" fill="#0f172a">
<text x="210" y="122" font-size="17" font-weight="700" letter-spacing="0.4">${line1}</text>
<text x="210" y="146" font-size="14" font-weight="600" letter-spacing="0.3">${line2}</text>
</g></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [label, stamp]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none select-none z-20 overflow-hidden"
    >
      {/* Tiled identity — the layer that makes a leak attributable. */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: tile, backgroundRepeat: 'repeat', opacity }}
      />

      {/* Central brand mark, kept from the original overlay. */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: opacity * 0.9 }}>
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
