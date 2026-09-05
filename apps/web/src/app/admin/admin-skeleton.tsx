'use client';

import React from 'react';
import { Card, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@psc/ui';

export function AdminSkeletonHeader({
  titleWidth = 'w-56',
  hasButton = true,
  buttonWidth = 'w-36',
}: {
  titleWidth?: string;
  hasButton?: boolean;
  buttonWidth?: string;
}) {
  return (
    <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
      <div className="space-y-1.5">
        <div className={`h-8 ${titleWidth} bg-slate-200 dark:bg-[#1e2e56] rounded-xl`} />
        <div className="h-4 w-72 max-w-full bg-slate-100 dark:bg-[#132044] rounded-lg" />
      </div>
      {hasButton && (
        <div className="flex items-center gap-2.5">
          <div className={`h-10 ${buttonWidth} bg-slate-200 dark:bg-[#1e2e56] rounded-xl`} />
        </div>
      )}
    </div>
  );
}

export function AdminSkeletonKpiGrid({ cardsCount = 4 }: { cardsCount?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: cardsCount }).map((_, i) => (
        <Card key={i} className="p-5 border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded-md" />
            <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-[#1e2e56]" />
          </div>
          <div className="h-7 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
          <div className="h-3 w-16 bg-slate-100 dark:bg-[#132044] rounded-md" />
        </Card>
      ))}
    </div>
  );
}

