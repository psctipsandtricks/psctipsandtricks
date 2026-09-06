import {
  PdfSyncCue,
  PdfSyncMap,
  PdfSyncRegion,
  PdfSyncRegionKind,
} from '@psc/shared-types';

/**
 * Subtitle-style PDF↔audio timing.
 *
 * A sync map is a sparse, sorted list of `[startMs, endMs) → page` segments.
 * Everything here is pure so the timing rules can be reasoned about (and
 * tested) without a DOM, an <audio> element, or React.
 *
 * Two decisions shape the whole module:
 *
 *  - **Gaps hold, they don't interpolate.** Time that falls between two cues
 *    keeps showing the *previous* cue's page. A page of dense diagrams the
 *    narrator talks over for a minute needs one cue, not a cue per sentence,
 *    and must not drift just because the audio kept running.
 *  - **Milliseconds, integer.** Page turns in a lecture land mid-sentence;
 *    rounding cue edges to whole seconds visibly turns pages early or late.
 */

/** Cue edits snap to this grid so hand-tuned values stay tidy round numbers. */
export const CUE_TIME_GRID_MS = 10;

/** How far a single nudge moves the global offset. */
export const OFFSET_NUDGE_MS = 250;

/** Clamp for the global offset — beyond this a re-time is the honest fix. */
export const MAX_OFFSET_MS = 120_000;

/** Shortest cue we will create; anything narrower is unhittable during playback. */
export const MIN_CUE_DURATION_MS = 50;

export const EMPTY_SYNC_MAP: PdfSyncMap = { offsetMs: 0, cues: [], revision: 0 };

/** A cue with no region of its own is about its whole page. */
export const WHOLE_PAGE: PdfSyncRegion = { x: 0, y: 0, width: 1, height: 1 };

const REGION_KINDS: readonly PdfSyncRegionKind[] = [
  'text',
  'heading',
  'image',
  'table',
  'diagram',
  'other',
];

/** A region thinner than this is a rounding artefact, not something to scroll to. */
const MIN_REGION_SIZE = 0.002;

/**
 * Fractions are stored to this many decimals. Five is far finer than any
 * screen can resolve — a hundred-thousandth of a page is a hundredth of a
 * pixel — and it keeps clipped values from carrying float dust like
 * `0.09999999999999998` into the database and every diff after it.
 */
const REGION_DECIMALS = 5;

function roundFraction(value: number): number {
  const factor = 10 ** REGION_DECIMALS;
  return Math.round(value * factor) / factor;
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return n;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Coerce a raw target into a normalized rectangle, or null when it says
 * nothing usable.
 *
 * Anything outside the page is clipped rather than rejected: an extractor that
 * reports a figure a few thousandths over the edge is still pointing at the
 * right figure.
 */
export function normalizeRegion(raw: unknown): PdfSyncRegion | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;

  const x = toFiniteNumber(source.x);
  const y = toFiniteNumber(source.y);
  const width = toFiniteNumber(source.width);
  const height = toFiniteNumber(source.height);
  if (x === null || y === null || width === null || height === null) return null;

  const left = clamp01(x);
  const top = clamp01(y);
  const right = clamp01(left + Math.abs(width));
  const bottom = clamp01(top + Math.abs(height));

  const w = right - left;
  const h = bottom - top;
  if (w < MIN_REGION_SIZE || h < MIN_REGION_SIZE) return null;

  return {
    x: roundFraction(left),
    y: roundFraction(top),
    width: roundFraction(w),
    height: roundFraction(h),
  };
}

function normalizeKind(raw: unknown): PdfSyncRegionKind | undefined {
  return REGION_KINDS.includes(raw as PdfSyncRegionKind)
    ? (raw as PdfSyncRegionKind)
    : undefined;
}

function toFiniteInt(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.round(n);
}

function snap(ms: number): number {
  return Math.round(ms / CUE_TIME_GRID_MS) * CUE_TIME_GRID_MS;
}

export function clampOffset(offsetMs: number): number {
  if (!Number.isFinite(offsetMs)) return 0;
  return Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, Math.round(offsetMs)));
}

