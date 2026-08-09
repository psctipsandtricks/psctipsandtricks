import React from 'react';
import { cn } from '../utils';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ className, children, ...props }) => (
  <div className="w-full overflow-x-auto rounded-2xl glass-panel shadow-sm">
    <table className={cn('w-full text-left text-sm text-slate-700 dark:text-slate-200', className)} {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, children, ...props }) => (
  <thead className={cn('bg-slate-100/80 dark:bg-[#0b1120] text-slate-800 dark:text-slate-200 font-extrabold border-b border-slate-200/90 dark:border-slate-800/80 uppercase text-[11px] font-mono tracking-wider', className)} {...props}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, children, ...props }) => (
  <tbody className={cn('divide-y divide-slate-200/80 dark:divide-slate-800/60 bg-transparent font-medium text-xs sm:text-sm', className)} {...props}>
    {children}
  </tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className, children, ...props }) => (
  <tr className={cn('hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors duration-150', className)} {...props}>
    {children}
  </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className, children, ...props }) => (
  <th className={cn('px-4 py-3.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider', className)} {...props}>
    {children}
  </th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className, children, ...props }) => (
  <td className={cn('px-4 py-3.5 align-middle text-slate-900 dark:text-slate-100', className)} {...props}>
    {children}
  </td>
);
