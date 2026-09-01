'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X, ArrowRight, ExternalLink, Megaphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { AnnouncementPopup } from '@psc/shared-types';

const DISMISSED_STORAGE_KEY = 'psc_dismissed_banners_v2';

function resolveBannerLink(rawUrl?: string | null): { href: string; isExternal: boolean } | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Full external URL
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return { href: trimmed, isExternal: true };
  }
  // Domain-style URL without scheme (e.g. google.com, www.example.com)
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed)) {
    return { href: `https://${trimmed}`, isExternal: true };
  }
  // Internal path (ensure leading slash, e.g. "quizzes" -> "/quizzes")
  const internalPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return { href: internalPath, isExternal: false };
}

function isDarkColor(colorOrGradient?: string | null): boolean {
  if (!colorOrGradient) return false;
  const trimmed = colorOrGradient.trim();

  // Solid Hex Code
  if (trimmed.startsWith('#')) {
    const hex = trimmed.replace('#', '');
    if (hex.length !== 6 && hex.length !== 3) return false;
    const fullHex = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const r = parseInt(fullHex.substring(0, 2), 16);
    const g = parseInt(fullHex.substring(2, 4), 16);
    const b = parseInt(fullHex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 145;
  }

  // Gradient string: parse hex codes and average their luminance
  if (trimmed.includes('gradient')) {
    const hexMatches = trimmed.match(/#[0-9a-fA-F]{3,6}/g);
    if (hexMatches && hexMatches.length > 0) {
      let totalBrightness = 0;
      for (const hexStr of hexMatches) {
        const hex = hexStr.replace('#', '');
        const fullHex = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
        const r = parseInt(fullHex.substring(0, 2), 16) || 0;
        const g = parseInt(fullHex.substring(2, 4), 16) || 0;
        const b = parseInt(fullHex.substring(4, 6), 16) || 0;
        totalBrightness += (r * 299 + g * 587 + b * 114) / 1000;
      }
      return totalBrightness / hexMatches.length < 145;
    }
  }

  return false;
}

export function AnnouncementBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const [banners, setBanners] = useState<AnnouncementPopup[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const active = await ApiClient.getActiveAnnouncements();
        if (!active || cancelled) return;

        let dismissedSet = new Set<string>();
        try {
          const stored = localStorage.getItem(DISMISSED_STORAGE_KEY);
          if (stored) {
            dismissedSet = new Set(JSON.parse(stored));
          }
        } catch { }

        const pending = active.filter((b) => !dismissedSet.has(`${b.id}:${b.updatedAt}`));
        setBanners(pending);
      } catch {
        // fail silently
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-cycle announcements when multiple exist
  useEffect(() => {
    if (banners.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [banners.length, isPaused]);

  if (pathname.startsWith('/admin')) return null;
  if (banners.length === 0) return null;

  const currentBanner = banners[currentIndex % banners.length];
  if (!currentBanner) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    const key = `${currentBanner.id}:${currentBanner.updatedAt}`;
    try {
      let dismissedSet = new Set<string>();
      const stored = localStorage.getItem(DISMISSED_STORAGE_KEY);
      if (stored) dismissedSet = new Set(JSON.parse(stored));
      dismissedSet.add(key);
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(Array.from(dismissedSet)));
    } catch { }

    const remaining = banners.filter((b) => b.id !== currentBanner.id);
    setBanners(remaining);
    if (currentIndex >= remaining.length) {
      setCurrentIndex(Math.max(0, remaining.length - 1));
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const redirectConfig = resolveBannerLink(currentBanner.redirectUrl);
  const hasButton = Boolean(redirectConfig);

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!redirectConfig) return;

    if (redirectConfig.isExternal) {
      window.open(redirectConfig.href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(redirectConfig.href);
    }
  };

  const isDark = isDarkColor(currentBanner.backgroundColor);
  const customBg = currentBanner.backgroundColor?.trim();

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        background: customBg || undefined,
      }}
      className={`relative shadow-md border-b transition-all z-40 ${!customBg
          ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-400 text-slate-950 border-amber-600/20'
          : isDark
            ? 'text-white border-white/10'
            : 'text-slate-950 border-slate-950/10'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-col sm:flex-row items-center justify-between gap-3 pr-12 sm:pr-14">
        <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
          {/* Banner Image / Thumbnail or Icon */}
          {currentBanner.imageUrl ? (
            <div
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden shadow-xs shrink-0 border ${isDark ? 'border-white/20 bg-white/10' : 'border-slate-950/10 bg-slate-950/5'
                }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentBanner.imageUrl}
                alt={currentBanner.title || 'Announcement'}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-white/15 text-white' : 'bg-slate-950/10 text-slate-950'
                }`}
            >
              <Megaphone className="w-4 h-4" />
            </div>
          )}

          {/* Announcement Content: Title & Message */}
          <div className="min-w-0 flex-1">
            {currentBanner.title && currentBanner.title !== 'Global Banner' && (
              <p
                className={`text-xs sm:text-sm font-black leading-tight tracking-tight truncate sm:whitespace-normal ${isDark ? 'text-white' : 'text-slate-950'
                  }`}
              >
                {currentBanner.title}
              </p>
            )}
            <p
              className={`text-[11px] sm:text-xs font-semibold leading-snug line-clamp-2 sm:line-clamp-1 ${isDark ? 'text-slate-200' : 'text-slate-900/90'
                }`}
            >
              {currentBanner.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
          {/* Multi-announcement stepper / controls if more than 1 active */}
          {banners.length > 1 && (
            <div
              className={`flex items-center gap-1 rounded-xl px-2 py-1 ${isDark ? 'bg-white/10 text-white' : 'bg-slate-950/10 text-slate-950'
                }`}
            >
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous announcement"
                className={`p-1 rounded-lg transition-colors cursor-pointer ${isDark ? 'hover:bg-white/15 text-white' : 'hover:bg-slate-950/10 text-slate-950'
                  }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span
                className={`text-[10px] font-mono font-bold px-1 ${isDark ? 'text-white/90' : 'text-slate-950/80'
                  }`}
              >
                {currentIndex + 1}/{banners.length}
              </span>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next announcement"
                className={`p-1 rounded-lg transition-colors cursor-pointer ${isDark ? 'hover:bg-white/15 text-white' : 'hover:bg-slate-950/10 text-slate-950'
                  }`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Redirect Button */}
          {hasButton && redirectConfig && (
            <button
              type="button"
              onClick={handleButtonClick}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl active:scale-95 text-xs font-extrabold shadow-sm transition-all cursor-pointer shrink-0 ${isDark
                  ? 'bg-white hover:bg-slate-100 text-slate-950 border border-white'
                  : 'bg-slate-950 hover:bg-slate-900 text-amber-300 hover:text-amber-200 border border-slate-900'
                }`}
              title={currentBanner.redirectUrl || 'Open link'}
            >
              {currentBanner.buttonText?.trim() && <span>{currentBanner.buttonText.trim()}</span>}
              {redirectConfig.isExternal ? (
                <ExternalLink className="w-3.5 h-3.5" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss announcement"
          className={`absolute right-2 sm:right-4 top-2 sm:top-1/2 sm:-translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isDark
              ? 'text-white/70 hover:text-white hover:bg-white/15'
              : 'text-slate-950/70 hover:text-slate-950 hover:bg-slate-950/15'
            }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
