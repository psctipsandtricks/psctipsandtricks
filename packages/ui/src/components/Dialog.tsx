import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../utils';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-2.5 sm:p-4 animate-in fade-in duration-200 !mt-0">
      <div
        className={cn(
          'w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl text-slate-900 dark:text-slate-100 relative overflow-hidden',
          className
        )}
      >
        {/* Fixed Header */}
        {title || description ? (
          <div className="shrink-0 p-4 sm:p-6 pb-2 sm:pb-3 pr-14 relative">
            <button
              onClick={onClose}
              type="button"
              className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer z-10 shrink-0 hover:scale-105"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
            {title && <h2 className="text-base sm:text-xl font-extrabold tracking-tight mb-1 leading-snug">{title}</h2>}
            {description && <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
        ) : (
          <button
            onClick={onClose}
            type="button"
            className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer z-10 shrink-0 hover:scale-105"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Scrollable Body - moves scrollbar right to the edge with content padded inside */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6 pt-1 flex flex-col min-h-0 relative custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};
