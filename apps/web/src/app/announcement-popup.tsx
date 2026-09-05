'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X, ArrowRight, ExternalLink, Megaphone } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from './auth-provider';
import { AnnouncementPopup as Announcement } from '@psc/shared-types';

/**
 * Announcements are a signed-in, Home-page feature: a guest never sees one,
 * and neither does a signed-in student anywhere else in the site — only on
 * arriving at `/`. Once shown, a card is shown once and then never again.
 *
 * `localStorage`, not `sessionStorage`: a dismissal has to outlive the tab, or
 * every visit re-runs the same queue. Namespaced per account, so signing in on
 * a shared machine does not inherit whatever the previous person dismissed.
 *
 * The guest bucket below is read-only backward compatibility: earlier
 * versions of this component did show announcements to guests, so a visitor
 * who saw one then and has since signed up must not be shown it again under
 * their new id. Nothing writes to that bucket anymore.
 *
 * The one thing this cannot do is follow a student to a second device; that
 * needs the server to record who has seen what.
 */
const DISMISSED_STORAGE_PREFIX = 'psc_seen_announcements';

/** Ids are kept forever, so the list needs a ceiling. */
const MAX_REMEMBERED = 300;

const GUEST_BUCKET = `${DISMISSED_STORAGE_PREFIX}:guest`;

function bucketFor(userId: string): string {
  return `${DISMISSED_STORAGE_PREFIX}:${userId}`;
}

function readBucket(key: string): string[] {
  try {
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Everything this account has already seen, including — for backward
 * compatibility — whatever it saw as a guest before it existed. */
function readDismissed(userId: string): Set<string> {
  return new Set([...readBucket(GUEST_BUCKET), ...readBucket(bucketFor(userId))]);
}

function rememberDismissed(id: string, userId: string) {
  try {
    const key = bucketFor(userId);
    const next = readBucket(key).filter((seen) => seen !== id);
    next.push(id);
    localStorage.setItem(
      key,
      // Oldest first, so trimming drops the ones least likely to still be
      // active — the server stops serving an expired announcement anyway.
      JSON.stringify(next.slice(-MAX_REMEMBERED)),
    );
  } catch {
    // A browser with storage blocked still gets the popups; they just come
    // back on the next visit.
  }
}

type ResolvedLink = { href: string; isExternal: boolean };

/**
 * Reads whatever the admin panel typed into "Opens" as a destination.
 *
 * Shared in spirit with the app's `resolveNotificationDestination`: a full URL
 * or a bare domain goes to the browser, anything else is an internal path.
 */
export function resolveAnnouncementLink(rawUrl?: string | null): ResolvedLink | null {
  const trimmed = (rawUrl ?? '').trim();
  if (!trimmed) return null;

  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return { href: trimmed, isExternal: true };
  }
  // Domain-style URL without a scheme, e.g. `example.com/offers`.
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed)) {
    return { href: `https://${trimmed}`, isExternal: true };
  }
  return { href: trimmed.startsWith('/') ? trimmed : `/${trimmed}`, isExternal: false };
}

/** The admin panel's colour when it sent a usable hex, amber otherwise. */
function accentColor(raw?: string | null): string {
  const trimmed = (raw ?? '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : '#f59e0b';
}

/**
 * Puts the active announcements in front of the student, one modal at a time
 * — but only once signed in, and only on arriving at the Home page.
 *
 * Mounted in the root layout, so it survives client-side navigation: following
 * an announcement's link does not remount this component, which is what keeps
 * the queue from restarting and showing the same notice twice on the way to
 * the destination. It simply stays quiet on every other route, and for a
 * visitor who has not signed in.
 */
export function AnnouncementPopupHost() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [queue, setQueue] = useState<Announcement[]>([]);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const userId = user?.id ?? null;

  // Held so dismissing reads the same identity the queue was filtered against,
  // without making the dismiss callback change on every auth tick.
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;

  // Waits for the session to resolve, and fetches nothing at all for a guest
  // — there is no id to key a dismissal against, and nothing this component
  // will ever show them anyway.
  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setQueue([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const active = await ApiClient.getActiveAnnouncements();
        if (cancelled || !active?.length) return;
        const dismissed = readDismissed(userId);
        setQueue(active.filter((a) => !dismissed.has(a.id)));
      } catch {
        // An announcement is never worth an error on the page.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  const isHome = pathname === '/';
  const current = userId && isHome ? queue[0] : undefined;

  /** Drops the head of the queue; whatever is behind it opens next. */
  const dismissCurrent = useCallback(() => {
    setQueue((pending) => {
      if (pending.length === 0) return pending;
      const seenBy = userIdRef.current;
      if (seenBy) rememberDismissed(pending[0].id, seenBy);
      return pending.slice(1);
    });
  }, []);

  // Escape closes, and the page behind must not scroll under the modal.
  useEffect(() => {
    if (!current) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissCurrent();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [current, dismissCurrent]);

  if (!current) return null;

  const link = resolveAnnouncementLink(current.redirectUrl);
  const accent = accentColor(current.backgroundColor);
  const actionLabel = link ? current.buttonText?.trim() || 'Open' : null;

  /**
   * Dismisses first, then navigates: an internal push re-renders the page
   * underneath, and the next announcement should open onto the destination
   * rather than alongside a copy of the one that sent the visitor there.
   */
  const followLink = () => {
    if (!link) return;
    dismissCurrent();
    if (link.isExternal) {
      window.open(link.href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(link.href);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
      onClick={dismissCurrent}
      className="announcement-scrim fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="announcement-card relative w-full max-w-md sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-3xl border border-slate-200/90 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] shadow-2xl"
      >
        {current.imageUrl && (
          // The artwork is the most obvious thing to press, so it follows the
          // link too when there is one.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.imageUrl}
            alt={current.title || 'Announcement'}
            onClick={link ? followLink : undefined}
            className={`w-full h-40 sm:h-48 object-cover ${link ? 'cursor-pointer' : ''}`}
          />
        )}

        <button
          type="button"
          ref={closeButtonRef}
          onClick={dismissCurrent}
          aria-label="Close announcement"
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            current.imageUrl
              ? 'bg-slate-950/50 text-white hover:bg-slate-950/70'
              : 'bg-slate-100 dark:bg-[#111c3a] text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <X className="w-4 h-4" />
        </button>

        <div className={`p-6 sm:p-7 ${current.imageUrl ? '' : 'pt-12'}`}>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border"
            style={{ color: accent, backgroundColor: `${accent}1f`, borderColor: `${accent}59` }}
          >
            <Megaphone className="w-3 h-3" />
            Announcement
          </span>

          <h2
            id="announcement-title"
            className="mt-3.5 text-lg sm:text-xl font-black leading-snug text-slate-950 dark:text-white"
          >
            {current.title}
          </h2>

          {current.message?.trim() && (
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">
              {current.message}
            </p>
          )}

          {actionLabel && (
            <button
              type="button"
              onClick={followLink}
              style={{ backgroundColor: accent }}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-extrabold text-slate-950 shadow-lg active:scale-[0.98] transition-transform cursor-pointer"
            >
              <span>{actionLabel}</span>
              {link?.isExternal ? (
                <ExternalLink className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          )}

          {queue.length > 1 && (
            <p className="mt-4 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500">
              {queue.length - 1} more announcement{queue.length > 2 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
