'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Input, Skeleton, Pagination } from '@psc/ui';
import {
  Trophy,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Award,
  Medal,
  Search,
  Lock,
  XCircle,
  Target,
  SlidersHorizontal,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';

/**
 * Mirrors the state machine in `mock-tests/[id]/page.tsx` (`isLocked` →
 * `hasSubmitted` → joined-but-not-submitted → never joined) so a student sees
 * the same verdict for the same test whether they land here or open it
 * directly — required so the rank list never leaks to someone who didn't
 * actually attempt or pay for the test.
 */
type MockTestState = 'ATTEMPTED' | 'MISSED' | 'NOT_ATTEMPTED' | 'LOCKED';

type StateFilter = 'ALL' | MockTestState;

interface CompletedMockTest {
  id: string;
  quizId: string;
  title: string;
  quizTitle: string;
  scheduledAt: string;
  totalMarks: number;
  participantCount: number;
  myScore?: number;
  myRank?: number;
  rankedOutOf?: number;
  state: MockTestState;
  price: number;
}

const FILTERS: { key: StateFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ATTEMPTED', label: 'Attempted' },
  { key: 'MISSED', label: 'Missed' },
  { key: 'NOT_ATTEMPTED', label: 'Not Attempted' },
  { key: 'LOCKED', label: 'Locked' },
];

export default function CompletedMockTestsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [tests, setTests] = useState<CompletedMockTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirect=/mock-tests/completed');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    async function loadCompleted() {
      try {
        setLoading(true);
        const [allTests, myAttempts] = await Promise.all([
          ApiClient.getMockTests(),
          ApiClient.getMyMockTestAttempts(),
        ]);

        const attemptByTestId = new Map<string, any>();
        (myAttempts || []).forEach((a: any) => attemptByTestId.set(a.mockTestId, a));

        const completed = (allTests as any[])
          .filter((mt) => mt.status === 'COMPLETED')
          .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

        // The stored `rank` is written by a background worker and can lag or be
        // missing, so derive it from the leaderboard — which ranks live from the
        // score ordering — for every test this student actually submitted.
        const enriched = await Promise.all(
          completed.map(async (mt) => {
            const attempt = attemptByTestId.get(mt.id);
            const hasAccess = mt.access?.hasAccess ?? true;
            const joined = !!attempt;
            const attempted = !!attempt?.submittedAt;

            // A payment lapse takes priority over join/submit history — a locked
            // premium test never shows scores or a rank list, no matter what a
            // participant row says.
            let state: MockTestState;
            if (!hasAccess) state = 'LOCKED';
            else if (attempted) state = 'ATTEMPTED';
            else if (joined) state = 'MISSED';
            else state = 'NOT_ATTEMPTED';

            const base: CompletedMockTest = {
              id: mt.id,
              quizId: mt.quizId,
              title: mt.title,
              quizTitle: mt.quiz?.title || 'Quiz',
              scheduledAt: mt.scheduledAt,
              totalMarks: mt.quiz?.totalMarks ?? 0,
              participantCount: mt._count?.participants ?? 0,
              state,
              price: mt.access?.price ?? mt.quiz?.price ?? 0,
              myScore: attempt?.score ?? undefined,
              myRank: attempt?.rank ?? undefined,
            };

            if (state !== 'ATTEMPTED') return base;

            try {
              const board = await ApiClient.getMockTestLeaderboard(mt.id);
              const mine = (board || []).find((entry: any) => entry.userId === user!.id);
              return {
                ...base,
                myRank: mine?.rank ?? base.myRank,
                myScore: mine?.score ?? base.myScore,
                rankedOutOf: board?.length ?? undefined,
              };
            } catch (err) {
              console.error(`Failed to load leaderboard for mock test ${mt.id}:`, err);
              return base;
            }
          }),
        );

        setTests(enriched);
      } catch (err) {
        console.error('Failed to load completed mock tests:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCompleted();
  }, [user]);

  const attemptedTests = useMemo(() => tests.filter((t) => t.state === 'ATTEMPTED'), [tests]);

  const bestRank = attemptedTests.reduce<number | undefined>((best, t) => {
    if (t.myRank === undefined) return best;
    return best === undefined || t.myRank < best ? t.myRank : best;
  }, undefined);

  // Only tests with a positive total contribute — a test with no marks
  // configured would otherwise divide by zero and poison the average.
  const scorable = attemptedTests.filter((t) => t.totalMarks > 0);
  const avgPercentage =
    scorable.length > 0
      ? Math.round(
          scorable.reduce((acc, t) => acc + Math.max(0, ((t.myScore ?? 0) / t.totalMarks) * 100), 0) / scorable.length,
        )
      : 0;

  const filteredTests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return tests.filter((t) => {
      const matchesSearch =
        !term || t.title.toLowerCase().includes(term) || t.quizTitle.toLowerCase().includes(term);
      const matchesState = stateFilter === 'ALL' || t.state === stateFilter;
      return matchesSearch && matchesState;
    });
  }, [tests, searchTerm, stateFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, stateFilter]);

  const totalItems = filteredTests.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedTests = filteredTests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading || authLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-6 px-2">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-56 h-6 rounded-md" />
            <Skeleton className="w-72 h-4 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <Skeleton className="h-12 rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
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
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-500 shrink-0" />
            <span className="truncate">Completed Mock Tests</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5 leading-relaxed">
            Your score and rank for every mock test that has finished.
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          label="Completed"
          value={String(tests.length)}
          icon={<Calendar className="w-5 h-5" />}
          tone="cyan"
        />
        <StatTile
          label="Attempted"
          value={String(attemptedTests.length)}
          icon={<Award className="w-5 h-5" />}
          tone="emerald"
        />
        <StatTile
          label="Best Rank"
          value={bestRank !== undefined ? `#${bestRank}` : '—'}
          icon={<Medal className="w-5 h-5" />}
          tone="gold"
        />
        <StatTile
          label="Avg Score"
          value={scorable.length > 0 ? `${avgPercentage}%` : '—'}
          icon={<Target className="w-5 h-5" />}
          tone="violet"
        />
      </div>

      {/* Search + state filters */}
      {tests.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search mock tests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              aria-label="Search completed mock tests"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap bg-slate-100 dark:bg-[#091124] p-1 rounded-xl border border-slate-200 dark:border-[#1e2e56]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 ml-1.5 hidden sm:block" />
            {FILTERS.map((f) => {
              const count = f.key === 'ALL' ? tests.length : tests.filter((t) => t.state === f.key).length;
              const isActive = stateFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStateFilter(f.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                  <span className={`ml-1 font-mono ${isActive ? 'opacity-70' : 'opacity-60'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Test list */}
      {tests.length === 0 ? (
        <EmptyState
          title="No completed mock tests yet"
          message="Once a live mock test finishes it will appear here with your score and rank."
          action={
            <Link href="/quizzes">
              <Button variant="gold" size="sm" className="font-bold">
                Back to Quiz Hub
              </Button>
            </Link>
          }
        />
      ) : filteredTests.length === 0 ? (
        <EmptyState
          title="No mock tests match your filters"
          message="Try a different search term or switch back to the All filter."
          action={
            <Button
              variant="outline"
              size="sm"
              className="font-bold"
              onClick={() => {
                setSearchTerm('');
                setStateFilter('ALL');
              }}
            >
              Clear Filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {paginatedTests.map((test) => (
            <CompletedTestRow key={test.id} test={test} />
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
  icon,
  tone,
}: {
  label: string;
  value: string;
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
        <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">{value}</span>
      </div>
    </Card>
  );
}

function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action: React.ReactNode;
}) {
  return (
    <Card className="p-10 text-center glass-card border-dashed">
      <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 dark:text-cyan-400 shadow-inner">
          <Search className="w-6 h-6" />
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

const STATE_COPY: Record<MockTestState, string> = {
  ATTEMPTED: '',
  MISSED: "You joined this test but didn't submit before it ended.",
  NOT_ATTEMPTED: 'You did not participate in this live test.',
  LOCKED: 'Premium test — purchase access to view or attempt it.',
};

/** Left accent stripe colour so a student can scan states without reading badges. */
const STATE_ACCENT: Record<MockTestState, string> = {
  ATTEMPTED: 'before:bg-gradient-to-b before:from-cyan-400 before:to-blue-500',
  MISSED: 'before:bg-amber-500',
  NOT_ATTEMPTED: 'before:bg-slate-300 dark:before:bg-slate-600',
  LOCKED: 'before:bg-gradient-to-b before:from-amber-400 before:to-amber-600',
};

const MEDAL_STYLE: Record<number, string> = {
  1: 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-[0_0_14px_rgba(245,158,11,0.45)]',
  2: 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 shadow-[0_0_12px_rgba(148,163,184,0.4)]',
  3: 'bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950 shadow-[0_0_12px_rgba(249,115,22,0.4)]',
};

function StateBadge({ state, myRank, rankedOutOf }: { state: MockTestState; myRank?: number; rankedOutOf?: number }) {
  if (state === 'ATTEMPTED') {
    const isTopThree = myRank !== undefined && myRank <= 3;
    return (
      <Badge variant={isTopThree ? 'gold' : 'success'} className="font-bold">
        {myRank !== undefined ? `Rank #${myRank}${rankedOutOf ? ` of ${rankedOutOf}` : ''}` : 'Rank pending'}
      </Badge>
    );
  }
  if (state === 'MISSED') {
    return (
      <Badge variant="warning" className="font-bold">
        Missed
      </Badge>
    );
  }
  if (state === 'LOCKED') {
    return (
      <Badge variant="outline" className="font-bold text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10">
        <Lock className="w-3 h-3 mr-1 inline" />
        Locked
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-bold text-slate-500">
      <XCircle className="w-3 h-3 mr-1 inline" />
      Not Attempted
    </Badge>
  );
}

function TestAction({ test }: { test: CompletedMockTest }) {
  if (test.state === 'ATTEMPTED') {
    return (
      <Link href={`/mock-tests/${test.id}`} className="block w-full sm:w-auto">
        <Button
          variant="outline"
          size="sm"
          className="font-bold w-full sm:w-auto flex items-center justify-center space-x-1 whitespace-nowrap border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/70"
        >
          <span>Rank List</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </Link>
    );
  }

  if (test.state === 'LOCKED') {
    return (
      <Link href={`/checkout?type=quiz&id=${test.quizId}`} className="block w-full sm:w-auto">
        <Button
          variant="gold"
          size="sm"
          className="font-bold w-full sm:w-auto flex items-center justify-center space-x-1 whitespace-nowrap"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Buy Quiz (₹{test.price ?? 0})</span>
        </Button>
      </Link>
    );
  }

  // MISSED or NOT_ATTEMPTED — the live session is over, so this sends the
  // student to the quiz's regular practice attempt instead of a rank list
  // they never earned a place on.
  return (
    <Link href={`/quizzes/${test.quizId}`} className="block w-full sm:w-auto">
      <Button
        variant="outline"
        size="sm"
        className="font-bold w-full sm:w-auto flex items-center justify-center space-x-1 whitespace-nowrap"
      >
        <span>Go to Attempt Test</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </Button>
    </Link>
  );
}

function CompletedTestRow({ test }: { test: CompletedMockTest }) {
  const scheduled = new Date(test.scheduledAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const showScore = test.state === 'ATTEMPTED';
  const score = test.myScore ?? 0;
  // Negative marking can push a raw score below zero — clamp only the bar, so
  // the printed number still tells the truth.
  const percent =
    test.totalMarks > 0 ? Math.min(100, Math.max(0, Math.round((score / test.totalMarks) * 100))) : 0;
  const medal = test.myRank !== undefined && test.myRank <= 3 ? MEDAL_STYLE[test.myRank] : undefined;

  return (
    <Card
      className={`relative overflow-hidden p-4 sm:p-5 pl-5 sm:pl-6 glass-card rounded-2xl transition-all hover:border-cyan-500/40 hover:shadow-[0_4px_24px_-8px_rgba(6,182,212,0.3)] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 ${STATE_ACCENT[test.state]}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center flex-wrap gap-2">
            <Badge variant="default" className="font-bold">
              <Trophy className="w-3 h-3 mr-1 inline" />
              Completed
            </Badge>
            <StateBadge state={test.state} myRank={test.myRank} rankedOutOf={test.rankedOutOf} />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            {medal && (
              <span
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black font-mono ${medal}`}
                title={`Rank #${test.myRank}`}
              >
                {test.myRank}
              </span>
            )}
            <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
              {test.title}
            </h3>
          </div>

          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="truncate max-w-[220px]">{test.quizTitle}</span>
            <span className="flex items-center space-x-1 font-mono">
              <Calendar className="w-3 h-3" />
              <span>{scheduled}</span>
            </span>
            <span className="flex items-center space-x-1 font-mono">
              <Users className="w-3 h-3" />
              <span>{test.participantCount} joined</span>
            </span>
          </div>

          {STATE_COPY[test.state] && (
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{STATE_COPY[test.state]}</p>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 sm:shrink-0 border-t sm:border-t-0 border-slate-200/70 dark:border-[#1e2e56] pt-3 sm:pt-0">
          {showScore && (
            <div className="text-left sm:text-right sm:min-w-[110px]">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Your Score
              </span>
              <span className="text-lg font-black font-mono text-cyan-600 dark:text-cyan-300">
                {score}
                <span className="text-xs text-slate-400 dark:text-slate-500"> / {test.totalMarks}</span>
              </span>
              {test.totalMarks > 0 && (
                <span className="mt-1 block h-1.5 w-full sm:w-24 sm:ml-auto rounded-full bg-slate-200 dark:bg-[#091124] overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                    style={{ width: `${percent}%` }}
                  />
                </span>
              )}
            </div>
          )}
          {test.state === 'LOCKED' && test.price > 0 && (
            <div className="text-left sm:text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Price
              </span>
              <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">₹{test.price}</span>
            </div>
          )}
          <div className="shrink-0">
            <TestAction test={test} />
          </div>
        </div>
      </div>
    </Card>
  );
}