/**
 * Coerce anything that came off the wire, out of a JSON column, or out of
 * localStorage into a well-formed map: integer ms, positive-width cues, sorted
 * by start, and with overlaps resolved so no instant maps to two pages.
 *
 * Bad rows are dropped rather than rejected wholesale — one corrupt cue should
 * cost that one page turn, not the entire lecture's sync.
 */
export function normalizeSyncMap(raw: unknown, numPages?: number): PdfSyncMap {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_SYNC_MAP };

  const source = raw as Partial<PdfSyncMap> & { cues?: unknown };
  const rawCues = Array.isArray(source.cues) ? source.cues : [];
  const maxPage = numPages && numPages > 0 ? numPages : Number.MAX_SAFE_INTEGER;

  const cleaned: PdfSyncCue[] = [];
  for (const entry of rawCues) {
    if (!entry || typeof entry !== 'object') continue;
    const cue = entry as unknown as Record<string, unknown>;

    const startMs = toFiniteInt(cue.startMs);
    const page = toFiniteInt(cue.page);
    if (startMs === null || page === null) continue;

    let endMs = toFiniteInt(cue.endMs);
    if (endMs === null) endMs = startMs + MIN_CUE_DURATION_MS;

    const safeStart = Math.max(0, startMs);
    const safeEnd = Math.max(safeStart + MIN_CUE_DURATION_MS, endMs);
    const safePage = Math.max(1, Math.min(maxPage, page));
    const target = normalizeRegion(cue.target);
    const kind = normalizeKind(cue.type);

    cleaned.push({
      startMs: safeStart,
      endMs: safeEnd,
      page: safePage,
      ...(target ? { target } : {}),
      ...(kind ? { type: kind } : {}),
    });
  }

  cleaned.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  // Resolve overlaps by truncating the earlier cue at the later cue's start.
  // A later edit is the more recent intent, so it wins the contested span.
  const resolved: PdfSyncCue[] = [];
  for (const cue of cleaned) {
    const prev = resolved[resolved.length - 1];
    if (prev && prev.endMs > cue.startMs) {
      if (prev.startMs >= cue.startMs) {
        // Fully shadowed by the newer cue — drop it.
        resolved.pop();
      } else {
        prev.endMs = cue.startMs;
      }
    }
    if (resolved.length === 0 || resolved[resolved.length - 1].endMs <= cue.startMs) {
      resolved.push({ ...cue });
    }
  }

  const withWidth = resolved.filter((c) => c.endMs - c.startMs >= 1);

  return {
    offsetMs: clampOffset(toFiniteInt(source.offsetMs) ?? 0),
    cues: withWidth,
    revision: Math.max(0, toFiniteInt(source.revision) ?? 0),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
  };
}

export function hasCues(map: PdfSyncMap | null | undefined): boolean {
  return Boolean(map && map.cues.length > 0);
}

/**
 * Index of the cue covering `timeMs`, or the most recent cue that started
 * before it when the instant falls in a gap. Returns -1 only when `timeMs`
 * precedes the first cue.
 *
 * Binary search: a long lecture can carry hundreds of cues and this runs on
 * every `timeupdate` tick.
 */
export function findCueIndexAtTime(cues: PdfSyncCue[], timeMs: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let found = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].startMs <= timeMs) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * The page that should be on screen at `timeMs` (raw audio time; the map's
 * offset is applied here). Returns null when no cue applies yet — the caller
 * should then leave the PDF where it is rather than guessing.
 */
export function resolvePageAtTime(map: PdfSyncMap | null | undefined, timeMs: number): number | null {
  if (!map || map.cues.length === 0) return null;

  const adjusted = timeMs - map.offsetMs;
  const idx = findCueIndexAtTime(map.cues, adjusted);

  // Before the first cue: hold the first page rather than showing nothing, so
  // a lead-in of silence or an intro jingle still has the deck on page one.
  if (idx < 0) return map.cues[0].page;

  // Inside a gap past this cue's end we deliberately keep returning its page.
  return map.cues[idx].page;
}

