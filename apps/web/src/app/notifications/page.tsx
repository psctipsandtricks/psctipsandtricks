'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Badge, Card, Skeleton, Input } from '@psc/ui';
import {
  Bell,
  ChevronLeft,
  CheckCheck,
  Inbox,
  ExternalLink,
  AlertCircle,
  Trophy,
  BookOpen,
  Megaphone,
  Sparkles,
  Search,
  Clock,
  ArrowUpRight,
  Check,
  X,
  FileText,
  Zap,
  SlidersHorizontal,
  Maximize2,
} from 'lucide-react';
import { useAuth } from '@/app/auth-provider';
import { useNotifications } from '@/app/notifications-data';
import { shortAge, useOpenNotification } from '@/app/notification-bell';
import { resolveNotificationDestination } from '@/lib/notification-destination';
import type { Notification as AppNotification } from '@psc/shared-types';

type NotificationCategory = 'ALL' | 'UNREAD' | 'QUIZZES' | 'BOOKS' | 'ANNOUNCEMENTS';

function categorizeNotification(n: AppNotification): 'QUIZZES' | 'BOOKS' | 'ANNOUNCEMENTS' {
  const route = (n.route || '').toLowerCase();
  const title = (n.title || '').toLowerCase();
  const body = (n.body || '').toLowerCase();

  if (route.includes('quiz') || route.includes('mock-test') || title.includes('quiz') || title.includes('mock') || body.includes('quiz')) {
    return 'QUIZZES';
  }
  if (route.includes('book') || route.includes('pdf') || route.includes('video') || title.includes('book') || title.includes('pdf') || title.includes('chapter')) {
    return 'BOOKS';
  }
  return 'ANNOUNCEMENTS';
}

