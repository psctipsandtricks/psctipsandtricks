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
    <div className={cn('glass-card p-4 space-y-3 relative overflow-hidden group bg-gradient-to-b from-white via-white to-slate-50/90 dark:bg-none dark:bg-[#0c152e] border border-slate-200/90 dark:border-[#1e2e56] shadow-md', className)}>
      <div className="flex items-center justify-between">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            {icon}
          </div>
        )}
        {change && (
          <span
            className={cn(
              'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shadow-xs',
              isPositive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
            )}
          >
            {change}
          </span>
        )}
      </div>
      <div className="space-y-1 pt-1">
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-sans">
          {value}
        </div>
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {title}
        </div>
      </div>
    </div>
  );
};
