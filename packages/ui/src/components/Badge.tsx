import React from 'react';
import { cn } from '../utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline' | 'gold';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'default', children, ...props }) => {
  const variants = {
    default: 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    outline: 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-transparent',
    gold: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 shadow-xs font-bold',
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
