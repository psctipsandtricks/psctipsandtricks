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
  isLoading?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const handleClose = () => {
    if (isLoading) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm p-2.5 sm:p-4 animate-in fade-in duration-200 !mt-0">
      <div
        className={cn(
          'w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-3xl bg-white dark:bg-[#0c152e] border border-slate-200/90 dark:border-[#1e2e56] shadow-2xl shadow-slate-950/20 dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-slate-900 dark:text-slate-100 relative overflow-hidden',
          className
        )}
      >
        {/* Fixed Header */}
        {title || description ? (
          <div className="shrink-0 pl-4 sm:pl-6 pr-14 sm:pr-16 pt-4 sm:pt-6 pb-2 sm:pb-3 relative border-b border-slate-100 dark:border-slate-800/40">
            <button
              onClick={handleClose}
              disabled={isLoading}
              type="button"
              className={cn(
                'absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all z-10 shrink-0 border border-slate-200/80 dark:border-slate-700/60',
                isLoading
                  ? 'opacity-40 cursor-not-allowed pointer-events-none'
                  : 'hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white cursor-pointer hover:scale-105 active:scale-95'
              )}
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
            {title && <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight mb-1 leading-snug">{title}</h2>}
            {description && <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{description}</p>}
          </div>
        ) : (
          <button
            onClick={handleClose}
            disabled={isLoading}
            type="button"
            className={cn(
              'absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all z-10 shrink-0 border border-slate-200/80 dark:border-slate-700/60',
              isLoading
                ? 'opacity-40 cursor-not-allowed pointer-events-none'
                : 'hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white cursor-pointer hover:scale-105 active:scale-95'
            )}
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Scrollable Body - moves scrollbar right to the edge with content padded inside */}
        <div
          className={cn(
            'flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6 pt-3 flex flex-col min-h-0 relative custom-scrollbar',
            isLoading && 'pointer-events-none opacity-80 cursor-wait select-none'
          )}
        >
          <fieldset disabled={isLoading} className="contents disabled:pointer-events-none">
            {children}
          </fieldset>
        </div>
      </div>
    </div>
  );
};
