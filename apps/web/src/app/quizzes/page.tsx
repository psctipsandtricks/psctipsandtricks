'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardTitle, CardDescription, Button, Badge, Input, Pagination } from '@psc/ui';
import { Timer, Award, Folder, FolderOpen, Lock, Unlock, ArrowRight, Search, Filter, History, Radio, CheckCircle2, Trophy, Calendar, Clock, ChevronRight, ChevronLeft, Crown, ShoppingCart, Zap, FileQuestion } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { QuizFolder } from '@psc/shared-types';
import { useAuth } from '../auth-provider';
import { QuizHubSkeleton } from '../skeletons/page-skeletons';

interface StudentQuiz {
  id: string;
  title: string;
  folderName: string;
  questions: number;
  duration: number;
  isLive: boolean;
  totalMarks: number;
  accessType: 'FREE' | 'PAID';
  price?: number;
  imageUrl?: string | null;
  createdAt?: string;
  hasAccess?: boolean;
  isPurchased?: boolean;
}

const NEW_QUIZ_WINDOW_DAYS = 7;

function isRecentlyUploaded(createdAt?: string): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= NEW_QUIZ_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

const MOCK_TEST_POLL_MS = 20_000;

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const targetMs = new Date(target).getTime();
    if (targetMs <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [target]);

  const diffMs = new Date(target).getTime() - now;
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isStartingNow: totalSeconds <= 0,
    isUrgent: totalSeconds > 0 && totalSeconds < 3600,
  };
}

