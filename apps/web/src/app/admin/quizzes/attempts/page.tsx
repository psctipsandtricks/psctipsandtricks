'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Card,
  Button,
  Badge,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@psc/ui';
import {
  History,
  Search,
  ChevronLeft,
  User as UserIcon,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '@/app/auth-provider';
import { Skeleton } from '@psc/ui';

export default function AdminQuizAttemptsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    router.replace('/admin/quizzes');
  }, [router]);

  useEffect(() => {
    if (!user) return;
    async function loadAdminAttempts() {
      try {
        setLoading(true);
        const data = await ApiClient.getAdminAttemptHistory();
        setAttempts(data || []);
      } catch (err) {
        console.error('Failed to load admin attempt history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAdminAttempts();
  }, [user]);

  const filteredAttempts = attempts.filter((att) => {
    const studentName = att.user?.name || '';
    const studentEmail = att.user?.email || '';
    const quizTitle = att.quiz?.title || '';

    const query = searchTerm.toLowerCase();
    const matchesSearch =
      studentName.toLowerCase().includes(query) ||
      studentEmail.toLowerCase().includes(query) ||
      quizTitle.toLowerCase().includes(query);

    const matchesStatus = statusFilter === 'ALL' || att.attemptStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading || authLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 py-6 px-2">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-6 rounded-md" />
            <Skeleton className="w-64 h-4 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-4 px-1 sm:px-0">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <Link href="/admin/quizzes">
            <Button variant="outline" size="sm" className="p-2 rounded-xl">
              <ChevronLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <History className="w-6 h-6 text-amber-500" />
              <span>Student Quiz Attempts History</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Admin oversight across all student quiz attempts, attempt numbers, completion status, and scores.
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <Input
            placeholder="Search by student name, email, or quiz..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center space-x-1 bg-slate-200/80 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-300/80 dark:border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
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
            Completed ({attempts.filter((a) => a.attemptStatus === 'COMPLETED').length})
          </button>
          <button
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            In Progress ({attempts.filter((a) => a.attemptStatus === 'IN_PROGRESS').length})
          </button>
        </div>
      </div>

      {/* Table Container */}
      <Card className="p-0 overflow-hidden bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
        {filteredAttempts.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <History className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Student Quiz Attempts</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No attempt records match the current search or filter query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950/70">
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Student</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Quiz Title</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Attempt #</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Score & %</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Breakdown (C / W / U)</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Duration</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Started At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttempts.map((att) => {
                  const studentName = att.user?.name || 'Student';
                  const studentEmail = att.user?.email || 'N/A';
                  const quizTitle = att.quiz?.title || 'Practice Quiz';
                  const isCompleted = att.attemptStatus === 'COMPLETED';

                  const durationSec = att.timeTakenSeconds || 0;
                  const mins = Math.floor(durationSec / 60);
                  const secs = durationSec % 60;
                  const timeTakenFormatted = `${mins}m ${secs.toString().padStart(2, '0')}s`;

                  const dateFormatted = new Date(att.startedAt || att.createdAt).toLocaleDateString(
                    'en-US',
                    { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                  );

                  return (
                    <TableRow key={att.id} className="border-b border-slate-200/80 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{studentName}</span>
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block">{studentEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-xs text-slate-800 dark:text-slate-200">{quizTitle}</TableCell>
                      <TableCell>
                        <Badge variant="gold" className="text-[10px] font-mono font-bold shadow-xs">
                          Attempt #{att.attemptNumber || 1}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isCompleted ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10 font-bold">
                            COMPLETED
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10 font-bold">
                            IN PROGRESS
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isCompleted ? (
                          <div className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                            {att.score} / {att.totalMarks || 100} ({att.percentage || 0}%)
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isCompleted ? (
                          <div className="flex items-center space-x-2 text-xs font-mono font-semibold">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{att.correctAnswers || 0}C</span>
                            <span className="text-slate-300 dark:text-slate-600">/</span>
                            <span className="text-rose-600 dark:text-rose-400 font-bold">{att.wrongAnswers || 0}W</span>
                            <span className="text-slate-300 dark:text-slate-600">/</span>
                            <span className="text-slate-500 dark:text-slate-400 font-bold">{att.unattempted || 0}U</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">{timeTakenFormatted}</TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">{dateFormatted}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
