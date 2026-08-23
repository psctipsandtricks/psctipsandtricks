'use client';

import React, { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section';
  id?: string;
}

/** A block this close to the viewport bottom counts as already on screen. */
const IN_VIEW_RATIO = 0.9;

/**
 * Fades a block up as it scrolls into view, once.
 *
 * Built to fail *visible*. The markup renders fully opaque; only JS hides it,
 * and only when the block starts below the fold. Two independent triggers then
 * bring it back — an IntersectionObserver and a plain scroll listener — so the
 * content still appears if either one is unavailable. With JS off, nothing
 * hides in the first place.
 */
export function Reveal({ children, className = '', as = 'div', id }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const isOnScreen = () => node.getBoundingClientRect().top < window.innerHeight * IN_VIEW_RATIO;

    // Already painted where the reader can see it — animating now would flash
    // content that is being read.
    if (isOnScreen()) return;

    setIsHidden(true);

    let observer: IntersectionObserver | undefined;
    const onScroll = () => {
      if (isOnScreen()) reveal();
    };
    const reveal = () => {
      setIsHidden(false);
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll);
    };

    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) reveal();
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.04 },
      );
      observer.observe(node);
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const Tag = as;
  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      id={id}
      className={`reveal-on-scroll ${isHidden ? 'is-hidden' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}
