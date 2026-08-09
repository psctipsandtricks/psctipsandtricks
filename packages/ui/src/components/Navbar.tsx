'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../utils';
import { Sun, Moon, Menu, X, User as UserIcon, BookOpen, Settings, LogOut, ChevronDown } from 'lucide-react';

export interface NavbarProps {
  brandName?: string;
  links?: { label: string; href: string; active?: boolean }[];
  user?: { name: string; email?: string; avatarUrl?: string };
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onLogout?: () => void;
  className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  brandName = '⚡ PSC Tips & Tricks',
  links = [],
  user,
  theme: propTheme,
  onToggleTheme,
  onLogout,
  className,
}) => {
  const [localTheme, setLocalTheme] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeTheme = propTheme || localTheme;

  useEffect(() => {
    setMounted(true);
    if (!propTheme) {
      const isDark = document.documentElement.classList.contains('dark');
      setLocalTheme(isDark ? 'dark' : 'light');
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [propTheme]);

  const handleToggleTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      const root = document.documentElement;
      const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
      if (nextTheme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
      localStorage.setItem('psc_theme', nextTheme);
      setLocalTheme(nextTheme);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className={cn('sticky top-0 z-40 w-full glass-header bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/90 dark:border-slate-800/90', className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <a href="/" className="flex items-center space-x-2 font-black text-xl tracking-tight">
            <span className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 dark:from-cyan-400 dark:via-cyan-300 dark:to-blue-400 bg-clip-text text-transparent drop-shadow-xs font-black">
              {brandName}
            </span>
          </a>
          <nav className="hidden md:flex items-center space-x-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200',
                  link.active
                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-500/30'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#0c152e]/60'
                )}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          {/* Hydration-safe Single-click Theme Toggle Button */}
          <button
            type="button"
            onClick={handleToggleTheme}
            className="p-2.5 rounded-xl border border-slate-300 dark:border-[#1e2e56] bg-slate-100 dark:bg-[#091124] text-slate-700 dark:text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-all duration-200 shadow-xs cursor-pointer"
            title={mounted && activeTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {!mounted ? (
              <Sun className="w-4 h-4 text-cyan-400" />
            ) : activeTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-cyan-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-800" />
            )}
          </button>

          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2.5 p-1.5 rounded-2xl border border-slate-300 dark:border-[#1e2e56] bg-slate-100 dark:bg-[#091124] hover:border-cyan-500/40 transition-all duration-200 cursor-pointer shadow-xs"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-xl object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 text-slate-950 font-black flex items-center justify-center text-xs shadow-md shadow-cyan-500/20">
                    {getInitials(user.name)}
                  </div>
                )}
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 hidden sm:inline-block">
                  {user.name}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>

              {/* User Avatar Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-white/95 dark:bg-[#091124]/95 backdrop-blur-2xl p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2.5 border-b border-slate-200/80 dark:border-[#1e2e56] mb-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
                    {user.email && (
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    )}
                  </div>

                  <a
                    href="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-400 transition-all"
                  >
                    <UserIcon className="w-4 h-4 text-cyan-400" />
                    <span>Profile</span>
                  </a>

                  <a
                    href="/books"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-400 transition-all"
                  >
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    <span>My Books</span>
                  </a>

                  <a
                    href="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-400 transition-all"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>Settings</span>
                  </a>

                  <div className="border-t border-slate-200/80 dark:border-[#1e2e56] my-1" />

                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center space-x-2">
              <a
                href="/login"
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-cyan-400 px-3.5 py-2 rounded-xl transition-colors"
              >
                Log In
              </a>
              <a
                href="/signup"
                className="btn-shine-effect text-sm font-extrabold bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white dark:from-cyan-400 dark:via-cyan-500 dark:to-blue-500 dark:text-slate-950 px-4 py-2 rounded-xl shadow-md shadow-cyan-600/20 dark:shadow-[0_0_15px_rgba(6,182,212,0.35)] border border-cyan-500/30 dark:border-cyan-300/60 transition-all duration-200"
              >
                Get Started
              </a>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border border-slate-300 dark:border-[#1e2e56] text-slate-700 dark:text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-[#1e2e56] bg-white/95 dark:bg-[#060b18]/95 backdrop-blur-2xl px-4 py-4 space-y-2 animate-in slide-in-from-top-2">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'block px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                link.active
                  ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#091124]'
              )}
            >
              {link.label}
            </a>
          ))}
          {!user && (
            <div className="pt-2 border-t border-slate-200 dark:border-[#1e2e56] flex flex-col space-y-2">
              <a
                href="/login"
                className="block text-center px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#091124]"
              >
                Log In
              </a>
              <a
                href="/signup"
                className="block text-center px-4 py-2 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500"
              >
                Get Started
              </a>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
