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

export function AdminSkeletonTable({ rowsCount = 6, colsCount = 5 }: { rowsCount?: number; colsCount?: number }) {
  return (
    <div className="w-full overflow-hidden">
      <div className="grid grid-cols-12 gap-4 px-6 py-3.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800 text-xs font-bold">
        <div className="col-span-4"><div className="h-4 w-28 skeleton-base rounded-md" /></div>
        <div className="col-span-2"><div className="h-4 w-20 skeleton-base rounded-md" /></div>
        <div className="col-span-2"><div className="h-4 w-20 skeleton-base rounded-md" /></div>
        <div className="col-span-2"><div className="h-4 w-16 skeleton-base rounded-md" /></div>
        <div className="col-span-2 text-right"><div className="h-4 w-14 skeleton-base rounded-md ml-auto" /></div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: rowsCount }).map((_, i) => (
          <div key={i} className="grid grid-cols-12 gap-4 px-6 py-3.5 items-center">
            <div className="col-span-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl skeleton-base shrink-0" />
              <div className="space-y-1 flex-1 min-w-0">
                <div className="h-4 w-3/4 skeleton-base rounded-md" />
                <div className="h-3 w-1/3 skeleton-base rounded-md" />
              </div>
            </div>
            <div className="col-span-2">
              <div className="h-4 w-20 skeleton-base rounded-md" />
            </div>
            <div className="col-span-2">
              <div className="h-4 w-20 skeleton-base rounded-md" />
            </div>
            <div className="col-span-2">
              <div className="h-5 w-16 skeleton-base rounded-full" />
            </div>
            <div className="col-span-2 flex justify-end gap-1.5">
              <div className="w-7 h-7 rounded-lg skeleton-base" />
              <div className="w-7 h-7 rounded-lg skeleton-base" />
            </div>
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
