'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Input, Pagination } from '@psc/ui';
import {
  History,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PlayCircle,
  Search,
  ChevronLeft,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';
import { Skeleton } from '@psc/ui';

export default function StudentQuizHistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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

  const filteredAttempts = attempts.filter((att) => {
    const quizTitle = att.quiz?.title || 'Quiz';
    const matchesSearch = quizTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || att.attemptStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const totalItems = filteredAttempts.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedAttempts = filteredAttempts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalCompleted = attempts.filter((a) => a.attemptStatus === 'COMPLETED').length;
  const avgPercentage =
    attempts.length > 0
      ? Math.round(
          attempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / attempts.length
        )
      : 0;

  if (loading || authLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-6 px-2">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-6 rounded-md" />
            <Skeleton className="w-64 h-4 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 px-1 sm:px-0">
      {/* Top Navigation & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <Link href="/quizzes">
            <Button
              variant="outline"
              size="sm"
              className="p-2 rounded-xl border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/70"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <History className="w-6 h-6 text-cyan-400" />
              <span>My Quiz Attempt History</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review your previous attempts, performance scores, completion times, and detailed results.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-3.5 sm:p-4 glass-card flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold block">Total Attempts</span>
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">{attempts.length}</span>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4 glass-card flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold block">Completed</span>
            <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{totalCompleted}</span>
          </div>
        </Card>

        <Card className="p-3.5 sm:p-4 glass-card flex items-center space-x-3 col-span-2 sm:col-span-1">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold block">Average Score</span>
            <span className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 font-mono">{avgPercentage}%</span>
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <Input
            placeholder="Search by quiz title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-[#091124] p-1 rounded-xl border border-slate-200 dark:border-[#1e2e56] self-start sm:self-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Status
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            In Progress
          </button>
        </div>
      </div>

      {/* Attempt History List */}
      {filteredAttempts.length === 0 ? (
        <Card className="p-8 text-center space-y-3 glass-card border-dashed">
          <History className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No Quiz Attempts Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            You haven't attempted any quizzes yet matching this filter. Start a quiz from the Quiz Hub!
          </p>
          <Link href="/quizzes" className="inline-block pt-2">
            <Button variant="gold" size="sm" className="font-bold">
              Explore Quiz Hub
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedAttempts.map((attempt) => {
            const isCompleted = attempt.attemptStatus === 'COMPLETED';
            const quizTitle = attempt.quiz?.title || 'Practice Quiz';
            const durationSec = attempt.timeTakenSeconds || 0;
            const mins = Math.floor(durationSec / 60);
            const secs = durationSec % 60;
            const timeTakenFormatted = `${mins}m ${secs.toString().padStart(2, '0')}s`;
            const dateFormatted = new Date(attempt.startedAt || attempt.createdAt).toLocaleDateString(
              'en-US',
              { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }
            );

            return (
              <Card
                key={attempt.id}
                className="p-4 sm:p-5 glass-card space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-[#1e2e56] pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">{quizTitle}</span>
                      <Badge variant="gold" className="text-[10px] font-mono font-bold">
                        Attempt #{attempt.attemptNumber || 1}
                      </Badge>
                      {isCompleted ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10 font-bold">
                          COMPLETED
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10 font-bold">
                          IN PROGRESS
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{dateFormatted}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right Action / Score */}
                  <div className="flex items-center space-x-3 self-end sm:self-center">
                    {isCompleted ? (
                      <div className="text-right">
                        <span className="text-xs text-slate-500 dark:text-slate-400 block font-semibold">Score</span>
                        <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                          {attempt.score} / {attempt.totalMarks || 100} ({attempt.percentage || 0}%)
                        </span>
                      </div>
                    ) : (
                      <Link href={`/quizzes/${attempt.quizId}`}>
                        <Button variant="gold" size="sm" className="font-bold flex items-center space-x-1">
                          <PlayCircle className="w-4 h-4" />
                          <span>Resume Quiz</span>
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Stats Breakdown Row */}
                {isCompleted && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    <div className="flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Correct</span>
                        <span className="font-bold font-mono text-sm">{attempt.correctAnswers || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 text-rose-700 dark:text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                      <XCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Wrong</span>
                        <span className="font-bold font-mono text-sm">{attempt.wrongAnswers || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#091124] p-2 rounded-lg border border-slate-200 dark:border-[#1e2e56]">
                      <AlertCircle className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Unattempted</span>
                        <span className="font-bold font-mono text-sm">{attempt.unattempted || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 text-amber-700 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-500" />
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Time Taken</span>
                        <span className="font-bold font-mono text-sm">{timeTakenFormatted}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

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
