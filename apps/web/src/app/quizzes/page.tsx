'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardTitle, CardDescription, Button, Badge, Input, Pagination } from '@psc/ui';
import { Timer, Award, Folder, FolderOpen, Lock, Unlock, ArrowRight, Search, Filter, History, Radio, CheckCircle2, Trophy, Calendar, Clock, ChevronRight, ChevronLeft, Crown } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from '../auth-provider';
import { QuizHubSkeleton } from '../skeletons/page-skeletons';

interface StudentQuiz {
  id: string;
  title: string;
  category: string;
  folderName: string;
  questions: number;
  duration: number;
  isLive: boolean;
  totalMarks: number;
  accessType: 'FREE' | 'PAID';
  price?: number;
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
    isStartingNow: diffMs <= 0,
    // Under 5 minutes: switch the display to an amber "about to start" state.
    isUrgent: diffMs > 0 && totalSeconds < 300,
  };
}

function CountdownUnit({ value, label, urgent }: { value: number; label: string; urgent: boolean }) {
  return (
    <div className="flex flex-col items-center min-w-[32px] sm:min-w-[36px]">
      <span
        className={`text-lg sm:text-xl font-black font-mono tabular-nums leading-none ${
          urgent ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
        }`}
      >
        {value.toString().padStart(2, '0')}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">
        {label}
      </span>
    </div>
  );
}

