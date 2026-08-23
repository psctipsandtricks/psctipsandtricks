'use client';

import { useEffect } from 'react';

/**
 * Stops the browser from navigating away when a file is dropped anywhere
 * outside a real drop target.
 *
 * The default behaviour is to open the dropped file in the tab, which throws
 * away whatever half-filled admin form was on screen. Now that most upload
 * inputs accept drops, a near-miss on the dropzone is a normal thing for a
 * user to do — and it must be a no-op, not a lost draft.
 *
 * React delegates its events at the document root — the same node these
 * listeners sit on — so a zone's `stopPropagation` does *not* keep the event
 * from reaching them. `defaultPrevented` is the reliable signal instead: every
 * real drop target calls `preventDefault`, so anything still un-prevented by
 * the time it arrives here landed on empty page. Without that check the guard
 * would overwrite the zone's `dropEffect` and show a "not allowed" cursor over
 * every working dropzone in the app.
 */
export function DropGuard() {
  useEffect(() => {
    const swallow = (e: DragEvent) => {
      // A real drop target already claimed this one.
      if (e.defaultPrevented) return;
      if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
      e.preventDefault();
      if (e.type === 'dragover' && e.dataTransfer) e.dataTransfer.dropEffect = 'none';
    };

    document.addEventListener('dragover', swallow);
    document.addEventListener('drop', swallow);
    return () => {
      document.removeEventListener('dragover', swallow);
      document.removeEventListener('drop', swallow);
    };
  }, []);

  return null;
}