/** Generic compact skeleton table */
export function AdminSkeletonTable({ rowsCount = 4 }: { rowsCount?: number; colsCount?: number }) {
  return (
    <Card className="w-full p-0 overflow-hidden admin-table-card border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124]">
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 dark:bg-[#0c152e]/80">
              <TableHead className="w-12"><div className="h-3.5 w-6 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
              <TableHead><div className="h-3.5 w-32 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
              <TableHead><div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
              <TableHead><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
              <TableHead className="text-right"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded ml-auto" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowsCount }).map((_, i) => (
              <TableRow key={i} className="animate-pulse border-b border-slate-100 dark:border-[#1e2e56]/40">
                <TableCell className="py-2.5"><div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-[#1a2b58]" /></TableCell>
                <TableCell className="py-2.5">
                  <div className="space-y-1">
                    <div className="h-3.5 w-48 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                    <div className="h-2.5 w-28 bg-slate-100 dark:bg-[#132044] rounded" />
                  </div>
                </TableCell>
                <TableCell className="py-2.5"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                <TableCell className="py-2.5"><div className="h-4 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-full" /></TableCell>
                <TableCell className="py-2.5 text-right"><div className="h-6 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-lg ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/** Accurate E-Book Content Management Skeleton Loader */
export function BooksPageSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl w-full animate-pulse">
      {/* Header with Search and Add Button */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <div className="h-8 w-64 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-4 w-80 bg-slate-100 dark:bg-[#132044] rounded-lg" />
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="h-10 w-full sm:w-64 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-10 w-36 bg-slate-200 dark:bg-[#1e2e56] rounded-xl shrink-0" />
        </div>
      </div>

      {/* Table Card matching Cover, Title, Author, Category, Status, Price, Orders, Actions */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card p-0">
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-[#0c152e]/80">
                <TableHead className="w-20"><div className="h-3.5 w-12 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="min-w-[200px]"><div className="h-3.5 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead><div className="h-3.5 w-14 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="text-right"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded ml-auto" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx} className="border-b border-slate-100 dark:border-[#1e2e56]/40">
                  <TableCell className="py-2.5"><div className="w-16 h-10 rounded-lg bg-slate-200 dark:bg-[#1a2b58]" /></TableCell>
                  <TableCell className="py-2.5">
                    <div className="space-y-1">
                      <div className="h-3.5 w-44 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      <div className="h-2.5 w-24 bg-slate-100 dark:bg-[#132044] rounded" />
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5"><div className="h-3.5 w-28 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-2.5"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-2.5"><div className="h-4 w-14 bg-slate-200 dark:bg-[#1a2b58] rounded-full" /></TableCell>
                  <TableCell className="py-2.5"><div className="h-3.5 w-12 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-2.5"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-2.5 text-right"><div className="h-7 w-20 bg-slate-200 dark:bg-[#1a2b58] rounded-lg ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/** Accurate Videos & PDFs Library Skeleton Loader */
export function MediaLibrarySkeleton({ isPdf = false }: { isPdf?: boolean }) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl w-full animate-pulse">
      {/* Header */}
      <div className="shrink-0 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="h-8 w-44 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
              <div className="h-5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded-full" />
            </div>
            <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-[#132044] rounded-lg" />
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <div className="h-9 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
            <div className="h-9 w-32 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          </div>
        </div>

        {/* Search Bar */}
        <div className="h-10 max-w-md bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
      </div>

      {/* Table Card */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card p-0">
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-[#0c152e]/80">
                <TableHead className="min-w-[220px]"><div className="h-3.5 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-32"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-28"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-28"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-36 text-right"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded ml-auto" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx} className="border-b border-slate-100 dark:border-[#1e2e56]/40">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-[#1a2b58] shrink-0" />
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 shrink-0" />
                      <div className="h-3.5 w-44 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3"><div className="h-4 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-full" /></TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <div className="h-6 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                      <div className="h-6 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                      <div className="h-6 w-14 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/** Accurate Push Notifications Skeleton Loader */
export function NotificationsPageSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl w-full px-1 sm:px-0 animate-pulse">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-cyan-500/20" />
            <div className="h-8 w-56 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          </div>
          <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-[#132044] rounded-lg" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded-full" />
          <div className="h-7 w-40 bg-slate-200 dark:bg-[#1e2e56] rounded-full" />
          <div className="h-10 w-44 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
        </div>
      </div>

      {/* Table Card with Search, Status Pills & Category Chips */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card p-0">
        <div className="shrink-0 p-4 sm:p-5 border-b border-slate-200/80 dark:border-[#1e2e56] space-y-3 bg-slate-50/40 dark:bg-[#0c152e]/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="h-10 w-full md:w-96 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
              <div className="h-8 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
              <div className="h-8 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
            </div>
          </div>
          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pt-1">
            <div className="h-7 w-28 bg-cyan-500/20 rounded-lg shrink-0" />
            <div className="h-7 w-36 bg-slate-200 dark:bg-[#1e2e56] rounded-lg shrink-0" />
            <div className="h-7 w-44 bg-slate-200 dark:bg-[#1e2e56] rounded-lg shrink-0" />
            <div className="h-7 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded-lg shrink-0" />
            <div className="h-7 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded-lg shrink-0" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-[#0c152e]/80">
                <TableHead className="w-20"><div className="h-3.5 w-14 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="min-w-[200px]"><div className="h-3.5 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-28"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-24"><div className="h-3.5 w-14 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-32"><div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-36"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-32"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-32"><div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-20 text-right"><div className="h-3.5 w-12 bg-slate-200 dark:bg-[#1e2e56] rounded ml-auto" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="border-b border-slate-100 dark:border-[#1e2e56]/40">
                  <TableCell className="py-3"><div className="w-14 aspect-video rounded-lg bg-slate-200 dark:bg-[#1a2b58]" /></TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-1">
                      <div className="h-3.5 w-36 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      <div className="h-2.5 w-44 bg-slate-100 dark:bg-[#132044] rounded" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3"><div className="h-5 w-24 bg-slate-200 dark:bg-[#1a2b58] rounded-full" /></TableCell>
                  <TableCell className="py-3"><div className="h-5 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-full" /></TableCell>
                  <TableCell className="py-3"><div className="h-5 w-24 bg-slate-200 dark:bg-[#1a2b58] rounded-full" /></TableCell>
                  <TableCell className="py-3"><div className="h-3.5 w-28 bg-slate-100 dark:bg-[#132044] rounded" /></TableCell>
                  <TableCell className="py-3"><div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-1">
                      <div className="h-3 w-20 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      <div className="h-2 w-14 bg-slate-100 dark:bg-[#132044] rounded" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-6 h-6 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                      <div className="w-6 h-6 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footer Pagination */}
        <div className="p-3.5 border-t border-slate-200/80 dark:border-[#1e2e56] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#0c152e]/50">
          <div className="h-4 w-44 bg-slate-200 dark:bg-[#1e2e56] rounded" />
          <div className="h-7 w-48 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
        </div>
      </Card>
    </div>
  );
}

/** Accurate Customer Reviews Skeleton Loader */
export function ReviewsPageSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl w-full px-1 sm:px-0 animate-pulse">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <div className="h-8 w-56 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-4 w-80 max-w-full bg-slate-100 dark:bg-[#132044] rounded-lg" />
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="h-10 w-full sm:w-64 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-10 w-32 bg-slate-200 dark:bg-[#1e2e56] rounded-xl shrink-0" />
        </div>
      </div>

      {/* Table Card */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card p-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-[#0c152e]/80">
                <TableHead className="w-48"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-36"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="min-w-[260px]"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-32"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-28"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-32 text-right"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded ml-auto" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-slate-100 dark:border-[#1e2e56]/40">
                  <TableCell className="py-3.5"><div className="h-4 w-32 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, si) => (
                        <div key={si} className="w-3.5 h-3.5 rounded-full bg-amber-400/30" />
                      ))}
                      <div className="h-3.5 w-6 bg-slate-200 dark:bg-[#1a2b58] rounded ml-1" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="space-y-1">
                      <div className="h-3.5 w-full max-w-md bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      <div className="h-2.5 w-3/4 max-w-sm bg-slate-100 dark:bg-[#132044] rounded" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5"><div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3.5"><div className="h-5 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-full" /></TableCell>
                  <TableCell className="py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-7 h-7 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                      <div className="h-7 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                      <div className="w-7 h-7 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footer Pagination */}
        <div className="p-3.5 border-t border-slate-200/80 dark:border-[#1e2e56] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#0c152e]/50">
          <div className="h-4 w-40 bg-slate-200 dark:bg-[#1e2e56] rounded" />
          <div className="h-7 w-48 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
        </div>
      </Card>
    </div>
  );
}

/** Accurate Coupon Code Management Skeleton Loader */
export function CouponsPageSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl w-full px-1 sm:px-0 animate-pulse">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <div className="h-8 w-64 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-4 w-80 max-w-full bg-slate-100 dark:bg-[#132044] rounded-lg" />
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="h-10 w-full sm:w-64 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-10 w-36 bg-slate-200 dark:bg-[#1e2e56] rounded-xl shrink-0" />
        </div>
      </div>

      {/* Table Card */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card p-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-[#0c152e]/80">
                <TableHead className="w-36"><div className="h-3.5 w-14 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-32"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-36"><div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-36"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-32"><div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-28"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-32 text-right"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded ml-auto" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} className="border-b border-slate-100 dark:border-[#1e2e56]/40">
                  <TableCell className="py-3.5"><div className="h-4 w-20 bg-cyan-500/20 rounded" /></TableCell>
                  <TableCell className="py-3.5"><div className="h-4 w-12 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3.5"><div className="h-4 w-14 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3.5"><div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3.5"><div className="h-3.5 w-6 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3.5"><div className="h-5 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-full" /></TableCell>
                  <TableCell className="py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-7 h-7 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                      <div className="h-7 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                      <div className="w-7 h-7 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footer Pagination */}
        <div className="p-3.5 border-t border-slate-200/80 dark:border-[#1e2e56] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#0c152e]/50">
          <div className="h-4 w-40 bg-slate-200 dark:bg-[#1e2e56] rounded" />
          <div className="h-7 w-48 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
        </div>
      </Card>
    </div>
  );
}

/** Accurate Social Media Links Skeleton Loader */
export function SocialLinksPageSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl animate-pulse">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="h-8 w-60 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
        <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-[#132044] rounded-lg" />
      </div>

      {/* Card Form */}
      <Card className="p-6 space-y-5 border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="h-6 w-36 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
          <div className="h-3.5 w-72 bg-slate-100 dark:bg-[#132044] rounded-md" />
        </div>

        <div className="space-y-4 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0c152e]/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-[#1a2b58]" />
                  <div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded" />
                </div>
                <div className="h-3 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" />
              </div>
              <div className="h-10 w-full bg-slate-200 dark:bg-[#1a2b58] rounded-xl" />
            </div>
          ))}
        </div>

        <div className="pt-2">
          <div className="h-10 w-36 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
        </div>
      </Card>
    </div>
  );
}

/** Accurate App Update Settings Skeleton Loader */
export function AppUpdatePageSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl animate-pulse">
      <div className="space-y-1.5">
        <div className="h-8 w-64 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
        <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-[#132044] rounded-lg" />
      </div>

      <Card className="p-6 space-y-5 border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] rounded-2xl shadow-sm">
        <div className="h-14 w-full bg-slate-100 dark:bg-[#0c152e]/60 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="h-20 bg-slate-100 dark:bg-[#0c152e]/60 rounded-xl" />
          <div className="h-20 bg-slate-100 dark:bg-[#0c152e]/60 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-16 bg-slate-100 dark:bg-[#0c152e]/60 rounded-xl" />
          <div className="h-16 bg-slate-100 dark:bg-[#0c152e]/60 rounded-xl" />
        </div>
        <div className="h-14 w-full bg-slate-100 dark:bg-[#0c152e]/60 rounded-xl" />
        <div className="h-24 w-full bg-slate-100 dark:bg-[#0c152e]/60 rounded-xl" />
        <div className="h-10 w-40 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
      </Card>
    </div>
  );
}

/** Accurate Orders & Transactions Skeleton Loader */
export function OrdersPageSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl w-full px-1 sm:px-0 animate-pulse">
      {/* Header & Actions */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-8 w-72 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-[#132044] rounded-lg" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-44 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-10 w-44 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
        </div>
      </div>

      {/* Filter & Summary Card */}
      <Card className="shrink-0 p-4 border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] shadow-xs space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="h-10 w-full bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-10 w-full bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-10 w-full bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-10 w-full bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
        </div>

        {/* Summary Badges Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-[#1e2e56]/60">
          <div className="h-6 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
          <div className="h-6 w-48 bg-emerald-500/20 rounded-lg" />
          <div className="h-6 w-24 bg-emerald-500/15 rounded-lg" />
          <div className="h-6 w-24 bg-amber-500/15 rounded-lg" />
          <div className="h-6 w-20 bg-purple-500/15 rounded-lg" />
          <div className="h-6 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
        </div>
      </Card>

      {/* Table Card */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card p-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-[#0c152e]/80">
                <TableHead className="w-40"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="min-w-[200px]"><div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="min-w-[240px]"><div className="h-3.5 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-36"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-28"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-48"><div className="h-3.5 w-32 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, idx) => (
                <TableRow key={idx} className="border-b border-slate-100 dark:border-[#1e2e56]/40">
                  <TableCell className="py-3.5"><div className="h-3.5 w-28 bg-slate-200 dark:bg-[#1a2b58] rounded font-mono" /></TableCell>
                  <TableCell className="py-3.5">
                    <div className="space-y-1">
                      <div className="h-3.5 w-32 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      <div className="h-2.5 w-44 bg-slate-100 dark:bg-[#132044] rounded" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-3.5 w-48 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      {idx % 2 === 1 && <div className="h-4 w-14 bg-cyan-500/20 rounded-md shrink-0" />}
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="space-y-1">
                      <div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      <div className="h-2.5 w-16 bg-slate-100 dark:bg-[#132044] rounded" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5"><div className="h-4 w-12 bg-cyan-500/20 rounded" /></TableCell>
                  <TableCell className="py-3.5"><div className="h-3.5 w-36 bg-slate-100 dark:bg-[#132044] rounded font-mono" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footer Pagination */}
        <div className="p-3.5 border-t border-slate-200/80 dark:border-[#1e2e56] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#0c152e]/50">
          <div className="h-4 w-44 bg-slate-200 dark:bg-[#1e2e56] rounded" />
          <div className="h-7 w-48 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
        </div>
      </Card>
    </div>
  );
}

export function AdminSkeletonForm() {
  return (
    <div className="max-w-xl p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 glass-panel space-y-6 animate-pulse">
      <div className="h-6 w-48 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-28 bg-slate-100 dark:bg-[#132044] rounded-md" />
          <div className="h-11 w-full bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 bg-slate-100 dark:bg-[#132044] rounded-md" />
          <div className="h-11 w-full bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
        </div>
        <div className="h-11 w-full bg-slate-200 dark:bg-[#1e2e56] rounded-xl pt-2" />
      </div>
    </div>
  );
}

/** Accurate Admin Dashboard Skeleton matching Welcome header, KPI Grid, Revenue Chart card, and Recent Transactions table */
export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse w-full">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-8 w-64 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-4 w-72 bg-slate-100 dark:bg-[#132044] rounded-lg" />
        </div>
        <div className="h-7 w-28 bg-emerald-500/20 border border-emerald-500/30 rounded-full" />
      </div>

      {/* SECTION 1 • LIVE ENVIRONMENT */}
      <div className="space-y-3">
        <div className="h-3 w-48 bg-slate-200 dark:bg-[#1e2e56] rounded-sm" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5 border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded-md" />
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15" />
              </div>
              <div className="h-7 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
              <div className="h-3.5 w-16 bg-slate-100 dark:bg-[#132044] rounded-md" />
            </Card>
          ))}
        </div>
      </div>

      {/* SECTION 2 • PLATFORM ANALYTICS */}
      <div className="space-y-3">
        <div className="h-3 w-56 bg-slate-200 dark:bg-[#1e2e56] rounded-sm" />
        <Card className="p-6 space-y-4 bg-white dark:bg-[#0c152e] border border-slate-200/80 dark:border-[#1e2e56]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 rounded-md bg-cyan-500/20" />
              <div className="h-5 w-72 bg-slate-200 dark:bg-[#1e2e56] rounded-md" />
            </div>
            <div className="h-6 w-36 bg-cyan-500/10 border border-cyan-500/20 rounded-full" />
          </div>
          {/* Chart waveform skeleton */}
          <div className="h-72 w-full pt-6 flex items-end justify-between gap-3 sm:gap-6 px-2">
            {[45, 60, 35, 75, 50, 90, 65, 80, 55, 70, 85, 95].map((val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-slate-200 dark:bg-[#1a2b58] rounded-t-lg"
                  style={{ height: `${val}%` }}
                />
                <div className="h-2.5 w-6 bg-slate-100 dark:bg-[#132044] rounded" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* SECTION 3 • RECENT TRANSACTIONS */}
      <div className="space-y-3">
        <div className="h-3 w-64 bg-slate-200 dark:bg-[#1e2e56] rounded-sm" />
        <Card className="p-6 space-y-4 bg-white dark:bg-[#0c152e] border border-slate-200/80 dark:border-[#1e2e56]">
          <div className="flex items-center justify-between">
            <div className="h-5 w-56 bg-slate-200 dark:bg-[#1e2e56] rounded-md" />
            <div className="h-4 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded-md" />
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-[#0c152e]/80">
                <TableHead><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead><div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead><div className="h-3.5 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead><div className="h-3.5 w-14 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx} className="border-b border-slate-100 dark:border-[#1e2e56]/40">
                  <TableCell className="py-3"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3"><div className="h-3.5 w-36 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3"><div className="h-3.5 w-44 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3"><div className="h-3.5 w-14 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1a2b58] rounded" /></TableCell>
                  <TableCell className="py-3"><div className="h-5 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-full" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

/** Accurate Announcements Management Skeleton Loader */
export function AnnouncementsPageSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl w-full px-1 sm:px-0 animate-pulse">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-64 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
            <div className="h-5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded-full" />
          </div>
          <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-[#132044] rounded-lg" />
        </div>
        <div className="h-10 w-44 bg-slate-200 dark:bg-[#1e2e56] rounded-xl shrink-0" />
      </div>

      {/* 3 KPI Stats Grid */}
      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4 flex items-center justify-between border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124]">
            <div className="space-y-2">
              <div className="h-3 w-24 bg-slate-100 dark:bg-[#132044] rounded" />
              <div className="h-7 w-12 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-[#1e2e56]" />
          </Card>
        ))}
      </div>

      {/* Main Table Card */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card p-0">
        {/* Card Header with Search & View Toggle */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-[#1e2e56] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="space-y-1">
            <div className="h-5 w-64 bg-slate-200 dark:bg-[#1e2e56] rounded-md" />
            <div className="h-3 w-80 max-w-full bg-slate-100 dark:bg-[#132044] rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-60 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
            <div className="h-9 w-32 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          </div>
        </div>

        {/* Table Rows */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-[#0c152e]/80">
                <TableHead className="w-24"><div className="h-3.5 w-14 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="min-w-[220px]"><div className="h-3.5 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="min-w-[280px]"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-40"><div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-36"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-28 text-right"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded ml-auto" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, idx) => (
                <TableRow key={idx} className="border-b border-slate-100 dark:border-[#1e2e56]/40">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-10 rounded bg-slate-200 dark:bg-[#1a2b58]" />
                      <div className="h-5 w-12 rounded bg-slate-200 dark:bg-[#1a2b58]" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-[#1a2b58] shrink-0" />
                      <div className="space-y-1.5">
                        <div className="h-4 w-44 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                        <div className="h-3 w-24 bg-slate-100 dark:bg-[#132044] rounded-full" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-1">
                      <div className="h-3.5 w-64 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      <div className="h-3 w-40 bg-slate-100 dark:bg-[#132044] rounded" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-1">
                      <div className="h-3.5 w-14 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      <div className="h-3 w-20 bg-slate-100 dark:bg-[#132044] rounded" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-14 bg-slate-200 dark:bg-[#1a2b58] rounded-full" />
                      <div className="h-5 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-full" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-4 h-4 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      <div className="w-4 h-4 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      <div className="w-4 h-4 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footer Pagination */}
        <div className="p-3.5 border-t border-slate-200/80 dark:border-[#1e2e56] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#0c152e]/50">
          <div className="h-4 w-40 bg-slate-200 dark:bg-[#1e2e56] rounded" />
          <div className="h-7 w-48 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
        </div>
      </Card>
    </div>
  );
}

/** Accurate Staff Management Skeleton Loader */
export function StaffPageSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl w-full px-1 sm:px-0 animate-pulse">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-cyan-500/20" />
            <div className="h-3.5 w-44 bg-slate-200 dark:bg-[#1e2e56] rounded-md" />
          </div>
          <div className="h-8 w-56 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-[#132044] rounded-lg" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-9 w-32 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="shrink-0 p-4 border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124]">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-6">
            <div className="h-10 w-full bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          </div>
          <div className="sm:col-span-3">
            <div className="h-10 w-full bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          </div>
          <div className="sm:col-span-3">
            <div className="h-10 w-full bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          </div>
        </div>
      </Card>

      {/* Table Card */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card p-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-[#0c152e]/80">
                <TableHead className="min-w-[220px]"><div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-28"><div className="h-3.5 w-14 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="min-w-[200px]"><div className="h-3.5 w-32 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-28"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-48"><div className="h-3.5 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-36 text-right"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded ml-auto" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx} className="border-b border-slate-100 dark:border-[#1e2e56]/40">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-[#1a2b58] shrink-0" />
                      <div className="space-y-1.5">
                        <div className="h-3.5 w-32 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                        <div className="h-2.5 w-44 bg-slate-100 dark:bg-[#132044] rounded" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="h-6 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="h-5 w-36 bg-slate-200 dark:bg-[#1a2b58] rounded-md" />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="h-5 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-md" />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-1">
                      <div className="h-3 w-28 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      <div className="h-2.5 w-36 bg-slate-100 dark:bg-[#132044] rounded" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-7 h-7 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                      <div className="w-7 h-7 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                      <div className="w-7 h-7 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                      <div className="w-7 h-7 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footer Pagination */}
        <div className="p-3.5 border-t border-slate-200/80 dark:border-[#1e2e56] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#0c152e]/50">
          <div className="h-4 w-40 bg-slate-200 dark:bg-[#1e2e56] rounded" />
          <div className="h-7 w-48 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
        </div>
      </Card>
    </div>
  );
}

/** Accurate Student Account Management Skeleton Loader */
export function UsersPageSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 rounded-b-2xl w-full px-1 sm:px-0 animate-pulse">
      {/* Header & Filter Bar */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <div className="h-8 w-72 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-4 w-96 max-w-full bg-slate-100 dark:bg-[#132044] rounded-lg" />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-3 w-full md:w-auto">
          <div className="h-10 w-full md:w-64 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-10 w-full sm:w-48 bg-slate-200 dark:bg-[#1e2e56] rounded-xl" />
          <div className="h-10 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded-xl shrink-0" />
        </div>
      </div>

      {/* Table Card */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-[#091124] admin-table-card p-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-[#0c152e]/80">
                <TableHead className="min-w-[200px]"><div className="h-3.5 w-28 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-32"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-48"><div className="h-3.5 w-36 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-20"><div className="h-3.5 w-14 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-28"><div className="h-3.5 w-20 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-32"><div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1e2e56] rounded" /></TableHead>
                <TableHead className="w-32 text-right"><div className="h-3.5 w-16 bg-slate-200 dark:bg-[#1e2e56] rounded ml-auto" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 7 }).map((_, idx) => (
                <TableRow key={idx} className="border-b border-slate-100 dark:border-[#1e2e56]/40">
                  <TableCell className="py-3">
                    <div className="space-y-1">
                      <div className="h-3.5 w-36 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      <div className="h-2.5 w-48 bg-slate-100 dark:bg-[#132044] rounded" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-[#1a2b58]" />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-1">
                      <div className="h-3.5 w-24 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                      <div className="h-2.5 w-16 bg-slate-100 dark:bg-[#132044] rounded" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="h-3.5 w-6 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="h-3.5 w-6 bg-slate-200 dark:bg-[#1a2b58] rounded" />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="h-5 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-full" />
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-7 h-7 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                      <div className="h-7 w-16 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                      <div className="w-7 h-7 bg-slate-200 dark:bg-[#1a2b58] rounded-lg" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footer Pagination */}
        <div className="p-3.5 border-t border-slate-200/80 dark:border-[#1e2e56] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#0c152e]/50">
          <div className="h-4 w-44 bg-slate-200 dark:bg-[#1e2e56] rounded" />
          <div className="h-7 w-48 bg-slate-200 dark:bg-[#1e2e56] rounded-lg" />
        </div>
      </Card>
    </div>
  );
}

export default function AdminSkeleton() {
  return <AdminDashboardSkeleton />;
}
