'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2, Award, ShieldCheck, Trophy, ArrowRight, Loader2 } from 'lucide-react';

const DEFAULT_QUIZ_STEPS = [
  'Encrypting & recording your answers',
  'Evaluating question-by-question responses',
  'Calculating score, accuracy & negative marks',
  'Finalizing rank & preparing your performance scorecard',
];

const DEFAULT_MOCK_STEPS = [
  'Recording your final test submissions',
  'Verifying millisecond timestamps for rank ties',
  'Calculating score & accuracy breakdown',
  'Updating live statewide leaderboard',
];

export function QuizSubmittingOverlay({
  title,
  message,
  type = 'quiz',
}: {
  title?: string;
  message?: string;
  type?: 'quiz' | 'mock-test';
}) {
  const isMock = type === 'mock-test';
  const steps = isMock ? DEFAULT_MOCK_STEPS : DEFAULT_QUIZ_STEPS;
  const heading = title || (isMock ? 'Submitting Mock Test…' : 'Submitting Your Quiz…');
  const subHeading =
    message || (isMock ? 'Evaluating your performance & updating the statewide rank board.' : 'Evaluating your responses and generating your detailed performance breakdown.');

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(18);

  useEffect(() => {
    // Stage 1 -> 2
    const t1 = setTimeout(() => {
      setCurrentStepIndex(1);
      setProgressPercent(48);
    }, 600);

    // Stage 2 -> 3
    const t2 = setTimeout(() => {
      setCurrentStepIndex(2);
      setProgressPercent(78);
    }, 1300);

    // Stage 3 -> 4
    const t3 = setTimeout(() => {
      setCurrentStepIndex(3);
      setProgressPercent(95);
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-xl p-4 animate-in fade-in duration-300"
    >
      {/* Background ambient glowing orbs */}
      <div className="absolute w-72 h-72 rounded-full bg-amber-500/15 blur-3xl -top-10 -left-10 pointer-events-none animate-pulse" />
      <div className="absolute w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl -bottom-10 -right-10 pointer-events-none animate-pulse" />

      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-800/80 shadow-2xl rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center space-y-6 overflow-hidden ring-1 ring-white/10">
        {/* Top subtle decorative gradient bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-amber-300 to-cyan-400" />

        {/* Central glowing loader visual */}
        <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
          {/* Outer glowing pulsing ring */}
          <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-md animate-pulse" />
          
          {/* Static track ring */}
          <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
          
          {/* Fast spinning golden ring */}
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-400 border-r-amber-400 animate-spin" />
          
          {/* Slower counter-spinning cyan ring */}
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-cyan-400 border-l-cyan-400 animate-[spin_2s_linear_infinite_reverse]" />

          {/* Center Trophy / Sparkles Icon */}
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center shadow-inner text-amber-400">
            {currentStepIndex >= 3 ? (
              <Trophy className="w-6 h-6 animate-bounce text-amber-300" />
            ) : currentStepIndex >= 2 ? (
              <Award className="w-6 h-6 animate-pulse text-amber-400" />
            ) : (
              <Sparkles className="w-6 h-6 animate-pulse text-amber-300" />
            )}
          </div>
        </div>

        {/* Header & Subtitle */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>{heading}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300/90 font-medium leading-relaxed max-w-xs mx-auto">
            {subHeading}
          </p>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 font-mono px-1">
            <span className="text-amber-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Processing</span>
            </span>
            <span className="text-white">{progressPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-400 rounded-full transition-all duration-700 ease-out shadow-sm shadow-amber-500/50"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Steps sequence */}
        <div className="w-full space-y-2 text-left bg-slate-950/60 p-3.5 sm:p-4 rounded-2xl border border-slate-800/80">
          {steps.map((stepText, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={idx}
                className={`flex items-center gap-2.5 text-xs transition-all duration-300 ${
                  isCurrent
                    ? 'text-amber-300 font-bold translate-x-1'
                    : isCompleted
                    ? 'text-emerald-400/90 font-medium'
                    : 'text-slate-500 font-normal opacity-50'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : isCurrent ? (
                  <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                )}
                <span className="leading-tight truncate">{stepText}</span>
              </div>
            );
          })}
        </div>

        {/* Safety & status pill */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 bg-slate-800/60 border border-slate-700/60 rounded-full px-3.5 py-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Responses safe • Please do not close this window</span>
        </div>
      </div>
    </div>
  );
}