/* ─────────────────────────────────────────────────────────────────────────
   Region-level sync: audio time → cue → page → region → scroll offset.

   Everything below is pure arithmetic on plain numbers. The viewer supplies
   spans in whatever unit it scrolls in (CSS pixels on the web, logical pixels
   on the phone) and gets an offset back in the same unit, so one set of rules
   drives both platforms and every zoom level.
   ───────────────────────────────────────────────────────────────────────── */

/** What the sync map wants on screen at some instant. */
export interface ResolvedSyncTarget {
  /** Index into `map.cues` — lets a caller tell "still this cue" from "next cue". */
  cueIndex: number;
  /** 1-based, as authored. */
  page: number;
  /** Always present: a cue without a region of its own resolves to the whole page. */
  region: PdfSyncRegion;
  type: PdfSyncRegionKind;
  /**
   * True while the instant is inside the cue's own span. False in the gap
   * after it, where the cue is still what should be on screen but the narrator
   * has moved past what it points at.
   */
  active: boolean;
}

/** A vertical range — a region's extent, or the visible window. Any unit, one unit. */
export interface Span {
  top: number;
  bottom: number;
}

/** How much of a region has to be on screen before it counts as "already there". */
export const MIN_VISIBLE_FRACTION = 0.65;

/**
 * A region taller than the viewport can never be mostly visible, so it settles
 * on filling this much of the screen instead — being *inside* a full-page
 * diagram is the same as having arrived at it.
 */
export const TALL_REGION_FILL = 0.8;

/** Where a region's top lands when we do scroll: this far down the viewport. */
export const REGION_TOP_BIAS = 0.3;

/** A region taller than the screen aligns near the top instead, with a little air. */
export const TALL_REGION_MARGIN = 0.06;

/**
 * The region that should be on screen at `timeMs` (raw audio time; the map's
 * offset is applied here), or null when the map has nothing to say.
 *
 * Gaps hold, exactly as [resolvePageAtTime] does: time past a cue's end keeps
 * resolving to that cue until the next one starts, so a narrator talking over
 * a figure for a minute does not make the document wander.
 */
export function resolveTargetAtTime(
  map: PdfSyncMap | null | undefined,
  timeMs: number,
): ResolvedSyncTarget | null {
  if (!map || map.cues.length === 0) return null;

  const adjusted = timeMs - map.offsetMs;
  const idx = findCueIndexAtTime(map.cues, adjusted);

  // Before the first cue: hold the first cue's target, so a lead-in of silence
  // still has the reader looking at where the narration is about to start.
  const cueIndex = idx < 0 ? 0 : idx;
  const cue = map.cues[cueIndex];

  return targetForCue(map, cueIndex, idx >= 0 && adjusted < cue.endMs);
}

/**
 * The target for one cue by index.
 *
 * Split out from [resolveTargetAtTime] so a caller that already knows which cue
 * is current can rebuild the target without going through the clock — which is
 * what lets React memoize on the cue index and hand the viewer an object whose
 * identity only changes when the cue does, instead of a fresh one every tick.
 */
export function targetForCue(
  map: PdfSyncMap | null | undefined,
  cueIndex: number | null,
  active = true,
): ResolvedSyncTarget | null {
  if (!map || cueIndex === null || cueIndex < 0) return null;
  const cue = map.cues[cueIndex];
  if (!cue) return null;

  return {
    cueIndex,
    page: cue.page,
    region: cue.target ?? WHOLE_PAGE,
    type: cue.type ?? 'text',
    active,
  };
}

/** Fraction of `region` currently inside `viewport`, 0–1. */
export function visibleFraction(region: Span, viewport: Span): number {
  const height = region.bottom - region.top;
  if (height <= 0) return 0;
  const overlap =
    Math.min(region.bottom, viewport.bottom) - Math.max(region.top, viewport.top);
  if (overlap <= 0) return 0;
  return Math.min(1, overlap / height);
}

/**
 * Whether the reader can already see this region well enough that moving the
 * page would be noise rather than help.
 *
 * This is the check that keeps the document still: a paragraph two lines below
 * the last one does not earn a scroll, and neither does the figure the narrator
 * has been describing for the last thirty seconds.
 */
