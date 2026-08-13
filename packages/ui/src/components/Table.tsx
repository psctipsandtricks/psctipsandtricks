import React from 'react';
import { cn } from '../utils';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ className, children, ...props }) => (
  <table className={cn('w-full text-left text-sm text-slate-700 dark:text-slate-200', className)} {...props}>
    {children}
  </table>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, children, ...props }) => (
  <thead className={cn('bg-slate-100/95 dark:bg-[#091124]/95 text-slate-900 dark:text-slate-100 font-extrabold border-b border-slate-200 dark:border-[#1e2e56] uppercase text-[11px] font-mono tracking-wider sticky top-0 z-20 backdrop-blur-md', className)} {...props}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, children, ...props }) => (
  <tbody className={cn('divide-y divide-slate-200/80 dark:divide-slate-800/60 bg-transparent font-medium text-xs sm:text-sm', className)} {...props}>
    {children}
  </tbody>
);

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, children, ...props }, ref) => (
    <tr ref={ref} className={cn('hover:bg-slate-50/80 dark:hover:bg-[#0f1b3d]/60 transition-colors duration-150', className)} {...props}>
      {children}
    </tr>
  ),
);
TableRow.displayName = 'TableRow';

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className, children, ...props }) => (
  <th className={cn('px-4 py-4 text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider', className)} {...props}>
    {children}
  </th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className, children, ...props }) => (
  <td className={cn('px-4 py-4 align-middle text-slate-900 dark:text-slate-100 font-medium', className)} {...props}>
    {children}
  </td>
);
