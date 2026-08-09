'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@psc/ui';
import {
  LogOut,
  Sun,
  Moon,
  LayoutDashboard,
  HelpCircle,
  BookOpen,
  Users,
  ShoppingCart,
  Tag,
  Bell,
  Megaphone,
  MessageSquare,
  Menu,
  X,
  Search,
  Compass,
  Calendar,
  Clock,
} from 'lucide-react';
import { useTheme } from '../theme-provider';
import { useAuth } from '../auth-provider';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const isStaffOrAdmin = user && (user.role === 'ADMIN' || user.role === 'STAFF');

  useEffect(() => {
    if (mounted && !authLoading && !isStaffOrAdmin) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || '/admin')}`);
    }
  }, [mounted, authLoading, isStaffOrAdmin, pathname, router]);

  const sidebarItems = [
    { id: 'dashboard', label: 'Analytics Dashboard', href: '/admin', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'quizzes', label: 'Manage Quizzes', href: '/admin/quizzes', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'books', label: 'Manage E-Books', href: '/admin/books', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'users', label: 'User Management', href: '/admin/users', icon: <Users className="w-4 h-4" /> },
    { id: 'community', label: 'Community Groups', href: '/admin/community', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'orders', label: 'Orders & Payments', href: '/admin/orders', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'coupons', label: 'Coupon Codes', href: '/admin/coupons', icon: <Tag className="w-4 h-4" /> },
    { id: 'notifications', label: 'Push Notifications', href: '/admin/notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'announcements', label: 'Announcements', href: '/admin/announcements', icon: <Megaphone className="w-4 h-4" /> },
  ];

  if (!mounted || authLoading || !isStaffOrAdmin) {
    return (
      <div className="min-h-screen bg-[#060b18] flex items-center justify-center text-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#060b18] text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-x-hidden">
      {/* Desktop Sidebar */}
      <Sidebar 
        brandName="PSC Control Panel" 
        items={sidebarItems} 
        pathname={pathname} 
        onNavigate={(href, e) => {
          e.preventDefault();
          router.push(href);
        }}
      />

      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Responsive Header */}
        <header className="h-16 glass-header px-4 sm:px-6 flex items-center justify-between shrink-0 border-b border-slate-200/90 dark:border-[#1e2e56] sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            {/* Mobile Nav Trigger */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-[#1e2e56] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0c152e] shrink-0 cursor-pointer"
              aria-label="Toggle admin menu"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Session Indicator Pill */}
            <span className="text-[11px] font-mono font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded-full shadow-xs flex items-center space-x-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span>{user!.role === 'ADMIN' ? 'Admin' : 'Staff'} Session</span>
            </span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-100 dark:bg-[#091124] text-slate-700 dark:text-slate-300 hover:text-cyan-400 transition-all shadow-xs cursor-pointer shrink-0"
              title={mounted && theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-800" />}
            </button>

            {/* User Profile Pill */}
            <div className="flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56]">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-400 to-blue-500 text-slate-950 font-black flex items-center justify-center text-xs shadow-xs shrink-0">
                {user!.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex flex-col hidden md:flex text-left">
                <span className="font-bold text-slate-900 dark:text-white text-xs leading-none truncate max-w-[100px]">
                  {user!.name}
                </span>
                <span className="text-[9px] font-mono text-slate-400 leading-none mt-0.5">
                  {user!.role === 'ADMIN' ? 'Project Admin' : 'Staff Member'}
                </span>
              </div>
            </div>

            {/* Logout Pill */}
            <button
              type="button"
              onClick={logout}
              className="flex items-center space-x-1 text-xs text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all shrink-0"
              title="Logout from Admin Panel"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer Sheet */}
        {mobileNavOpen && (
          <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl px-3 py-3 space-y-1 z-30 shadow-xl animate-in slide-in-from-top-2">
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href));
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileNavOpen(false);
                    router.push(item.href);
                  }}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                >
                  <span className={isActive ? 'text-amber-500' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>
        )}

        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