const CATEGORY_META = {
  QUIZZES: {
    label: 'Quiz & Mock Tests',
    icon: Trophy,
    color: 'from-emerald-500 to-teal-500',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  BOOKS: {
    label: 'Study Materials & E-Books',
    icon: BookOpen,
    color: 'from-amber-500 to-orange-500',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  ANNOUNCEMENTS: {
    label: 'Announcements',
    icon: Megaphone,
    color: 'from-cyan-500 to-blue-500',
    badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    iconBg: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  },
};

export default function NotificationsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { visible, unreadCount, isUnread, isLoading, isError, refetch, markAllRead, markRead } =
    useNotifications();
  const openNotification = useOpenNotification();

  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/notifications');
    }
  }, [authLoading, user, router]);

  const filteredNotifications = useMemo(() => {
    return visible.filter((n) => {
      // Category filter
      if (activeCategory === 'UNREAD' && !isUnread(n)) return false;
      if (activeCategory === 'QUIZZES' && categorizeNotification(n) !== 'QUIZZES') return false;
      if (activeCategory === 'BOOKS' && categorizeNotification(n) !== 'BOOKS') return false;
      if (activeCategory === 'ANNOUNCEMENTS' && categorizeNotification(n) !== 'ANNOUNCEMENTS') return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = n.title?.toLowerCase().includes(query);
        const matchesBody = n.body?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesBody) return false;
      }

      return true;
    });
  }, [visible, activeCategory, searchQuery, isUnread]);

  const counts = useMemo(() => {
    return {
      ALL: visible.length,
      UNREAD: unreadCount,
      QUIZZES: visible.filter((n) => categorizeNotification(n) === 'QUIZZES').length,
      BOOKS: visible.filter((n) => categorizeNotification(n) === 'BOOKS').length,
      ANNOUNCEMENTS: visible.filter((n) => categorizeNotification(n) === 'ANNOUNCEMENTS').length,
    };
  }, [visible, unreadCount]);

  if (authLoading || !user || isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-8 px-3 sm:px-0 animate-in fade-in duration-300">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-11 h-11 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="w-56 h-7 rounded-lg" />
            <Skeleton className="w-80 h-4 rounded-md" />
          </div>
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-2 sm:px-0">
      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-gradient-to-br from-white/90 via-slate-50/70 to-white/90 dark:from-[#0c152e]/90 dark:via-[#080f24]/90 dark:to-[#0c152e]/90 backdrop-blur-xl p-5 sm:p-7 shadow-xl shadow-slate-200/40 dark:shadow-black/40">
        {/* Top ambient glow circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <Link href="/dashboard">
              <button
                type="button"
                className="w-11 h-11 rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#070e20] text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-500/50 flex items-center justify-center transition-all duration-200 shadow-sm hover:scale-105 cursor-pointer shrink-0"
                aria-label="Back to Dashboard"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </Link>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 flex items-center justify-center shadow-inner">
                  <Bell className="w-4 h-4" />
                </div>
                <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Notification Center
                </h1>
                {unreadCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/25 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    {unreadCount} NEW
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Check className="w-3 h-3" />
                    All caught up
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
                Real-time updates regarding your mock test schedules, quiz alerts, books, and exam notifications.
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              className="font-bold text-xs shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/70 shadow-sm transition-all self-start sm:self-center cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 text-cyan-500" />
              <span>Mark all as read</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search Bar Strip */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { key: 'ALL' as const, label: 'All', count: counts.ALL },
            { key: 'UNREAD' as const, label: 'Unread', count: counts.UNREAD },
            { key: 'QUIZZES' as const, label: 'Quizzes', count: counts.QUIZZES },
            { key: 'BOOKS' as const, label: 'E-Books', count: counts.BOOKS },
            { key: 'ANNOUNCEMENTS' as const, label: 'Notices', count: counts.ANNOUNCEMENTS },
          ].map((tab) => {
            const isActive = activeCategory === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveCategory(tab.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer border ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20 scale-[1.02]'
                    : 'bg-white/80 dark:bg-[#091124]/80 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-[#1e2e56] hover:bg-slate-100 dark:hover:bg-[#0f1d3d] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                      isActive
                        ? 'bg-slate-950/20 text-slate-950 font-extrabold'
                        : 'bg-slate-200 dark:bg-[#152347] text-slate-600 dark:text-slate-400 font-bold'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search notices…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#091124] border border-slate-200 dark:border-[#1e2e56] rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Notifications List */}
      {isError ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center rounded-3xl border border-rose-500/30 bg-rose-500/[0.03]">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-inner">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Could not load notifications
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              We encountered an error connecting to the server. Please check your network and retry.
            </p>
          </div>
          <Button variant="gold" size="sm" className="font-bold text-xs mt-2" onClick={() => refetch()}>
            Retry Connection
          </Button>
        </Card>
      ) : filteredNotifications.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-4 py-20 text-center rounded-3xl border border-dashed border-slate-300 dark:border-[#1e2e56] bg-slate-50/40 dark:bg-[#070e20]/40">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-cyan-500/15 to-blue-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shadow-inner">
            <Inbox className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-md px-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {searchQuery
                ? 'No matching notifications found'
                : activeCategory === 'UNREAD'
                ? 'No unread notifications'
                : "You're all caught up!"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {searchQuery
                ? `No notifications found matching "${searchQuery}". Try searching with different keywords or clear the filter.`
                : activeCategory === 'UNREAD'
                ? 'All your notifications have been marked as read. Check other categories for history.'
                : 'New updates about mock tests, quiz ranks, e-books, and notices will arrive here automatically.'}
            </p>
          </div>
          {searchQuery ? (
            <Button
              variant="outline"
              size="sm"
              className="font-bold text-xs"
              onClick={() => setSearchQuery('')}
            >
              Clear Search Filter
            </Button>
          ) : (
            <Link href="/quizzes">
              <Button variant="gold" size="sm" className="font-bold text-xs mt-1">
                <span>Explore Live Quizzes &amp; Tests</span>
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <ul className="space-y-4">
          {filteredNotifications.map((n) => {
            const unread = isUnread(n);
            const destination = resolveNotificationDestination(n.route);
            const category = categorizeNotification(n);
            const meta = CATEGORY_META[category];
            const CategoryIcon = meta.icon;

            return (
              <li key={n.id} className="group">
                <div
                  className={`relative overflow-hidden rounded-3xl border transition-all duration-300 shadow-sm ${
                    unread
                      ? 'border-cyan-500/40 bg-gradient-to-r from-cyan-500/[0.08] via-white to-white dark:from-cyan-950/25 dark:via-[#091124] dark:to-[#091124] shadow-cyan-500/5 hover:border-cyan-500/70 hover:shadow-md'
                      : 'border-slate-200/80 dark:border-[#1e2e56] bg-white/90 dark:bg-[#091124]/90 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                  }`}
                >
                  {/* Left Edge Unread Indicator Bar */}
                  {unread && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-cyan-400 via-teal-400 to-cyan-600 animate-pulse" />
                  )}

                  <div className="p-4 sm:p-6 space-y-3.5">
                    {/* Top Row: Category badge, title, time, and unread indicator */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.iconBg}`}
                        >
                          <CategoryIcon className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${meta.badge}`}
                            >
                              {meta.label}
                            </span>
                            {unread && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
                                Unread
                              </span>
                            )}
                          </div>

                          <h3
                            className={`text-sm sm:text-base leading-snug transition-colors ${
                              unread
                                ? 'font-black text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400'
                                : 'font-extrabold text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {n.title}
                          </h3>
                        </div>
                      </div>

                      {/* Right: Timestamp */}
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 shrink-0 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{shortAge(n.createdAt)}</span>
                      </div>
                    </div>

                    {/* Notification Body Text */}
                    {n.body && (
                      <div className="pl-11 sm:pl-11.5">
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                          {n.body}
                        </p>
                      </div>
                    )}

                    {/* Media Banner Image Preview */}
                    {n.imageUrl && (
                      <div className="pl-11 sm:pl-11.5 pt-1">
                        <div className="relative group/img rounded-2xl overflow-hidden border border-slate-200/90 dark:border-[#1e2e56] bg-slate-100 dark:bg-[#070e20] aspect-[16/9] max-h-72 w-full max-w-xl shadow-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={n.imageUrl}
                            alt={n.title || 'Notification media'}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage(n.imageUrl!);
                            }}
                            className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer shadow-md"
                            title="Expand Image"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="pl-11 sm:pl-11.5 pt-2 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-[#1e2e56]/60 flex-wrap">
                      <div className="flex items-center gap-2">
                        {destination ? (
                          <Button
                            variant="gold"
                            size="sm"
                            onClick={() => openNotification(n)}
                            className="font-bold text-xs flex items-center gap-1.5 px-4 py-1.5 shadow-sm shadow-cyan-500/20 cursor-pointer"
                          >
                            <span>
                              {destination.externalUrl
                                ? 'Open Link'
                                : category === 'QUIZZES'
                                ? 'Enter Quiz Hub'
                                : category === 'BOOKS'
                                ? 'Read Material'
                                : 'View Announcement'}
                            </span>
                            {destination.externalUrl ? (
                              <ExternalLink className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400">
                            General notice
                          </span>
                        )}
                      </div>

                      {unread && (
                        <button
                          type="button"
                          onClick={() => markRead(n.id)}
                          className="text-[11px] font-bold text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 inline-flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0c152e] cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark as read</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Fullscreen Image Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="Close Preview"
            >
              <X className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="Preview"
              className="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

