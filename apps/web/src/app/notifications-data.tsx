'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Notification as AppNotification } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import {
  countUnread,
  hasSyncedLocalReads,
  isUnread as isUnreadOf,
  loadLocallyRead,
  markLocalReadsSynced,
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
 * Deliberately a single provider rather than a hook each consumer calls: this
 * browser keeps its own optimistic copy of what has been read, so two
 * independent copies of it would drift the moment one of them marked something
 * read — the bell would still show a badge for a notice the list had just
 * dimmed. One owner means the badge and the list cannot disagree.
 *
 * The server is the shared record: every mark is sent to it and it answers
 * `isRead` per student, so the phone app and this page agree. The local copy
 * survives alongside it to paint the change instantly and to hold up when the
 * request fails.
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

  const queryClient = useQueryClient();

  /**
   * Pulls the server's read state back in after marking something.
   *
   * The mark itself is painted locally and instantly; this is what closes the
   * loop the other way, so a notice this browser did not mark — one read in the
   * phone app — stops showing a badge here as well.
   */
  const syncFromServer = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: notificationsKey });
  }, [queryClient]);

  /**
   * Records the id in this browser — which is what the list paints from,
   * instantly and offline — and tells the server, which keeps a per-student
   * read receipt so the notice stops being unread on their phone too.
   *
   * Broadcasts included. They used to be skipped here, on the grounds that a
   * broadcast is one row shared by every student and the server had nowhere to
   * put one student's read state; it has a receipt table for exactly that now,
   * and skipping the call is what kept the phone and the website disagreeing.
   */
  const markRead = useCallback(
    (id: string) => {
      setLocallyRead((prev) => {
        if (prev.has(id)) return prev;
        return persistLocallyRead(userId, prev, id);
      });
      // Read state is never worth interrupting anyone for, so a failure is
      // swallowed — the local record already carries the UI.
      ApiClient.markNotificationRead(id).then(syncFromServer).catch(() => {});
    },
    [userId, syncFromServer],
  );

  /**
   * Hands this browser's existing read state to the server, once per student.
   *
   * Everything read before the server kept receipts is recorded only here, so
   * without this the synchronisation would start from empty and a student's
   * phone would re-surface notices they had already dealt with on the website.
   * Only ids the server is still listing are sent — anything older has aged out
   * of its window and would be ignored anyway.
   */
  useEffect(() => {
    if (!userId || all.length === 0) return;
    if (hasSyncedLocalReads(userId)) return;
    const known = new Set(all.map((n) => n.id));
    const backlog = Array.from(locallyRead).filter((id) => known.has(id));
    if (backlog.length === 0) {
      // Nothing to hand over, but the question has been settled for this
      // browser — don't ask again on every load.
      markLocalReadsSynced(userId);
      return;
    }
    ApiClient.markNotificationsRead(backlog)
      .then(() => markLocalReadsSynced(userId))
      // Left unflagged on failure, so the next load tries again.
      .catch(() => {});
  }, [userId, all, locallyRead]);

  const markAllRead = useCallback(() => {
    const unreadIds = all.filter((n) => isUnreadOf(n, locallyRead)).map((n) => n.id);
    if (unreadIds.length === 0) return;
    // Written once, outside the state updater: an updater can run twice under
    // StrictMode, and localStorage is a side effect that should not.
    let next = locallyRead;
    for (const id of unreadIds) next = persistLocallyRead(userId, next, id);
    setLocallyRead(next);
    // One request for the whole batch rather than one per notice.
    ApiClient.markNotificationsRead(unreadIds).then(syncFromServer).catch(() => {});
  }, [all, locallyRead, userId, syncFromServer]);

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
