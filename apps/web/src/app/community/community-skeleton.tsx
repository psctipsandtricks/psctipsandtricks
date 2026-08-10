'use client';

import React from 'react';

/* ── Primitive ───────────────────────────────────────────────── */
function Sk({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton-base ${className}`} style={style} />;
}

/* ── Single Group Row ────────────────────────────────────────── */
export function GroupRowSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="p-3 flex items-center space-x-3">
      <Sk className="w-11 h-11 rounded-2xl shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Sk className="h-2.5 rounded-full" style={{ width: wide ? '70%' : '55%' }} />
          <Sk className="h-2 w-10 rounded-full shrink-0" />
        </div>
        <Sk className="h-2 rounded-full" style={{ width: '80%' }} />
        <Sk className="h-2 w-16 rounded-full" />
      </div>
    </div>
  );
}

/* ── Single Message Bubble ───────────────────────────────────── */
export function BubbleSkeleton({
  isMe = false,
  bubbleWidth,
  hasSecondLine = false,
}: {
  isMe?: boolean;
  bubbleWidth: string;
  hasSecondLine?: boolean;
}) {
  return (
    <div className={`flex space-x-2.5 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
      <Sk className="w-7 h-7 rounded-lg shrink-0 mt-4" />
      <div className={`space-y-1.5 ${isMe ? 'items-end' : ''}`} style={{ maxWidth: '60%' }}>
        <div className={`flex items-center space-x-2 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
          <Sk className="h-2.5 w-24 rounded-full" />
          <Sk className="h-2 w-10 rounded-full" />
        </div>
        <Sk
          className="rounded-2xl"
          style={{ width: bubbleWidth, height: hasSecondLine ? '52px' : '32px' }}
        />
        <div className={`flex space-x-1 pt-0.5 ${isMe ? 'justify-end' : ''}`}>
          {[28, 24, 28].map((w, i) => (
            <Sk key={i} className="h-5 rounded-full" style={{ width: `${w}px` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Full Community Skeleton (full-page layout) ──────────────── */
export function CommunitySkeleton() {
  return (
    <div className="w-full h-[calc(100vh-64px)] flex flex-col">
      <div className="flex flex-1 h-full overflow-hidden border-t border-slate-200/80 dark:border-slate-800/80">

        {/* LEFT SIDEBAR */}
        <div className="hidden md:flex w-[320px] lg:w-[360px] border-r border-slate-200 dark:border-slate-800/80 flex-col bg-white/95 dark:bg-slate-950/70 shrink-0">
          {/* Header strip */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800/80 space-y-3 bg-slate-50/80 dark:bg-transparent shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sk className="w-7 h-7 rounded-lg" />
                <Sk className="h-3 w-28 rounded-full" />
              </div>
              <Sk className="h-5 w-14 rounded-full" />
            </div>
            <Sk className="h-8 w-full rounded-xl" />
            <div className="flex space-x-1.5 overflow-hidden">
              {[32, 42, 56, 52, 60].map((w, i) => (
                <Sk key={i} className="h-6 rounded-lg shrink-0" style={{ width: `${w}px` }} />
              ))}
            </div>
          </div>
          {/* Group rows */}
          <div className="flex-1 overflow-hidden divide-y divide-slate-200 dark:divide-slate-800/40">
            <GroupRowSkeleton wide />
            <GroupRowSkeleton />
            <GroupRowSkeleton wide />
            <GroupRowSkeleton />
            <GroupRowSkeleton wide />
            <GroupRowSkeleton />
          </div>
        </div>

        {/* RIGHT PANE */}
        <div className="flex-1 min-w-0 flex flex-col bg-slate-100/60 dark:bg-slate-950/20">
          {/* Chat header */}
          <div className="p-3 px-5 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <Sk className="w-9 h-9 rounded-xl shrink-0" />
              <div className="space-y-2">
                <Sk className="h-3 w-44 rounded-full" />
                <Sk className="h-2 w-32 rounded-full" />
              </div>
            </div>
            <Sk className="h-8 w-24 rounded-xl" />
          </div>
          {/* Pinned bar */}
          <div className="px-5 py-2.5 border-b border-indigo-500/20 bg-indigo-500/5 flex items-center space-x-2 shrink-0">
            <Sk className="w-3.5 h-3.5 rounded shrink-0" />
            <Sk className="h-2.5 w-3/5 rounded-full" />
          </div>
          {/* Message stream */}
          <div className="flex-1 p-4 space-y-5 overflow-hidden">
            <div className="flex justify-center">
              <Sk className="h-5 w-16 rounded-full" />
            </div>
            <BubbleSkeleton bubbleWidth="240px" hasSecondLine />
            <BubbleSkeleton isMe bubbleWidth="160px" />
            <BubbleSkeleton bubbleWidth="200px" hasSecondLine />
            <BubbleSkeleton isMe bubbleWidth="300px" hasSecondLine />
            <BubbleSkeleton bubbleWidth="180px" />
            <BubbleSkeleton isMe bubbleWidth="220px" />
            <BubbleSkeleton bubbleWidth="260px" hasSecondLine />
          </div>
          {/* Input bar */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/80 flex items-center space-x-2 shrink-0">
            <Sk className="w-9 h-9 rounded-xl shrink-0" />
            <Sk className="flex-1 h-9 rounded-xl" />
            <Sk className="w-9 h-9 rounded-xl shrink-0" />
            <Sk className="w-20 h-9 rounded-xl shrink-0" />
          </div>
        </div>

      </div>
    </div>
  );
}
