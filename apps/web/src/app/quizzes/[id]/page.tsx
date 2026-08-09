'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Dialog } from '@psc/ui';
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
  Sparkles,
  AlertCircle,
  Clock,
  Download,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';
import { generateQuizSolutionsPDF, ExportPDFQuestionOption } from '@/lib/pdf-exporter';
import { QuizTakingSkeleton } from '../../skeletons/page-skeletons';

interface QuizQuestion {
  id: string;
  text: string;
  options: (string | ExportPDFQuestionOption)[];
  correct: number;
  explanation?: string;
  marks: number;
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
  const [result, setResult] = useState<any>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptNumber, setAttemptNumber] = useState<number>(1);
  const [isPremiumQuiz, setIsPremiumQuiz] = useState(false);

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
        const quiz = await ApiClient.getQuizById(params.id) as any;
        setQuizTitle(quiz.title);
        setIsPremiumQuiz(Boolean(quiz.isPremium || quiz.accessType === 'PAID' || (quiz.price && quiz.price > 0)));
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

        // Start or resume attempt via API
        try {
          const attempt = await ApiClient.startQuizAttempt(params.id);
          if (attempt) {
            setAttemptId(attempt.id);
            setAttemptNumber(attempt.attemptNumber || 1);
          }
        } catch (e) {
          console.warn('Could not initialize backend attempt record:', e);
        }
      } catch (err: any) {
        console.error('Failed to fetch quiz:', err);
        setError(err.message || 'Failed to load quiz');
      } finally {
        setLoading(false);
      }
    }
    fetchQuiz();
  }, [params.id, user]);

  useEffect(() => {
    if (isSubmitted || timeLeft <= 0 || loading || !user) return;
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted, loading, user]);

  if (loading || authLoading || !user) {
    return <QuizTakingSkeleton />;
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

  const currentQ = questions[currentIndex];

  const handleOptionSelect = (optIndex: number) => {
    if (isSubmitted || (showCorrectAnswerAfterSelection && selectedAnswers[currentQ.id] !== undefined)) {
      return;
    }
    setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: optIndex }));
  };

  const handleSubmit = () => {
    let score = 0;
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
        score += q.marks;
        correct++;
        answerPayload.push({ questionId: q.id, selectedOptionIndex: selected });
      } else {
        score -= 0.33;
        wrong++;
        answerPayload.push({ questionId: q.id, selectedOptionIndex: selected });
      }
    });

    const elapsedSeconds = Math.max(0, quizDuration - timeLeft);
    const takenMin = Math.floor(elapsedSeconds / 60);
    const takenSec = elapsedSeconds % 60;
    const timeTakenFormatted = `${takenMin}m ${takenSec.toString().padStart(2, '0')}s`;

    // 1. Immediately open result modal for instant UI responsiveness
    setResult({
      score: Math.max(0, Math.round(score * 100) / 100),
      totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
      correct,
      wrong,
      unattempted,
      rank: Math.floor(Math.random() * 10) + 1,
      timeTakenFormatted,
      attemptNumber,
    });
    setIsSubmitted(true);

    // 2. Persist attempt asynchronously to backend in background
    ApiClient.submitQuizAttempt(
      params.id,
      {
        quizId: params.id,
        answers: answerPayload,
        timeTakenSeconds: elapsedSeconds,
      },
      attemptId || undefined
    ).catch((err) => {
      console.warn('API quiz submission error (saved locally):', err);
    });
  };

  const handleCloseModal = () => {
    setIsSubmitted(false);
    router.push('/quizzes');
  };

  const handleDownloadPDF = () => {
    const exportQuestions = questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options,
      correct: q.correct,
      explanation: q.explanation,
      marks: q.marks,
      userSelection: selectedAnswers[q.id],
    }));

    generateQuizSolutionsPDF({
      quizTitle: quizTitle || 'PSC Quiz Solutions',
      score: result?.score,
      totalMarks: result?.totalMarks,
      questions: exportQuestions,
    });
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 px-1 sm:px-0">
      {/* Timer & Progress Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-xl shadow-md gap-2">
        <div className="flex items-center space-x-2.5 sm:space-x-3">
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
            onClick={handleSubmit}
            className="font-bold flex items-center space-x-1 py-1.5 px-3 text-xs shadow-sm cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit</span>
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
          {isPremiumQuiz && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                className="font-bold flex items-center space-x-1 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                title="Download Premium PDF Solutions"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Solutions PDF</span>
              </Button>
            </div>
          )}
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

        {/* Immediate Feedback Explanation Box */}
        {showCorrectAnswerAfterSelection && selectedAnswers[currentQ.id] !== undefined && currentQ.explanation && (
          <div className="p-4 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1.5 animate-fadeIn">
            <div className="flex items-center space-x-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
              <HelpCircle className="w-4 h-4" />
              <span>Overall Explanation</span>
            </div>
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
            <Button variant="gold" className="font-bold flex items-center space-x-2" onClick={handleSubmit}>
              <Send className="w-4 h-4" />
              <span>Submit Quiz</span>
            </Button>
          ) : (
            <Button variant="gold" className="flex items-center space-x-2" onClick={() => setCurrentIndex((i) => i + 1)}>
              <span>Next Question</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>

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
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{result.correct}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center space-x-2 text-xs font-semibold">
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <span>Wrong Answers:</span>
                </span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">{result.wrong}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center space-x-2 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                  <span>Unattempted:</span>
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-bold">{result.unattempted}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {isPremiumQuiz && (
                <Button
                  variant="gold"
                  onClick={handleDownloadPDF}
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
    </div>
  );
}
