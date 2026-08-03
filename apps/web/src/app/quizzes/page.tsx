'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardTitle, CardDescription, Button, Badge } from '@psc/ui';

const SAMPLE_QUIZZES = [
  {
    id: 'quiz-1',
    title: 'Kerala PSC LDC Mega Mock Test 2026',
    category: 'LDC / Tenth Level',
    questions: 100,
    duration: 75,
    isLive: true,
    totalMarks: 100,
  },
  {
    id: 'quiz-2',
    title: 'Indian Constitution & Fundamental Rights',
    category: 'Polity Special',
    questions: 25,
    duration: 20,
    isLive: false,
    totalMarks: 25,
  },
  {
    id: 'quiz-3',
    title: 'Kerala Geography & Rivers Speed Test',
    category: 'Kerala GK',
    questions: 30,
    duration: 15,
    isLive: false,
    totalMarks: 30,
  },
];

export default function QuizzesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Quiz Hub & Mock Tests</h1>
        <p className="text-slate-400 text-sm mt-1">Test your preparation with live mock tests, topic-wise practice quizzes, and instant rank cards.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SAMPLE_QUIZZES.map((quiz) => (
          <Card key={quiz.id} hoverEffect className="flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Badge variant={quiz.isLive ? 'gold' : 'default'}>
                  {quiz.isLive ? '🔥 Live Mock Test' : quiz.category}
                </Badge>
                <span className="text-xs text-slate-400">⏱️ {quiz.duration} mins</span>
              </div>
              <CardTitle className="text-lg">{quiz.title}</CardTitle>
              <CardDescription>
                {quiz.questions} Questions • {quiz.totalMarks} Marks • 0.33 Negative Marking
              </CardDescription>
            </div>
            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
              <span className="text-xs text-slate-400 font-mono">Passing: {Math.round(quiz.totalMarks * 0.4)} Marks</span>
              <Link href={`/quizzes/${quiz.id}`}>
                <Button variant={quiz.isLive ? 'gold' : 'primary'} size="sm">
                  Start Test
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
