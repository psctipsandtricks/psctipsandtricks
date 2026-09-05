'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Skeleton } from '@psc/ui';
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Download,
  History,
  ListChecks,
  MinusCircle,
  RotateCcw,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';
import type { QuizAnswerStatus, QuizAttemptReview, QuizReviewQuestion } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';

type Filter = 'ALL' | QuizAnswerStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'CORRECT', label: 'Correct' },
  { key: 'INCORRECT', label: 'Incorrect' },
  { key: 'UNATTEMPTED', label: 'Skipped' },
];

/** Percentages can carry long float tails (-33.333333) — one decimal at most. */
function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

/**
 * A qualitative read on a score, layered on top of the pass/fail verdict.
 *
 * "Not Passed" only says whether the cutoff was cleared — it reads the same
 * whether a student missed it by two marks or scored close to zero. This adds
 * the difference back, and applies to every attempt, passed or not. Mirrors
 * the thresholds the mobile app uses (performance_band.dart) so the two never
 * disagree about a label for the same attempt.
 */
function performanceBandFor(percentage: number): {
  label: string;
  className: string;
} {
  if (percentage >= 85) {
    return {
      label: 'Excellent',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    };
  }
  if (percentage >= 60) {
    return {
      label: 'Good',
      className: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
    };
  }
  if (percentage >= 40) {
    return {
      label: 'Average',
      className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    };
  }
  return {
    label: 'Needs Improvement',
    className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  };
}

function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

const optionLetter = (index: number) => String.fromCharCode(65 + index);

/** Colour language shared by the status badges, option rows and answer callouts. */
const STATUS_THEME: Record<QuizAnswerStatus, { label: string; badge: string; border: string }> = {
  CORRECT: {
    label: 'Correct',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    border: 'border-l-emerald-500',
  },
  INCORRECT: {
    label: 'Incorrect',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    border: 'border-l-rose-500',
  },
  UNATTEMPTED: {
    label: 'Not answered',
    badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
    border: 'border-l-slate-400 dark:border-l-slate-600',
  },
};

