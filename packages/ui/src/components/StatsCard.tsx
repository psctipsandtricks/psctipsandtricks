import React from 'react';
import { cn } from '../utils';

export interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  isPositive = true,
  icon,
  className,
}) => {
  return (
    <div className={cn('glass-card p-4 space-y-3 relative overflow-hidden group hover-lift', className)}>
      <div className="flex items-center justify-between">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-400/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 shadow-2xs">
            {icon}
          </div>
        )}
        {change && (
          <span
            className={cn(
              'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shadow-2xs',
              isPositive
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400'
                : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400'
            )}
          >
            {change}
          </span>
        )}
      </div>
      <div className="space-y-0.5 pt-1">
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-sans">
          {value}
        </div>
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {title}
        </div>
      </div>
    </div>
  );
};