export function isRegionSettled(region: Span, viewport: Span): boolean {
  const viewportHeight = viewport.bottom - viewport.top;
  if (viewportHeight <= 0) return false;

  const regionHeight = region.bottom - region.top;
  const overlap =
    Math.min(region.bottom, viewport.bottom) - Math.max(region.top, viewport.top);
  if (overlap <= 0) return false;

  if (regionHeight > viewportHeight) {
    return overlap >= viewportHeight * TALL_REGION_FILL;
  }
  return overlap / regionHeight >= MIN_VISIBLE_FRACTION;
}

/**
 * Where the scroll container should land to put `region` in a comfortable
 * reading position, clamped to the document.
 */
export function scrollOffsetForRegion(
  region: Span,
  viewportHeight: number,
  documentExtent: number,
): number {
  const regionHeight = region.bottom - region.top;
  const bias =
    regionHeight >= viewportHeight ? TALL_REGION_MARGIN : REGION_TOP_BIAS;
  const desired = region.top - viewportHeight * bias;
  const maxOffset = Math.max(0, documentExtent - viewportHeight);
  return Math.max(0, Math.min(maxOffset, desired));
}

export interface SyncScrollInput {
  /** From [resolveTargetAtTime]. */
  target: ResolvedSyncTarget | null;
  /** The cue this viewer has already acted on, or null if none yet. */
  appliedCueIndex: number | null;
  /**
   * The target region's extent in scroll-space, or null while the page it
   * lives on has not been laid out or measured yet.
   */
  regionSpan: Span | null;
  viewport: Span;
  /** Total scrollable extent of the document, same unit as the spans. */
  documentExtent: number;
}

export interface SyncScrollDecision {
  /** Where to scroll, or null to stay put. */
  scrollTo: number | null;
  /** The cue now considered handled — record it even when nothing moved. */
  cueIndex: number | null;
  reason: 'no-target' | 'layout-pending' | 'settled' | 'scroll';
}

/**
 * The whole follow-the-audio rule in one place: move only when the target has
 * actually changed or drifted off screen, and never on the strength of the
 * clock alone.
 *
 * Note that a cue change alone is not enough — if the next region is already
 * on screen the answer is still "stay put", which is what carries the reader
 * smoothly through a figure sitting between two narrated paragraphs instead of
 * snapping to it and then snapping away.
 */
export function decideSyncScroll(input: SyncScrollInput): SyncScrollDecision {
  const { target, appliedCueIndex, regionSpan, viewport, documentExtent } = input;

  if (!target) return { scrollTo: null, cueIndex: null, reason: 'no-target' };
  if (!regionSpan) {
    return { scrollTo: null, cueIndex: appliedCueIndex, reason: 'layout-pending' };
  }

  if (isRegionSettled(regionSpan, viewport)) {
    // Handled without moving: the reader is already looking at it.
    return { scrollTo: null, cueIndex: target.cueIndex, reason: 'settled' };
  }

  const viewportHeight = viewport.bottom - viewport.top;
  return {
    scrollTo: scrollOffsetForRegion(regionSpan, viewportHeight, documentExtent),
    cueIndex: target.cueIndex,
    reason: 'scroll',
  };
}

/** The cue whose span contains `timeMs` exactly — used to highlight the active row in the editor. */
export function findActiveCue(map: PdfSyncMap | null | undefined, timeMs: number): PdfSyncCue | null {
  if (!map || map.cues.length === 0) return null;
  const adjusted = timeMs - map.offsetMs;
  const idx = findCueIndexAtTime(map.cues, adjusted);
  if (idx < 0) return null;
  const cue = map.cues[idx];
  return adjusted < cue.endMs ? cue : null;
}

/**
 * Record "this page belongs at this instant".
 *
 * The new cue runs from `timeMs` until whatever cue previously followed it,
 * and any cue already covering that instant is trimmed to end here. That makes
 * repeated capture-as-you-listen the primary authoring gesture: play the
 * audio, hit the button each time the page should turn, and the spans fall out
 * correctly without anyone typing an end time.
 */