export default function QuizzesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<StudentQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolderTab, setActiveFolderTab] = useState<string>('ALL');
  const [accessFilter, setAccessFilter] = useState<'ALL' | 'FREE' | 'PAID'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, accessFilter, activeFolderTab]);

  const [mockTests, setMockTests] = useState<any[]>([]);
  const [myMockAttempts, setMyMockAttempts] = useState<Record<string, any>>({});
  const [attemptedQuizIds, setAttemptedQuizIds] = useState<Set<string>>(new Set());
  const mockTestsRef = useRef<any[]>([]);

  const handleStartTest = (quiz: any) => {
    const isPaid = quiz.accessType === 'PAID' || quiz.isPremium || (quiz.price ?? 0) > 0;
    const isAlreadyAttempted = attemptedQuizIds.has(quiz.id);

    const targetUrl =
      isPaid && !isAlreadyAttempted ? `/checkout?type=quiz&id=${quiz.id}` : `/quizzes/${quiz.id}`;

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
        const data = await ApiClient.getPublishedQuizzes();
        const mapped: StudentQuiz[] = (data as any[]).map((q) => ({
          id: q.id,
          title: q.title,
          category: q.category,
          folderName: (!q.folderName || q.folderName === 'Root / No Folder' || q.folderName === 'Root') ? 'Root' : q.folderName,
          questions: q.totalQuestions || (q.questions?.length ?? 0),
          duration: q.durationMinutes,
          isLive: q.isLiveMock,
          totalMarks: q.totalMarks,
          accessType: q.accessType === 'PAID' ? 'PAID' : 'FREE',
          price: q.price > 0 ? q.price : undefined,
        }));
        setQuizzes(mapped);
      } catch (err) {
        console.error('Failed to fetch quizzes:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPublishedQuizzes();
  }, []);

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

  // Browsing is a drill-down: course type → folder → quizzes. `accessFilter`
  // holds level 1 and `activeFolderTab` level 2, both 'ALL' until chosen.
  const browseLevel: 'ACCESS' | 'FOLDER' | 'QUIZ' =
    accessFilter === 'ALL' ? 'ACCESS' : activeFolderTab === 'ALL' ? 'FOLDER' : 'QUIZ';

  // Folders are scoped to the chosen course type, so opening "Free" never lists
  // a folder that holds only premium quizzes.
  const accessScopedQuizzes =
    accessFilter === 'ALL' ? quizzes : quizzes.filter((q) => q.accessType === accessFilter);
  const folders = Array.from(new Set(accessScopedQuizzes.map((q) => q.folderName)));

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
      quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quiz.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFolder =
      activeFolderTab === 'ALL' || quiz.folderName === activeFolderTab;

    const matchesAccess =
      accessFilter === 'ALL' || quiz.accessType === accessFilter;

    return matchesSearch && matchesFolder && matchesAccess;
  });

  const totalItems = filteredQuizzes.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedQuizzes = filteredQuizzes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
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
        <Link href="/quizzes/history">
          <Button variant="outline" size="sm" className="font-bold flex items-center space-x-1.5 self-start sm:self-auto shrink-0 border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-400/70">
            <History className="w-4 h-4 text-cyan-500" />
            <span>My Attempt History</span>
          </Button>
        </Link>
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

      {/* Level 2 — pick a folder inside the chosen course type */}
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
                  count={accessScopedQuizzes.filter((q) => q.folderName === folder).length}
                  accent={accessFilter === 'PAID' ? 'premium' : 'free'}
                  onClick={() => setActiveFolderTab(folder)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Level 3 — the quizzes inside the chosen folder */}
      {browseLevel === 'QUIZ' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedQuizzes.length === 0 ? (
            <div className="col-span-full py-16 text-center">
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
          ) : (
            paginatedQuizzes.map((quiz) => (
              <Card key={quiz.id} hoverEffect className="flex flex-col justify-between space-y-4 bg-gradient-to-b from-white via-white to-slate-50/90 dark:bg-none dark:bg-[#0c152e] border border-slate-200/90 dark:border-[#1e2e56] shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_30px_rgba(6,182,212,0.16)] hover:border-cyan-500/50 transition-all duration-300 p-5 rounded-2xl">
                <div className="space-y-3">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant={quiz.isLive ? 'gold' : 'default'}>
                        {quiz.isLive ? '🔥 Live Mock Test' : quiz.category}
                      </Badge>
                      {/* Free vs Paid Access Badge */}
                      {quiz.accessType === 'FREE' ? (
                        <Badge variant="success" className="font-bold flex items-center gap-1">
                          <Unlock className="w-3 h-3" />
                          <span>FREE</span>
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

                  {/* Folder pill + Attended/Unattended status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                      <Folder className="w-3 h-3 text-cyan-500" />
                      <span>{quiz.folderName || 'Root Level'}</span>
                    </div>
                    {attemptedQuizIds.has(quiz.id) && (
                      <Badge variant="success" className="text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Attempted</span>
                      </Badge>
                    )}
                  </div>

                  <CardTitle className="text-lg leading-snug">{quiz.title}</CardTitle>
                  <CardDescription>
                    {quiz.questions} Questions • {quiz.totalMarks} Marks • 0.33 Negative Marking
                  </CardDescription>
                </div>

                <div className="pt-4 border-t border-slate-200/60 dark:border-[#1e2e56] flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center space-x-1">
                    <Award className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
                    <span>Pass: {Math.round(quiz.totalMarks * 0.4)} Marks</span>
                  </span>
                  <Button
                    variant={quiz.isLive ? 'gold' : quiz.accessType === 'FREE' ? 'primary' : 'gold'}
                    size="sm"
                    className="font-bold cursor-pointer"
                    onClick={() => handleStartTest(quiz)}
                  >
                    <span>
                      {attemptedQuizIds.has(quiz.id)
                        ? 'Retake Test'
                        : quiz.accessType === 'FREE'
                          ? 'Start Test'
                          : 'Unlock & Start'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {browseLevel === 'QUIZ' && (
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

const COURSE_CARD_ACCENTS = {
  free: {
    bg: 'bg-gradient-to-b from-white via-white to-emerald-50/50 dark:bg-none dark:bg-[#0c152e]',
    border: 'border-emerald-500/30 hover:border-emerald-500/60',
    iconBox: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
    action: 'text-emerald-600 dark:text-emerald-400',
    shadow: 'shadow-[0_4px_20px_-2px_rgba(16,185,129,0.08)] hover:shadow-[0_10px_30px_rgba(16,185,129,0.18)]',
    badge: 'success' as const,
  },
  premium: {
    bg: 'bg-gradient-to-b from-white via-white to-amber-50/50 dark:bg-none dark:bg-[#0c152e]',
    border: 'border-amber-500/30 hover:border-amber-500/60',
    iconBox: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
    action: 'text-amber-600 dark:text-amber-400',
    shadow: 'shadow-[0_4px_20px_-2px_rgba(245,158,11,0.08)] hover:shadow-[0_10px_30px_rgba(245,158,11,0.18)]',
    badge: 'gold' as const,
  },
  completed: {
    bg: 'bg-gradient-to-b from-white via-white to-cyan-50/50 dark:bg-none dark:bg-[#0c152e]',
    border: 'border-cyan-500/30 hover:border-cyan-500/60',
    iconBox: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500',
    action: 'text-cyan-600 dark:text-cyan-400',
    shadow: 'shadow-[0_4px_20px_-2px_rgba(6,182,212,0.08)] hover:shadow-[0_10px_30px_rgba(6,182,212,0.18)]',
    badge: 'default' as const,
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
  const theme = COURSE_CARD_ACCENTS[accent];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${theme.iconBox}`}>
          {icon}
        </div>
        <Badge variant={theme.badge} className="font-bold shrink-0">
          {count} {countLabel || (count === 1 ? 'Quiz' : 'Quizzes')}
        </Badge>
      </div>
      <h3 className="mt-4 text-lg font-black tracking-tight text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
      <span className={`mt-4 inline-flex items-center space-x-1 text-xs font-extrabold ${theme.action}`}>
        <span>{href ? 'View rank list' : 'Open folders'}</span>
        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </>
  );

  const shell = `group block text-left w-full h-full p-5 sm:p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${theme.bg} ${theme.border} ${theme.shadow}`;

  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={shell}>
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
      className="group text-left p-5 rounded-2xl bg-gradient-to-b from-white via-white to-slate-50/90 dark:bg-none dark:bg-[#0c152e] border border-slate-200/90 dark:border-[#1e2e56] shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_30px_rgba(6,182,212,0.16)] hover:border-cyan-500/50 transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-center justify-between gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${isPremium
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
            }`}
        >
          <Folder className="w-5 h-5" />
        </div>
        <Badge variant="default" className="font-bold shrink-0">
          {count} {count === 1 ? 'Quiz' : 'Quizzes'}
        </Badge>
      </div>
      <h3 className="mt-3.5 text-base font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
        {name === 'Root / No Folder' ? '🏠 Root Level' : name}
      </h3>
      <span className="mt-2.5 inline-flex items-center space-x-1 text-xs font-extrabold text-cyan-600 dark:text-cyan-400">
        <span>View quizzes</span>
        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
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
  const scheduledFormatted = new Date(mockTest.scheduledAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
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
    <Card
      hoverEffect
      className={`relative overflow-hidden flex flex-col justify-between space-y-4 bg-gradient-to-b from-white via-white to-sky-50/60 dark:bg-none dark:bg-[#0c152e] border-cyan-500/30 dark:border-[#1e2e56] shadow-[0_4px_20px_-2px_rgba(6,182,212,0.08)] hover:shadow-[0_10px_30px_rgba(6,182,212,0.2)] hover:border-cyan-400 transition-all duration-300 p-5 rounded-2xl ${
        isLive
          ? 'ring-1 ring-emerald-500/50 dark:ring-emerald-500/40'
          : isUpcoming
            ? 'ring-1 ring-cyan-500/30 dark:ring-cyan-500/20'
            : ''
      }`}
    >
      {isLive && <span className="absolute inset-y-0 left-0 w-1.5 bg-emerald-500" aria-hidden="true" />}
      {isUpcoming && <span className="absolute inset-y-0 left-0 w-1.5 bg-cyan-500" aria-hidden="true" />}
      <div className="space-y-3">
        <div className="flex justify-between items-center gap-2">
          {isLive ? (
            <Badge className="font-bold flex items-center gap-1.5 bg-emerald-500 text-white border-emerald-500 dark:bg-emerald-500 dark:text-white dark:border-emerald-500 shadow-[0_0_12px_-2px_rgba(16,185,129,0.6)]">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              <span>LIVE NOW</span>
            </Badge>
          ) : mockTest.status === 'UPCOMING' ? (
            <Badge variant="outline" className="font-bold flex items-center gap-1 text-cyan-700 dark:text-cyan-300 border-cyan-500/40 bg-cyan-500/10">
              <Calendar className="w-3 h-3" />
              <span>Upcoming</span>
            </Badge>
          ) : (
            <Badge variant="success" className="font-bold flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              <span>Completed</span>
            </Badge>
          )}
          {myAttempt ? (
            <Badge variant={hasSubmitted ? 'success' : 'warning'} className="text-[10px] font-bold flex items-center gap-1">
              {hasSubmitted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              <span>{hasSubmitted ? (myAttempt.rank ? `Rank #${myAttempt.rank}` : 'Attended') : 'In Progress'}</span>
            </Badge>
          ) : isLocked ? (
            <Badge variant="gold" className="text-[10px] font-bold flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>₹{mockTest.access?.price ?? 0} Premium</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] font-bold">Not Attempted</Badge>
          )}
        </div>

        <CardTitle className="text-lg leading-snug">{mockTest.title}</CardTitle>
        <CardDescription>
          {mockTest.quiz?.title} • {mockTest.quiz?.totalMarks} Marks
        </CardDescription>
        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 font-mono">
          <Timer className="w-3.5 h-3.5 text-cyan-500" />
          <span>{scheduledFormatted}</span>
        </div>

        {isUpcoming && (
          <div
            className={`rounded-xl border p-3 transition-colors ${
              countdown.isUrgent
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border-cyan-500/30'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
              <Clock className={`w-3 h-3 ${countdown.isUrgent ? 'text-amber-500 animate-pulse' : 'text-cyan-500'}`} />
              <span>{countdown.isStartingNow ? 'Starting Now' : 'Starts In'}</span>
            </div>
            {countdown.isStartingNow ? (
              <p className="text-center text-sm font-black text-emerald-600 dark:text-emerald-400 animate-pulse">
                Refresh to join…
              </p>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                {countdown.days > 0 && (
                  <>
                    <CountdownUnit value={countdown.days} label="Days" urgent={countdown.isUrgent} />
                    <span className="text-slate-300 dark:text-slate-700 font-black pb-3">:</span>
                  </>
                )}
                <CountdownUnit value={countdown.hours} label="Hrs" urgent={countdown.isUrgent} />
                <span className="text-slate-300 dark:text-slate-700 font-black pb-3">:</span>
                <CountdownUnit value={countdown.minutes} label="Min" urgent={countdown.isUrgent} />
                <span className="text-slate-300 dark:text-slate-700 font-black pb-3">:</span>
                <CountdownUnit value={countdown.seconds} label="Sec" urgent={countdown.isUrgent} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-200/60 dark:border-[#1e2e56] flex justify-between items-center">
        <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300 font-mono">
          {mockTest.status === 'UPCOMING'
            ? `${mockTest.quiz?.durationMinutes ?? '—'} min • ${mockTest.quiz?.totalQuestions ?? '—'} Qs`
            : mockTest._count?.participants != null
              ? `${mockTest._count.participants} joined`
              : ''}
        </span>
        {mockTest.status === 'COMPLETED' && !myAttempt ? (
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" />
            Test Completed
          </span>
        ) : (
          <Button
            variant={mockTest.status === 'UPCOMING' ? 'outline' : 'gold'}
            size="sm"
            className="font-bold cursor-pointer flex items-center"
            onClick={handleClick}
          >
            {isLocked && !hasSubmitted && <Lock className="w-3.5 h-3.5 mr-1.5" />}
            <span>
              {mockTest.status === 'LIVE'
                ? hasSubmitted
                  ? 'View Live Rank List'
                  : canResume
                    ? 'Resume Test'
                    : isLocked
                      ? `Unlock & Start (₹${mockTest.access?.price ?? 0})`
                      : 'Join & Start'
                : mockTest.status === 'COMPLETED'
                  ? 'View Final Rank List'
                  : isLocked
                    ? `Unlock Test (₹${mockTest.access?.price ?? 0})`
                    : 'View Details'}
            </span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        )}
      </div>
    </Card>
  );
}
