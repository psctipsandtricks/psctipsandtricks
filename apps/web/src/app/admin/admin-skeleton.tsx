'use client';

import React from 'react';

export function AdminSkeletonHeader() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-2">
        <div className="h-8 w-48 sm:w-64 skeleton-base rounded-xl" />
        <div className="h-4 w-full max-w-sm skeleton-base rounded-lg" />
      </div>
      <div className="h-10 w-32 sm:w-36 skeleton-base rounded-xl" />
    </div>
  );
}

export function AdminSkeletonKpiGrid({ cardsCount = 4 }: { cardsCount?: number }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${cardsCount} gap-4`}>
      {Array.from({ length: cardsCount }).map((_, i) => (
        <div
          key={i}
          className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 glass-panel space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 skeleton-base rounded-md" />
            <div className="w-8 h-8 rounded-xl skeleton-base" />
          </div>
          <div className="h-7 w-20 skeleton-base rounded-lg" />
          <div className="h-3 w-16 skeleton-base rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function AdminSkeletonTable({ rowsCount = 5, colsCount = 6 }: { rowsCount?: number; colsCount?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 p-6 space-y-4 glass-panel">
      <div className="flex justify-between items-center pb-2">
        <div className="h-6 w-48 skeleton-base rounded-lg" />
        <div className="h-8 w-32 skeleton-base rounded-xl" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center space-x-4 py-2 border-b border-slate-200 dark:border-slate-800">
          {Array.from({ length: colsCount }).map((_, j) => (
            <div key={j} className="h-4 flex-1 skeleton-base rounded-md" />
          ))}
        </div>
        {Array.from({ length: rowsCount }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 py-3">
            {Array.from({ length: colsCount }).map((_, j) => (
              <div
                key={j}
                className={`h-5 flex-1 skeleton-base rounded-lg ${
                  j === 0 ? 'w-1/3' : j === colsCount - 1 ? 'w-16' : 'w-full'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminSkeletonForm() {
  return (
    <div className="max-w-xl p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 glass-panel space-y-6">
      <div className="h-6 w-48 skeleton-base rounded-lg" />
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-28 skeleton-base rounded-md" />
          <div className="h-11 w-full skeleton-base rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 skeleton-base rounded-md" />
          <div className="h-11 w-full skeleton-base rounded-xl" />
        </div>
        <div className="h-11 w-full skeleton-base rounded-xl pt-2" />
      </div>
    </div>
  );
}

export default function AdminSkeleton() {
  return (
    <div className="space-y-8 animate-fadeIn">
      <AdminSkeletonHeader />
      <AdminSkeletonKpiGrid cardsCount={4} />
      <AdminSkeletonTable rowsCount={5} colsCount={6} />
    </div>
  );
}
