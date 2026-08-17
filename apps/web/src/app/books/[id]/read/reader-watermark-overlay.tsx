'use client';

import React, { useEffect, useState } from 'react';

interface ReaderWatermarkOverlayProps {
  userName?: string | null;
  userId?: string | null;
  userIdentifier?: string | null; // e.g. email or phone
  opacity?: number;
}

/**
 * Renders a tamper-resistant, non-intrusive repeating forensic watermark across
 * eBook pages and containers. Contains the account holder's name, user ID,
 * and current live timestamp to deter screenshot and photo leaks.
 */
export function ReaderWatermarkOverlay({
  userName,
  userId,
  userIdentifier,
  opacity = 0.065,
}: ReaderWatermarkOverlayProps) {
  const [timestamp, setTimestamp] = useState<string>('');

  useEffect(() => {
    const formatNow = () => {
      const now = new Date();
      return `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', { hour12: false })}`;
    };
    setTimestamp(formatNow());
    const interval = setInterval(() => setTimestamp(formatNow()), 60000);
    return () => clearInterval(interval);
  }, []);

  const displayName = userName || 'Registered Student';
  const displayId = userId ? `ID: ${userId.slice(0, 8)}…` : '';
  const displayContact = userIdentifier ? `(${userIdentifier})` : '';

  // SVG Repeating Pattern
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none select-none z-20 overflow-hidden"
      style={{ opacity }}
    >
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="ebook-forensic-watermark"
            width="320"
            height="210"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-25)"
          >
            <text
              x="20"
              y="40"
              fontSize="11"
              fontWeight="700"
              fill="currentColor"
              className="text-slate-600 dark:text-slate-300 fill-current font-sans tracking-wide"
            >
              PSC Tips and Tricks
            </text>
            <text
              x="20"
              y="58"
              fontSize="9.5"
              fontWeight="500"
              fill="currentColor"
              className="text-slate-600 dark:text-slate-300 fill-current font-sans"
            >
              Purchased by: {displayName}
            </text>
            <text
              x="20"
              y="74"
              fontSize="8.5"
              fontWeight="400"
              fill="currentColor"
              className="text-slate-500 dark:text-slate-400 fill-current font-sans"
            >
              {displayId} {displayContact}
            </text>
            <text
              x="20"
              y="90"
              fontSize="8"
              fontWeight="400"
              fill="currentColor"
              className="text-slate-500 dark:text-slate-400 fill-current font-sans"
            >
              © 2026 PSC Tips · {timestamp}
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ebook-forensic-watermark)" />
      </svg>
    </div>
  );
}
