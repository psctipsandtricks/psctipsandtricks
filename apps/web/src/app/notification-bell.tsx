'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import type { Notification as AppNotification } from '@psc/shared-types';
import { resolveNotificationDestination } from '@/lib/notification-destination';
import { useNotifications } from './notifications-data';

/** Compact relative age, e.g. "3h", "2d". Absolute dates read as noise here. */
export function shortAge(iso?: string | null) {
  const ms = Date.parse(iso ?? '');
  if (Number.isNaN(ms)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}

/**
 * Opening a notification marks it read and takes the student wherever it
 * points. An unrecognised destination is not an error — it just leaves them on
 * the list, which is the one place every notification is reachable from.
 */
export function useOpenNotification(onNavigated?: () => void) {
  const router = useRouter();
  const { markRead } = useNotifications();

  return (n: AppNotification) => {
    markRead(n.id);
    const destination = resolveNotificationDestination(n.route);
    if (destination?.externalUrl) {
      // noopener: the opened page must not be able to reach back into this one.
      window.open(destination.externalUrl, '_blank', 'noopener,noreferrer');
    } else if (destination?.href) {
      router.push(destination.href);
    }
    onNavigated?.();
  };
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { visible, unreadCount, isUnread, isLoading, markAllRead } = useNotifications();
  const openNotification = useOpenNotification(() => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Only the newest few belong in a dropdown; the page carries the rest.
  const preview = visible.slice(0, 6);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2.5 rounded-xl border border-slate-300 dark:border-[#1e2e56] bg-slate-100 dark:bg-[#091124] text-slate-700 dark:text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-all duration-200 shadow-xs cursor-pointer active:scale-90"
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-md shadow-rose-500/30 ring-2 ring-white dark:ring-[#060b18]"
            aria-hidden="true"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#080f22] shadow-2xl shadow-slate-900/10 dark:shadow-black/40 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-[#1e2e56]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-cyan-500 inline-flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-2">
                    <div className="w-2 h-2 mt-2 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="h-2.5 w-full rounded bg-slate-100 dark:bg-slate-800/60" />
                    </div>
                  </div>
                ))}
              </div>
            ) : preview.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
                  <Inbox className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">You&rsquo;re all caught up</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  New updates about books, quizzes and results will show up here.
                </p>
              </div>
            ) : (
              <ul>
                {preview.map((n) => {
                  const unread = isUnread(n);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(n)}
                        className={`w-full text-left flex gap-2.5 px-4 py-3 border-b border-slate-100 dark:border-[#1e2e56]/50 last:border-b-0 transition-colors cursor-pointer ${
                          unread
                            ? 'bg-cyan-500/[0.06] hover:bg-cyan-500/[0.1]'
                            : 'hover:bg-slate-50 dark:hover:bg-[#0c152e]/60'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            unread ? 'bg-cyan-500' : 'bg-transparent'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span
                              className={`text-xs truncate ${
                                unread
                                  ? 'font-black text-slate-900 dark:text-white'
                                  : 'font-bold text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {n.title}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {shortAge(n.createdAt)}
                            </span>
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug mt-0.5">
                            {n.body}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-center text-[11px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400 border-t border-slate-200/80 dark:border-[#1e2e56] hover:bg-cyan-500/5 transition-colors"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