export function captureCueAtTime(
  map: PdfSyncMap,
  timeMs: number,
  page: number,
  numPages?: number,
): PdfSyncMap {
  const adjusted = snap(Math.max(0, Math.round(timeMs - map.offsetMs)));
  const maxPage = numPages && numPages > 0 ? numPages : Number.MAX_SAFE_INTEGER;
  const safePage = Math.max(1, Math.min(maxPage, Math.round(page)));

  // Drop any existing cue that starts at (or within a grid step of) this
  // instant, so re-capturing the same moment replaces rather than stacks.
  const kept = map.cues.filter((c) => Math.abs(c.startMs - adjusted) >= CUE_TIME_GRID_MS);

  const next = kept.find((c) => c.startMs > adjusted);
  const endMs = next ? next.startMs : adjusted + Math.max(MIN_CUE_DURATION_MS, 5_000);

  return normalizeSyncMap(
    {
      ...map,
      cues: [...kept, { startMs: adjusted, endMs, page: safePage }],
      revision: (map.revision ?? 0) + 1,
    },
    numPages,
  );
}

/** Remove the cue starting at `startMs`, extending its predecessor over the freed span. */
export function removeCue(map: PdfSyncMap, startMs: number, numPages?: number): PdfSyncMap {
  const cues = map.cues.filter((c) => c.startMs !== startMs);
  return normalizeSyncMap({ ...map, cues, revision: (map.revision ?? 0) + 1 }, numPages);
}

/** Shift one cue's start by `deltaMs`, keeping the list sorted and non-overlapping. */
export function nudgeCue(
  map: PdfSyncMap,
  startMs: number,
  deltaMs: number,
  numPages?: number,
): PdfSyncMap {
  const cues = map.cues.map((c) =>
    c.startMs === startMs
      ? { ...c, startMs: Math.max(0, snap(c.startMs + deltaMs)), endMs: Math.max(0, snap(c.endMs + deltaMs)) }
      : c,
  );
  return normalizeSyncMap({ ...map, cues, revision: (map.revision ?? 0) + 1 }, numPages);
}

/** Apply a global timing correction, in ms. */
export function withOffset(map: PdfSyncMap, offsetMs: number): PdfSyncMap {
  return { ...map, offsetMs: clampOffset(offsetMs), revision: (map.revision ?? 0) + 1 };
}

/**
 * Fold the global offset into every cue and reset it to zero. Lets a reader who
 * nudged a track into place save a map that is correct on its own terms.
 */
export function bakeOffset(map: PdfSyncMap, numPages?: number): PdfSyncMap {
  if (map.offsetMs === 0) return map;
  const cues = map.cues.map((c) => ({
    ...c,
    startMs: Math.max(0, c.startMs + map.offsetMs),
    endMs: Math.max(0, c.endMs + map.offsetMs),
  }));
  return normalizeSyncMap({ ...map, cues, offsetMs: 0, revision: (map.revision ?? 0) + 1 }, numPages);
}

/**
 * Build an evenly-spaced map across `numPages` for an audio of
 * `durationMs` — the old duration-proportional behavior, but materialized as
 * real cues so it becomes an editable starting point instead of an invisible
 * rule. Explicitly a *seed*: the whole point of the feature is that a human
 * then corrects it.
 */
export function seedLinearSyncMap(numPages: number, durationMs: number): PdfSyncMap {
  if (numPages <= 0 || !Number.isFinite(durationMs) || durationMs <= 0) {
    return { ...EMPTY_SYNC_MAP };
  }
  const per = durationMs / numPages;
  const cues: PdfSyncCue[] = Array.from({ length: numPages }, (_, i) => ({
    startMs: snap(i * per),
    endMs: snap((i + 1) * per),
    page: i + 1,
  }));
  return normalizeSyncMap({ offsetMs: 0, cues, revision: 1 }, numPages);
}

/** `mm:ss.mmm` — the precision the editor is actually working at. */
export function formatCueTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const millis = safe % 1000;
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

/** Signed offset for display, e.g. `+1.250s` / `−0.500s`. */
export function formatOffset(ms: number): string {
  if (ms === 0) return '0.000s';
  const sign = ms > 0 ? '+' : '−';
  return `${sign}${(Math.abs(ms) / 1000).toFixed(3)}s`;
}
