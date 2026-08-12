'use client';

import React, { useEffect, useRef, useState } from 'react';

interface StatCounterProps {
  /** Numeric target the count animates up to. */
  value: number;
  /** Rendered after the number, e.g. "+" or "%". */
  suffix?: string;
  className?: string;
}

/**
 * Animates from 0 up to `value` once the counter scrolls into view.
 *
 * SSR always renders the final value as plain text, so a crawler or a client
 * with JS disabled sees the real number immediately — the animation is a
 * progressive enhancement layered on top via a client-only effect, never the
 * only way the number reaches the page.
 */
export function StatCounter({ value, suffix = '', className }: StatCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || animated) return;

    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setAnimated(true);
        observer.disconnect();

        const durationMs = 1400;
        const start = performance.now();

        const tick = (now: number) => {
          const progress = Math.min((now - start) / durationMs, 1);
          // easeOutExpo — fast start, gentle settle.
          const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          setDisplay(Math.round(eased * value));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animated, value]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString('en-IN')}
      {suffix}
    </span>
  );
}
