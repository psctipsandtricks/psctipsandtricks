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
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';

type StatusFilter = 'ALL' | 'COMPLETED' | 'IN_PROGRESS';
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
  const [sortKey, setSortKey] = useState<SortKey>('RECENT');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

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
  const inProgressCount = attempts.length - completedAttempts.length;

  // Averaging over every row would let unfinished attempts (percentage 0) drag
  // the number down, so only submitted attempts count towards performance.
  const avgPercentage =
    completedAttempts.length > 0
      ? completedAttempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0) /
        completedAttempts.length
      : 0;
  const bestPercentage =
    completedAttempts.length > 0
      ? Math.max(...completedAttempts.map((a) => a.percentage || 0))
      : undefined;

  const visibleAttempts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = attempts.filter((att) => {
      const quizTitle = (att.quiz?.title || 'Practice Quiz').toLowerCase();
      const category = (att.quiz?.category || '').toLowerCase();
      const matchesSearch = !term || quizTitle.includes(term) || category.includes(term);
      const matchesStatus = statusFilter === 'ALL' || att.attemptStatus === statusFilter;
      return matchesSearch && matchesStatus;
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
  }, [attempts, searchTerm, statusFilter, sortKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortKey]);

  const totalItems = visibleAttempts.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedAttempts = visibleAttempts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: attempts.length },
    { key: 'COMPLETED', label: 'Completed', count: completedAttempts.length },
    { key: 'IN_PROGRESS', label: 'In Progress', count: inProgressCount },
  ];

  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'ALL';

  if (loading || authLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6 py-4 px-1 sm:px-0">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-6 rounded-md" />
            <Skeleton className="w-64 h-4 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <Skeleton className="h-12 rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6 py-4 px-1 sm:px-0">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Link href="/quizzes">
          <Button
            variant="outline"
            size="sm"
            className="p-2 rounded-xl border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/70"
            aria-label="Back to Quiz Hub"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
            <History className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-500 shrink-0" />
            <span className="truncate">My Quiz Attempt History</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5 leading-relaxed">
            Every attempt you&apos;ve made, with scores, timing and answer breakdowns.
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          label="Total Attempts"
          value={String(attempts.length)}
          icon={<Trophy className="w-5 h-5" />}
          tone="cyan"
        />
        <StatTile
          label="Completed"
          value={String(completedAttempts.length)}
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="emerald"
        />
        <StatTile
          label="Average Score"
          value={completedAttempts.length > 0 ? formatPercent(avgPercentage) : '—'}
          hint="Completed only"
          icon={<Sparkles className="w-5 h-5" />}
          tone="gold"
        />
        <StatTile
          label="Best Score"
          value={bestPercentage !== undefined ? formatPercent(bestPercentage) : '—'}
          icon={<Target className="w-5 h-5" />}
          tone="violet"
        />
      </div>

      {/* Search + filters + sort */}
      {attempts.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search by quiz title or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-9"
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

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#091124] p-1 rounded-xl border border-slate-200 dark:border-[#1e2e56]">
              {filters.map((f) => {
                const isActive = statusFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setStatusFilter(f.key)}
                    aria-pressed={isActive}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                    <span className={`ml-1 font-mono ${isActive ? 'opacity-70' : 'opacity-60'}`}>
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="w-44 shrink-0">
              <Select
                value={sortKey}
                onChange={(val) => setSortKey(val as SortKey)}
                triggerClassName="h-9 text-xs"
                options={SORTS.map((s) => ({ value: s.key, label: s.label }))}
              />
            </div>
          </div>
        </div>
      )}

      {/* Attempt list */}
      {attempts.length === 0 ? (
        <EmptyState
          icon={<History className="w-6 h-6" />}
          title="No quiz attempts yet"
          message="Once you attempt a quiz it lands here with your score, timing and a full answer breakdown."
          action={
            <Link href="/quizzes">
              <Button variant="gold" size="sm" className="font-bold">
                Explore Quiz Hub
              </Button>
            </Link>
          }
        />
      ) : visibleAttempts.length === 0 ? (
        <EmptyState
          icon={<Search className="w-6 h-6" />}
          title="No attempts match your filters"
          message="Try a different search term or switch back to the All filter."
          action={
            hasActiveFilters ? (
              <Button
                variant="outline"
                size="sm"
                className="font-bold"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                }}
              >
                Clear Filters
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {paginatedAttempts.map((attempt) => (
            <AttemptRow key={attempt.id} attempt={attempt} />
          ))}

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
      )}
    </div>
  );
}

