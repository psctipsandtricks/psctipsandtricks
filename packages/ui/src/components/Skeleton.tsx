import React from 'react';
import { cn } from '../utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangular',
  width,
  height,
  style,
  ...props
}) => {
  const variantClasses = {
    text: 'h-4 w-full rounded-md',
    rectangular: 'rounded-xl',
    circular: 'rounded-full',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300/40 dark:border-slate-700/40 shrink-0',
        variantClasses[variant],
        className
      )}
      style={{
        width: width !== undefined ? width : undefined,
        height: height !== undefined ? height : undefined,
        ...style,
      }}
      {...props}
    />
  );
};
