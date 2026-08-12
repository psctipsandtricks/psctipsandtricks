'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PanelLeft } from 'lucide-react';
import { cn } from '../utils';

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
  active?: boolean;
}

export type SidebarMode = 'expanded' | 'collapsed' | 'hover';

const SIDEBAR_MODE_KEY = 'psc_sidebar_mode';
/** Superseded by SIDEBAR_MODE_KEY; still read once so existing users keep their preference. */
const LEGACY_COLLAPSED_KEY = 'psc_sidebar_collapsed';

const MODE_OPTIONS: { id: SidebarMode; label: string }[] = [
  { id: 'expanded', label: 'Expanded' },
  { id: 'collapsed', label: 'Collapsed' },
  { id: 'hover', label: 'Expand on hover' },
];

export interface SidebarProps {
  items: SidebarItem[];
  brandName?: string;
  /** Logo shown top-left. Consumers pass their own asset; defaults to a bolt tile. */
  brandIcon?: React.ReactNode;
  pathname?: string;
  className?: string;
  onNavigate?: (href: string, e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  brandName = 'PSC Control Panel',
  brandIcon = (
    <div className="w-full h-full rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 text-slate-950 font-black flex items-center justify-center">
      ⚡
    </div>
  ),
  pathname: propPathname,
  className,
  onNavigate,
}) => {
  const [currentPath, setCurrentPath] = useState('');
  const [mode, setMode] = useState<SidebarMode>('expanded');
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

  // 'collapsed' stays narrow even under the cursor — that is what separates it from 'hover'.
  // An open control menu pins the sidebar open so it cannot slide shut from under the pointer.
  const isNarrow = mode === 'collapsed' || (mode === 'hover' && !isHovered && !isMenuOpen);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setCurrentPath(window.location.pathname);

    const saved = localStorage.getItem(SIDEBAR_MODE_KEY);
    if (saved === 'expanded' || saved === 'collapsed' || saved === 'hover') {
      setMode(saved);
      return;
    }

    // The old boolean collapsed the rail but still expanded it on hover, so that maps to 'hover'.
    if (localStorage.getItem(LEGACY_COLLAPSED_KEY) === 'true') {
      setMode('hover');
    }
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (controlRef.current && !controlRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const changeMode = (nextMode: SidebarMode) => {
    setMode(nextMode);
    setIsMenuOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SIDEBAR_MODE_KEY, nextMode);
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
      className={cn("hidden md:block relative h-screen sticky top-0 shrink-0 transition-all duration-300 ease-in-out z-40", mode === 'expanded' ? "w-64" : "w-[72px]", className)}
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
      <div
        className={cn(
          'h-16 flex items-center border-b border-slate-200/90 dark:border-[#1e2e56] font-black text-lg tracking-tight',
          isNarrow ? 'justify-center px-2' : 'justify-between px-4'
        )}
      >
        {/* Collapsed shows the logo alone — the wordmark is not rendered at all,
            so nothing can spill past the 72px rail. */}
        <a href="/admin" className="flex items-center space-x-3 overflow-hidden" title={brandName}>
          <span className="w-8 h-8 rounded-xl overflow-hidden shadow-xs shrink-0 flex items-center justify-center">
            {brandIcon}
          </span>
          {!isNarrow && (
            <span className="text-sm font-black bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-cyan-300 dark:to-blue-400 bg-clip-text text-transparent tracking-tight leading-none whitespace-nowrap">
              PSC Control
            </span>
          )}
        </a>

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

      {/* Footer Sidebar Control */}
      <div ref={controlRef} className="p-3 border-t border-slate-200/90 dark:border-[#1e2e56]">
        <div className="relative">
          {isMenuOpen && (
            <div
              role="menu"
              aria-orientation="vertical"
              aria-label="Sidebar control"
              className="absolute bottom-full left-0 mb-2 w-56 rounded-2xl border border-slate-200/90 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] shadow-2xl overflow-hidden z-50"
            >
              <div className="px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200/90 dark:border-[#1e2e56]">
                Sidebar control
              </div>
              <div className="py-1.5">
                {MODE_OPTIONS.map((option) => {
                  const isSelected = mode === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      onClick={() => changeMode(option.id)}
                      className={cn(
                        'w-full flex items-center space-x-3 px-4 py-2 text-xs font-semibold transition-colors cursor-pointer',
                        isSelected
                          ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/10'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0f1b3d]'
                      )}
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0 transition-colors',
                          isSelected ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-transparent'
                        )}
                      />
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            title="Sidebar control"
            className={cn(
              'w-full flex items-center py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
              isNarrow ? 'justify-center px-0' : 'space-x-2.5 px-3',
              isMenuOpen
                ? 'bg-slate-100 dark:bg-[#0f1b3d] text-cyan-600 dark:text-cyan-300'
                : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-[#0c152e]'
            )}
          >
            <PanelLeft className="w-4 h-4 shrink-0" />
            {!isNarrow && <span className="truncate">Sidebar control</span>}
          </button>
        </div>
      </div>
    </aside>
    </div>
  );
};
