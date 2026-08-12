'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Card,
  Button,
  Badge,
  Input,
  DatePicker,
  TimePicker,
  combineDateAndTime,
  splitIsoToDateAndTime,
  Dialog,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
  Pagination,
  ConfirmDialog,
} from '@psc/ui';
import { Radio, ChevronLeft, Plus, Users, Calendar, Trash2, Edit3, Loader2, Trophy } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';

const mockTestSchema = Yup.object({
  title: Yup.string().trim().required('Mock test title is required'),
  quizId: Yup.string().required('Please select a quiz'),
  scheduledDate: Yup.string().required('Scheduled date is required'),
  scheduledTime: Yup.string().required('Scheduled time is required'),
});

export default function AdminMockTestsPage() {
  const router = useRouter();

  const [mockTests, setMockTests] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UPCOMING' | 'LIVE' | 'COMPLETED'>('ALL');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMockTest, setEditingMockTest] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const [selectedLeaderboardMockTest, setSelectedLeaderboardMockTest] = useState<any | null>(null);
  const [adminLeaderboard, setAdminLeaderboard] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  useEffect(() => {
    if (!selectedLeaderboardMockTest) return;
    let active = true;
    async function fetchLeaderboard() {
      try {
        setLeaderboardLoading(true);
        const data = await ApiClient.getMockTestLeaderboard(selectedLeaderboardMockTest.id);
        if (active) setAdminLeaderboard(data || []);
      } catch (err) {
        console.error('Failed to fetch admin mock test leaderboard:', err);
      } finally {
        if (active) setLeaderboardLoading(false);
      }
    }
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedLeaderboardMockTest]);

  const loadData = useCallback(async () => {
    try {
      const [mockTestData, quizData] = await Promise.all([
        ApiClient.getMockTests(),
        ApiClient.getQuizzes(),
      ]);
      setMockTests(mockTestData || []);
      setQuizzes(quizData || []);
    } catch (err) {
      console.error('Failed to load mock tests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formik = useFormik({
    initialValues: { title: '', quizId: '', scheduledDate: '', scheduledTime: '' },
    validationSchema: mockTestSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        const fullScheduledIso = combineDateAndTime(values.scheduledDate, values.scheduledTime);
        const payload = {
          title: values.title.trim(),
          quizId: values.quizId,
          scheduledAt: fullScheduledIso,
        };
        if (editingMockTest) {
          await ApiClient.updateMockTest(editingMockTest.id, payload);
        } else {
          await ApiClient.createMockTest(payload);
        }
        setIsDialogOpen(false);
        setEditingMockTest(null);
        resetForm();
        await loadData();
      } catch (err) {
        console.error('Failed to save mock test:', err);
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleOpenCreateDialog = () => {
    setEditingMockTest(null);
    formik.resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (mockTest: any) => {
    setEditingMockTest(mockTest);
    const { date: schDate, time: schTime } = splitIsoToDateAndTime(mockTest.scheduledAt);
    formik.setValues({
      title: mockTest.title || '',
      quizId: mockTest.quizId || '',
      scheduledDate: schDate,
      scheduledTime: schTime,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (mockTest: any) => {
    try {
      setDeletingId(mockTest.id);
      await ApiClient.deleteMockTest(mockTest.id);
      setMockTests((prev) => prev.filter((mt) => mt.id !== mockTest.id));
    } catch (err) {
      console.error('Failed to delete mock test:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  // Newest-scheduled first, so a session you just added is at the top of the
  // list. The API orders by scheduledAt ascending for the student-facing
  // "next upcoming" lists, so the admin ordering is applied here instead.
  const filteredMockTests = mockTests
    .filter((mt) => statusFilter === 'ALL' || mt.status === statusFilter)
    .sort((a, b) => {
      const createdDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      // Records created in the same batch fall back to the later session first.
      if (createdDiff !== 0) return createdDiff;
      return new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();
    });

  const totalItems = filteredMockTests.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedMockTests = filteredMockTests.slice((currentPage - 1) * pageSize, currentPage * pageSize);



  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
      {/* Fixed Header */}
      <div className="shrink-0 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <Link href="/admin/quizzes" className="ml-1">
              <Button variant="outline" size="sm" className="p-2 rounded-xl">
                <ChevronLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
                <Radio className="w-6 h-6 text-cyan-400" />
                <span>Live Mock Tests</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Schedule a quiz to go live at a specific date and time, and track status as it becomes LIVE and completes.
              </p>
            </div>
          </div>
          <Button
            variant="gold"
            className="font-bold shadow-md shadow-cyan-500/20 flex items-center space-x-1.5"
            onClick={handleOpenCreateDialog}
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Mock Test</span>
          </Button>
        </div>

        {/* Status Filter Bar */}
        <div className="flex items-center space-x-1 bg-slate-200/80 dark:bg-[#091124] p-1 rounded-xl border border-slate-300/80 dark:border-[#1e2e56] self-start w-fit">
          {(['ALL', 'UPCOMING', 'LIVE', 'COMPLETED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === s
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-cyan-300'
              }`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()} (
              {s === 'ALL' ? mockTests.length : mockTests.filter((mt) => mt.status === s).length})
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Table */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border border-slate-200/80 dark:border-[#1e2e56] rounded-2xl bg-white dark:bg-slate-900/80 shadow-sm p-0">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 relative">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950/70">
                <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider min-w-[180px] max-w-[280px]">Title</TableHead>
                <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider min-w-[150px] max-w-[240px]">Quiz</TableHead>
                <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">Scheduled At</TableHead>
                <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">Status</TableHead>
                <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">Participants</TableHead>
                <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`} className="border-b border-slate-200/80 dark:border-slate-800/60">
                    <TableCell className="py-4"><Skeleton className="h-5 w-44 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-36 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-32 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-lg" /></TableCell>
                    <TableCell className="py-4 text-right"><Skeleton className="h-8 w-24 rounded-xl ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedMockTests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                        <Radio className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Mock Tests Scheduled</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          No live mock tests scheduled matching your selected status filter.
                        </p>
                      </div>
                      {statusFilter !== 'ALL' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/10 mt-1 cursor-pointer"
                          onClick={() => setStatusFilter('ALL')}
                        >
                          Show All Mock Tests
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMockTests.map((mt) => {
                  const scheduledFormatted = new Date(mt.scheduledAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <TableRow key={mt.id} className="border-b border-slate-200/80 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <TableCell className="max-w-[200px] lg:max-w-[280px] py-3.5">
                        <div className="relative group/title max-w-full">
                          <span className="block truncate font-bold text-sm text-slate-900 dark:text-white cursor-pointer">
                            {mt.title}
                          </span>
                          <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 hidden group-hover/title:block z-[90] w-max max-w-xs sm:max-w-md px-3 py-2 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white text-xs font-semibold shadow-xl border border-slate-700/80 leading-snug break-words">
                            {mt.title}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px] lg:max-w-[240px] py-3.5">
                        {mt.quiz?.title ? (
                          <div className="relative group/quiztitle max-w-full">
                            <span className="block truncate text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                              {mt.quiz.title}
                            </span>
                            <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 hidden group-hover/quiztitle:block z-[90] w-max max-w-xs sm:max-w-md px-3 py-2 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white text-xs font-semibold shadow-xl border border-slate-700/80 leading-snug break-words">
                              {mt.quiz.title}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-700 dark:text-slate-300 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>{scheduledFormatted}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 whitespace-nowrap">
                        {mt.status === 'LIVE' ? (
                          <Badge variant="gold" className="text-[10px] font-bold animate-pulse">🔴 LIVE</Badge>
                        ) : mt.status === 'UPCOMING' ? (
                          <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10 font-bold">
                            UPCOMING
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px] font-bold">COMPLETED</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5 whitespace-nowrap">
                        <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{mt._count?.participants ?? 0}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="p-2 rounded-xl text-cyan-700 dark:text-cyan-300 border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all shadow-xs flex items-center space-x-1"
                            title="View Live Rank List"
                            aria-label="View Live Rank List"
                            onClick={() => setSelectedLeaderboardMockTest(mt)}
                          >
                            <Trophy className="w-4 h-4" />
                            <span className="hidden xl:inline text-xs font-bold">Rank List</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="p-2 rounded-xl text-cyan-700 dark:text-cyan-300 hover:text-cyan-400 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all shadow-xs"
                            title="Edit Mock Test"
                            aria-label="Edit Mock Test"
                            onClick={() => handleEdit(mt)}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={deletingId === mt.id}
                            onClick={() => setDeleteTarget(mt)}
                            className="p-2 rounded-xl transition-all shadow-sm"
                            title="Delete Mock Test"
                            aria-label="Delete Mock Test"
                          >
                            {deletingId === mt.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#091124]">
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
      </Card>

      <Dialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingMockTest(null);
        }}
        title={editingMockTest ? 'Edit Live Mock Test' : 'Schedule Live Mock Test'}
      >
        <form className="space-y-4 pt-2" onSubmit={formik.handleSubmit} noValidate>
          <Input
            label="Mock Test Title"
            name="title"
            placeholder="e.g. Kerala PSC LDC Mega Mock 2026"
            value={formik.values.title}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.title && formik.errors.title ? formik.errors.title : undefined}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Quiz</label>
            <select
              name="quizId"
              value={formik.values.quizId}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/60"
            >
              <option value="">Select a quiz…</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.totalQuestions || q.questions?.length || 0} Qs, {q.durationMinutes} min)
                </option>
              ))}
            </select>
            {formik.touched.quizId && formik.errors.quizId && (
              <p className="text-xs text-rose-500 font-medium">{formik.errors.quizId}</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DatePicker
              label="Scheduled Date"
              value={formik.values.scheduledDate}
              onChange={(d) => {
                formik.setFieldValue('scheduledDate', d);
                formik.setFieldTouched('scheduledDate', true);
              }}
              minDate={new Date().toISOString().split('T')[0]}
              error={formik.touched.scheduledDate && formik.errors.scheduledDate ? (formik.errors.scheduledDate as string) : undefined}
            />
            <TimePicker
              label="Scheduled Time"
              value={formik.values.scheduledTime}
              onChange={(t) => {
                formik.setFieldValue('scheduledTime', t);
                formik.setFieldTouched('scheduledTime', true);
              }}
              error={formik.touched.scheduledTime && formik.errors.scheduledTime ? (formik.errors.scheduledTime as string) : undefined}
            />
          </div>
          <Button type="submit" variant="gold" className="w-full font-bold shadow-md shadow-amber-500/20" disabled={formik.isSubmitting}>
            {formik.isSubmitting
              ? editingMockTest
                ? 'Saving…'
                : 'Scheduling…'
              : editingMockTest
              ? 'Save Changes'
              : 'Schedule Mock Test 🔴'}
          </Button>
        </form>
      </Dialog>

      {/* Live Rank List Dialog */}
      <Dialog
        isOpen={!!selectedLeaderboardMockTest}
        onClose={() => setSelectedLeaderboardMockTest(null)}
        title={`Live Rank List — ${selectedLeaderboardMockTest?.title || ''}`}
      >
        {selectedLeaderboardMockTest && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Quiz Title</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedLeaderboardMockTest.quiz?.title || '—'}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-500 block">Total Marks</span>
                <span className="text-sm font-mono font-bold text-amber-500">{selectedLeaderboardMockTest.quiz?.totalMarks || 100} Marks</span>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
              {adminLeaderboard.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {leaderboardLoading ? 'Loading rankings...' : 'No student submissions yet. Rankings will auto-update in real-time as tests are submitted.'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950/70">
                      <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Rank</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Student Name</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-right">Score</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-right">Total Marks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminLeaderboard.map((entry) => {
                      const initial = entry.userName ? entry.userName.charAt(0).toUpperCase() : 'S';
                      return (
                        <TableRow key={entry.userId} className="border-b border-slate-200/80 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <TableCell className="py-3">
                            <div className="flex items-center space-x-1.5">
                              <Badge variant={entry.rank <= 3 ? 'gold' : 'outline'} className="text-[10px] font-mono font-bold">
                                #{entry.rank}
                              </Badge>
                              {entry.rank === 1 && <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            </div>
                          </TableCell>
                          <TableCell className="font-bold text-sm text-slate-900 dark:text-white py-3">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                                {initial}
                              </div>
                              <span>{entry.userName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-extrabold text-amber-600 dark:text-amber-400 py-3">
                            {entry.score}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-slate-600 dark:text-slate-400 py-3">
                            {entry.totalMarks ?? selectedLeaderboardMockTest.quiz?.totalMarks ?? 100}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setSelectedLeaderboardMockTest(null)}>
                Close Rank List
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Mock Test"
        description={deleteTarget ? `Delete "${deleteTarget.title}"? This will remove all participant records and cannot be undone.` : undefined}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
