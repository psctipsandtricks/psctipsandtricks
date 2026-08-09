'use client';

import React, { useEffect, useState } from 'react';
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
  pathname?: string;
  className?: string;
  onNavigate?: (href: string, e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  brandName = 'PSC Control Panel',
  pathname: propPathname,
  className,
  onNavigate,
}) => {
  const [currentPath, setCurrentPath] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isNarrow = isCollapsed && !isHovered;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
      const saved = localStorage.getItem('psc_sidebar_collapsed');
      if (saved === 'true') {
        setIsCollapsed(true);
      }
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('psc_sidebar_collapsed', String(nextState));
    }
  };

  const activePath = propPathname || currentPath;

  const isItemActive = (item: SidebarItem) => {
    if (item.active !== undefined) return item.active;
    if (!activePath) return false;

    if (item.href === '/admin') {
      return activePath === '/admin' || activePath === '/admin/';
    }
    return activePath === item.href || activePath.startsWith(item.href + '/') || activePath.startsWith(item.href);
  };

  return (
    <div 
      className={cn("hidden md:block relative h-screen sticky top-0 shrink-0 transition-all duration-300 ease-in-out z-40", isCollapsed ? "w-[72px]" : "w-64", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <aside
        className={cn(
          'fixed top-0 left-0 h-screen flex flex-col border-r border-slate-200/90 dark:border-[#1e2e56] bg-white dark:bg-[#060b18] backdrop-blur-2xl transition-all duration-300 ease-in-out select-none z-40',
          isNarrow ? 'w-[72px] shadow-xs' : 'w-64 shadow-[4px_0_12px_rgba(0,0,0,0.03)] dark:shadow-[4px_0_16px_rgba(0,0,0,0.15)]'
        )}
      >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200/90 dark:border-[#1e2e56] font-black text-lg tracking-tight">
        <a href="/admin" className={cn('flex items-center space-x-3 overflow-hidden transition-all duration-300', isNarrow ? 'w-0 opacity-0' : 'w-auto opacity-100')}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 text-slate-950 font-black flex items-center justify-center shadow-xs shrink-0">
            ⚡
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-cyan-300 dark:to-blue-400 bg-clip-text text-transparent tracking-tight leading-none whitespace-nowrap">
              PSC Control
            </span>
          </div>
        </a>
        <button
          type="button"
          onClick={toggleCollapse}
          className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#091124] border border-slate-200/90 dark:border-[#1e2e56] text-slate-500 hover:text-cyan-400 flex items-center justify-center transition-all shadow-xs hover:scale-105 cursor-pointer shrink-0 mx-auto"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <span className={cn('transform transition-transform duration-300 font-bold text-xs', isCollapsed ? 'rotate-180' : 'rotate-0')}>
            ◀
          </span>
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {items.map((item) => {
          const isActive = isItemActive(item);

          return (
            <div key={item.id} className="relative group">
              <a
                href={item.href}
                onClick={(e) => {
                  if (onNavigate) {
                    onNavigate(item.href, e);
                  }
                }}
                className={cn(
                  'flex items-center rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer relative overflow-hidden',
                  isNarrow ? 'justify-center p-3' : 'space-x-3 px-3.5 py-2.5',
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 via-blue-600/15 to-purple-600/15 dark:bg-[#0f1b3d] text-cyan-900 dark:text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-cyan-200 hover:bg-slate-100/80 dark:hover:bg-[#0c152e] border border-transparent'
                )}
              >
                {/* Active Glowing Left Accent Indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                )}

                {item.icon && (
                  <span
                    className={cn(
                      'w-4 h-4 shrink-0 transition-colors flex items-center justify-center',
                      isActive
                        ? 'text-cyan-500 dark:text-cyan-300'
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-cyan-400'
                    )}
                  >
                    {item.icon}
                  </span>
                )}
                {!isNarrow && <span className="truncate">{item.label}</span>}
              </a>

              {/* Floating Flyout Tooltip when Collapsed */}
              {isNarrow && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-[#091124] text-cyan-200 font-bold text-xs rounded-xl shadow-2xl z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap border border-[#1e2e56] flex items-center space-x-1.5 scale-95 group-hover:scale-100">
                  <span>{item.label}</span>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Collapse Button */}
      <div className="p-3 border-t border-slate-200/90 dark:border-[#1e2e56] text-xs text-slate-500 text-center font-mono font-medium">
        <button
          type="button"
          onClick={toggleCollapse}
          className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#0c152e] text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
        >
          <span>{isNarrow ? '»' : '« Collapse'}</span>
        </button>
      </div>
    </aside>
    </div>
  );
};
