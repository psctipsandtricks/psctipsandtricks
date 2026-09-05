'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Input, Pagination, Skeleton, Select } from '@psc/ui';
import {
  History,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  PlayCircle,
  RotateCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sparkles,
  Target,
  ListChecks,
  X,
  Crown,
  Download,
  ArrowRight,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';

type StatusFilter = 'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED';
type AccessFilter = 'ALL' | 'FREE' | 'PREMIUM';
type SortKey = 'RECENT' | 'OLDEST' | 'BEST' | 'WORST';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'RECENT', label: 'Newest first' },
  { key: 'OLDEST', label: 'Oldest first' },
  { key: 'BEST', label: 'Highest score' },
  { key: 'WORST', label: 'Lowest score' },
];

/** Percentages can carry long float tails (-33.333333) — one decimal at most. */
function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default function StudentQuizHistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('RECENT');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/quizzes/history');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    async function loadHistory() {
      try {
        setLoading(true);
        const data = await ApiClient.getStudentAttemptHistory();
        setAttempts(data || []);
      } catch (err) {
        console.error('Failed to load attempt history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [user]);

  const completedAttempts = useMemo(
    () => attempts.filter((a) => a.attemptStatus === 'COMPLETED'),
    [attempts]
  );
  const inProgressAttempts = useMemo(
    () => attempts.filter((a) => a.attemptStatus !== 'COMPLETED'),
    [attempts]
  );
  const passedAttempts = useMemo(
    () => completedAttempts.filter((a) => a.passed),
    [completedAttempts]
  );
  const failedAttempts = useMemo(
    () => completedAttempts.filter((a) => !a.passed),
    [completedAttempts]
  );

  const avgPercentage =
    completedAttempts.length > 0
      ? completedAttempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0) /
        completedAttempts.length
      : 0;
  const bestPercentage =
    completedAttempts.length > 0
      ? Math.max(...completedAttempts.map((a) => a.percentage || 0))
      : undefined;

  const passRate =
    completedAttempts.length > 0
      ? (passedAttempts.length / completedAttempts.length) * 100
      : 0;

  const visibleAttempts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = attempts.filter((att) => {
      const quizTitle = (att.quiz?.title || 'Practice Quiz').toLowerCase();
      const category = (att.quiz?.category || '').toLowerCase();
      const matchesSearch = !term || quizTitle.includes(term) || category.includes(term);

      let matchesStatus = true;
      if (statusFilter === 'COMPLETED') matchesStatus = att.attemptStatus === 'COMPLETED';
      else if (statusFilter === 'IN_PROGRESS') matchesStatus = att.attemptStatus !== 'COMPLETED';
      else if (statusFilter === 'PASSED') matchesStatus = att.attemptStatus === 'COMPLETED' && att.passed;
      else if (statusFilter === 'FAILED') matchesStatus = att.attemptStatus === 'COMPLETED' && !att.passed;

      const isPremium = Boolean(
        att.quiz?.isPremium ||
          att.quiz?.accessType === 'PAID' ||
          (att.quiz?.price ?? 0) > 0
      );

      let matchesAccess = true;
      if (accessFilter === 'FREE') matchesAccess = !isPremium;
      else if (accessFilter === 'PREMIUM') matchesAccess = isPremium;

      return matchesSearch && matchesStatus && matchesAccess;
    });

    const timeOf = (a: any) => new Date(a.startedAt || a.createdAt).getTime();
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'OLDEST':
          return timeOf(a) - timeOf(b);
        case 'BEST':
          return (b.percentage || 0) - (a.percentage || 0);
        case 'WORST':
          return (a.percentage || 0) - (b.percentage || 0);
        default:
          return timeOf(b) - timeOf(a);
      }
    });
  }, [attempts, searchTerm, statusFilter, accessFilter, sortKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, accessFilter, sortKey]);

  const totalItems = visibleAttempts.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedAttempts = visibleAttempts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const statusFilters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: attempts.length },
    { key: 'COMPLETED', label: 'Completed', count: completedAttempts.length },
    { key: 'IN_PROGRESS', label: 'In Progress', count: inProgressAttempts.length },
    { key: 'PASSED', label: 'Passed', count: passedAttempts.length },
    { key: 'FAILED', label: 'Needs Work', count: failedAttempts.length },
  ];

  const hasActiveFilters =
    searchTerm.trim() !== '' || statusFilter !== 'ALL' || accessFilter !== 'ALL';

  if (loading || authLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 py-6 px-4 sm:px-6">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-10 h-10 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="w-56 h-7 rounded-lg" />
            <Skeleton className="w-80 h-4 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-14 rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-6 px-4 sm:px-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 glass-panel rounded-3xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-gradient-to-l from-cyan-500/10 via-blue-500/5 to-transparent pointer-events-none rounded-3xl" />
        
        <div className="flex items-center space-x-3.5 relative z-10">
          <Link href="/quizzes">
            <Button
              variant="outline"
              size="sm"
              className="p-2.5 rounded-2xl border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-cyan-500/10 hover:border-cyan-400/50 transition-all shadow-sm"
              aria-label="Back to Quiz Hub"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center space-x-2.5">
              <span className="p-2 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
                <History className="w-5 h-5 sm:w-6 sm:h-6" />
              </span>
              <span>My Quiz Attempt History</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
              Review detailed scores, accuracy breakdowns, question solutions, and resume pending quizzes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10 sm:self-center">
          <Link href="/quizzes">
            <Button
              variant="gold"
              size="sm"
              className="font-bold text-xs sm:text-sm px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <span>Explore Quiz Hub</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Attempts"
          value={String(attempts.length)}
          subtext={`${completedAttempts.length} completed`}
          icon={<Trophy className="w-5 h-5" />}
          tone="cyan"
        />
        <StatCard
          label="Pass Rate"
          value={completedAttempts.length > 0 ? formatPercent(passRate) : '—'}
          subtext={`${passedAttempts.length} passed / ${completedAttempts.length} finished`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="emerald"
        />
        <StatCard
          label="Average Score"
          value={completedAttempts.length > 0 ? formatPercent(avgPercentage) : '—'}
          subtext="Over all completed tests"
          icon={<Sparkles className="w-5 h-5" />}
          tone="gold"
        />
        <StatCard
          label="Best Score"
          value={bestPercentage !== undefined ? formatPercent(bestPercentage) : '—'}
          subtext="Personal record"
          icon={<Target className="w-5 h-5" />}
          tone="violet"
        />
      </div>

      {/* Search + Filter Toolbar */}
      {attempts.length > 0 && (
        <div className="p-3 sm:p-4 glass-card rounded-2xl flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
          {/* Search Box */}
          <div className="relative w-full xl:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search by quiz title or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-9 h-10 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-[#091124] border-slate-200 dark:border-white/10 focus:border-cyan-500 focus:ring-cyan-500/20"
              aria-label="Search quiz attempts"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Pills & Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#091124] border border-slate-200/80 dark:border-white/10 overflow-x-auto max-w-full">
              {statusFilters.map((f) => {
                const isActive = statusFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setStatusFilter(f.key)}
                    aria-pressed={isActive}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Access Filter (All / Free / Premium) */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#091124] border border-slate-200/80 dark:border-white/10">
              {(['ALL', 'FREE', 'PREMIUM'] as AccessFilter[]).map((tier) => {
                const isActive = accessFilter === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setAccessFilter(tier)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-white/10'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {tier === 'ALL' ? 'All Tiers' : tier === 'FREE' ? 'Free' : 'Premium'}
                  </button>
                );
              })}
            </div>

            {/* Sort Dropdown */}
            <div className="w-40 shrink-0">
              <Select
                value={sortKey}
                onChange={(val) => setSortKey(val as SortKey)}
                triggerClassName="h-10 text-xs rounded-xl bg-slate-50 dark:bg-[#091124] border-slate-200 dark:border-white/10"
                options={SORTS.map((s) => ({ value: s.key, label: s.label }))}
              />
            </div>
          </div>
        </div>
      )}

      {/* Attempt List */}
      {attempts.length === 0 ? (
        <EmptyState
          icon={<History className="w-8 h-8" />}
          title="No quiz attempts yet"
          message="Once you take a quiz, your full attempt history, performance analytics, and solution reviews will appear here."
          action={
            <Link href="/quizzes">
              <Button variant="gold" size="md" className="font-bold">
                Explore Quiz Hub
              </Button>
            </Link>
          }
        />
      ) : visibleAttempts.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title="No matching attempts found"
          message="No attempts match your current search keywords or filters. Try adjusting your query."
          action={
            hasActiveFilters ? (
              <Button
                variant="outline"
                size="sm"
                className="font-bold border-cyan-500/40 text-cyan-600 dark:text-cyan-400"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                  setAccessFilter('ALL');
                }}
              >
                Clear Filters
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>
              Showing <span className="font-bold text-slate-900 dark:text-white font-mono">{paginatedAttempts.length}</span> of{' '}
              <span className="font-bold text-slate-900 dark:text-white font-mono">{totalItems}</span> matching attempts
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                  setAccessFilter('ALL');
                }}
                className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-bold"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset all filters</span>
              </button>
            )}
          </div>

          <div className="space-y-3.5">
            {paginatedAttempts.map((attempt) => (
              <AttemptCard key={attempt.id} attempt={attempt} />
            ))}
          </div>

          <div className="pt-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const CARD_TONES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  cyan: {
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-500/25',
    glow: 'from-cyan-500/10 to-transparent',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/25',
    glow: 'from-emerald-500/10 to-transparent',
  },
  gold: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/25',
    glow: 'from-amber-500/10 to-transparent',
  },
  violet: {
    bg: 'bg-violet-500/10 dark:bg-violet-500/15',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/25',
    glow: 'from-violet-500/10 to-transparent',
  },
};

