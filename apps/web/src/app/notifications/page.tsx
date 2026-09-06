'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Badge, Card, Skeleton } from '@psc/ui';
import { Bell, ChevronLeft, CheckCheck, Inbox, ExternalLink, AlertCircle } from 'lucide-react';
import { useAuth } from '@/app/auth-provider';
import { useNotifications } from '@/app/notifications-data';
import { shortAge, useOpenNotification } from '@/app/notification-bell';
import { resolveNotificationDestination } from '@/lib/notification-destination';

export default function NotificationsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { visible, unreadCount, isUnread, isLoading, isError, refetch, markAllRead } =
    useNotifications();
  const openNotification = useOpenNotification();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/notifications');
    }
  }, [authLoading, user, router]);

  if (authLoading || !user || isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 py-6 px-2">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-6 rounded-md" />
            <Skeleton className="w-64 h-4 rounded-md" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 py-4 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard">
            <Button
              variant="outline"
              size="sm"
              className="p-2 rounded-xl border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/70"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Bell className="w-6 h-6 text-cyan-400" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="gold" className="text-[10px] font-black">
                  {unreadCount} NEW
                </Badge>
              )}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Updates about your books, quizzes and results. Read notices clear after a week;
              anything unread stays here until you open it.
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            className="font-bold text-xs shrink-0 flex items-center gap-1.5"
          >
            <CheckCheck className="w-4 h-4 text-cyan-500" />
            <span>Mark all read</span>
          </Button>
        )}
      </div>

      {isError ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-14 text-center rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Could not load your notifications
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              Check your connection and try again.
            </p>
          </div>
          <Button variant="outline" size="sm" className="font-bold text-xs" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
            <Inbox className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              You&rsquo;re all caught up
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              New updates about books, quizzes and results will show up here.
            </p>
          </div>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((n) => {
            const unread = isUnread(n);
            const destination = resolveNotificationDestination(n.route);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all cursor-pointer shadow-xs ${
                    unread
                      ? 'border-cyan-500/35 bg-cyan-500/[0.06] hover:border-cyan-500/60'
                      : 'border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#091124] hover:border-cyan-500/30'
                  }`}
                >
                  <div className="flex gap-3">
                    <span
                      className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                        unread ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3
                          className={`text-sm leading-snug ${
                            unread
                              ? 'font-black text-slate-900 dark:text-white'
                              : 'font-bold text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {n.title}
                        </h3>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {shortAge(n.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                        {n.body}
                      </p>

                      {n.imageUrl && (
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-[#1e2e56] mt-2 bg-slate-100 dark:bg-slate-900">
                          {/* A plain img, like every other admin-supplied image on
                              the site: the URL is typed into the composer and can
                              point at any host, which next/image would reject. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={n.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}

                      {destination && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 pt-0.5">
                          <span>{destination.externalUrl ? 'Open link' : 'View'}</span>
                          {destination.externalUrl ? (
                            <ExternalLink className="w-3 h-3" />
                          ) : (
                            <ChevronLeft className="w-3 h-3 rotate-180" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
