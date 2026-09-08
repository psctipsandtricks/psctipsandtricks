import type { Notification as AppNotification } from '@psc/shared-types';

/**
 * Read state and retention for the student's notification list.
 *
 * These rules are deliberately the same ones the Flutter app applies in
 * `features/notifications/` — a student who reads a notice on their phone and
 * then opens the site should not be told it is still unread, and the two lists
 * should not disagree about what is old enough to drop off.
 */

/** How long a notification the student has already read stays on the list. */
export const NOTIFICATION_READ_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Ids are only useful while the notification is still inside the API's window,
 * and that window is bounded — there is no reason to grow this forever.
 */
const MAX_REMEMBERED = 300;

/**
 * Notifications this student has opened in this browser.
 *
 * The server is the shared record — it keeps a read receipt per student, so a
 * notice read on the phone comes back read here. This local copy is what makes
 * the change visible the instant it is tapped, and what carries the list when
 * the request fails or the browser is offline. It is keyed by student so a
 * shared computer does not leak one reader's state into another's list.
 */
export function readStorageKey(userId?: string | null) {
  return `psc_read_notifications_${userId || 'guest'}`;
}

/**
 * Whether this browser has already handed its old read state to the server.
 *
 * Read state for broadcasts used to live only here, so the backlog a student
 * accumulated before the server could remember it would otherwise stay
 * invisible to their other devices. It is uploaded once, and this flag is what
 * stops it being uploaded on every page load afterwards.
 */
export function readSyncedKey(userId?: string | null) {
  return `psc_read_notifications_synced_${userId || 'guest'}`;
}

export function hasSyncedLocalReads(userId?: string | null) {
  try {
    return window.localStorage.getItem(readSyncedKey(userId)) === '1';
  } catch {
    // Storage is unreadable, so the flag can never be written either — treat it
    // as done rather than re-uploading on every load.
    return true;
  }
}

export function markLocalReadsSynced(userId?: string | null) {
  try {
    window.localStorage.setItem(readSyncedKey(userId), '1');
  } catch {
    // Nothing to do: the upload already happened, and a browser that cannot
    // store the flag will simply repeat a harmless idempotent request.
  }
}

/**
 * Every storage access is guarded: a browser with site data blocked throws on
 * the property itself, and read state is never worth breaking the page for.
 */
export function loadLocallyRead(userId?: string | null): Set<string> {
  try {
    const raw = window.localStorage.getItem(readStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

/** Appends `id`, trims the oldest beyond the cap, and returns the kept ids. */
export function persistLocallyRead(userId: string | null | undefined, existing: Set<string>, id: string) {
  // Insertion order is what makes trimming drop the *oldest* ids.
  const ids = Array.from(existing).concat(id);
  const kept = ids.length > MAX_REMEMBERED ? ids.slice(ids.length - MAX_REMEMBERED) : ids;
  try {
    window.localStorage.setItem(readStorageKey(userId), JSON.stringify(kept));
  } catch {
    // A private window or blocked site data: the in-memory set still works for
    // this session, which is the part the student can see.
  }
  return new Set(kept);
}

/**
 * Unread means neither the server nor this browser has it marked read — the
 * same test the list uses to decide what to highlight. The server's answer
 * covers every device; the local set covers the marks it has not acknowledged
 * yet.
 */
export function isUnread(n: AppNotification, locallyRead: Set<string>) {
  return !n.isRead && !locallyRead.has(n.id);
}

export function countUnread(all: AppNotification[], locallyRead: Set<string>) {
  return all.reduce((total, n) => (isUnread(n, locallyRead) ? total + 1 : total), 0);
}

/**
 * The notifications to show, newest first.
 *
 * Read notices older than a week are hidden — they have been dealt with and the
 * list is not an archive. Unread ones are never hidden however old they are:
 * hiding something the student has not seen would lose it silently. None of
 * this deletes anything; the rows stay on the server either way.
 */
export function visibleNotifications(
  all: AppNotification[],
  { locallyRead, now }: { locallyRead: Set<string>; now: number },
) {
  const cutoff = now - NOTIFICATION_READ_RETENTION_MS;

  return all
    .filter((n) => {
      if (isUnread(n, locallyRead)) return true;
      const created = Date.parse(n.createdAt ?? '');
      // An undated notification cannot be judged old, so it is kept.
      if (Number.isNaN(created)) return true;
      return created > cutoff;
    })
    .sort((a, b) => (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0));
}
