import React from 'react';
import { cn } from '../utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline' | 'gold';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'default', children, ...props }) => {
  const variants = {
    default: 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 font-bold',
    success: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 font-extrabold',
    warning: 'bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/30 font-extrabold',
    danger: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30 font-extrabold',
    outline: 'border border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-transparent font-bold',
    gold: 'bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/35 shadow-2xs font-extrabold',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-bold transition-all duration-200 shrink-0',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