const TONES: Record<string, string> = {
  cyan: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  gold: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
};

function StatTile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone: keyof typeof TONES;
}) {
  return (
    <Card className="p-3 sm:p-4 glass-card flex items-center space-x-3">
      <div className={`p-2.5 rounded-xl border shrink-0 ${TONES[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold block truncate">
          {label}
        </span>
        <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
          {value}
        </span>
        {hint && (
          <span className="hidden sm:block text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
            {hint}
          </span>
        )}
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
    <Card className="p-10 text-center glass-card border-dashed">
      <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 dark:text-cyan-400 shadow-inner">
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
        {action}
      </div>
    </Card>
  );
}

/** Performance band drives the accent stripe, ring colour and score colour. */
type Band = 'strong' | 'fair' | 'weak' | 'pending';

function bandOf(attempt: any): Band {
  if (attempt.attemptStatus !== 'COMPLETED') return 'pending';
  if (attempt.passed) return 'strong';
  return (attempt.percentage || 0) >= 40 ? 'fair' : 'weak';
}

const BAND_STRIPE: Record<Band, string> = {
  strong: 'before:bg-gradient-to-b before:from-emerald-400 before:to-emerald-600',
  fair: 'before:bg-gradient-to-b before:from-amber-400 before:to-amber-600',
  weak: 'before:bg-gradient-to-b before:from-rose-400 before:to-rose-600',
  pending: 'before:bg-gradient-to-b before:from-cyan-400 before:to-blue-500',
};

const BAND_TEXT: Record<Band, string> = {
  strong: 'text-emerald-600 dark:text-emerald-400',
  fair: 'text-amber-600 dark:text-amber-400',
  weak: 'text-rose-600 dark:text-rose-400',
  pending: 'text-cyan-600 dark:text-cyan-300',
};

const BAND_RING: Record<Band, string> = {
  strong: 'stroke-emerald-500',
  fair: 'stroke-amber-500',
  weak: 'stroke-rose-500',
  pending: 'stroke-cyan-500',
};

function ScoreRing({ percentage, band }: { percentage: number; band: Band }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  // Negative marking can push a percentage below zero — clamp the arc only, so
  // the printed number still tells the truth.
  const clamped = Math.min(100, Math.max(0, percentage));
  const dash = (clamped / 100) * circumference;

  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-slate-200 dark:stroke-[#1e2e56]"
        />
        {/* A rounded cap on a zero-length arc paints a stray dot, so skip the
            arc entirely when there is nothing to show. */}
        {clamped > 0 && (
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            className={`${BAND_RING[band]} transition-[stroke-dasharray] duration-500`}
          />
        )}
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-[11px] font-black font-mono tabular-nums ${BAND_TEXT[band]}`}
      >
        {formatPercent(percentage)}
      </span>
    </div>
  );
}

