'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@psc/ui';
import { CheckCircle2, Trophy, Award, ChevronLeft, ChevronRight, Send, Radio, Clock, XCircle, Download } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';
import { QuizPaywall } from '@/app/quiz-paywall';
import { QuizTakingSkeleton } from '../../skeletons/page-skeletons';

interface QuizQuestionOption {
  id?: string;
  text: string;
  explanation?: string;
}

interface QuizQuestion {
  id: string;
  text: string;
  options: (string | QuizQuestionOption)[];
  correct: number;
  explanation?: string;
  marks: number;
}

const LEADERBOARD_POLL_MS = 4000;
const STATUS_POLL_MS = 15_000;

interface SavedMockProgress {
  currentIndex: number;
  selectedAnswers: Record<string, number>;
}

// A live mock test is one-shot per user (no re-attempts), so unlike the
// regular quiz flow this doesn't need to be scoped to an attempt id.
const mockProgressStorageKey = (mockTestId: string) => `mock-test-progress-${mockTestId}`;

function loadSavedMockProgress(mockTestId: string): SavedMockProgress | null {
  try {
    const raw = localStorage.getItem(mockProgressStorageKey(mockTestId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function MockTestPage({ params }: { params: { id: string } }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [mockTest, setMockTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [, setTick] = useState(0); // forces re-render for local countdown/state checks

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const joinedRef = useRef(false);
  const quizStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/mock-tests/${params.id}`)}`);
    }
  }, [user, authLoading, params.id, router]);

  // Also re-run after a payment settles: the server withholds questions for a
  // locked premium test, so they only arrive once access opens.
  const loadMockTest = useCallback(async () => {
    try {
      const data = await ApiClient.getMockTestById(params.id);
      setMockTest(data);
      const mapped: QuizQuestion[] = (data.quiz?.questions || []).map((q: any) => {
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
    } catch (err: any) {
      console.error('Failed to fetch mock test:', err);
      setError(err.message || 'Failed to load mock test');
    }
  }, [params.id]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    loadMockTest().finally(() => setLoading(false));
  }, [user, loadMockTest]);

  // Tick every second while UPCOMING so the countdown view flips exactly at start time.
  useEffect(() => {
    if (!mockTest || mockTest.status !== 'UPCOMING') return;
    if (Date.now() >= new Date(mockTest.scheduledAt).getTime()) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [mockTest]);

  // Re-check server status periodically while upcoming, to pick up the scheduler's LIVE flip.
  useEffect(() => {
    if (!mockTest || mockTest.status !== 'UPCOMING') return;
    const interval = setInterval(async () => {
      try {
        setMockTest(await ApiClient.getMockTestById(params.id));
      } catch (err) {
        console.error('Failed to refresh mock test status:', err);
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [mockTest, params.id]);

  const myParticipant = mockTest?.participants?.find((p: any) => p.userId === user?.id);
  const scheduledMs = mockTest ? new Date(mockTest.scheduledAt).getTime() : 0;
  const hasStarted = !!mockTest && (mockTest.status !== 'UPCOMING' || Date.now() >= scheduledMs);
  const hasSubmitted = isSubmitted || !!myParticipant?.submittedAt;
  const isCompleted = mockTest?.status === 'COMPLETED';

  // The server decides this; the page only reflects it. Questions arrive empty
  // for a locked premium test, so there is nothing to attempt either way.
  const access = mockTest?.access;
  const isLocked = !!mockTest && access?.hasAccess === false;

  // A completed test the student never submitted must not fall into the
  // leaderboard view (that would leak the final rank list to someone who
  // didn't participate) or the quiz-taking view (the live window is over —
  // there is nothing left to "join"). It gets its own missed/not-attempted view.
  const showLeaderboardView = !!mockTest && !isLocked && hasSubmitted;
  const showMissedView = !!mockTest && !isLocked && !hasSubmitted && isCompleted;
  const showQuizView = !!mockTest && !isLocked && hasStarted && !showLeaderboardView && !showMissedView;
  const showCountdownView = !!mockTest && !isLocked && !hasStarted && !showLeaderboardView && !showMissedView;

  // Join once when entering the live quiz-taking view.
  useEffect(() => {
    if (!showQuizView || joinedRef.current || !mockTest) return;
    joinedRef.current = true;
    quizStartRef.current = Date.now();
    setTimeLeft((mockTest.quiz.durationMinutes || 15) * 60);

    // Submissions only reach the server on final submit, so where the
    // student stopped is tracked locally and restored on Resume.
    const saved = loadSavedMockProgress(params.id);
    if (saved) {
      setSelectedAnswers(saved.selectedAnswers);
      setCurrentIndex(Math.min(saved.currentIndex, Math.max(0, questions.length - 1)));
    }

    ApiClient.joinMockTest(params.id).catch((err) => console.warn('Join failed (may already be joined):', err));
  }, [showQuizView, mockTest, params.id, questions.length]);

  // Persist progress on every change so a Resume click lands back here.
  useEffect(() => {
    if (!showQuizView || isSubmitted || questions.length === 0) return;
    const progress: SavedMockProgress = { currentIndex, selectedAnswers };
    localStorage.setItem(mockProgressStorageKey(params.id), JSON.stringify(progress));
  }, [showQuizView, isSubmitted, questions.length, currentIndex, selectedAnswers, params.id]);

  useEffect(() => {
    if (!showQuizView || isSubmitted || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [showQuizView, isSubmitted, timeLeft]);

  useEffect(() => {
    if (!showLeaderboardView) return;
    let active = true;
    async function fetchLeaderboard() {
      try {
        const data = await ApiClient.getMockTestLeaderboard(params.id);
        if (active) setLeaderboard(data || []);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      }
    }
    fetchLeaderboard();
    if (isCompleted) return () => { active = false; };
    const interval = setInterval(fetchLeaderboard, LEADERBOARD_POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [showLeaderboardView, isCompleted, params.id]);

  useEffect(() => {
    if (!showLeaderboardView || isCompleted) return;
    const interval = setInterval(async () => {
      try {
        setMockTest(await ApiClient.getMockTestById(params.id));
      } catch (err) {
        console.error('Failed to refresh mock test status:', err);
      }
    }, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [showLeaderboardView, isCompleted, params.id]);

  if (loading || authLoading || !user) {
    return <QuizTakingSkeleton />;
  }

  if (error || !mockTest) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{error || 'Mock test not found.'}</h2>
        <Link href="/quizzes">
          <Button variant="gold" className="flex items-center space-x-2 mx-auto">
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Quiz Hub</span>
          </Button>
        </Link>
      </div>
    );
  }

  // Premium test with no settled payment: nothing below this point should run.
  if (isLocked) {
    return (
      <QuizPaywall
        quizId={mockTest.quizId}
        title={mockTest.title}
        access={access}
        loginRedirect={`/mock-tests/${params.id}`}
        onUnlocked={loadMockTest}
        subtitle={
          isCompleted
            ? 'This live mock test has ended. Purchase access to unlock the quiz for practice and review.'
            : undefined
        }
      />
    );
  }

  const handleSubmit = async () => {
    // The button disables the instant isSubmitting flips true, but a second
    // click can still queue up before that render lands — this stops it from
    // firing a duplicate submit.
    if (isSubmitting || isSubmitted) return;
    setIsSubmitting(true);

    const answerPayload = questions.map((q) => {
      const selected = selectedAnswers[q.id];
      return selected === undefined ? { questionId: q.id } : { questionId: q.id, selectedOptionIndex: selected };
    });
    const elapsedSeconds = quizStartRef.current ? Math.round((Date.now() - quizStartRef.current) / 1000) : 0;

    try {
      const result = await ApiClient.submitMockTest(params.id, {
        quizId: mockTest.quizId,
        answers: answerPayload,
        timeTakenSeconds: elapsedSeconds,
      });
      setSubmitResult(result);
      setIsSubmitted(true);
      localStorage.removeItem(mockProgressStorageKey(params.id));
    } catch (err: any) {
      const message: string = err?.message || '';

      // An earlier attempt can persist server-side while its response still
      // fails. The server's "already submitted" is the authoritative answer, so
      // move to the result view instead of leaving the student on a page whose
      // only button can never succeed.
      if (/already submitted/i.test(message)) {
        setIsSubmitted(true);
        localStorage.removeItem(mockProgressStorageKey(params.id));
        try {
          setMockTest(await ApiClient.getMockTestById(params.id));
        } catch (refreshErr) {
          console.error('Failed to refresh mock test after duplicate submit:', refreshErr);
        }
        return;
      }

      console.error('Failed to submit mock test:', err);
      alert(message || 'Failed to submit — please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportPDF = async () => {
    if (isExportingPDF) return;
    if (!questions || questions.length === 0) {
      alert('No questions available to download PDF.');
      return;
    }
    const exportQuestions = questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options,
      correct: q.correct,
      explanation: q.explanation,
      marks: q.marks,
      userSelection: selectedAnswers[q.id],
    }));

    setIsExportingPDF(true);
    try {
      // jsPDF is a heavy dependency only needed when the student actually
      // exports their solutions, not on every mock-test view.
      const { generateQuizSolutionsPDF } = await import('@/lib/pdf-exporter');
      await generateQuizSolutionsPDF({
        quizTitle: mockTest?.title || mockTest?.quiz?.title || 'Live Mock Test Solutions',
        score: submitResult?.score ?? myParticipant?.score,
        totalMarks: mockTest?.quiz?.totalMarks,
        questions: exportQuestions,
      });
    } catch (err) {
      console.error('Failed to generate solutions PDF', err);
      alert('Could not generate the solutions PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  if (showCountdownView) {
    return <CountdownGate mockTest={mockTest} />;
  }

  if (showMissedView) {
    return <MissedTestView mockTest={mockTest} joined={!!myParticipant} onExportPDF={handleExportPDF} />;
  }

  if (showLeaderboardView) {
    return (
      <LeaderboardView
        mockTest={mockTest}
        leaderboard={leaderboard}
        userId={user.id}
        myScore={submitResult?.score ?? myParticipant?.score}
        myRank={submitResult?.rank ?? myParticipant?.rank}
        onExportPDF={handleExportPDF}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">No questions available for this mock test yet.</h2>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 px-1 sm:px-0">
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-xl shadow-md gap-2">
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          <div className="p-1.5 sm:p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
            <Radio className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs text-slate-400 block">Progress</span>
            <span className="text-xs sm:text-sm font-bold text-white font-mono">
              {currentIndex + 1} / {questions.length}
            </span>
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
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            isLoading={isExportingPDF}
            className="font-bold flex items-center space-x-1 py-1.5 px-2.5 text-xs cursor-pointer shrink-0 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
            title="Download Questions & Solutions PDF"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button
            variant="gold"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            className="font-bold flex items-center space-x-1 py-1.5 px-3 text-xs shadow-sm cursor-pointer shrink-0"
          >
            {!isSubmitting && <Send className="w-3.5 h-3.5" />}
            <span>{isSubmitting ? 'Submitting…' : 'Submit'}</span>
          </Button>
        </div>
      </div>

      <Card className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex justify-between items-center gap-2">
          <Badge variant="outline" className="text-xs">Question #{currentIndex + 1}</Badge>
          <div className="flex items-center space-x-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              {currentQ.marks} Mark
              {mockTest.quiz.negativeMarkingEnabled &&
                ` • -${mockTest.quiz.negativeMarkingDeduct} per ${mockTest.quiz.negativeMarkingEvery} wrong`}
            </span>
          </div>
        </div>

        <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-relaxed sm:leading-snug">{currentQ.text}</h2>

        <div className="space-y-2.5 sm:space-y-3">
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedAnswers[currentQ.id] === idx;
            const optText = typeof opt === 'string' ? opt : opt.text;
            return (
              <button
                key={idx}
                onClick={() => setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: idx }))}
                className={`w-full flex items-center justify-between p-3 sm:p-4 rounded-xl border text-xs sm:text-sm font-medium transition-all gap-2 cursor-pointer ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10 text-amber-950 dark:text-amber-300 font-semibold shadow-sm ring-1 ring-amber-500/50'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40 text-slate-800 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2.5 sm:space-x-3">
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all shrink-0 ${
                      isSelected ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-left leading-snug">{optText}</span>
                </div>
                {isSelected && <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)} className="flex items-center space-x-2">
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </Button>

          {currentIndex === questions.length - 1 ? (
            <Button
              variant="gold"
              className="font-bold flex items-center space-x-2"
              onClick={handleSubmit}
              isLoading={isSubmitting}
            >
              {!isSubmitting && <Send className="w-4 h-4" />}
              <span>{isSubmitting ? 'Submitting…' : 'Submit Mock Test'}</span>
            </Button>
          ) : (
            <Button variant="gold" className="flex items-center space-x-2" onClick={() => setCurrentIndex((i) => i + 1)}>
              <span>Next Question</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function CountdownGate({ mockTest }: { mockTest: any }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const diffMs = new Date(mockTest.scheduledAt).getTime() - Date.now();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
      <Badge variant="outline" className="text-xs font-bold text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10">
        Upcoming Live Mock Test
      </Badge>
      <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{mockTest.title}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {mockTest.quiz?.title} • {mockTest.quiz?.totalQuestions || mockTest.quiz?.questions?.length || 0} Questions • {mockTest.quiz?.durationMinutes} mins
      </p>

      <div className="flex items-center justify-center gap-3 sm:gap-4">
        {[
          { label: 'Days', value: days },
          { label: 'Hours', value: hours },
          { label: 'Minutes', value: minutes },
          { label: 'Seconds', value: seconds },
        ].map((unit) => (
          <div key={unit.label} className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 sm:px-6 sm:py-4 min-w-[70px] sm:min-w-[90px]">
            <div className="text-2xl sm:text-4xl font-black text-amber-400 font-mono">{unit.value.toString().padStart(2, '0')}</div>
            <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider mt-1">{unit.label}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        This page automatically unlocks the moment the mock test goes live — no need to refresh.
      </p>
    </div>
  );
}

/**
 * Shown instead of the rank list when the live window has closed and this
 * student never submitted — whether they joined and ran out of time
 * (`joined`) or never took part at all. Either way there is no score or rank
 * to show, so this offers a way to at least practice the quiz instead.
 */
function MissedTestView({ mockTest, joined, onExportPDF }: { mockTest: any; joined: boolean; onExportPDF?: () => void }) {
  const canPractice = mockTest.quiz?.isActive !== false;

  return (
    <div className="max-w-2xl mx-auto py-16 text-center space-y-6 px-4">
      <div
        className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto ${
          joined
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
            : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
        }`}
      >
        {joined ? <Clock className="w-7 h-7" /> : <XCircle className="w-7 h-7" />}
      </div>

      <div className="space-y-2">
        <Badge variant={joined ? 'warning' : 'outline'} className="font-bold">
          {joined ? 'Missed' : 'Not Attempted'}
        </Badge>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{mockTest.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          {joined
            ? "You joined this live mock test but didn't submit before it ended, so no rank or score is available."
            : 'You did not participate in this live mock test, so no rank or score is available.'}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {onExportPDF && (
          <Button
            variant="outline"
            onClick={onExportPDF}
            className="font-bold flex items-center justify-center space-x-2 px-6 py-3 cursor-pointer border-cyan-500/40 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/10"
          >
            <Download className="w-4 h-4 text-cyan-500" />
            <span>Download Solutions PDF</span>
          </Button>
        )}
        {canPractice && (
          <Link href={`/quizzes/${mockTest.quizId}`}>
            <Button variant="gold" className="font-bold flex items-center justify-center space-x-2 px-6 py-3 cursor-pointer">
              <span>Go to Attempt Test</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        )}
      </div>

      <div className="pt-1">
        <Link href="/mock-tests/completed" className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline">
          Back to Completed Mock Tests
        </Link>
      </div>
    </div>
  );
}

function LeaderboardView({
  mockTest,
  leaderboard,
  userId,
  myScore,
  myRank,
  onExportPDF,
}: {
  mockTest: any;
  leaderboard: any[];
  userId: string;
  myScore?: number;
  myRank?: number;
  onExportPDF?: () => void;
}) {
  const isCompleted = mockTest.status === 'COMPLETED';
  return (
    <div className="max-w-3xl mx-auto space-y-6 px-3 sm:px-0 py-6">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner mx-auto">
          <Trophy className="w-7 h-7" />
        </div>
        <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{mockTest.title}</h1>
        <div className="flex justify-center items-center gap-2 flex-wrap">
          <Badge variant={isCompleted ? 'success' : 'gold'} className={`font-bold text-xs ${isCompleted ? '' : 'animate-pulse'}`}>
            {isCompleted ? 'Final Rank List' : 'Live Rank List — updating…'}
          </Badge>
          {onExportPDF && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportPDF}
              className="font-bold flex items-center space-x-1.5 text-xs border-cyan-500/40 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/10 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-500" />
              <span>Download Solutions PDF</span>
            </Button>
          )}
        </div>
      </div>

      {(myScore !== undefined || myRank !== undefined) && (
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="bg-white dark:bg-[#0c152e] p-4 rounded-2xl border border-slate-200 dark:border-[#1e2e56] space-y-1 shadow-xs">
            <div className="flex items-center justify-center space-x-1.5 text-slate-500 dark:text-slate-400 text-xs">
              <Award className="w-3.5 h-3.5 text-cyan-400" />
              <span>Your Score</span>
            </div>
            <span className="text-3xl font-extrabold text-cyan-400 block">{myScore ?? '—'}</span>
          </div>
          <div className="bg-white dark:bg-[#0c152e] p-4 rounded-2xl border border-slate-200 dark:border-[#1e2e56] space-y-1 shadow-xs">
            <div className="flex items-center justify-center space-x-1.5 text-slate-500 dark:text-slate-400 text-xs">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span>Your Rank</span>
            </div>
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 block">
              {myRank ? `#${myRank}` : 'Pending'}
            </span>
          </div>
        </div>
      )}

      <Card className="p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#0c152e] shadow-xs">
        {leaderboard.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No submissions yet — rankings will appear here as students finish.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 dark:border-[#1e2e56] bg-slate-100/80 dark:bg-[#091124]">
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider py-3.5">Rank</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider py-3.5">Student Name</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-right py-3.5">Score</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-right py-3.5">Total Marks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry) => {
                  const initial = entry.userName ? entry.userName.charAt(0).toUpperCase() : 'S';
                  const isCurrentUser = entry.userId === userId;
                  return (
                    <TableRow
                      key={entry.userId}
                      className={`border-b border-slate-200/80 dark:border-[#1e2e56] transition-colors ${
                        isCurrentUser ? 'bg-cyan-500/10 dark:bg-cyan-500/15' : 'hover:bg-slate-50/50 dark:hover:bg-[#0c152e]/50'
                      }`}
                    >
                      <TableCell className="py-3.5">
                        <div className="flex items-center space-x-1.5">
                          <Badge variant={entry.rank <= 3 ? 'gold' : 'outline'} className="text-[10px] font-mono font-bold">
                            #{entry.rank}
                          </Badge>
                          {entry.rank === 1 && <Trophy className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-sm text-slate-900 dark:text-white py-3.5">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-[#091124] border border-slate-300 dark:border-[#1e2e56] text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                          <span>
                            {entry.userName} {isCurrentUser && <span className="text-cyan-400 font-semibold text-xs ml-1">(You)</span>}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-extrabold text-cyan-700 dark:text-cyan-400 py-3.5">
                        {entry.score}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-slate-600 dark:text-slate-400 py-3.5">
                        {entry.totalMarks ?? mockTest?.quiz?.totalMarks ?? 100}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {onExportPDF && (
          <Button
            variant="outline"
            onClick={onExportPDF}
            className="w-full flex items-center justify-center space-x-2 border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 font-bold py-3 cursor-pointer"
          >
            <Download className="w-4 h-4 text-cyan-500" />
            <span>Download Solutions PDF</span>
          </Button>
        )}
        <Link href="/quizzes" className={onExportPDF ? '' : 'sm:col-span-2'}>
          <Button variant="gold" className="w-full flex items-center justify-center space-x-2 cursor-pointer font-bold py-3 shadow-md shadow-cyan-500/20">
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Quiz Hub</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
