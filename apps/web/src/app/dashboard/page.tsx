'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  StatsCard,
  Card,
  CardTitle,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Button,
  Skeleton,
} from '@psc/ui';
import {
  Target,
  Award,
  Trophy,
  Clock,
  Flame,
  RefreshCw,
  TrendingUp,
  CalendarClock,
  ChevronRight,
  BarChart3,
  Radio,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  TooltipProps,
} from 'recharts';
import type { StudentDashboard } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';

/** How often the dashboard silently re-pulls its numbers while the tab is visible. */
const POLL_INTERVAL_MS = 45_000;

function formatRelative(from: string | Date, now: number) {
  const seconds = Math.max(0, Math.round((now - new Date(from).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function scoreTone(percentage: number) {
  if (percentage >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (percentage >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-white/95 dark:bg-[#0c152e]/95 backdrop-blur-md px-3 py-2 shadow-lg">
      <p className="text-[11px] font-bold text-slate-900 dark:text-white max-w-[180px] truncate">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-[11px] font-mono font-bold" style={{ color: entry.color }}>
          {entry.name}: {entry.value}%
        </p>
      ))}
    </div>
  );
}

/** Circular gauge for overall accuracy — reads faster than another number in a row of numbers. */
function AccuracyRing({ value }: { value: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          className="stroke-slate-200 dark:stroke-[#1e2e56]"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="url(#accuracyGradient)"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (clamped / 100) * circumference}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
        <defs>
          <linearGradient id="accuracyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">{Math.round(clamped)}%</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Accuracy
        </span>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-8 py-2 sm:py-4 px-1 sm:px-0">
      <div className="space-y-2">
        <Skeleton className="w-72 h-8 rounded-lg" />
        <Skeleton className="w-96 h-4 rounded-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<StudentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Keeps the poller from clobbering a manual refresh already in flight.
  const inFlight = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/dashboard');
    }
  }, [user, authLoading, router]);

  const load = useCallback(async (silent: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (silent) setRefreshing(true);
    try {
      const result = await ApiClient.getMyDashboard();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      // A silent poll failure keeps the last good numbers on screen rather than
      // replacing a working dashboard with an error panel.
      if (!silent) setError(err?.message || 'Could not load your dashboard right now.');
    } finally {
      inFlight.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load(false);
  }, [user, load]);

  // Live-ness: poll on an interval, and pull immediately when the tab regains
  // focus so numbers are never stale after a quiz was submitted in another tab.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [user, load]);

  // Drives the "updated Xs ago" label.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(tick);
  }, []);

  if (authLoading || (loading && !data)) return <DashboardSkeleton />;

  if (error && !data) {
    return (
      <div className="py-10 px-1 sm:px-0">
        <Card className="max-w-lg mx-auto text-center space-y-3 border-dashed">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Dashboard unavailable</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
          <Button variant="gold" size="sm" onClick={() => load(false)} className="font-bold">
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { stats, trend, recentAttempts, subjects, upcomingMockTests } = data;
  const hasAttempts = stats.totalAttempts > 0;
  const weeklyDelta = Math.round((stats.averagePercentThisWeek - stats.averagePercentLastWeek) * 10) / 10;
  const hasWeeklyComparison = stats.averagePercentThisWeek > 0 && stats.averagePercentLastWeek > 0;
  const rankImprovement =
    stats.bestRank !== null && stats.previousBestRank !== null && stats.previousBestRank > stats.bestRank
      ? stats.previousBestRank - stats.bestRank
      : null;
  const passRate = hasAttempts ? Math.round((stats.passedCount / stats.totalAttempts) * 100) : 0;
  // A trend confined to one day would otherwise repeat the same date on every
  // tick, so it switches to clock time instead.
  const trendWithinOneDay =
    trend.length > 0 &&
    new Set(trend.map((point) => new Date(point.date).toDateString())).size === 1;
  const formatTrendTick = (value: string) =>
    new Date(value).toLocaleString('en-IN',
      trendWithinOneDay
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short' },
    );

  return (
    <div className="space-y-4 sm:space-y-8 py-2 sm:py-4 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {user?.name ? `${user.name.split(' ')[0]}'s Study Dashboard` : 'Personal Study Dashboard'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
            Track your mock test accuracy, recent ranks, and study plan progress.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span>{lastUpdated ? `Live • ${formatRelative(lastUpdated, now)}` : 'Live'}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10"
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard
          title={`Tests Attempted${stats.mockTestsTaken > 0 ? ` • ${stats.mockTestsTaken} mock` : ''}`}
          value={stats.totalAttempts}
          change={stats.attemptsThisWeek > 0 ? `+${stats.attemptsThisWeek} this week` : undefined}
          isPositive
          icon={<Target className="w-5 h-5" />}
        />
        <StatsCard
          title="Average Score"
          value={`${stats.averagePercent}%`}
          change={hasWeeklyComparison ? `${weeklyDelta >= 0 ? '+' : ''}${weeklyDelta}% vs last week` : undefined}
          isPositive={weeklyDelta >= 0}
          icon={<Award className="w-5 h-5" />}
        />
        <StatsCard
          title={stats.rankedAttempts > 0 ? `Best Rank • ${stats.rankedAttempts} ranked` : 'Best Rank'}
          value={stats.bestRank !== null ? `#${stats.bestRank}` : '—'}
          change={rankImprovement ? `↑ ${rankImprovement} ranks` : undefined}
          isPositive
          icon={<Trophy className="w-5 h-5" />}
        />
        <StatsCard
          title="Study Hours"
          value={`${stats.studyHours} hrs`}
          change={stats.studyHoursThisWeek > 0 ? `+${stats.studyHoursThisWeek} hrs this week` : undefined}
          isPositive
          icon={<Clock className="w-5 h-5" />}
        />
      </div>

      {!hasAttempts ? (
        <Card className="text-center space-y-3 border-dashed py-10">
          <BarChart3 className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Your dashboard is waiting for data</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Attempt a quiz or join a live mock test and your scores, ranks, accuracy, and study hours will appear here
            automatically.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Link href="/quizzes">
              <Button variant="gold" size="sm" className="font-bold">
                Explore Quiz Hub
              </Button>
            </Link>
            <Link href="/mock-tests">
              <Button variant="outline" size="sm" className="font-bold">
                Browse Mock Tests
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Trend + accuracy */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
            <Card className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                  <span>Performance Trend</span>
                </CardTitle>
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Score
                  </span>
                  <span className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-500" /> Accuracy
                  </span>
                </div>
              </div>

              {trend.length < 2 ? (
                <div className="h-56 flex flex-col items-center justify-center text-center gap-2">
                  <BarChart3 className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                    One more attempt and your score trend will start plotting here.
                  </p>
                </div>
              ) : (
                <div className="h-56 -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="accuracyFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="currentColor" className="text-slate-200 dark:text-[#1e2e56]" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatTrendTick}
                        tick={{ fontSize: 10 }}
                        stroke="currentColor"
                        className="text-slate-400 dark:text-slate-500"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                        stroke="currentColor"
                        className="text-slate-400 dark:text-slate-500"
                        tickLine={false}
                        axisLine={false}
                        width={34}
                        tickFormatter={(value: number) => `${value}%`}
                      />
                      <Tooltip content={<ChartTooltip />} labelFormatter={(_, entries) => entries?.[0]?.payload?.label ?? ''} />
                      <Area
                        type="monotone"
                        dataKey="percentage"
                        name="Score"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        fill="url(#scoreFill)"
                        dot={{ r: 3, fill: '#06b6d4', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="accuracy"
                        name="Accuracy"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        fill="url(#accuracyFill)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="space-y-4">
              <CardTitle className="text-base sm:text-lg">Overall Accuracy</CardTitle>
              <div className="flex items-center gap-4">
                <AccuracyRing value={stats.accuracyPercent} />
                <div className="space-y-3 min-w-0">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Pass Rate
                    </span>
                    <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {passRate}%
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">
                      ({stats.passedCount}/{stats.totalAttempts})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Study Streak
                    </span>
                    <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Flame className="w-4 h-4" />
                      {stats.streakDays} {stats.streakDays === 1 ? 'day' : 'days'}
                    </span>
                  </div>
                </div>
              </div>

              {subjects.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-slate-200/80 dark:border-[#1e2e56]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Strongest Subjects
                  </span>
                  {subjects.slice(0, 4).map((subject) => (
                    <div key={subject.category} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                          {subject.category}
                        </span>
                        <span className={`font-mono font-bold shrink-0 ${scoreTone(subject.averagePercent)}`}>
                          {subject.averagePercent}%
                          <span className="text-slate-400 dark:text-slate-500 font-medium ml-1">
                            ({subject.attempts})
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-[#1e2e56] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-700"
                          style={{ width: `${Math.min(100, Math.max(2, subject.averagePercent))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Recent performances */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg">Recent Performances</CardTitle>
              <Link
                href="/quizzes/history"
                className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-0.5"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Table on wide screens */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                {/* The shared header is sticky for tables inside their own
                    scroll container; here the scrollport is the page, so it
                    would stick underneath the fixed navbar and vanish. */}
                <TableHeader className="static">
                  <TableRow>
                    <TableHead>Test Title</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>Accuracy</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAttempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[220px]">{attempt.title}</span>
                          {attempt.isMockTest && (
                            <Badge variant="gold" className="text-[9px] font-bold shrink-0">
                              MOCK
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          {attempt.category} • {formatRelative(attempt.submittedAt, now)}
                        </span>
                      </TableCell>
                      <TableCell className={`font-mono font-extrabold ${scoreTone(attempt.percentage)}`}>
                        {attempt.score} / {attempt.totalMarks}
                      </TableCell>
                      <TableCell className="font-mono font-extrabold">
                        {attempt.rank !== null ? (
                          <span className="text-emerald-600 dark:text-emerald-400">#{attempt.rank}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium font-mono">{attempt.accuracy}%</TableCell>
                      <TableCell className="font-mono text-slate-500 dark:text-slate-400">
                        {formatDuration(attempt.timeTakenSeconds)}
                      </TableCell>
                      <TableCell>
                        {attempt.passed || (attempt.percentage !== undefined && attempt.percentage >= 40) ? (
                          <Badge variant="success">Passed</Badge>
                        ) : (
                          <Badge variant="danger" className="font-medium">
                            Needs Improvement
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Stacked cards on mobile — a 6-column table is unreadable there */}
            <div className="sm:hidden space-y-2.5">
              {recentAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/60 dark:bg-[#091124]/60 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{attempt.title}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {attempt.category} • {formatRelative(attempt.submittedAt, now)}
                      </p>
                    </div>
                    {attempt.passed || (attempt.percentage !== undefined && attempt.percentage >= 40) ? (
                      <Badge variant="success" className="shrink-0">
                        Passed
                      </Badge>
                    ) : (
                      <Badge variant="danger" className="font-medium shrink-0">
                        Improve
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
                        Score
                      </span>
                      <span className={`text-xs font-mono font-extrabold ${scoreTone(attempt.percentage)}`}>
                        {attempt.score}/{attempt.totalMarks}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
                        Rank
                      </span>
                      <span className="text-xs font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                        {attempt.rank !== null ? `#${attempt.rank}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
                        Accuracy
                      </span>
                      <span className="text-xs font-mono font-extrabold text-slate-900 dark:text-white">
                        {attempt.accuracy}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Upcoming & live mock tests */}
      {upcomingMockTests.length > 0 && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
              <span>Upcoming & Live Mock Tests</span>
            </CardTitle>
            <Link
              href="/mock-tests"
              className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingMockTests.map((test) => (
              <Link
                key={test.id}
                href={`/mock-tests/${test.id}`}
                className="rounded-xl border border-slate-200 dark:border-[#1e2e56] bg-slate-50/60 dark:bg-[#091124]/60 p-3.5 space-y-2 hover:border-cyan-500/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">{test.title}</p>
                  {test.status === 'LIVE' ? (
                    <Badge variant="danger" className="shrink-0 flex items-center gap-1">
                      <Radio className="w-3 h-3 animate-pulse" /> LIVE
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      UPCOMING
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {new Date(test.scheduledAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {test.durationMinutes ? ` • ${test.durationMinutes} min` : ''}
                </p>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-500 dark:text-slate-400 font-mono">
                    {test.participantCount} joined
                  </span>
                  {test.submitted ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Submitted</span>
                  ) : test.joined ? (
                    <span className="text-amber-600 dark:text-amber-400">Joined</span>
                  ) : (
                    <span className="text-cyan-600 dark:text-cyan-400">Join now</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
