import React from 'react';
import { cn } from '../utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none';
    
    const variants = {
      primary: 'btn-shine-effect bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white dark:from-cyan-400 dark:via-cyan-500 dark:to-blue-500 dark:hover:from-cyan-300 dark:hover:to-blue-400 dark:text-slate-950 font-extrabold shadow-md shadow-cyan-600/20 dark:shadow-[0_0_15px_rgba(6,182,212,0.35)] border border-cyan-500/30 dark:border-cyan-300/60',
      secondary: 'bg-slate-100 dark:bg-[#091124] text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-[#0c152e] border border-slate-200 dark:border-[#1e2e56]',
      outline: 'border border-cyan-500/40 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/70 bg-transparent',
      ghost: 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-[#0c152e]/80 hover:text-cyan-400',
      danger: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-xs',
      gold: 'btn-shine-effect bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white dark:from-cyan-400 dark:via-cyan-500 dark:to-blue-500 dark:hover:from-cyan-300 dark:hover:to-blue-400 dark:text-slate-950 font-extrabold shadow-md shadow-cyan-600/20 dark:shadow-[0_0_15px_rgba(6,182,212,0.35)] border border-cyan-500/30 dark:border-cyan-300/60',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current fill-none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
