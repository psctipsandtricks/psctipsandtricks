import React from 'react';
import { cn } from '../utils';

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
  active?: boolean;
}

export interface SidebarProps {
  items: SidebarItem[];
  brandName?: string;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  brandName = 'PSC Admin',
  className,
}) => {
  return (
    <aside className={cn('w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 min-h-screen flex flex-col', className)}>
      <div className="h-16 flex items-center px-6 border-b border-slate-800 font-bold text-lg tracking-wide text-amber-400">
        ⚡ {brandName}
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className={cn(
              'flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
              item.active
                ? 'bg-indigo-600 text-white font-semibold shadow-md'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            )}
          >
            {item.icon && <span className="w-5 h-5">{item.icon}</span>}
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
        PSC Tips & Tricks Admin v1.0
      </div>
    </aside>
  );
};
