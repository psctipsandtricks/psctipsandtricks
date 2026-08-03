import React from 'react';
import { cn } from '../utils';

export interface NavbarProps {
  brandName?: string;
  links?: { label: string; href: string; active?: boolean }[];
  user?: { name: string; avatarUrl?: string };
  onLogout?: () => void;
  className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  brandName = 'PSC Tips & Tricks',
  links = [],
  user,
  onLogout,
  className,
}) => {
  return (
    <header className={cn('sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md', className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <a href="/" className="flex items-center space-x-2 font-bold text-xl text-slate-900 dark:text-slate-100">
            <span className="bg-gradient-to-r from-indigo-600 to-amber-500 bg-clip-text text-transparent">
              {brandName}
            </span>
          </a>
          <nav className="hidden md:flex space-x-6">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-indigo-600 dark:hover:text-indigo-400',
                  link.active ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
                )}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:inline-block">
                {user.name}
              </span>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-medium border border-rose-200 dark:border-rose-900 px-2.5 py-1 rounded-md"
                >
                  Sign Out
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <a href="/login" className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600">
                Log In
              </a>
              <a
                href="/signup"
                className="text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm"
              >
                Get Started
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