/** Single stacked bar so correct / wrong / skipped read as proportions at a glance. */
function BreakdownBar({
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
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-[#091124]">
      {correct > 0 && <span className="bg-emerald-500" style={{ width: pct(correct) }} />}
      {wrong > 0 && <span className="bg-rose-500" style={{ width: pct(wrong) }} />}
      {unattempted > 0 && (
        <span className="bg-slate-300 dark:bg-slate-600" style={{ width: pct(unattempted) }} />
      )}
    </div>
  );
}

function BreakdownChip({
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
    <div className={`flex items-center space-x-2 p-2 rounded-xl border ${className}`}>
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
          {label}
        </span>
        <span className="block text-sm font-black font-mono tabular-nums">{value}</span>
      </span>
    </div>
  );
}

function AttemptRow({ attempt }: { attempt: any }) {
  const isCompleted = attempt.attemptStatus === 'COMPLETED';
  const band = bandOf(attempt);
  const quizTitle = attempt.quiz?.title || 'Practice Quiz';
  const category = attempt.quiz?.category;

  const correct = attempt.correctAnswers || 0;
  const wrong = attempt.wrongAnswers || 0;
  const unattempted = attempt.unattempted || 0;
  const totalQuestions = attempt.totalQuestions || attempt.quiz?.totalQuestions || correct + wrong + unattempted;

  const dateFormatted = new Date(attempt.startedAt || attempt.createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isNegativeMarking = Boolean(attempt.quiz?.negativeMarkingEnabled);
  const negEvery = Math.max(1, attempt.quiz?.negativeMarkingEvery || 3);
  const negDeduct = attempt.quiz?.negativeMarkingDeduct ?? 1;
  const negativeMarks = Math.floor(wrong / negEvery) * negDeduct;

  return (
    <Card
      className={`relative overflow-hidden p-4 sm:p-5 pl-5 sm:pl-6 glass-card rounded-2xl space-y-3.5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 ${BAND_STRIPE[band]}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
            {quizTitle}
          </h3>

          <div className="flex items-center flex-wrap gap-1.5">
            <Badge variant="outline" className="font-bold">
              Attempt #{attempt.attemptNumber || 1}
            </Badge>
            {isCompleted ? (
              <Badge variant={attempt.passed ? 'success' : 'danger'} className="font-bold">
                {attempt.passed ? 'Passed' : 'Not Passed'}
              </Badge>
            ) : (
              <Badge variant="warning" className="font-bold">
                In Progress
              </Badge>
            )}
            {isNegativeMarking && (
              <Badge variant="outline" className="font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25">
                Negative Marking (-{negDeduct}/{negEvery})
              </Badge>
            )}
            {category && (
              <Badge variant="default" className="font-bold max-w-[160px] truncate">
                {category}
              </Badge>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center space-x-1 font-mono">
              <Calendar className="w-3 h-3" />
              <span>{dateFormatted}</span>
            </span>
            {totalQuestions > 0 && (
              <span className="flex items-center space-x-1 font-mono">
                <ListChecks className="w-3 h-3" />
                <span>{totalQuestions} questions</span>
              </span>
            )}
            {isCompleted && (
              <span className="flex items-center space-x-1 font-mono">
                <Clock className="w-3 h-3" />
                <span>{formatDuration(attempt.timeTakenSeconds || 0)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Score / action */}
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 sm:shrink-0 border-t sm:border-t-0 border-slate-200/70 dark:border-[#1e2e56] pt-3 sm:pt-0">
          {isCompleted ? (
            <>
              <div className="text-left sm:text-right">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Score
                </span>
                <span className={`text-xl font-black font-mono tabular-nums ${BAND_TEXT[band]}`}>
                  {attempt.score ?? 0}
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {' '}
                    / {attempt.totalMarks ?? 0}
                  </span>
                </span>
                {isNegativeMarking && negativeMarks > 0 && (
                  <span className="block text-[10px] font-bold text-rose-500 font-mono">
                    Penalty: -{negativeMarks}
                  </span>
                )}
                <Link href={`/quizzes/${attempt.quizId}`} className="block mt-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-bold h-7 px-2.5 text-[11px] flex items-center space-x-1 border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/70"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retake</span>
                  </Button>
                </Link>
              </div>
              <ScoreRing percentage={attempt.percentage || 0} band={band} />
            </>
          ) : (
            <Link href={`/quizzes/${attempt.quizId}`} className="w-full sm:w-auto">
              <Button
                variant="gold"
                size="sm"
                className="font-bold w-full sm:w-auto flex items-center justify-center space-x-1 whitespace-nowrap"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Resume Quiz</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Answer breakdown */}
      {isCompleted && (
        <div className="space-y-2.5">
          <BreakdownBar correct={correct} wrong={wrong} unattempted={unattempted} />
          <div className={`grid gap-2 ${isNegativeMarking ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
            <BreakdownChip
              label="Correct"
              value={String(correct)}
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
              className="bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
            />
            <BreakdownChip
              label="Wrong"
              value={String(wrong)}
              icon={<XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
              className="bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400"
            />
            {isNegativeMarking && (
              <BreakdownChip
                label="Negative Marks"
                value={`-${negativeMarks}`}
                icon={<MinusCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                className="bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400"
              />
            )}
            <BreakdownChip
              label="Skipped"
              value={String(unattempted)}
              icon={<MinusCircle className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
              className="bg-slate-100 dark:bg-[#091124] border-slate-200 dark:border-[#1e2e56] text-slate-700 dark:text-slate-300"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
