'use client';

import React from 'react';
import { Skeleton, Card } from '@psc/ui';

export function QuizHubSkeleton() {
  return (
    <div className="space-y-6 py-4 animate-fadeIn">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 sm:w-80 rounded-xl" />
        <Skeleton className="h-4 w-full max-w-lg rounded-lg" />
      </div>

      {/* Filter & Search Bar Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <Skeleton className="h-11 w-full sm:w-80 rounded-xl" />
        <Skeleton className="h-11 w-full sm:w-64 rounded-xl" />
      </div>

      {/* Folder Tabs Skeleton */}
      <div className="flex space-x-2 overflow-hidden pb-1">
        <Skeleton className="h-9 w-32 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-36 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>

      {/* Quiz Grid Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-5 space-y-4 flex flex-col justify-between border border-slate-200/80 dark:border-slate-800/80">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-6 w-3/4 rounded-lg" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
              <div className="flex space-x-3 pt-2">
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
            </div>
            <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex justify-between items-center">
              <Skeleton className="h-6 w-16 rounded-lg" />
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function QuizTakingSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 animate-fadeIn">
      {/* Top Timer & Progress Bar Skeleton */}
      <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-md">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
        </div>
        <div className="flex items-center space-x-3 text-right">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <Skeleton className="w-9 h-9 rounded-lg" />
        </div>
      </div>

      {/* Question Card Skeleton */}
      <Card className="p-6 space-y-6 border border-slate-200/80 dark:border-slate-800/80">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-6 w-full rounded-lg" />
          <Skeleton className="h-6 w-4/5 rounded-lg" />
        </div>

        {/* 4 Option Buttons Skeleton */}
        <div className="space-y-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-full flex items-center space-x-3 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
              <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
              <Skeleton className="h-5 w-3/4 rounded-md" />
            </div>
          ))}
        </div>

        {/* Footer Navigation Buttons Skeleton */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </Card>
    </div>
  );
}

export function BookCatalogSkeleton() {
  return (
    <div className="space-y-6 py-4 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 sm:w-80 rounded-xl" />
          <Skeleton className="h-4 w-full max-w-md rounded-lg" />
        </div>
        <Skeleton className="h-11 w-full sm:w-72 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-6 space-y-4 flex flex-col justify-between border border-slate-200/80 dark:border-slate-800/80">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-12 rounded-md" />
              </div>
              <Skeleton className="h-6 w-5/6 rounded-lg" />
              <Skeleton className="h-4 w-1/3 rounded-md" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex justify-between items-center">
              <Skeleton className="h-7 w-20 rounded-lg" />
              <div className="flex space-x-2">
                <Skeleton className="h-9 w-20 rounded-xl" />
                <Skeleton className="h-9 w-24 rounded-xl" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function CommunitySkeleton() {
  return (
    <div className="space-y-6 py-4 animate-fadeIn">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-4 w-full max-w-md rounded-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5 space-y-3 border border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-center space-x-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-14 w-full rounded-xl" />
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function AuthSkeleton() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 animate-fadeIn">
      <Card className="w-full max-w-md p-6 space-y-6 border border-slate-200/80 dark:border-slate-800/80">
        <div className="text-center space-y-2">
          <Skeleton className="w-12 h-12 rounded-2xl mx-auto" />
          <Skeleton className="h-7 w-48 mx-auto rounded-xl" />
          <Skeleton className="h-4 w-64 mx-auto rounded-md" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </Card>
    </div>
  );
}