export default function QuizAttemptReviewPage({ params }: { params: { attemptId: string } }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [review, setReview] = useState<QuizAttemptReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/quizzes/attempts/${params.attemptId}`)}`);
    }
  }, [user, authLoading, params.attemptId, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadReview() {
      try {
        setLoading(true);
        const data = await ApiClient.getQuizAttemptReview(params.attemptId);
        if (!cancelled) setReview(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load this result.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadReview();
    return () => {
      cancelled = true;
    };
  }, [params.attemptId, user]);

  const counts = useMemo(() => {
    const questions = review?.questions ?? [];
    return {
      ALL: questions.length,
      CORRECT: questions.filter((q) => q.status === 'CORRECT').length,
      INCORRECT: questions.filter((q) => q.status === 'INCORRECT').length,
      UNATTEMPTED: questions.filter((q) => q.status === 'UNATTEMPTED').length,
    } as Record<Filter, number>;
  }, [review]);

  // The original question order is the server's; filtering never re-sorts it.
  const visibleQuestions = useMemo(
    () => (review?.questions ?? []).filter((q) => filter === 'ALL' || q.status === filter),
    [review, filter]
  );

  // Premium-only, and only reachable from here — a submitted attempt's own
  // result page — so a student can never download the answer key before
  // their attempt is locked in.
  const handleDownloadPDF = async () => {
    if (!review || isDownloadingPDF) return;
    setIsDownloadingPDF(true);
    try {
      const { generateQuizSolutionsPDF } = await import('@/lib/pdf-exporter');
      await generateQuizSolutionsPDF({
        quizTitle: review.quizTitle,
        score: review.score,
        totalMarks: review.totalMarks,
        questions: review.questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options.map((opt) => ({
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

  if (loading || authLoading || !user) {
    return (
      <div className="max-w-4xl mx-auto space-y-5 px-1 sm:px-0 py-2 animate-pulse">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>
        <Card className="p-5 sm:p-6 space-y-5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <Skeleton className="h-7 w-3/4 rounded-lg" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-20 rounded-lg" />
                <Skeleton className="h-6 w-24 rounded-lg" />
                <Skeleton className="h-6 w-20 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-16 w-36 rounded-xl" />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        </Card>
        <div className="space-y-3 pt-2">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {error || 'This result is not available.'}
        </h2>
        <Link href="/quizzes/history">
          <Button variant="gold" className="flex items-center space-x-2 mx-auto">
            <ChevronLeft className="w-4 h-4" />
            <span>Back to My Attempts</span>
          </Button>
        </Link>
      </div>
    );
  }

  const submittedOn = new Date(review.submittedAt || review.startedAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const band = performanceBandFor(review.percentage);

  return (
    <div className="max-w-4xl mx-auto space-y-5 px-1 sm:px-0 py-2">
      <div className="flex items-center justify-between gap-3">
        <Link href="/quizzes/history">
          <Button variant="outline" size="sm" className="font-bold flex items-center space-x-1.5">
            <ChevronLeft className="w-4 h-4" />
            <span>My Attempts</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {review.isPremium && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              isLoading={isDownloadingPDF}
              className="font-bold flex items-center space-x-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              title="Download Solutions PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Solutions PDF</span>
            </Button>
          )}
          <Link href={`/quizzes/${review.quizId}`}>
            <Button variant="gold" size="sm" className="font-bold flex items-center space-x-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake Quiz</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Result summary */}
      <Card className="p-5 sm:p-6 space-y-5 glass-card rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {review.quizTitle}
            </h1>
            <div className="flex items-center flex-wrap gap-1.5">
              <Badge variant={review.passed ? 'success' : 'danger'} className="font-bold">
                {review.passed ? 'Passed' : 'Not Passed'}
              </Badge>
              <Badge className={`font-bold ${band.className}`}>{band.label}</Badge>
              <Badge variant="outline" className="font-bold">
                Attempt #{review.attemptNumber}
              </Badge>
              {review.negativeMarking.enabled && (
                <Badge
                  variant="outline"
                  className="font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25"
                >
                  Negative Marking (-{review.negativeMarking.deduct}/{review.negativeMarking.every})
                </Badge>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center space-x-1 font-mono">
                <Calendar className="w-3 h-3" />
                <span>{submittedOn}</span>
              </span>
              <span className="flex items-center space-x-1 font-mono">
                <ListChecks className="w-3 h-3" />
                <span>{review.totalQuestions} questions</span>
              </span>
              <span className="flex items-center space-x-1 font-mono">
                <Clock className="w-3 h-3" />
                <span>{formatDuration(review.timeTakenSeconds)}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:shrink-0 border-t sm:border-t-0 border-slate-200/70 dark:border-[#1e2e56] pt-4 sm:pt-0">
            <div className="text-left sm:text-right">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Score
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {review.score}
                <span className="text-sm text-slate-400 dark:text-slate-500"> / {review.totalMarks}</span>
              </span>
              <span className="block text-[11px] font-bold font-mono text-slate-500 dark:text-slate-400">
                {formatPercent(review.percentage)} · pass {review.passingMarks}
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              {review.passed ? <Trophy className="w-6 h-6" /> : <Target className="w-6 h-6" />}
            </div>
          </div>
        </div>

        <div className={`grid gap-2 ${review.negativeMarking.enabled ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
          <SummaryChip
            label="Correct"
            value={String(review.correctAnswers)}
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            className="bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
          />
          <SummaryChip
            label="Wrong"
            value={String(review.wrongAnswers)}
            icon={<XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
            className="bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400"
          />
          {review.negativeMarking.enabled && (
            <SummaryChip
              label="Negative Marks"
              value={`-${review.negativeMarking.deducted}`}
              icon={<MinusCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
              className="bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400"
            />
          )}
          <SummaryChip
            label="Skipped"
            value={String(review.unattempted)}
            icon={<MinusCircle className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
            className="bg-slate-100 dark:bg-[#091124] border-slate-200 dark:border-[#1e2e56] text-slate-700 dark:text-slate-300"
          />
        </div>
      </Card>

      {review.answersStale && (
        <Card className="p-4 flex items-start space-x-3 border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300 leading-relaxed">
            This quiz was edited after you attempted it, so your saved answers no longer line up with
            the questions below. Your score above is the one you earned on the original questions.
          </p>
        </Card>
      )}

      {/* Question-by-question review */}
      <div className="flex items-center flex-wrap gap-2">
        <span className="flex items-center space-x-1.5 text-sm font-extrabold text-slate-900 dark:text-white mr-1">
          <History className="w-4 h-4 text-amber-500" />
          <span>Answer Review</span>
        </span>
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
              filter === key
                ? 'bg-amber-500 text-slate-950 border-amber-500'
                : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-300 dark:border-[#1e2e56] hover:border-amber-500/50'
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {visibleQuestions.length === 0 ? (
        <Card className="p-8 text-center glass-card border-dashed">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            No questions in this category.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleQuestions.map((question) => (
            <ReviewCard key={question.id} question={question} />
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <Link href="/quizzes/history" className="flex-1">
          <Button variant="outline" className="w-full font-bold flex items-center justify-center space-x-2">
            <History className="w-4 h-4" />
            <span>All My Attempts</span>
          </Button>
        </Link>
        <Link href="/quizzes" className="flex-1">
          <Button variant="gold" className="w-full font-bold flex items-center justify-center space-x-2">
            <Award className="w-4 h-4" />
            <span>Back to Quiz Hub</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}

function SummaryChip({
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
    <div className={`flex items-center space-x-2 p-2.5 rounded-xl border ${className}`}>
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

function ReviewCard({ question }: { question: QuizReviewQuestion }) {
  const theme = STATUS_THEME[question.status];

  return (
    <Card className={`p-4 sm:p-5 space-y-4 glass-card rounded-2xl border-l-4 ${theme.border}`}>
      <div className="flex items-center flex-wrap gap-2">
        <Badge variant="outline" className="font-bold">
          Question {question.number}
        </Badge>
        <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${theme.badge}`}>
          {theme.label}
        </span>
        <span className="text-[11px] font-semibold font-mono text-slate-500 dark:text-slate-400">
          {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
        </span>
      </div>

      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed">
        {question.text}
      </h3>

      <div className="space-y-2">
        {question.options.map((option, index) => {
          const isCorrect = index === question.correctOptionIndex;
          const isChosen = index === question.selectedOptionIndex;

          let rowStyles =
            'border-slate-200 dark:border-[#1e2e56] bg-slate-50 dark:bg-[#091124] text-slate-600 dark:text-slate-400';
          let badgeStyles = 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
          if (isCorrect) {
            rowStyles =
              'border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-semibold';
            badgeStyles = 'bg-emerald-500 text-white';
          } else if (isChosen) {
            rowStyles = 'border-rose-500/50 bg-rose-500/10 text-rose-900 dark:text-rose-200 font-semibold';
            badgeStyles = 'bg-rose-500 text-white';
          }

          return (
            <div key={option.id} className="space-y-1">
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border text-xs sm:text-sm ${rowStyles}`}
              >
                <div className="flex items-start space-x-2.5 min-w-0">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-mono font-bold shrink-0 ${badgeStyles}`}
                  >
                    {optionLetter(index)}
                  </span>
                  <span className="text-left leading-snug">{option.text}</span>
                </div>
                <div className="flex items-center flex-wrap gap-1.5 sm:shrink-0">
                  {isChosen && (
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        isCorrect
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {isCorrect ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      <span>Your answer</span>
                    </span>
                  )}
                  {isCorrect && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Correct answer</span>
                    </span>
                  )}
                </div>
              </div>

              {option.explanation && (isCorrect || isChosen) && (
                <p className="ml-9 text-[11px] italic text-slate-600 dark:text-slate-400 leading-relaxed">
                  {option.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {question.explanation && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block">
            Explanation
          </span>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
            {question.explanation}
          </p>
        </div>
      )}
    </Card>
  );
}
