/**
 * Marker strokes on a book's PDF, shared with the mobile app.
 *
 * Points are **fractions of the page box** — `x` across, `y` down, both in
 * `[0, 1]`. That is what lets a highlight drawn on a phone land on the same
 * words in a desktop browser at any zoom: a pixel path is only true for the
 * viewport that drew it. Same convention the audio sync map already uses.
 */
export interface ReaderHighlight {
  id: string;
  /** Zero-based, as both viewers count. */
  page: number;
  /** Flat `[x0, y0, x1, y1, …]`. */
  points: number[];
  /** ARGB as an integer, which is how the mobile client's colour type reads it. */
  color: number;
  /** Nib width as a fraction of the page width. */
  width: number;
  createdAt?: string;
}

export type AnnotationTool = 'none' | 'marker' | 'eraser';

/** Highlighter yellow at 40% — the same value the app writes. */
export const DEFAULT_HIGHLIGHT_COLOR = 0x66ffd54f;

/** About the height of a line of body text on a typical study PDF. */
export const DEFAULT_HIGHLIGHT_WIDTH = 0.035;

/** How close a click has to land to rub a stroke out, in page fractions. */
export const ERASER_RADIUS = 0.03;

/** ARGB integer → a CSS colour the browser understands. */
export function argbToCss(argb: number): string {
  const a = ((argb >>> 24) & 0xff) / 255;
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

/** `[x0,y0,x1,y1,…]` → the pairs a path needs. */
export function toPairs(points: number[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    pairs.push([points[i], points[i + 1]]);
  }
  return pairs;
}

/** Distance from a point to a line segment, all in page fractions. */
function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);

  // How far along AB the closest point lies, clamped to the segment itself.
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Whether the eraser at (x, y) on `page` should rub out `highlight`.
 *
 * Whole strokes go, not parts of them — that is what makes a highlight one
 * thing to remove and one row to delete, and it matches the app exactly so the
 * two behave the same way on the same marks.
 */
export function eraserHits(
  highlight: ReaderHighlight,
  page: number,
  x: number,
  y: number,
  radius = ERASER_RADIUS
): boolean {
  if (highlight.page !== page) return false;
  const pairs = toPairs(highlight.points);
  if (pairs.length === 0) return false;
  if (pairs.length === 1) {
    return Math.hypot(pairs[0][0] - x, pairs[0][1] - y) <= radius;
  }
  for (let i = 0; i + 1 < pairs.length; i++) {
    const [ax, ay] = pairs[i];
    const [bx, by] = pairs[i + 1];
    if (distanceToSegment(x, y, ax, ay, bx, by) <= radius) return true;
  }
  return false;
}

/**
 * Drops points too close together to see.
 *
 * A pointer drag reports a move per frame; at speed that is hundreds of points
 * for one swipe, almost all of them moving the line by less than it is thick.
 */
export function thinPoints(points: number[], minSpacing = 0.004): number[] {
  const pairs = toPairs(points);
  if (pairs.length <= 2) return points;

  const kept: [number, number][] = [pairs[0]];
  for (let i = 1; i < pairs.length - 1; i++) {
    const last = kept[kept.length - 1];
    if (Math.hypot(pairs[i][0] - last[0], pairs[i][1] - last[1]) >= minSpacing) {
      kept.push(pairs[i]);
    }
  }
  // Where the pointer lifted always survives, or the stroke visibly ends short
  // of where it was drawn.
  const last = pairs[pairs.length - 1];
  const tail = kept[kept.length - 1];
  if (last[0] !== tail[0] || last[1] !== tail[1]) kept.push(last);

  return kept.flat();
}
