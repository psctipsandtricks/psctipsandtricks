import { useMemo } from 'react';
import { AudioSyncSegment } from '@psc/shared-types';

export interface AudioSyncState {
  activeSegment: AudioSyncSegment | null;
  activeIndex: number;
}

/**
 * Binary-searches the current segment for `currentTime`. Being a pure
 * function of `currentTime` (no internal state) means pause (time stops
 * advancing → segment stays put), resume, and seeks (time jumps → segment
 * recomputes immediately) all fall out for free.
 */
export function useAudioSync(
  segments: AudioSyncSegment[] | null | undefined,
  currentTime: number,
): AudioSyncState {
  return useMemo(() => {
    if (!segments || segments.length === 0) return { activeSegment: null, activeIndex: -1 };

    let lo = 0;
    let hi = segments.length - 1;
    let result = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (segments[mid].startTime <= currentTime) {
        result = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (result === -1) return { activeSegment: null, activeIndex: -1 };
    return { activeSegment: segments[result], activeIndex: result };
  }, [segments, currentTime]);
}