function CountdownUnit({ value, label, urgent }: { value: number; label: string; urgent?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-11 h-11 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center font-mono font-black text-lg sm:text-xl shadow-xs border transition-all ${
          urgent
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-amber-500/10'
            : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-white shadow-slate-200/50'
        }`}
      >
        {value.toString().padStart(2, '0')}
      </div>
      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1.5">
        {label}
      </span>
    </div>
  );
}

export default function QuizzesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [quizzes, setQuizzes] = useState<StudentQuiz[]>([]);
  const [dbFolders, setDbFolders] = useState<QuizFolder[]>([]);
  const [mockTests, setMockTests] = useState<any[]>([]);
  const [myMockAttempts, setMyMockAttempts] = useState<Record<string, any>>({});
  const [attemptedQuizIds, setAttemptedQuizIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [accessFilter, setAccessFilter] = useState<'ALL' | 'FREE' | 'PAID'>('ALL');
  const [activeFolderTab, setActiveFolderTab] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, accessFilter, activeFolderTab]);

  // Poll reference for mock tests
  const mockTestsRef = useRef<any[]>([]);

  const handleStartQuiz = (quiz: StudentQuiz) => {
    const isPaid = quiz.accessType === 'PAID';
    const isUnlocked = quiz.hasAccess || quiz.isPurchased;

    const targetUrl =
      isPaid && !isUnlocked ? `/checkout?type=quiz&id=${quiz.id}` : `/quizzes/${quiz.id}`;

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  useEffect(() => {
    async function fetchPublishedQuizzes() {
      try {
        setLoading(true);
        const [data, foldersData, myOrders] = await Promise.all([
          ApiClient.getPublishedQuizzes(),
          ApiClient.getQuizFolders(),
          user ? ApiClient.getMyOrders().catch(() => []) : Promise.resolve([]),
        ]);
        setDbFolders(foldersData || []);

        const purchasedQuizIds = new Set(
          (myOrders || [])
            .filter((o: any) => o.status === 'SUCCESS' && o.quizId)
            .map((o: any) => o.quizId as string)
        );

        const activePublished = (data as any[]).filter((q) => {
          // Strictly exclude any quiz whose release date/time is in the future
          if (q.releaseDate && new Date(q.releaseDate).getTime() > Date.now()) {
            return false;
          }
          return true;
        });

        const mapped: StudentQuiz[] = activePublished.map((q) => {
          const isPaid = q.accessType === 'PAID' || (q.price && q.price > 0);
          const hasAccess = q.access?.hasAccess ?? (q.accessType === 'FREE' || purchasedQuizIds.has(q.id));
          const isPurchased = q.access?.reason === 'PURCHASED' || purchasedQuizIds.has(q.id);

          return {
            id: q.id,
            title: q.title,
            folderName: (!q.folderName || q.folderName === 'Root / No Folder' || q.folderName === 'Root') ? 'Root' : q.folderName,
            questions: q.totalQuestions || (q.questions?.length ?? 0),
            duration: q.durationMinutes,
            isLive: q.isLiveMock,
            totalMarks: q.totalMarks,
            accessType: isPaid ? 'PAID' : 'FREE',
            price: q.price > 0 ? q.price : undefined,
            imageUrl: q.imageUrl || null,
            createdAt: q.createdAt,
            hasAccess,
            isPurchased,
          };
        });
        setQuizzes(mapped);
      } catch (err) {
        console.error('Failed to fetch quizzes:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPublishedQuizzes();
  }, [user]);

  useEffect(() => {
    async function fetchMockTests() {
      try {
        const data = await ApiClient.getMockTests();
        setMockTests(data || []);
        mockTestsRef.current = data || [];
      } catch (err) {
        console.error('Failed to fetch mock tests:', err);
      }
    }
    fetchMockTests();
  }, []);

  useEffect(() => {
    if (!user) {
      setMyMockAttempts({});
      setAttemptedQuizIds(new Set());
      return;
    }
    async function fetchMyProgress() {
      try {
        const [mockAttempts, quizHistory] = await Promise.all([
          ApiClient.getMyMockTestAttempts(),
          ApiClient.getStudentAttemptHistory(),
        ]);
        const attemptMap: Record<string, any> = {};
        (mockAttempts || []).forEach((a: any) => {
          attemptMap[a.mockTestId] = a;
        });
        setMyMockAttempts(attemptMap);
        setAttemptedQuizIds(new Set((quizHistory || []).map((h: any) => h.quizId)));
      } catch (err) {
        console.error('Failed to fetch student progress:', err);
      }
    }
    fetchMyProgress();
  }, [user]);

  // Poll the mock test list while anything is still UPCOMING/LIVE — stop once everything is COMPLETED.
  useEffect(() => {
    const interval = setInterval(async () => {
      const hasActive = mockTestsRef.current.some((mt) => mt.status !== 'COMPLETED');
      if (!hasActive) return;
      try {
        const data = await ApiClient.getMockTests();
        setMockTests(data || []);
        mockTestsRef.current = data || [];
      } catch (err) {
        console.error('Failed to poll mock tests:', err);
      }
    }, MOCK_TEST_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Only live and upcoming tests belong on the hub — they are the actionable
  // ones. Finished tests live in My Attempt History instead of taking up space
  // here with a button that cannot be used.
  const highlightedMockTests = mockTests
    .filter((mt) => (mt.status === 'LIVE' || mt.status === 'UPCOMING') && !!mt.quiz?.totalQuestions)
    .sort((a, b) => {
      const rank = (s: string) => (s === 'LIVE' ? 0 : 1);
      const rankDiff = rank(a.status) - rank(b.status);
      if (rankDiff !== 0) return rankDiff;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });

  const freeCount = quizzes.filter((q) => q.accessType === 'FREE').length;
  const premiumCount = quizzes.filter((q) => q.accessType === 'PAID').length;
  const completedMockTestCount = mockTests.filter((mt) => mt.status === 'COMPLETED').length;

  // Helper to compute active published quizzes in a folder + its descendants
  const getFolderQuizCount = useCallback(
    (folderName: string, scopedQuizzes: StudentQuiz[], allDbFolders: QuizFolder[]): number => {
      const directCount = scopedQuizzes.filter(
        (q) => q.folderName.toLowerCase() === folderName.toLowerCase(),
      ).length;

      const record = allDbFolders.find(
        (f) => f.name.toLowerCase() === folderName.toLowerCase(),
      );

      if (!record) return directCount;

      const childFolders = allDbFolders.filter(
        (f) => f.parentId === record.id && f.isActive !== false && f.name.toLowerCase() !== 'root',
      );

      const descendantCount = childFolders.reduce(
        (sum, child) => sum + getFolderQuizCount(child.name, scopedQuizzes, allDbFolders),
        0,
      );

      return directCount + descendantCount;
    },
    [],
  );

  // Browsing is a drill-down: course type → folder → quizzes. `accessFilter`
  // holds level 1 and `activeFolderTab` level 2, both 'ALL' until chosen.
  const browseLevel: 'ACCESS' | 'FOLDER' | 'QUIZ' =
    accessFilter === 'ALL' ? 'ACCESS' : activeFolderTab === 'ALL' ? 'FOLDER' : 'QUIZ';

  // Folders are scoped to the chosen course type, so opening "Free" never lists
  // a folder that holds only premium quizzes.
  const accessScopedQuizzes =
    accessFilter === 'ALL' ? quizzes : quizzes.filter((q) => q.accessType === accessFilter);

  // Top-level folders (those without a parentId, active, and containing at least 1 active quiz in this scope)
  const topDbFolders = dbFolders.filter(
    (f) => !f.parentId && f.isActive !== false && f.name.toLowerCase() !== 'root',
  );

  const topFoldersWithQuizzes = topDbFolders.filter(
    (f) => getFolderQuizCount(f.name, accessScopedQuizzes, dbFolders) > 0,
  );

  const quizFoldersSet = new Set(accessScopedQuizzes.map((q) => q.folderName));
  const folders: string[] = Array.from(
    new Set([
      ...topFoldersWithQuizzes.map((f) => f.name),
      ...Array.from(quizFoldersSet).filter((fn) => {
        const found = dbFolders.find((df) => df.name.toLowerCase() === fn.toLowerCase());
        if (!found) return Boolean(fn && fn.toLowerCase() !== 'root');
        return !found.parentId && found.isActive !== false && getFolderQuizCount(found.name, accessScopedQuizzes, dbFolders) > 0;
      }),
    ]),
  ).filter((f): f is string => Boolean(f && f.toLowerCase() !== 'root'));

  // Currently active folder object and its child sub-folders (only those with active quizzes)
  const currentFolderRecord = dbFolders.find(
    (f) => f.name.toLowerCase() === activeFolderTab.toLowerCase(),
  );
  const currentSubFolders = dbFolders.filter(
    (f) =>
      currentFolderRecord &&
      f.parentId === currentFolderRecord.id &&
      f.isActive !== false &&
      f.name.toLowerCase() !== 'root' &&
      getFolderQuizCount(f.name, accessScopedQuizzes, dbFolders) > 0,
  );

  const accessLabel = accessFilter === 'PAID' ? 'Premium Quizzes' : 'Free Quizzes';

  const openAccess = (next: 'FREE' | 'PAID') => {
    setAccessFilter(next);
    setActiveFolderTab('ALL');
  };
  const backToAccess = () => {
    setAccessFilter('ALL');
    setActiveFolderTab('ALL');
  };

  const filteredQuizzes = quizzes.filter((quiz) => {
    const matchesSearch =
      quiz.title.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFolder =
      activeFolderTab === 'ALL' || quiz.folderName === activeFolderTab;

    const matchesAccess =
      accessFilter === 'ALL' || quiz.accessType === accessFilter;

    return matchesSearch && matchesFolder && matchesAccess;
  });

  const totalItems = filteredQuizzes.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedQuizzes = filteredQuizzes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading || authLoading) {
    return <QuizHubSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-8 py-2 sm:py-4 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Quiz Hub & Live Mock Tests
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
            Browse quizzes by topic folder, test your preparation with live mock tests, and practice free/premium question banks.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!user) {
              router.push('/login?redirect=/quizzes/history');
            } else {
              router.push('/quizzes/history');
            }
          }}
          className="font-bold flex items-center space-x-1.5 self-start sm:self-auto shrink-0 border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/70 cursor-pointer"
        >
          <History className="w-4 h-4 text-cyan-500" />
          <span>My Attempt History</span>
        </Button>
      </div>

      {/* Live & Upcoming Mock Tests — pinned & highlighted */}
      {highlightedMockTests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
            <Radio className="w-4 h-4 text-rose-500" />
            <span>Live &amp; Upcoming Mock Tests</span>
          </h2>
          {/* A lone test gets the full viewport width instead of sitting in a
              third of an otherwise empty row. */}
          <div
            className={
              highlightedMockTests.length === 1
                ? 'grid grid-cols-1 gap-4'
                : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            }
          >
            {highlightedMockTests.map((mt) => (
              <MockTestCard key={mt.id} mockTest={mt} myAttempt={myMockAttempts[mt.id]} router={router} user={user} />
            ))}
          </div>
        </div>
      )}

      {/* Breadcrumb trail — only once the user has drilled in */}
      {browseLevel !== 'ACCESS' && (
        <div className="flex items-center flex-wrap gap-1.5 text-xs font-bold">
          <button
            onClick={backToAccess}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-[#0c152e] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>All Courses</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
          {browseLevel === 'QUIZ' ? (
            <>
              <button
                onClick={() => setActiveFolderTab('ALL')}
                className="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-[#0c152e] transition-colors cursor-pointer"
              >
                {accessLabel}
              </button>
              {currentFolderRecord?.parentName && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
                  <button
                    onClick={() => setActiveFolderTab(currentFolderRecord.parentName!)}
                    className="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-[#0c152e] transition-colors cursor-pointer"
                  >
                    {currentFolderRecord.parentName}
                  </button>
                </>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
              <span className="px-2.5 py-1.5 text-cyan-700 dark:text-cyan-300">
                {activeFolderTab === 'Root / No Folder' ? '🏠 Root Level' : activeFolderTab}
              </span>
            </>
          ) : (
            <span className="px-2.5 py-1.5 text-cyan-700 dark:text-cyan-300">{accessLabel}</span>
          )}
        </div>
      )}

      {/* Level 1 — pick a course type */}
      {browseLevel === 'ACCESS' && (
        <div className="space-y-3">
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
            <FolderOpen className="w-4 h-4 text-cyan-500" />
            <span>Browse Question Banks</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <CourseTypeCard
              title="Free Quizzes"
              description="Practice question banks you can attempt right away, at no cost."
              count={freeCount}
              icon={<Unlock className="w-6 h-6" />}
              accent="free"
              onClick={() => openAccess('FREE')}
            />
            <CourseTypeCard
              title="Premium Quizzes"
              description="Paid question banks curated by top rank holders. Unlock to attempt."
              count={premiumCount}
              icon={<Crown className="w-6 h-6" />}
              accent="premium"
              onClick={() => openAccess('PAID')}
            />
            {/* Finished tests moved off the hub, but students still need their
                rank — this is the way back to it. */}
            <CourseTypeCard
              title="Completed Mock Tests"
              description="Finished mock tests with your score, rank and the full rank list."
              count={completedMockTestCount}
              countLabel={completedMockTestCount === 1 ? 'Test' : 'Tests'}
              icon={<Trophy className="w-6 h-6" />}
              accent="completed"
              href="/mock-tests/completed"
            />
          </div>
        </div>
      )}

      {/* Level 2 — pick a top folder inside the chosen course type */}
      {browseLevel === 'FOLDER' && (
        <div className="space-y-3">
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
            <FolderOpen className={`w-4 h-4 ${accessFilter === 'PAID' ? 'text-amber-500' : 'text-emerald-500'}`} />
            <span>{accessLabel} — Folders</span>
          </h2>
          {folders.length === 0 ? (
            <EmptyBrowseState
              title={`No ${accessFilter === 'PAID' ? 'premium' : 'free'} quizzes yet`}
              message={`There are no ${accessFilter === 'PAID' ? 'premium' : 'free'} question banks published right now. Check back soon.`}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {folders.map((folder) => (
                <FolderCard
                  key={folder}
                  name={folder}
                  count={getFolderQuizCount(folder, accessScopedQuizzes, dbFolders)}
                  accent={accessFilter === 'PAID' ? 'premium' : 'free'}
                  onClick={() => setActiveFolderTab(folder)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Level 3 — the quizzes and sub-folders inside the chosen folder */}
      {browseLevel === 'QUIZ' && (
        <div className="space-y-6">
          {/* If the active folder contains sub-folders, display them */}
          {currentSubFolders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <span>Sub-folders in &ldquo;{activeFolderTab}&rdquo;</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {currentSubFolders.map((subFolder) => (
                  <FolderCard
                    key={subFolder.id}
                    name={subFolder.name}
                    count={getFolderQuizCount(subFolder.name, accessScopedQuizzes, dbFolders)}
                    accent={accessFilter === 'PAID' ? 'premium' : 'free'}
                    onClick={() => setActiveFolderTab(subFolder.name)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Quizzes inside this folder */}
          {paginatedQuizzes.length === 0 && currentSubFolders.length === 0 ? (
            <div className="py-16 text-center">
              <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                  <Search className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Quiz Match</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    No quizzes match your selected search or filter criteria. Try adjusting your search term or filters.
                  </p>
                </div>
              </div>
            </div>
          ) : paginatedQuizzes.length > 0 ? (
            <div className="space-y-3">
              {currentSubFolders.length > 0 && (
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Quizzes in &ldquo;{activeFolderTab}&rdquo; ({paginatedQuizzes.length})
                </h3>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedQuizzes.map((quiz) => {
                  const isPaid = quiz.accessType === 'PAID';
                  const isNew = isRecentlyUploaded(quiz.createdAt);
                  const defaultCover = isPaid ? '/default-quiz-cover.svg' : '/default-free-quiz-cover.svg';
                  const coverImage = quiz.imageUrl || defaultCover;

                  return (
                    <Card key={quiz.id} hoverEffect className="flex flex-col justify-between space-y-4 bg-gradient-to-b from-white via-white to-slate-50/90 dark:bg-none dark:bg-[#0c152e] border border-slate-200/90 dark:border-[#1e2e56] shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_30px_rgba(6,182,212,0.16)] hover:border-cyan-500/50 transition-all duration-300 p-5 rounded-2xl">
                      <div className="space-y-3">
                        <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-slate-950 group/img">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={coverImage}
                            alt={quiz.title}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = defaultCover;
                            }}
                            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover/img:scale-105"
                          />
                          {/* Top Badges Overlay on Cover */}
                          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
                            <div className="flex items-center gap-1.5">
                              {isNew && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-md">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                  New
                                </span>
                              )}
                              {quiz.isLive && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-md">
                                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                                  Live
                                </span>
                              )}
                            </div>
                            {isPaid ? (
                              quiz.hasAccess || quiz.isPurchased ? (
                                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-950/85 backdrop-blur-md text-emerald-400 border border-emerald-500/30 shadow-md flex items-center gap-1">
                                  <Unlock className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>UNLOCKED</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black font-mono bg-slate-950/85 backdrop-blur-md text-amber-400 border border-amber-500/30 shadow-md flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5 text-amber-400" />
                                  <span>₹{quiz.price}</span>
                                </span>
                              )
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-950/85 backdrop-blur-md text-emerald-400 border border-emerald-500/30 shadow-md flex items-center gap-1">
                                <Unlock className="w-2.5 h-2.5 text-emerald-400" />
                                <span>FREE</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center space-x-2">
                            {isNew && (
                              <Badge variant="success" className="font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>NEW</span>
                              </Badge>
                            )}
                            <Badge variant={quiz.isLive ? 'gold' : 'default'}>
                              {quiz.isLive ? '🔥 Live Mock Test' : 'Quiz'}
                            </Badge>
                          {/* Free vs Paid Access Badge */}
                          {quiz.accessType === 'FREE' ? (
                            <Badge variant="success" className="font-bold flex items-center gap-1">
                              <Unlock className="w-3 h-3" />
                              <span>FREE</span>
                            </Badge>
                          ) : quiz.hasAccess || quiz.isPurchased ? (
                            <Badge variant="success" className="font-bold flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>UNLOCKED</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-bold flex items-center gap-1 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30">
                              <Lock className="w-3 h-3 text-cyan-500" />
                              <span>₹{quiz.price}</span>
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1 font-mono">
                          <Timer className="w-3.5 h-3.5" />
                          <span>{quiz.duration} mins</span>
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-1 group-hover:text-cyan-500 transition-colors">
                          {quiz.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                          <span>{quiz.questions} Questions</span>
                          <span>•</span>
                          <span>{quiz.totalMarks} Marks</span>
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      {attemptedQuizIds.has(quiz.id) ? (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Attempted</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">Not attempted</span>
                      )}
                      {quiz.accessType === 'PAID' && !quiz.hasAccess && !quiz.isPurchased ? (
                        <Button
                          size="sm"
                          variant="gold"
                          className="font-bold cursor-pointer"
                          onClick={() => handleStartQuiz(quiz)}
                        >
                          <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                          <span>Buy Now</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="gold"
                          className="font-bold cursor-pointer"
                          onClick={() => handleStartQuiz(quiz)}
                        >
                          <span>{attemptedQuizIds.has(quiz.id) ? 'Retake Quiz' : 'Start Quiz'}</span>
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      )}
                    </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {browseLevel === 'QUIZ' && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          pageSizeOptions={[6, 9, 12, 24]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      )}
    </div>
  );
}

const COURSE_CARD_THEMES = {
  free: {
    accentBar: 'from-emerald-400 to-teal-500',
    iconBg: 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/25',
    pill: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    dot: 'bg-emerald-500',
    titleHover: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
    buttonText: 'Open Free Folders',
    buttonBg: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 group-hover:bg-emerald-500 group-hover:text-white',
    glow: 'group-hover:shadow-emerald-500/15',
  },
  premium: {
    accentBar: 'from-amber-400 to-amber-600',
    iconBg: 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/25',
    pill: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    dot: 'bg-amber-500',
    titleHover: 'group-hover:text-amber-600 dark:group-hover:text-amber-400',
    buttonText: 'Explore Premium Quizzes',
    buttonBg: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 group-hover:bg-amber-500 group-hover:text-slate-950',
    glow: 'group-hover:shadow-amber-500/15',
  },
  completed: {
    accentBar: 'from-cyan-400 to-blue-600',
    iconBg: 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25',
    pill: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
    dot: 'bg-cyan-500',
    titleHover: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400',
    buttonText: 'View Full Rank List',
    buttonBg: 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 group-hover:bg-cyan-500 group-hover:text-white',
    glow: 'group-hover:shadow-cyan-500/15',
  },
};

function CourseTypeCard({
  title,
  description,
  count,
  countLabel,
  icon,
  accent,
  onClick,
  href,
}: {
  title: string;
  description: string;
  count: number;
  countLabel?: string;
  icon: React.ReactNode;
  accent: 'free' | 'premium' | 'completed';
  onClick?: () => void;
  href?: string;
}) {
  const theme = COURSE_CARD_THEMES[accent];
  const body = (
    <div className="relative flex flex-col justify-between h-full space-y-5 p-6 sm:p-7">
      {/* Top row */}
      <div className="flex items-center justify-between gap-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${theme.iconBg}`}>
          {icon}
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${theme.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
          {count} {countLabel || (count === 1 ? 'Quiz' : 'Quizzes')}
        </span>
      </div>

      {/* Main Content */}
      <div className="space-y-1.5 flex-1">
        <h3 className={`text-xl font-black tracking-tight text-slate-900 dark:text-white transition-colors ${theme.titleHover}`}>
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all duration-300 ${theme.buttonBg}`}>
          <span>{href ? 'View Rank List' : theme.buttonText}</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </div>
  );

  const shell = `group relative text-left w-full h-full rounded-3xl border border-slate-200/90 dark:border-[#1e2e56] bg-white/90 dark:bg-[#0c152e]/90 hover:bg-white dark:hover:bg-[#0e1938] shadow-lg shadow-slate-200/40 dark:shadow-2xl dark:shadow-black/40 hover:shadow-2xl ${theme.glow} hover:-translate-y-1.5 transition-all duration-300 overflow-hidden cursor-pointer backdrop-blur-md`;

  if (href) {
    return (
      <Link href={href} className={shell}>
        <div className={`h-1.5 w-full bg-gradient-to-r ${theme.accentBar}`} />
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={shell}>
      <div className={`h-1.5 w-full bg-gradient-to-r ${theme.accentBar}`} />
      {body}
    </button>
  );
}

function FolderCard({
  name,
  count,
  accent,
  onClick,
}: {
  name: string;
  count: number;
  accent: 'free' | 'premium';
  onClick: () => void;
}) {
  const isPremium = accent === 'premium';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left w-full p-6 rounded-3xl border border-slate-200/90 dark:border-[#1e2e56] bg-white/90 dark:bg-[#0c152e]/90 hover:bg-white dark:hover:bg-[#0e1938] shadow-lg shadow-slate-200/40 dark:shadow-2xl dark:shadow-black/40 hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden cursor-pointer backdrop-blur-md ${
        isPremium ? 'hover:shadow-amber-500/15' : 'hover:shadow-emerald-500/15'
      }`}
    >
      <div
        className={`h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r ${
          isPremium ? 'from-amber-400 to-amber-600' : 'from-emerald-400 to-teal-500'
        }`}
      />
      <div className="flex items-center justify-between gap-3">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-lg ${
            isPremium
              ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-amber-500/25'
              : 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-500/25'
          }`}
        >
          <Folder className="w-5 h-5" />
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${
            isPremium
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isPremium ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          {count} {count === 1 ? 'Quiz' : 'Quizzes'}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-black tracking-tight text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
        {name === 'Root / No Folder' ? '🏠 Root Level' : name}
      </h3>
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-black text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-500">
          <span>Open Folder</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </button>
  );
}

function EmptyBrowseState({ title, message }: { title: string; message: string }) {
  return (
    <div className="py-16 text-center">
      <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
          <FolderOpen className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  );
}

function MockTestCard({
  mockTest,
  myAttempt,
  router,
  user,
}: {
  mockTest: any;
  myAttempt: any;
  router: ReturnType<typeof useRouter>;
  user: any;
}) {
  const countdown = useCountdown(mockTest.scheduledAt);
  const scheduledDate = new Date(mockTest.scheduledAt);
  const scheduledFormatted = scheduledDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const scheduledTimeFormatted = scheduledDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isJoined = !!myAttempt;
  const hasSubmitted = !!myAttempt?.submittedAt;
  const isLocked = mockTest.access?.isPaid && !mockTest.access?.hasAccess;
  const canResume = isJoined && !hasSubmitted;

  const handleClick = () => {
    const targetUrl = `/mock-tests/${mockTest.id}`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  const isLive = mockTest.status === 'LIVE';
  const isUpcoming = mockTest.status === 'UPCOMING';

  return (
    <div
      className={`group relative overflow-hidden rounded-3xl transition-all duration-300 border backdrop-blur-xl ${
        isLive
          ? 'bg-gradient-to-b from-emerald-500/[0.06] via-white to-white dark:from-emerald-950/20 dark:via-[#091124] dark:to-[#091124] border-emerald-500/40 shadow-xl shadow-emerald-500/10'
          : isUpcoming
            ? 'bg-gradient-to-b from-cyan-500/[0.04] via-white to-white dark:from-[#0f1d3d] dark:via-[#091124] dark:to-[#091124] border-slate-200/90 dark:border-[#1e2e56] shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/50'
            : 'bg-white dark:bg-[#091124] border-slate-200/80 dark:border-[#1e2e56] shadow-md'
      }`}
    >
      {/* Top Accent Gradient Bar */}
      <div
        className={`h-1.5 w-full ${
          isLive
            ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600 animate-pulse'
            : isUpcoming
              ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-amber-500'
              : 'bg-slate-300 dark:bg-slate-700'
        }`}
      />

      <div className="p-5 sm:p-7 space-y-5">
        {/* Top Badges Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                LIVE NOW
              </span>
            ) : isUpcoming ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                <Radio className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
                Scheduled Live Mock
              </span>
            ) : (
              <Badge variant="success" className="font-bold flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                <span>Completed</span>
              </Badge>
            )}

            {mockTest.access?.isPaid ? (
              <Badge variant="gold" className="text-xs font-black flex items-center gap-1 px-2.5 py-0.5">
                <Lock className="w-3 h-3" />
                <span>₹{mockTest.access?.price ?? 0} Premium</span>
              </Badge>
            ) : (
              <Badge variant="success" className="text-xs font-black flex items-center gap-1 px-2.5 py-0.5">
                <Unlock className="w-3 h-3" />
                <span>Free Access</span>
              </Badge>
            )}
          </div>

          <div>
            {myAttempt ? (
              <Badge
                variant={hasSubmitted ? 'success' : 'warning'}
                className="text-xs font-black flex items-center gap-1 px-2.5 py-1"
              >
                {hasSubmitted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                <span>{hasSubmitted ? (myAttempt.rank ? `Rank #${myAttempt.rank}` : 'Submitted') : 'In Progress'}</span>
              </Badge>
            ) : (
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Registration Open
              </span>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-snug group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
            {mockTest.title}
          </h3>
          <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400">
            {mockTest.quiz?.title || 'Kerala PSC Comprehensive Syllabus'}
          </p>
        </div>

        {/* Meta Highlights Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
            <Calendar className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span>{scheduledFormatted} at {scheduledTimeFormatted}</span>
          </div>

          {mockTest.quiz?.durationMinutes && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{mockTest.quiz.durationMinutes} Mins</span>
            </div>
          )}

          {mockTest.quiz?.totalQuestions && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
              <FileQuestion className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>{mockTest.quiz.totalQuestions} Questions</span>
            </div>
          )}

          {mockTest.quiz?.totalMarks && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
              <Award className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>{mockTest.quiz.totalMarks} Marks</span>
            </div>
          )}
        </div>

        {/* Live Arena or Countdown Box */}
        {isLive ? (
          <div className="rounded-2xl p-4 sm:p-5 border border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-black shadow-lg shadow-emerald-500/30 shrink-0 animate-pulse">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white">Exam Room is Live!</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Join now and compete on the real-time leaderboard.</p>
              </div>
            </div>
            <Button
              variant="gold"
              size="md"
              onClick={handleClick}
              className="w-full sm:w-auto font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white border-0 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>
                {hasSubmitted
                  ? 'View Live Rank List'
                  : canResume
                    ? 'Resume Test'
                    : isLocked
                      ? `Unlock & Start (₹${mockTest.access?.price ?? 0})`
                      : 'Enter Live Arena'}
              </span>
            </Button>
          </div>
        ) : isUpcoming ? (
          <div className="rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/70 dark:bg-[#070e20]/60 flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-start">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {countdown.isStartingNow ? 'Exam Room Ready' : 'Countdown to Start'}
                </p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {countdown.isStartingNow ? 'The test is beginning right now' : 'Test will unlock automatically'}
                </p>
              </div>
            </div>

            {countdown.isStartingNow ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="gold"
                  size="md"
                  onClick={handleClick}
                  className="font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>Join Exam Now</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                {countdown.days > 0 && (
                  <>
                    <CountdownUnit value={countdown.days} label="Days" urgent={countdown.isUrgent} />
                    <span className="text-slate-400 dark:text-slate-600 font-black text-lg pb-3">:</span>
                  </>
                )}
                <CountdownUnit value={countdown.hours} label="Hrs" urgent={countdown.isUrgent} />
                <span className="text-slate-400 dark:text-slate-600 font-black text-lg pb-3">:</span>
                <CountdownUnit value={countdown.minutes} label="Min" urgent={countdown.isUrgent} />
                <span className="text-slate-400 dark:text-slate-600 font-black text-lg pb-3">:</span>
                <CountdownUnit value={countdown.seconds} label="Sec" urgent={countdown.isUrgent} />
              </div>
            )}
          </div>
        ) : null}

        {/* Card Footer Actions (for Upcoming and Completed) */}
        {!isLive && (
          <div className="pt-3 border-t border-slate-200/80 dark:border-[#1e2e56] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>Real-time rank list available after submission</span>
            </div>

            {mockTest.status === 'COMPLETED' && !myAttempt ? (
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                Test Completed
              </span>
            ) : (
              <Button
                variant={isLocked ? 'gold' : 'outline'}
                size="sm"
                className="w-full sm:w-auto font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                onClick={handleClick}
              >
                {isLocked && <Lock className="w-3.5 h-3.5" />}
                <span>
                  {mockTest.status === 'COMPLETED'
                    ? 'View Final Rank List'
                    : isLocked
                      ? `Unlock Test (₹${mockTest.access?.price ?? 0})`
                      : 'View Details & Syllabus'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
