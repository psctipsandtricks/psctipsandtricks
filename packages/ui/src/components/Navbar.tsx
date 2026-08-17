'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../utils';
import {
  Sun,
  Moon,
  Menu,
  X,
  User as UserIcon,
  BookOpen,
  Receipt,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Shield,
  LayoutDashboard,
} from 'lucide-react';

export interface NavbarProps {
  brandName?: string;
  logoUrl?: string;
  logo?: React.ReactNode;
  links?: { label: string; href: string; active?: boolean }[];
  user?: {
    name: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
    isPremium?: boolean;
  };
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onLogout?: () => void;
  className?: string;
  /**
   * Lets the host app route internal links client-side (e.g. Next.js
   * `router.push`) instead of a full browser navigation. Without this, every
   * tab switch reloads the page and the auth state has to rehydrate from
   * scratch, which is what causes the logged-out flash.
   */
  onNavigate?: (href: string, e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  brandName = 'PSC Tips And Tricks',
  logoUrl,
  logo,
  links = [],
  user,
  theme: propTheme,
  onToggleTheme,
  onLogout,
  className,
  onNavigate,
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

  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);

  return (
    <header className={cn('sticky top-0 z-40 w-full glass-header bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/90 dark:border-slate-800/90', className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <a
            href="/"
            onClick={(e) => onNavigate?.('/', e)}
            className="flex items-center space-x-2.5 font-black text-xl tracking-tight group"
          >
            {logo ? (
              logo
            ) : logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-9 h-9 rounded-full object-contain shadow-sm ring-1 ring-cyan-500/25 group-hover:scale-105 transition-transform duration-200"
              />
            ) : null}
            <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-cyan-300 dark:to-blue-400 bg-clip-text text-transparent drop-shadow-xs font-black">
              {brandName}
            </span>
          </a>
          <nav className="hidden md:flex items-center space-x-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => onNavigate?.(link.href, e)}
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
                className={cn(
                  "flex items-center space-x-2.5 py-1.5 px-2.5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs",
                  dropdownOpen
                    ? "bg-white dark:bg-[#0c1631] border-cyan-500/50 shadow-md shadow-cyan-500/10 ring-2 ring-cyan-500/20"
                    : "bg-slate-100/90 dark:bg-[#091124]/90 border-slate-200 dark:border-[#1e2e56] hover:border-cyan-500/40 hover:bg-white dark:hover:bg-[#0d1833]"
                )}
              >
                {user.avatarUrl && !avatarError ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-7 h-7 rounded-xl object-cover ring-1 ring-cyan-500/30"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 text-white font-black flex items-center justify-center text-[11px] shadow-sm shadow-cyan-500/30 ring-1 ring-white/20">
                    {getInitials(user.name)}
                  </div>
                )}
                <div className="flex flex-col text-left hidden sm:flex">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[130px] truncate leading-tight">
                    {user.name}
                  </span>
                  {user.role && user.role !== 'STUDENT' ? (
                    <span className="text-[9px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400 leading-tight">
                      {user.role}
                    </span>
                  ) : user.isPremium ? (
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 leading-tight flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> PRO
                    </span>
                  ) : null}
                </div>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform duration-200",
                    dropdownOpen
                      ? "rotate-180 text-cyan-500"
                      : "text-slate-500 dark:text-slate-400"
                  )}
                />
              </button>

              {/* User Avatar Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2.5 w-72 sm:w-80 rounded-2xl border border-slate-200/90 dark:border-[#1e2e56] bg-white/95 dark:bg-[#070d1e]/95 backdrop-blur-2xl p-2 shadow-2xl shadow-slate-900/15 dark:shadow-[0_20px_50px_rgba(0,0,0,0.7)] z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-150 ring-1 ring-black/5 dark:ring-white/5">
                  {/* User Profile Header Card */}
                  <div className="p-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/80 dark:from-[#0c1630] dark:to-[#081024] border border-slate-200/70 dark:border-[#1e2e56]/70 mb-1.5 flex items-center gap-3">
                    {user.avatarUrl && !avatarError ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-10 h-10 rounded-xl object-cover ring-2 ring-cyan-500/30 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 text-white font-black flex items-center justify-center text-sm shadow-md shadow-cyan-500/25 ring-1 ring-white/20 shrink-0">
                        {getInitials(user.name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {user.name}
                        </p>
                        {user.role === 'ADMIN' ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20 shrink-0">
                            Admin
                          </span>
                        ) : user.role === 'STAFF' ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                            Staff
                          </span>
                        ) : user.isPremium ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> PRO
                          </span>
                        ) : null}
                      </div>
                      {user.email && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="space-y-0.5">
                    <a
                      href="/profile"
                      onClick={(e) => {
                        setDropdownOpen(false);
                        onNavigate?.('/profile', e);
                      }}
                      className="group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 dark:text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-all shrink-0">
                          <UserIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <div className="font-bold leading-none">Profile</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">Account & personal details</div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </a>

                    <a
                      href="/books?filter=purchased"
                      onClick={(e) => {
                        setDropdownOpen(false);
                        onNavigate?.('/books?filter=purchased', e);
                      }}
                      className="group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all shrink-0">
                          <BookOpen className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <div className="font-bold leading-none flex items-center gap-1.5">
                            <span>My Books</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                              Purchased
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">Your library & reader</div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </a>

                    <a
                      href="/orders"
                      onClick={(e) => {
                        setDropdownOpen(false);
                        onNavigate?.('/orders', e);
                      }}
                      className="group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all shrink-0">
                          <Receipt className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <div className="font-bold leading-none">My Orders</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">Payment history & receipts</div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </a>

                    <a
                      href="/dashboard"
                      onClick={(e) => {
                        setDropdownOpen(false);
                        onNavigate?.('/dashboard', e);
                      }}
                      className="group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all shrink-0">
                          <LayoutDashboard className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <div className="font-bold leading-none">Study Dashboard</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">Rank, tests & learning analytics</div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </a>

                    {(user.role === 'ADMIN' || user.role === 'STAFF') && (
                      <a
                        href="/admin"
                        onClick={(e) => {
                          setDropdownOpen(false);
                          onNavigate?.('/admin', e);
                        }}
                        className="group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all shrink-0">
                            <Shield className="w-3.5 h-3.5" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold leading-none">Admin Portal</div>
                            <div className="text-[10px] text-purple-500/70 font-normal mt-0.5">Manage books, quizzes & users</div>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-purple-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </a>
                    )}
                  </div>

                  <div className="border-t border-slate-200/80 dark:border-[#1e2e56] my-1.5" />

                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all shrink-0">
                          <LogOut className="w-3.5 h-3.5" />
                        </div>
                        <span className="group-hover:translate-x-0.5 transition-transform">Logout</span>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center space-x-2">
              <a
                href="/login"
                onClick={(e) => onNavigate?.('/login', e)}
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-cyan-400 px-3.5 py-2 rounded-xl transition-colors"
              >
                Log In
              </a>
              <a
                href="/signup"
                onClick={(e) => onNavigate?.('/signup', e)}
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
              onClick={(e) => {
                setMobileMenuOpen(false);
                onNavigate?.(link.href, e);
              }}
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
                onClick={(e) => {
                  setMobileMenuOpen(false);
                  onNavigate?.('/login', e);
                }}
                className="block text-center px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#091124]"
              >
                Log In
              </a>
              <a
                href="/signup"
                onClick={(e) => {
                  setMobileMenuOpen(false);
                  onNavigate?.('/signup', e);
                }}
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
