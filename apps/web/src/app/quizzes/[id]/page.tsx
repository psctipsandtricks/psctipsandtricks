'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardTitle, Button, Badge, Dialog } from '@psc/ui';

const SAMPLE_QUESTIONS = [
  {
    id: 'q1',
    text: 'Which is the longest river in Kerala?',
    options: ['Periyar', 'Bharathappuzha', 'Pamba', 'Chaliyar'],
    correct: 0,
    explanation: 'Periyar is the longest river in Kerala with a length of 244 km.',
  },
  {
    id: 'q2',
    text: 'Who is known as the Father of Kerala Renaissance?',
    options: ['Sree Narayana Guru', 'Chattampi Swamikal', 'Ayyankali', 'Vakkom Moulavi'],
    correct: 0,
    explanation: 'Sree Narayana Guru led the social reform movement in Kerala.',
  },
  {
    id: 'q3',
    text: 'What is the capital of Lakshadweep?',
    options: ['Kavaratti', 'Minicoy', 'Agatti', 'Andrott'],
    correct: 0,
    explanation: 'Kavaratti is the administrative capital of Lakshadweep.',
  },
];

export default function QuizTakingPage({ params }: { params: { id: string } }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(900); // 15 mins
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (isSubmitted || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted]);

  const currentQ = SAMPLE_QUESTIONS[currentIndex];

  const handleOptionSelect = (optIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: optIndex }));
  };

  const handleSubmit = () => {
    let score = 0;
    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    SAMPLE_QUESTIONS.forEach((q) => {
      const selected = selectedAnswers[q.id];
      if (selected === undefined) {
        unattempted++;
      } else if (selected === q.correct) {
        score += 1;
        correct++;
      } else {
        score -= 0.33;
        wrong++;
      }
    });

    setResult({
      score: Math.max(0, Math.round(score * 100) / 100),
      totalMarks: SAMPLE_QUESTIONS.length,
      correct,
      wrong,
      unattempted,
      rank: Math.floor(Math.random() * 10) + 1,
    });
    setIsSubmitted(true);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Timer & Progress Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div>
          <span className="text-xs text-slate-400 block">Question Progress</span>
          <span className="text-sm font-bold text-white">
            {currentIndex + 1} of {SAMPLE_QUESTIONS.length}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 block">Time Remaining</span>
          <span className="text-lg font-mono font-bold text-amber-400">
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Question Card */}
      <Card className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <Badge variant="outline">Question #{currentIndex + 1}</Badge>
          <span className="text-xs text-slate-400">1.0 Mark • -0.33 Negative</span>
        </div>

        <h2 className="text-xl font-bold text-white">{currentQ.text}</h2>

        <div className="space-y-3">
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedAnswers[currentQ.id] === idx;
            return (
              <button
                key={idx}
                onClick={() => handleOptionSelect(idx)}
                className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/60 text-white font-semibold'
                    : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <span className="inline-block w-6 font-mono text-slate-500">{String.fromCharCode(65 + idx)}.</span>
                {opt}
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-slate-800">
          <Button
            variant="outline"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => i - 1)}
          >
            Previous
          </Button>

          {currentIndex === SAMPLE_QUESTIONS.length - 1 ? (
            <Button variant="gold" className="font-bold" onClick={handleSubmit}>
              Submit Quiz
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setCurrentIndex((i) => i + 1)}>
              Next Question
            </Button>
          )}
        </div>
      </Card>

      {/* Result Dialog */}
      <Dialog isOpen={isSubmitted} onClose={() => setIsSubmitted(false)} title="🎉 Quiz Submitted Successfully!">
        {result && (
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <span className="text-xs text-slate-400 block">Your Score</span>
                <span className="text-3xl font-extrabold text-amber-400">{result.score} / {result.totalMarks}</span>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <span className="text-xs text-slate-400 block">Estimated State Rank</span>
                <span className="text-3xl font-extrabold text-emerald-400">#{result.rank}</span>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>Correct Answers:</span>
                <span className="text-emerald-400 font-bold">{result.correct}</span>
              </div>
              <div className="flex justify-between">
                <span>Wrong Answers:</span>
                <span className="text-rose-400 font-bold">{result.wrong}</span>
              </div>
              <div className="flex justify-between">
                <span>Unattempted:</span>
                <span className="text-slate-400 font-bold">{result.unattempted}</span>
              </div>
            </div>

            <Link href="/quizzes">
              <Button variant="primary" className="w-full">
                Back to Quiz Hub
              </Button>
            </Link>
          </div>
        )}
      </Dialog>
    </div>
  );
}