function StatCard({
  label,
  value,
  subtext,
  icon,
  tone,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  tone: keyof typeof CARD_TONES;
}) {
  const t = CARD_TONES[tone];

  return (
    <Card className="p-4 sm:p-5 glass-card relative overflow-hidden flex items-center justify-between group hover:border-cyan-500/40 transition-all duration-300">
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-gradient-to-tl ${t.glow} pointer-events-none`} />
      
      <div className="space-y-1 relative z-10 min-w-0 flex-1 pr-2">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block truncate">
          {label}
        </span>
        <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
          {value}
        </div>
        {subtext && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium block truncate">
            {subtext}
          </span>
        )}
      </div>

      <div
        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${t.bg} ${t.text} ${t.border} shadow-sm group-hover:scale-105 transition-transform`}
      >
        {icon}
      </div>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action: React.ReactNode;
}) {
  return (
    <Card className="p-12 text-center glass-panel border-dashed">
      <div className="flex flex-col items-center justify-center space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-inner">
          {icon}
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
        {action}
      </div>
    </Card>
  );
}

type Band = 'strong' | 'fair' | 'weak' | 'pending';

function bandOf(attempt: any): Band {
  if (attempt.attemptStatus !== 'COMPLETED') return 'pending';
  if (attempt.passed) return 'strong';
  return (attempt.percentage || 0) >= 40 ? 'fair' : 'weak';
}

