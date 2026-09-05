'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Dialog, ConfirmDialog } from '@psc/ui';
import {
  Timer,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Trophy,
  Award,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertCircle,
  Clock,
  Download,
  MinusCircle,
  Scale,
  Play,
  ListChecks,
  LogOut,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';
import type { ExportPDFQuestionOption } from '@/lib/pdf-exporter';
import { QuizPaywall, type QuizAccessState } from '@/app/quiz-paywall';
import { QuizSubmittingOverlay } from '@/app/quiz-submitting-overlay';
import { QuizTakingSkeleton } from '../../skeletons/page-skeletons';

interface QuizQuestion {
  id: string;
  text: string;
  options: (string | ExportPDFQuestionOption)[];
  correct: number;
  explanation?: string;
  marks: number;
}

interface SavedQuizProgress {
  attemptId: string;
  currentIndex: number;
  selectedAnswers: Record<string, number>;
  elapsedSeconds?: number;
  remainingSeconds?: number;
}

const progressStorageKey = (quizId: string) => `quiz-progress-${quizId}`;

function loadSavedProgress(quizId: string, attemptId?: string): SavedQuizProgress | null {
  try {
    const raw = localStorage.getItem(progressStorageKey(quizId));
    if (!raw) return null;
    const saved: SavedQuizProgress = JSON.parse(raw);
    if (!attemptId) return saved;
    // Only trust it for the attempt it was saved against — a completed
    // attempt followed by a fresh one must not inherit stale progress.
    return saved.attemptId === attemptId ? saved : null;
  } catch {
    return null;
  }
}

export default function QuizTakingPage({ params }: { params: { id: string } }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDuration, setQuizDuration] = useState(900);
  const [showCorrectAnswerAfterSelection, setShowCorrectAnswerAfterSelection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(900);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The attempt (and its timer) only begins once the student presses Start on
  // the intro screen — a just-purchased quiz must never drop them straight
  // into a running clock.
  const [hasStarted, setHasStarted] = useState(false);
  const [isStartingAttempt, setIsStartingAttempt] = useState(false);
  const [startError, setStartError] = useState('');
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptNumber, setAttemptNumber] = useState<number>(1);
  const [activeAttempt, setActiveAttempt] = useState<any>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [pendingNavUrl, setPendingNavUrl] = useState<string | null>(null);
  const isNavigatingAway = React.useRef(false);
  const [isPremiumQuiz, setIsPremiumQuiz] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [access, setAccess] = useState<QuizAccessState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [negativeMarkingRules, setNegativeMarkingRules] = useState<{
    enabled: boolean;
    every: number;
    deduct: number;
    allowNegative: boolean;
  }>({
    enabled: false,
    every: 3,
    deduct: 1,
    allowNegative: false,
  });

  // Require login to take quiz
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/quizzes/${params.id}`)}`);
    }
  }, [user, authLoading, params.id, router]);

  // Fetch quiz and questions from API & Start/Resume attempt
  useEffect(() => {
    if (!user) return;
    async function fetchQuiz() {
      try {
        setLoading(true);
        // A re-fetch (e.g. right after an unlock) must land back on the intro
        // screen, never resume a half-rendered attempt.
        setHasStarted(false);
        setStartError('');
        const quiz = (await ApiClient.getQuizById(params.id)) as any;
        setQuizTitle(quiz.title);
        const isPaid = Boolean(quiz.isPremium || quiz.accessType === 'PAID' || (quiz.price && quiz.price > 0));
        setIsPremiumQuiz(isPaid);
        const resolvedAccess =
          quiz.access ??
          (isPaid
            ? { isPaid: true, hasAccess: false, price: quiz.price || 0, reason: 'PAYMENT_REQUIRED' }
            : null);
        setAccess(resolvedAccess);
        setNegativeMarkingRules({
          enabled: Boolean(quiz.negativeMarkingEnabled),
          every: Number(quiz.negativeMarkingEvery) || 3,
          deduct: Number(quiz.negativeMarkingDeduct) || 1,
          allowNegative: Boolean(quiz.allowNegativeScore),
        });

        // The server withholds questions and refuses attempts for a premium
        // quiz until it is paid for, so stop here and let the paywall render.
        if (resolvedAccess && resolvedAccess.hasAccess === false) {
          setQuestions([]);
          return;
        }
        setShowCorrectAnswerAfterSelection(quiz.showCorrectAnswerAfterSelection ?? true);
        const durationSeconds = (quiz.durationMinutes || 15) * 60;
        setQuizDuration(durationSeconds);
        setTimeLeft(durationSeconds);

        const mapped: QuizQuestion[] = (quiz.questions || []).map((q: any) => {
          const opts = Array.isArray(q.options) ? q.options : [];
          return {
            id: q.id,
            text: q.text,
            options: opts.map((o: any) =>
              typeof o === 'string'
                ? { id: `opt-${Math.random()}`, text: o }
                : { id: o.id || `opt-${Math.random()}`, text: o.text || '', explanation: o.explanation || undefined }
            ),
            correct: q.correctOptionIndex ?? 0,
            explanation: q.explanation || '',
            marks: q.marks ?? 1,
          };
        });
        setQuestions(mapped);

        // Check if there is an active attempt in progress on the server or in local storage
        let serverActive: any = null;
        try {
          serverActive = await ApiClient.getActiveQuizAttempt(params.id);
        } catch {}

        const localSaved = loadSavedProgress(params.id);
        if ((serverActive && serverActive.attemptStatus === 'IN_PROGRESS') || localSaved) {
          setActiveAttempt(serverActive);
          setHasSavedProgress(true);
        } else {
          setActiveAttempt(null);
          setHasSavedProgress(false);
        }
      } catch (err: any) {
        console.error('Failed to fetch quiz:', err);
        setError(err.message || 'Failed to load quiz');
      } finally {
        setLoading(false);
      }
    }
    fetchQuiz();
  }, [params.id, user, reloadKey]);

  useEffect(() => {
    if (!hasStarted || isSubmitted || isSubmitting || timeLeft <= 0 || loading || !user) return;
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [hasStarted, timeLeft, isSubmitted, isSubmitting, loading, user]);

  // Track exactly where the student is and save progress locally with elapsed and remaining time.
  useEffect(() => {
    if (!hasStarted || !attemptId || isSubmitted || isSubmitting || loading) return;
    const elapsedSeconds = Math.max(0, quizDuration - timeLeft);
    const progress: SavedQuizProgress = {
      attemptId,
      currentIndex,
      selectedAnswers,
      elapsedSeconds,
      remainingSeconds: timeLeft,
    };
    localStorage.setItem(progressStorageKey(params.id), JSON.stringify(progress));
  }, [hasStarted, attemptId, currentIndex, selectedAnswers, timeLeft, quizDuration, isSubmitted, isSubmitting, loading, params.id]);

  // Navigation Interception: warn and save when student tries to leave an active quiz
  useEffect(() => {
    if (!hasStarted || isSubmitted || isSubmitting) return;

    // Push dummy state to capture browser Back button
    window.history.pushState({ quizActive: true }, '', window.location.href);

    const handlePopState = () => {
      if (isNavigatingAway.current) return;
      window.history.pushState({ quizActive: true }, '', window.location.href);
      setPendingNavUrl('/quizzes');
      setShowExitModal(true);
    };

    const handleAnchorClick = (e: MouseEvent) => {
      if (isNavigatingAway.current) return;
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingNavUrl(href);
      setShowExitModal(true);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isNavigatingAway.current) return;
      const elapsedSeconds = Math.max(0, quizDuration - timeLeft);
      const progress: SavedQuizProgress = {
        attemptId: attemptId || '',
        currentIndex,
        selectedAnswers,
        elapsedSeconds,
        remainingSeconds: timeLeft,
      };
      localStorage.setItem(progressStorageKey(params.id), JSON.stringify(progress));

      const answerPayload = questions.map((q) => {
        const sel = selectedAnswers[q.id];
        return sel !== undefined ? { questionId: q.id, selectedOptionIndex: sel } : { questionId: q.id };
      });
      const body = JSON.stringify({
        timeTakenSeconds: elapsedSeconds,
        answers: answerPayload,
        currentIndex,
      });
      try {
        navigator.sendBeacon(`/api/quizzes/${params.id}/attempts/pause${attemptId ? `?attemptId=${attemptId}` : ''}`, body);
      } catch {}

      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleAnchorClick, true);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleAnchorClick, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasStarted, isSubmitted, isSubmitting, attemptId, currentIndex, selectedAnswers, timeLeft, quizDuration, questions, params.id]);

  // Begins or Resumes the attempt: continues with remaining time from where they left off
  const handleStartAttempt = async () => {
    if (isStartingAttempt) return;
    setIsStartingAttempt(true);
    setStartError('');
    try {
      const attempt = await ApiClient.startQuizAttempt(params.id);
      if (attempt) {
        setAttemptId(attempt.id);
        setAttemptNumber(attempt.attemptNumber || 1);

        const saved = loadSavedProgress(params.id, attempt.id) || loadSavedProgress(params.id);

        // Restore answers from saved local progress or backend attempt.answers
        if (saved && saved.selectedAnswers && Object.keys(saved.selectedAnswers).length > 0) {
          setSelectedAnswers(saved.selectedAnswers);
          setCurrentIndex(Math.min(saved.currentIndex, Math.max(0, questions.length - 1)));
        } else if (Array.isArray(attempt.answers) && attempt.answers.length > 0) {
          const restoredAnswers: Record<string, number> = {};
          attempt.answers.forEach((ans: any) => {
            if (ans.questionId && typeof ans.selectedOptionIndex === 'number') {
              restoredAnswers[ans.questionId] = ans.selectedOptionIndex;
            }
          });
          setSelectedAnswers(restoredAnswers);
          const firstUnanswered = questions.findIndex((q) => restoredAnswers[q.id] === undefined);
          setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
        } else {
          setCurrentIndex(0);
          setSelectedAnswers({});
        }

        // CRITICAL: compute remaining time from elapsed seconds and resume clock
        const elapsed =
          typeof attempt.timeTakenSeconds === 'number' && attempt.timeTakenSeconds > 0
            ? attempt.timeTakenSeconds
            : (saved?.elapsedSeconds ?? 0);
        const remaining = Math.max(0, quizDuration - elapsed);
        setTimeLeft(remaining);
      } else {
        setTimeLeft(quizDuration);
      }
      setHasStarted(true);
    } catch (e: any) {
      setStartError(e?.message || 'Could not start the quiz. Please try again.');
    } finally {
      setIsStartingAttempt(false);
    }
  };

  // User clicked "Exit" on the exit confirmation modal: save as Resume Quiz and exit
  const handleConfirmExit = async () => {
    setIsExiting(true);
    try {
      const elapsedSeconds = Math.max(0, quizDuration - timeLeft);
      const answerPayload = questions.map((q) => {
        const sel = selectedAnswers[q.id];
        return sel !== undefined
          ? { questionId: q.id, selectedOptionIndex: sel }
          : { questionId: q.id };
      });

      // 1. Save to local storage
      const progress: SavedQuizProgress = {
        attemptId: attemptId || '',
        currentIndex,
        selectedAnswers,
        elapsedSeconds,
        remainingSeconds: timeLeft,
      };
      localStorage.setItem(progressStorageKey(params.id), JSON.stringify(progress));

      // 2. Save to backend API
      await ApiClient.pauseQuizAttempt(
        params.id,
        {
          timeTakenSeconds: elapsedSeconds,
          answers: answerPayload,
          currentIndex,
        },
        attemptId || undefined
      );
    } catch (err) {
      console.error('Failed to pause quiz attempt on server:', err);
    } finally {
      setIsExiting(false);
      setShowExitModal(false);
      isNavigatingAway.current = true;
      const destination = pendingNavUrl || '/quizzes';
      router.push(destination);
    }
  };

  if (loading || authLoading || !user) {
    return <QuizTakingSkeleton />;
  }

  if (access && access.hasAccess === false) {
    return (
      <QuizPaywall
        quizId={params.id}
        title={quizTitle}
        access={access}
        loginRedirect={`/quizzes/${params.id}`}
        subtitle="This question bank is premium. Complete the payment to unlock the questions and attempt it."
        onUnlocked={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {error || 'No questions available for this quiz yet.'}
        </h2>
        <Link href="/quizzes">
          <Button variant="gold" className="flex items-center space-x-2 mx-auto">
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Quiz Hub</span>
          </Button>
        </Link>
      </div>
    );
  }

  // Access is confirmed but the attempt has not begun — show the intro screen.
  // Nothing here starts a timer; that only happens on the Start button.
  if (!hasStarted) {
    const savedElapsed = activeAttempt?.timeTakenSeconds ?? (loadSavedProgress(params.id)?.elapsedSeconds ?? 0);
    const savedRemaining = Math.max(0, quizDuration - savedElapsed);
    return (
      <QuizStartScreen
        title={quizTitle}
        questionCount={questions.length}
        durationSeconds={quizDuration}
        remainingSeconds={hasSavedProgress ? savedRemaining : quizDuration}
        totalMarks={questions.reduce((sum, q) => sum + (q.marks ?? 1), 0)}
        negativeMarking={negativeMarkingRules}
        isPremium={isPremiumQuiz}
        hasSavedProgress={hasSavedProgress}
        isStarting={isStartingAttempt}
        error={startError}
        onStart={handleStartAttempt}
      />
    );
  }

  const currentQ = questions[currentIndex];

  const handleOptionSelect = (optIndex: number) => {
    if (isSubmitted || (showCorrectAnswerAfterSelection && selectedAnswers[currentQ.id] !== undefined)) {
      return;
    }
    setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: optIndex }));
  };

  const handleSubmit = async () => {
    if (isSubmitting || isSubmitted) return;
    setIsSubmitting(true);
    isNavigatingAway.current = true;

    let positiveMarks = 0;
    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    const answerPayload: { questionId: string; selectedOptionIndex?: number }[] = [];

    questions.forEach((q) => {
      const selected = selectedAnswers[q.id];
      if (selected === undefined) {
        unattempted++;
        answerPayload.push({ questionId: q.id });
      } else if (selected === q.correct) {
        positiveMarks += (q.marks ?? 1);
        correct++;
        answerPayload.push({ questionId: q.id, selectedOptionIndex: selected });
      } else {
        wrong++;
        answerPayload.push({ questionId: q.id, selectedOptionIndex: selected });
      }
    });

    let negativeMarks = 0;
    if (negativeMarkingRules.enabled) {
      const every = Math.max(1, negativeMarkingRules.every);
      const deduct = negativeMarkingRules.deduct;
      negativeMarks = Math.floor(wrong / every) * deduct;
    }

    const netScore = positiveMarks - negativeMarks;
    const finalScore = negativeMarkingRules.allowNegative
      ? Math.round(netScore * 100) / 100
      : Math.max(0, Math.round(netScore * 100) / 100);

    const elapsedSeconds = Math.max(0, quizDuration - timeLeft);
    const takenMin = Math.floor(elapsedSeconds / 60);
    const takenSec = elapsedSeconds % 60;
    const timeTakenFormatted = `${takenMin}m ${takenSec.toString().padStart(2, '0')}s`;

    // Computed locally only as an offline fallback — the result page the
    // student lands on reads the server's scoring, which is the same logic the
    // mobile app renders from.
    setResult({
      score: finalScore,
      positiveMarks,
      negativeMarks: Math.round(negativeMarks * 100) / 100,
      negativeMarkingEnabled: negativeMarkingRules.enabled,
      negativeMarkingEvery: negativeMarkingRules.every,
      negativeMarkingDeduct: negativeMarkingRules.deduct,
      totalMarks: questions.reduce((sum, q) => sum + (q.marks ?? 1), 0),
      correct,
      wrong,
      unattempted,
      rank: Math.floor(Math.random() * 10) + 1,
      timeTakenFormatted,
      attemptNumber,
    });
    localStorage.removeItem(progressStorageKey(params.id));

    try {
      const saved = await ApiClient.submitQuizAttempt(
        params.id,
        {
          quizId: params.id,
          answers: answerPayload,
          timeTakenSeconds: elapsedSeconds,
          timeTakenMs: elapsedSeconds * 1000,
        },
        attemptId || undefined
      );
      if (saved?.id) {
        // Pre-fetch the review result page so routing is instantaneous
        router.prefetch(`/quizzes/attempts/${saved.id}`);
        // Allow the animated progress loader to reach completion smoothly
        await new Promise((resolve) => setTimeout(resolve, 800));
        router.replace(`/quizzes/attempts/${saved.id}`);
        // Keep isSubmitting true so the overlay masks seamlessly until the destination page loads
        return;
      }
      setIsSubmitting(false);
      setIsSubmitted(true);
    } catch (err) {
      // The attempt could not be persisted — fall back to the locally scored
      // summary so the student still sees how they did.
      console.warn('API quiz submission error (showing local summary):', err);
      setIsSubmitting(false);
      setIsSubmitted(true);
    }
  };

  // The countdown effect above stops ticking at 00:00 but never used to end
  // the attempt — a stalled timer left the student stuck on the last question.
  useEffect(() => {
    if (!hasStarted || isSubmitted || isSubmitting || timeLeft > 0 || loading || !user) return;
    handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, hasStarted, isSubmitted, isSubmitting, loading, user]);

  const handleCloseModal = () => {
    setIsSubmitted(false);
    router.push('/quizzes');
  };

  const handleDownloadPDF = async () => {
    if (isDownloadingPDF) return;
    const exportQuestions = questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options,
      correct: q.correct,
      explanation: q.explanation,
      marks: q.marks,
      userSelection: selectedAnswers[q.id],
    }));

    setIsDownloadingPDF(true);
    try {
      // jsPDF is a heavy dependency only needed when the student actually
      // downloads their solutions, not on every quiz-result view.
      const { generateQuizSolutionsPDF } = await import('@/lib/pdf-exporter');
      await generateQuizSolutionsPDF({
        quizTitle: quizTitle || 'PSC Quiz Solutions',
        score: result?.score,
        totalMarks: result?.totalMarks,
        questions: exportQuestions,
      });
    } catch (err) {
      console.error('Failed to generate solutions PDF', err);
      alert('Could not generate the solutions PDF. Please try again.');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 px-1 sm:px-0">
      {/* Timer & Progress Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-xl shadow-md gap-2">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPendingNavUrl('/quizzes');
              setShowExitModal(true);
            }}
            className="flex items-center space-x-1.5 py-1.5 px-2.5 sm:px-3 text-xs font-semibold text-slate-300 hover:text-white border-slate-700 hover:bg-slate-800 shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Exit Quiz</span>
            <span className="sm:hidden">Exit</span>
          </Button>
          <div className="h-5 w-px bg-slate-800 hidden sm:block" />
          <div className="flex items-center space-x-2">
            <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs text-slate-400 block">Progress</span>
              <span className="text-xs sm:text-sm font-bold text-white font-mono">
                {currentIndex + 1} / {questions.length}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2.5 sm:space-x-3 text-right">
          <div>
            <span className="text-[10px] sm:text-xs text-slate-400 block">Time Left</span>
            <span className="text-base sm:text-lg font-mono font-bold text-amber-400">
              {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>
          <Button
            variant="gold"
            size="sm"
            onClick={() => setShowSubmitConfirm(true)}
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="font-bold flex items-center space-x-1 py-1.5 px-3 text-xs shadow-sm cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Submitting…' : 'Submit'}</span>
          </Button>
        </div>
      </div>

      {/* Question Card */}
      <Card className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex justify-between items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">Question #{currentIndex + 1}</Badge>
            <Badge variant="gold" className="text-xs font-bold font-mono">Attempt #{attemptNumber}</Badge>
          </div>
        </div>

        <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-relaxed sm:leading-snug">{currentQ.text}</h2>

        <div className="space-y-2.5 sm:space-y-3">
          {currentQ.options.map((opt, idx) => {
            const optText = typeof opt === 'string' ? opt : opt.text;
            const optExplanation = typeof opt === 'object' && opt ? opt.explanation : undefined;

            const selectedIndex = selectedAnswers[currentQ.id];
            const hasAnswered = selectedIndex !== undefined;
            const isSelected = selectedIndex === idx;

            let buttonStyles = 'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40 text-slate-800 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700';
            let badgeStyles = 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
            let statusIndicator = null;

            if (showCorrectAnswerAfterSelection && hasAnswered) {
              const isCorrectOption = idx === currentQ.correct;
              const isUserChoice = idx === selectedIndex;

              if (isCorrectOption) {
                buttonStyles = 'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500/50 shadow-sm';
                badgeStyles = 'bg-emerald-500 text-white font-bold';
                statusIndicator = (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Correct Answer</span>
                  </span>
                );
              } else if (isUserChoice) {
                buttonStyles = 'border-rose-500 bg-rose-500/10 text-rose-950 dark:text-rose-200 font-semibold ring-1 ring-rose-500/50 shadow-sm';
                badgeStyles = 'bg-rose-500 text-white font-bold';
                statusIndicator = (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 shrink-0">
                    <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>Your Answer (Incorrect)</span>
                  </span>
                );
              } else {
                buttonStyles = 'border-slate-200/60 dark:border-slate-800/60 bg-slate-100/40 dark:bg-slate-900/20 text-slate-400 dark:text-slate-500 opacity-60';
              }
            } else if (isSelected) {
              buttonStyles = 'border-amber-500 bg-amber-500/10 text-amber-950 dark:text-amber-300 font-semibold shadow-sm ring-1 ring-amber-500/50';
              badgeStyles = 'bg-amber-500 text-slate-950 shadow-sm';
              statusIndicator = <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0" />;
            }

            const isOptionDisabled = isSubmitted || (showCorrectAnswerAfterSelection && hasAnswered);

            return (
              <div key={idx} className="space-y-1">
                <button
                  disabled={isOptionDisabled}
                  onClick={() => handleOptionSelect(idx)}
                  className={`w-full flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 rounded-xl border text-xs sm:text-sm font-medium transition-all gap-2 ${
                    isOptionDisabled ? 'cursor-default' : 'cursor-pointer'
                  } ${buttonStyles}`}
                >
                  <div className="flex items-start sm:items-center space-x-2.5 sm:space-x-3">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all shrink-0 mt-0.5 sm:mt-0 ${badgeStyles}`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-left leading-snug">{optText}</span>
                  </div>
                  {statusIndicator && <div className="self-end sm:self-center shrink-0">{statusIndicator}</div>}
                </button>

                {/* Per-option rationale if revealed */}
                {showCorrectAnswerAfterSelection && hasAnswered && optExplanation && (
                  <div className="ml-10 text-xs italic text-slate-600 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                    💡 <strong>Option Rationale:</strong> {optExplanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Explanation */}
        {showCorrectAnswerAfterSelection && selectedAnswers[currentQ.id] !== undefined && currentQ.explanation && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1 animate-in fade-in duration-200">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block">Explanation</span>
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
              {currentQ.explanation}
            </p>
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button
            variant="outline"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => i - 1)}
            className="flex items-center space-x-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </Button>

          {currentIndex === questions.length - 1 ? (
            <Button
              variant="gold"
              className="font-bold flex items-center space-x-2"
              onClick={() => setShowSubmitConfirm(true)}
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting…' : 'Submit Quiz'}</span>
            </Button>
          ) : (
            <Button variant="gold" className="flex items-center space-x-2" onClick={() => setCurrentIndex((i) => i + 1)}>
              <span>{selectedAnswers[currentQ.id] === undefined ? 'Skip' : 'Next Question'}</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>

      {/* Submit confirmation */}
      <ConfirmDialog
        isOpen={showSubmitConfirm}
        title="Are you sure you want to submit?"
        description={(() => {
          const unanswered = questions.length - Object.keys(selectedAnswers).length;
          return unanswered > 0
            ? `You have ${unanswered} unanswered ${unanswered === 1 ? 'question' : 'questions'}. Unanswered questions score zero, and you cannot change your answers after submitting.`
            : 'Once submitted, you cannot change your answers.';
        })()}
        confirmLabel="Submit"
        cancelLabel="Keep going"
        isLoading={isSubmitting}
        onConfirm={() => {
          setShowSubmitConfirm(false);
          handleSubmit();
        }}
        onCancel={() => setShowSubmitConfirm(false)}
      />

      {/* Exit confirmation modal */}
      <ConfirmDialog
        isOpen={showExitModal}
        title="Are you sure you want to exit this quiz?"
        description="Your current progress and remaining time will be saved. You can resume this quiz later from where you left off."
        confirmLabel="Exit"
        cancelLabel="Stay"
        isLoading={isExiting}
        onConfirm={handleConfirmExit}
        onCancel={() => {
          setShowExitModal(false);
          setPendingNavUrl(null);
        }}
      />

      {/* Result Dialog */}
      <Dialog isOpen={isSubmitted} onClose={handleCloseModal} title="Quiz Submitted Successfully">
        {result && (
          <div className="space-y-6 pt-2">
            <div className="flex flex-col items-center text-center space-y-2 pb-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
                <Trophy className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Quiz Completed</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Here is your performance summary report</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-center space-x-1.5 text-slate-500 dark:text-slate-400 text-xs">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>Your Score</span>
                </div>
                <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 block">
                  {result.score} / {result.totalMarks}
                </span>
                {result.negativeMarkingEnabled && result.negativeMarks > 0 && (
                  <span className="inline-block text-[10px] font-bold text-rose-500 bg-rose-500/10 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-500/20">
                    Gross: +{result.positiveMarks} | Negative: -{result.negativeMarks}
                  </span>
                )}
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex items-center justify-center space-x-1.5 text-slate-500 dark:text-slate-400 text-xs">
                  <Award className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Estimated State Rank</span>
                </div>
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 block">
                  #{result.rank}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <span className="flex items-center space-x-2 text-xs font-semibold">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>Completed Time:</span>
                </span>
                <span className="text-amber-500 font-bold font-mono">{result.timeTakenFormatted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center space-x-2 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Correct Answers:</span>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                  {result.correct} {result.negativeMarkingEnabled ? `(+${result.positiveMarks} marks)` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center space-x-2 text-xs font-semibold">
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <span>Wrong Answers:</span>
                </span>
                <span className="text-rose-600 dark:text-rose-400 font-bold font-mono">{result.wrong}</span>
              </div>

              {result.negativeMarkingEnabled && (
                <div className="flex justify-between items-center bg-rose-500/10 dark:bg-rose-950/30 -mx-1 px-2.5 py-1.5 rounded-lg border border-rose-500/25 animate-in fade-in duration-200">
                  <span className="flex items-center space-x-2 text-xs font-bold text-rose-700 dark:text-rose-400">
                    <MinusCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Negative Marks Deducted:</span>
                    <span className="text-[10px] font-normal text-rose-500/80 hidden sm:inline">
                      (-{result.negativeMarkingDeduct} per {result.negativeMarkingEvery} wrong)
                    </span>
                  </span>
                  <span className="text-rose-600 dark:text-rose-400 font-black font-mono text-sm">
                    -{result.negativeMarks}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="flex items-center space-x-2 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                  <span>Unattempted:</span>
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-bold font-mono">{result.unattempted}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {isPremiumQuiz && (
                <Button
                  variant="gold"
                  onClick={handleDownloadPDF}
                  isLoading={isDownloadingPDF}
                  className="flex-1 flex items-center justify-center space-x-2 cursor-pointer font-bold shadow-md shadow-amber-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Solution PDF</span>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleCloseModal}
                className="flex-1 flex items-center justify-center space-x-2 cursor-pointer font-bold"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Quiz Hub</span>
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Full-screen "scoring" overlay — covers the gap between confirming
          submit and either landing on the review page or the fallback result
          dialog above, which otherwise showed nothing but a small spinner on
          a button the confirm dialog had just vacated. */}
      {isSubmitting && <QuizSubmittingOverlay />}
    </div>
  );
}

/** The intro screen shown once access is confirmed. The attempt and its timer
 *  begin only when the student presses Start — a just-purchased quiz never
 *  drops them straight into a running clock. */
function QuizStartScreen({
  title,
  questionCount,
  durationSeconds,
  remainingSeconds,
  totalMarks,
  negativeMarking,
  isPremium,
  hasSavedProgress,
  isStarting,
  error,
  onStart,
}: {
  title: string;
  questionCount: number;
  durationSeconds: number;
  remainingSeconds?: number;
  totalMarks: number;
  negativeMarking: { enabled: boolean; every: number; deduct: number; allowNegative: boolean };
  isPremium: boolean;
  hasSavedProgress: boolean;
  isStarting: boolean;
  error: string;
  onStart: () => void;
}) {
  const durationMin = Math.max(1, Math.round(durationSeconds / 60));
  const effectiveRemaining = remainingSeconds !== undefined ? remainingSeconds : durationSeconds;
  const remMin = Math.floor(effectiveRemaining / 60);
  const remSec = effectiveRemaining % 60;

  return (
    <div className="max-w-2xl mx-auto py-10 sm:py-16 px-4">
      <Card className="p-6 sm:p-8 space-y-6 border border-amber-500/30">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center justify-center mx-auto">
            <ListChecks className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            {isPremium && (
              <Badge variant="gold" className="text-[10px] font-black uppercase tracking-wider">
                Premium · Unlocked
              </Badge>
            )}
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {title || 'Ready to begin?'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {hasSavedProgress
                ? `You have an attempt in progress with ${remMin}m ${remSec > 0 ? `${remSec}s ` : ''}remaining. Click Resume Quiz to continue from where you left off.`
                : 'Review the details below. The timer starts the moment you press Start.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            <HelpCircle className="w-4 h-4 mx-auto text-amber-500 mb-1" />
            <span className="block text-lg font-black text-slate-900 dark:text-white font-mono">{questionCount}</span>
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Questions</span>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            <Timer className="w-4 h-4 mx-auto text-amber-500 mb-1" />
            <span className="block text-lg font-black text-slate-900 dark:text-white font-mono">
              {hasSavedProgress ? `${remMin}m${remSec > 0 ? ` ${remSec}s` : ''}` : `${durationMin}m`}
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {hasSavedProgress ? 'Time Left' : 'Duration'}
            </span>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            <Trophy className="w-4 h-4 mx-auto text-amber-500 mb-1" />
            <span className="block text-lg font-black text-slate-900 dark:text-white font-mono">{totalMarks}</span>
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Marks</span>
          </div>
        </div>

        {negativeMarking.enabled && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-semibold">
            <MinusCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Negative marking is on: −{negativeMarking.deduct} for every {negativeMarking.every} wrong answers
              {negativeMarking.allowNegative ? '. Your score can go below zero.' : '.'}
            </span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <Button
          variant="gold"
          className="w-full font-bold py-3 flex items-center justify-center gap-2 cursor-pointer"
          onClick={onStart}
          isLoading={isStarting}
          disabled={isStarting}
        >
          <Play className="w-4 h-4" />
          <span>{isStarting ? 'Starting…' : hasSavedProgress ? 'Resume Quiz' : 'Start Quiz'}</span>
        </Button>

        <Link href="/quizzes" className="block">
          <Button variant="outline" className="w-full font-bold flex items-center justify-center gap-2">
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Quiz Hub</span>
          </Button>
        </Link>
      </Card>
    </div>
  );
}
