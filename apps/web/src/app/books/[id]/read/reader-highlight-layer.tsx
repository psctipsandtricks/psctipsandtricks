'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  argbToCss,
  eraserHits,
  thinPoints,
  toPairs,
  type AnnotationTool,
  type ReaderHighlight,
} from './reader-highlights';

/**
 * The marker and eraser over one PDF page.
 *
 * An SVG with a `0 0 1 1` viewBox stretched over the page, so its own
 * coordinate space *is* the normalised page space the strokes are stored in —
 * no conversion on paint, and no re-layout when the reader zooms or the window
 * changes width. Because it is a child of the page element it also scrolls with
 * the page for free, which is what keeps the marks welded to the text.
 */
export function ReaderHighlightLayer({
  page,
  tool,
  highlights,
  onDraw,
  onErase,
  color,
  strokeWidth,
  aspectRatio,
}: {
  /** Zero-based, matching what is stored. */
  page: number;
  tool: AnnotationTool;
  highlights: ReaderHighlight[];
  onDraw: (points: number[]) => void;
  onErase: (ids: string[]) => void;
  color: number;
  strokeWidth: number;
  /** Page height ÷ width. Sets the viewBox so the two axes scale together. */
  aspectRatio: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [wet, setWet] = useState<number[] | null>(null);
  /** Rubbed out under the pointer, so the page shows what letting go will leave. */
  const [pendingErase, setPendingErase] = useState<Set<string>>(new Set());
  const drawing = useRef(false);

  const active = tool !== 'none';
  // A page that has not reported its shape yet still has to draw something
  // sane; A4 is the overwhelmingly common case for study material.
  const aspect = aspectRatio > 0 ? aspectRatio : 1.414;

  const toPage = useCallback((e: React.PointerEvent): [number, number] | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return [x, y];
  }, []);

  const eraseAt = useCallback(
    (x: number, y: number) => {
      setPendingErase((prev) => {
        let next: Set<string> | null = null;
        for (const h of highlights) {
          if (prev.has(h.id)) continue;
          if (eraserHits(h, page, x, y)) {
            next ??= new Set(prev);
            next.add(h.id);
          }
        }
        return next ?? prev;
      });
    },
    [highlights, page]
  );

  const handleDown = (e: React.PointerEvent) => {
    if (!active) return;
    const at = toPage(e);
    if (!at) return;
    // Captured so a stroke that wanders off the page still finishes cleanly
    // rather than being abandoned mid-line.
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    drawing.current = true;
    if (tool === 'marker') setWet([at[0], at[1]]);
    else eraseAt(at[0], at[1]);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!active || !drawing.current) return;
    const at = toPage(e);
    if (!at) return;
    if (tool === 'marker') setWet((prev) => (prev ? [...prev, at[0], at[1]] : prev));
    else eraseAt(at[0], at[1]);
  };

  const handleUp = () => {
    if (!drawing.current) return;
    drawing.current = false;

    if (tool === 'marker') {
      const points = wet;
      setWet(null);
      if (points && points.length >= 2) onDraw(thinPoints(points));
      return;
    }

    if (pendingErase.size > 0) {
      // One list rather than one call per stroke: a single swipe can cross
      // several, and the page should lose them together.
      onErase(Array.from(pendingErase));
      setPendingErase(new Set());
    }
  };

  const onPage = highlights.filter((h) => h.page === page && !pendingErase.has(h.id));

  // Stored y is a fraction of the page's height; viewBox y runs to `aspect`.
  const path = (points: number[]) => {
    const pairs = toPairs(points);
    if (pairs.length === 0) return '';
    if (pairs.length === 1) {
      // A dot: a zero-length segment with a round cap draws as a circle.
      const [x, y] = pairs[0];
      return `M ${x} ${y * aspect} L ${x} ${y * aspect}`;
    }
    return pairs
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y * aspect}`)
      .join(' ');
  };

  return (
    <svg
      ref={svgRef}
      // The viewBox is one page wide and `aspectRatio` tall, matching the
      // element it fills, so x and y scale by the same factor. A square viewBox
      // stretched over a portrait page would scale them differently — round
      // pen caps would come out as ellipses and the nib would be far wider
      // across the page than down it.
      viewBox={`0 0 1 ${aspect}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      style={{
        // Transparent to the mouse until a tool is picked up, so a reader who
        // never highlights cannot tell the layer is there — text selection,
        // panning and scrolling all behave exactly as before.
        pointerEvents: active ? 'auto' : 'none',
        cursor: active ? 'crosshair' : undefined,
        // A highlighter darkens what is under it rather than covering it, which
        // is the whole point of one: the words stay readable.
        mixBlendMode: 'multiply',
        touchAction: active ? 'none' : undefined,
        zIndex: 5,
      }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      {onPage.map((h) => (
        <path
          key={h.id}
          d={path(h.points)}
          fill="none"
          stroke={argbToCss(h.color)}
          // In viewBox units, where 1 is the page's width — which is exactly
          // what the width is stored as a fraction of.
          strokeWidth={h.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {wet && (
        <path
          d={path(wet)}
          fill="none"
          stroke={argbToCss(color)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
