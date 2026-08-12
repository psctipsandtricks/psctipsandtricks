'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Skeleton } from '@psc/ui';
import { Trophy, ChevronLeft, ChevronRight, Calendar, Users, Award, Medal, Search, Lock, XCircle } from 'lucide-react';
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

export default function CompletedMockTestsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [tests, setTests] = useState<CompletedMockTest[]>([]);
  const [loading, setLoading] = useState(true);

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

  const attemptedTests = tests.filter((t) => t.state === 'ATTEMPTED');
  const bestRank = attemptedTests.reduce<number | undefined>((best, t) => {
    if (t.myRank === undefined) return best;
    return best === undefined || t.myRank < best ? t.myRank : best;
  }, undefined);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <Link href="/quizzes">
            <Button variant="outline" size="sm" className="p-2 rounded-xl">
              <ChevronLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-cyan-500" />
              <span>Completed Mock Tests</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5 leading-relaxed">
              Your score and rank for every mock test that has finished.
            </p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatTile label="Completed Tests" value={String(tests.length)} icon={<Calendar className="w-4 h-4" />} />
        <StatTile label="You Attempted" value={String(attemptedTests.length)} icon={<Award className="w-4 h-4" />} />
        <StatTile
          label="Best Rank"
          value={bestRank !== undefined ? `#${bestRank}` : '—'}
          icon={<Medal className="w-4 h-4" />}
        />
      </div>

      {/* Test list */}
      {tests.length === 0 ? (
        <Card className="p-10 text-center bg-white dark:bg-[#0c152e] border border-slate-200/90 dark:border-[#1e2e56] rounded-2xl">
          <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
              <Search className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No completed mock tests yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Once a live mock test finishes it will appear here with your score and rank.
              </p>
            </div>
            <Link href="/quizzes">
              <Button variant="gold" size="sm" className="font-bold">
                Back to Quiz Hub
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <CompletedTestRow key={test.id} test={test} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-[#0c152e] border border-slate-200/90 dark:border-[#1e2e56] shadow-xs">
      <div className="flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span className="text-cyan-500">{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-1.5 text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">{value}</p>
    </div>
  );
}

const STATE_COPY: Record<MockTestState, string> = {
  ATTEMPTED: '',
  MISSED: "You joined this test but didn't submit before it ended.",
  NOT_ATTEMPTED: 'You did not participate in this live test.',
  LOCKED: 'Premium test — purchase access to view or attempt it.',
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
      <Link href={`/mock-tests/${test.id}`}>
        <Button variant="outline" size="sm" className="font-bold flex items-center space-x-1 whitespace-nowrap">
          <span>Rank List</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </Link>
    );
  }

  if (test.state === 'LOCKED') {
    return (
      <Link href={`/checkout?type=quiz&id=${test.quizId}`}>
        <Button variant="gold" size="sm" className="font-bold flex items-center space-x-1 whitespace-nowrap">
          <Lock className="w-3.5 h-3.5" />
          <span>Buy Book</span>
        </Button>
      </Link>
    );
  }

  // MISSED or NOT_ATTEMPTED — the live session is over, so this sends the
  // student to the quiz's regular practice attempt instead of a rank list
  // they never earned a place on.
  return (
    <Link href={`/quizzes/${test.quizId}`}>
      <Button variant="outline" size="sm" className="font-bold flex items-center space-x-1 whitespace-nowrap">
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

  return (
    <Card className="p-4 sm:p-5 bg-white dark:bg-[#0c152e] border border-slate-200/90 dark:border-[#1e2e56] rounded-2xl shadow-xs hover:border-cyan-500/40 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center flex-wrap gap-2">
            <Badge variant="default" className="font-bold">
              <Trophy className="w-3 h-3 mr-1 inline" />
              Completed
            </Badge>
            <StateBadge state={test.state} myRank={test.myRank} rankedOutOf={test.rankedOutOf} />
          </div>

          <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
            {test.title}
          </h3>

          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="truncate">{test.quizTitle}</span>
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

        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
          {test.state === 'ATTEMPTED' && (
            <div className="text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Your Score
              </span>
              <span className="text-lg font-black font-mono text-cyan-600 dark:text-cyan-300">
                {test.myScore ?? 0}
                <span className="text-xs text-slate-400 dark:text-slate-500"> / {test.totalMarks}</span>
              </span>
            </div>
          )}
          {test.state === 'LOCKED' && test.price > 0 && (
            <div className="text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Price
              </span>
              <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">₹{test.price}</span>
            </div>
          )}
          <TestAction test={test} />
        </div>
      </div>
    </Card>
  );
}
