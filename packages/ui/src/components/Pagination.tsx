'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../utils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  className,
}) => {
  if (totalItems === 0 || totalPages <= 1) {
    if (totalItems === 0) return null;
  }

  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Helper to generate page number buttons with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push('...');

      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(safeTotalPages - 1, safeCurrentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (safeCurrentPage < safeTotalPages - 2) pages.push('...');
      pages.push(safeTotalPages);
    }
    return pages;
  };

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800/80',
        className,
      )}
    >
      {/* Items Counter & Optional Page Size Selector */}
      <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
        <span>
          Showing <strong className="font-mono font-semibold text-slate-900 dark:text-slate-100">{startItem}</strong> to{' '}
          <strong className="font-mono font-semibold text-slate-900 dark:text-slate-100">{endItem}</strong> of{' '}
          <strong className="font-mono font-semibold text-slate-900 dark:text-slate-100">{totalItems}</strong> results
        </span>

        {onPageSizeChange && (
          <div className="flex items-center space-x-1.5 ml-2">
            <span className="hidden md:inline">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-slate-100 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] text-slate-900 dark:text-slate-100 text-xs font-semibold rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page Navigation Controls */}
      <div className="flex items-center space-x-1 self-end sm:self-auto">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          className="inline-flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] hover:bg-slate-100 dark:hover:bg-[#0c152e] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">Previous</span>
        </button>

        {/* Desktop Page Numbers */}
        <div className="hidden sm:flex items-center space-x-1">
          {getPageNumbers().map((p, idx) => {
            if (typeof p === 'string') {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-slate-400">
                  ...
                </span>
              );
            }
            const isSelected = p === safeCurrentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(p)}
                className={cn(
                  'min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all',
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-extrabold shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                    : 'bg-white dark:bg-[#091124] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1e2e56] hover:bg-slate-100 dark:hover:bg-[#0c152e]',
                )}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Mobile Page Counter Badge */}
        <div className="sm:hidden px-2 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
          {safeCurrentPage} / {safeTotalPages}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= safeTotalPages}
          className="inline-flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          title="Next Page"
          aria-label="Next Page"
        >
          <span className="hidden sm:inline mr-1">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