const BAND_ACCENT: Record<Band, { bar: string; text: string; bg: string; border: string }> = {
  strong: {
    bar: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-emerald-500/25',
  },
  fair: {
    bar: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-500/25',
  },
  weak: {
    bar: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    border: 'border-rose-500/25',
  },
  pending: {
    bar: 'bg-cyan-500',
    text: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    border: 'border-cyan-500/25',
  },
};

function ScoreDial({ percentage, band }: { percentage: number; band: Band }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percentage));
  const dash = (clamped / 100) * circumference;
  const strokeColor =
    band === 'strong'
      ? '#10b981'
      : band === 'fair'
      ? '#f59e0b'
      : band === 'weak'
      ? '#f43f5e'
      : '#06b6d4';

  return (
    <div className="relative w-15 h-15 shrink-0 flex items-center justify-center">
      <svg viewBox="0 0 60 60" className="w-14 h-14 -rotate-90" aria-hidden="true">
        <circle
          cx="30"
          cy="30"
          r={radius}
          fill="none"
          strokeWidth="5"
          className="stroke-slate-200/80 dark:stroke-slate-700/60"
        />
        {clamped > 0 && (
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            className="transition-[stroke-dasharray] duration-500"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-[11px] font-black font-mono tabular-nums ${BAND_ACCENT[band].text}`}>
          {formatPercent(percentage)}
        </span>
      </div>
    </div>
  );
}

function AccuracyBar({
  correct,
  wrong,
  unattempted,
}: {
  correct: number;
  wrong: number;
  unattempted: number;
}) {
  const total = correct + wrong + unattempted;
  if (total <= 0) return null;

  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800/80 p-0.5 gap-0.5">
      {correct > 0 && (
        <span
          className="bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: pct(correct) }}
          title={`Correct: ${correct}`}
        />
      )}
      {wrong > 0 && (
        <span
          className="bg-rose-500 rounded-full transition-all duration-500"
          style={{ width: pct(wrong) }}
          title={`Wrong: ${wrong}`}
        />
      )}
      {unattempted > 0 && (
        <span
          className="bg-slate-400 dark:bg-slate-600 rounded-full transition-all duration-500"
          style={{ width: pct(unattempted) }}
          title={`Skipped: ${unattempted}`}
        />
      )}
    </div>
  );
}

function MiniPill({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  className: string;
}) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold ${className}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="shrink-0">{icon}</span>
        <span className="truncate opacity-80 text-[11px]">{label}</span>
      </div>
      <span className="font-mono font-black text-xs tabular-nums ml-2">{value}</span>
    </div>
  );
}

function AttemptCard({ attempt }: { attempt: any }) {
  const isCompleted = attempt.attemptStatus === 'COMPLETED';
  const band = bandOf(attempt);
  const quizTitle = attempt.quiz?.title || 'Practice Quiz';
  const category = attempt.quiz?.category;
  const isPremium = Boolean(
    attempt.quiz?.isPremium ||
      attempt.quiz?.accessType === 'PAID' ||
      (attempt.quiz?.price ?? 0) > 0
  );

  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    if (isDownloadingPDF) return;
    setIsDownloadingPDF(true);
    try {
      const review: any = await ApiClient.getQuizAttemptReview(attempt.id);
      const { generateQuizSolutionsPDF } = await import('@/lib/pdf-exporter');
      await generateQuizSolutionsPDF({
        quizTitle: review.quizTitle || quizTitle,
        score: review.score,
        totalMarks: review.totalMarks,
        questions: (review.questions || []).map((q: any) => ({
          id: q.id,
          text: q.text,
          options: (q.options || []).map((opt: any) => ({
            id: opt.id,
            text: opt.text,
            explanation: opt.explanation ?? undefined,
          })),
          correct: q.correctOptionIndex ?? -1,
          explanation: q.explanation ?? undefined,
          marks: q.marks,
          userSelection: q.selectedOptionIndex ?? undefined,
        })),
      });
    } catch (err) {
      console.error('Failed to generate solutions PDF', err);
      alert('Could not generate the solutions PDF. Please try again.');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const correct = attempt.correctAnswers || 0;
  const wrong = attempt.wrongAnswers || 0;
  const unattempted = attempt.unattempted || 0;
  const totalQuestions =
    attempt.totalQuestions ||
    attempt.quiz?.totalQuestions ||
    correct + wrong + unattempted;

  const dateFormatted = new Date(attempt.startedAt || attempt.createdAt).toLocaleString(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  );

  const isNegativeMarking = Boolean(attempt.quiz?.negativeMarkingEnabled);
  const negEvery = Math.max(1, attempt.quiz?.negativeMarkingEvery || 3);
  const negDeduct = attempt.quiz?.negativeMarkingDeduct ?? 1;
  const negativeMarks = Math.floor(wrong / negEvery) * negDeduct;

  return (
    <Card className="glass-card rounded-2xl p-4 sm:p-5 relative overflow-hidden transition-all duration-300 hover:border-cyan-500/40 hover:shadow-md">
      {/* Accent Left Indicator */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${BAND_ACCENT[band].bar}`} />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Info, Badges, Metadata */}
        <div className="min-w-0 flex-1 pl-2 sm:pl-3 space-y-2">
          {/* Title & Badges */}
          <div className="space-y-1.5">
            <div className="flex items-center flex-wrap gap-1.5">
              {isPremium ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  <Crown className="w-3 h-3" />
                  <span>Premium</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                  <span>Free</span>
                </span>
              )}

              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10">
                Attempt #{attempt.attemptNumber || 1}
              </span>

              {isCompleted ? (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    attempt.passed
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
                  }`}
                >
                  {attempt.passed ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Passed</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      <span>Not Passed</span>
                    </>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30">
                  <Clock className="w-3 h-3 animate-spin" />
                  <span>In Progress</span>
                </span>
              )}

              {category && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 truncate max-w-[150px]">
                  {category}
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white leading-snug">
              {quizTitle}
            </h3>
          </div>

          {/* Metadata Row */}
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{dateFormatted}</span>
            </span>
            {totalQuestions > 0 && (
              <span className="flex items-center gap-1.5 font-mono">
                <ListChecks className="w-3.5 h-3.5 text-slate-400" />
                <span>{totalQuestions} questions</span>
              </span>
            )}
            {isCompleted && (
              <span className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{formatDuration(attempt.timeTakenSeconds || 0)}</span>
              </span>
            )}
            {isNegativeMarking && (
              <span className="text-[11px] text-rose-500 font-semibold">
                Neg: -{negDeduct}/{negEvery}
              </span>
            )}
          </div>
        </div>

        {/* Right: Score Dial + Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 pl-2 sm:pl-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-200/80 dark:border-white/10 shrink-0">
          {isCompleted ? (
            <>
              {/* Score Display */}
              <div className="text-left sm:text-right space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Final Score
                </span>
                <div className="flex items-baseline sm:justify-end gap-1 font-mono">
                  <span className={`text-xl sm:text-2xl font-black ${BAND_ACCENT[band].text}`}>
                    {attempt.score ?? 0}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    / {attempt.totalMarks ?? 0}
                  </span>
                </div>
                {isNegativeMarking && negativeMarks > 0 && (
                  <span className="block text-[10px] font-bold text-rose-500 font-mono">
                    Penalty: -{negativeMarks}
                  </span>
                )}
              </div>

              {/* Dial */}
              <ScoreDial percentage={attempt.percentage || 0} band={band} />

              {/* Actions Group */}
              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                <Link href={`/quizzes/attempts/${attempt.id}`}>
                  <Button
                    variant="gold"
                    size="sm"
                    className="font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <ListChecks className="w-3.5 h-3.5" />
                    <span>Review</span>
                  </Button>
                </Link>

                <Link href={`/quizzes/${attempt.quizId}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-bold text-xs h-9 px-3 rounded-xl flex items-center gap-1.5 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10"
                    title="Retake Quiz"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retake</span>
                  </Button>
                </Link>

                {isPremium && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPDF}
                    isLoading={isDownloadingPDF}
                    disabled={isDownloadingPDF}
                    title="Download Solutions PDF"
                    className="font-bold text-xs h-9 px-3 rounded-xl flex items-center gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {isDownloadingPDF ? 'PDF…' : 'PDF'}
                    </span>
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Link href={`/quizzes/${attempt.quizId}`} className="w-full sm:w-auto">
              <Button
                variant="gold"
                size="sm"
                className="font-bold w-full sm:w-auto h-10 px-5 rounded-xl flex items-center justify-center gap-2 shadow-sm"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Resume Quiz</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Accuracy breakdown footer (for completed attempts) */}
      {isCompleted && (
        <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-white/5 space-y-2.5 pl-2 sm:pl-3">
          <AccuracyBar correct={correct} wrong={wrong} unattempted={unattempted} />

          <div
            className={`grid gap-2 ${
              isNegativeMarking ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
            }`}
          >
            <MiniPill
              label="Correct"
              value={String(correct)}
              icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              className="bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
            />
            <MiniPill
              label="Wrong"
              value={String(wrong)}
              icon={<XCircle className="w-3.5 h-3.5 text-rose-500" />}
              className="bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400"
            />
            {isNegativeMarking && (
              <MiniPill
                label="Penalty"
                value={`-${negativeMarks}`}
                icon={<MinusCircle className="w-3.5 h-3.5 text-rose-500" />}
                className="bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400"
              />
            )}
            <MiniPill
              label="Skipped"
              value={String(unattempted)}
              icon={<MinusCircle className="w-3.5 h-3.5 text-slate-400" />}
              className="bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
