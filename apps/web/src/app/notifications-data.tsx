'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Notification as AppNotification } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import {
  countUnread,
  isUnread as isUnreadOf,
  loadLocallyRead,
  persistLocallyRead,
  readStorageKey,
  visibleNotifications,
} from '@/lib/notifications';
import { useAuth } from './auth-provider';

export const notificationsKey = ['notifications'] as const;

interface NotificationsContextValue {
  all: AppNotification[];
  visible: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  isUnread: (n: AppNotification) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

/**
 * Owns the student's notifications and their read state for the whole app.
 *
 * Deliberately a single provider rather than a hook each consumer calls: read
 * state for broadcasts lives in this browser, not on the server, so two
 * independent copies of it would drift the moment one of them marked something
 * read — the bell would still show a badge for a notice the list had just
 * dimmed. One owner means the badge and the list cannot disagree.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [locallyRead, setLocallyRead] = useState<Set<string>>(() => new Set());

  // Read state lives in localStorage, so it can only be loaded in the browser.
  // Re-runs on sign-in/out: signing in swaps to that student's record rather
  // than carrying the previous one over.
  useEffect(() => {
    setLocallyRead(loadLocallyRead(userId));
  }, [userId]);

  // A second tab marking something read should dim it here too.
  useEffect(() => {
    const key = readStorageKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setLocallyRead(loadLocallyRead(userId));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userId]);

  const query = useQuery({
    queryKey: notificationsKey,
    queryFn: () => ApiClient.getMyNotifications(),
    // Signed-out visitors have no inbox; the endpoint requires a session.
    enabled: !!userId,
    staleTime: 60 * 1000,
    // Notifications arrive without the page asking, so unlike most lists this
    // one is worth re-checking when the student comes back to the tab.
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000,
  });

  const all = useMemo(() => query.data ?? [], [query.data]);

  /**
   * A broadcast is one row shared by every student, so the server refuses to
   * mark it and answers `perUser: false`. Telling it anyway is a wasted round
   * trip — and on "mark all read" it would be one per notice.
   */
  const isTargeted = useCallback(
    (id: string) => !!all.find((n) => n.id === id)?.userId,
    [all],
  );

  /**
   * Records the id in this browser — which is what the list paints from,
   * instantly — and, for a notification addressed to this student, tells the
   * server so it stops being unread on their other devices too.
   */
  const markRead = useCallback(
    (id: string) => {
      setLocallyRead((prev) => {
        if (prev.has(id)) return prev;
        return persistLocallyRead(userId, prev, id);
      });
      // Read state is never worth interrupting anyone for, so a failure is
      // swallowed — the local record already carries the UI.
      if (isTargeted(id)) ApiClient.markNotificationRead(id).catch(() => {});
    },
    [userId, isTargeted],
  );

  const markAllRead = useCallback(() => {
    const unreadIds = all.filter((n) => isUnreadOf(n, locallyRead)).map((n) => n.id);
    if (unreadIds.length === 0) return;
    // Written once, outside the state updater: an updater can run twice under
    // StrictMode, and localStorage is a side effect that should not.
    let next = locallyRead;
    for (const id of unreadIds) next = persistLocallyRead(userId, next, id);
    setLocallyRead(next);
    unreadIds.filter(isTargeted).forEach((id) => {
      ApiClient.markNotificationRead(id).catch(() => {});
    });
  }, [all, locallyRead, userId, isTargeted]);

  // Destructured rather than closing over `query`: useQuery hands back a fresh
  // object every render, so depending on it would rebuild the list — and hand
  // every consumer a new value — on renders where nothing actually changed.
  const { isLoading, isError, refetch } = query;

  const value = useMemo<NotificationsContextValue>(
    () => ({
      all,
      isLoading,
      isError,
      refetch: () => void refetch(),
      unreadCount: countUnread(all, locallyRead),
      isUnread: (n: AppNotification) => isUnreadOf(n, locallyRead),
      markRead,
      markAllRead,
      /**
       * `now` is captured once per recompute rather than per row, so every item
       * is judged against the same instant and the retention cutoff cannot
       * shift midway through building the list.
       */
      visible: visibleNotifications(all, { locallyRead, now: Date.now() }),
    }),
    [all, locallyRead, markRead, markAllRead, isLoading, isError, refetch],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return ctx;
}
