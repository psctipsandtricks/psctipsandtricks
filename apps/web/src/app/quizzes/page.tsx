'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardTitle, CardDescription, Button, Badge, Input, Pagination } from '@psc/ui';
import { Timer, Award, Folder, Lock, Unlock, ArrowRight, Search, Filter, History, Radio, CheckCircle2, Trophy, Calendar, Clock } from 'lucide-react';
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
  if (diffMs <= 0) return 'Starting now…';
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `Starts in ${days}d ${hours}h`;
  if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Starts in ${minutes}m ${seconds}s`;
  return `Starts in ${seconds}s`;
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

  const handleStartTest = (quizId: string) => {
    const targetUrl = `/quizzes/${quizId}`;
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
          folderName: q.folderName || 'Root / No Folder',
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

  const highlightedMockTests = [...mockTests]
    .filter((mt) => mt.status !== 'COMPLETED')
    .concat(
      [...mockTests]
        .filter((mt) => mt.status === 'COMPLETED')
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
        .slice(0, 3),
    )
    .sort((a, b) => {
      const rank = (s: string) => (s === 'LIVE' ? 0 : s === 'UPCOMING' ? 1 : 2);
      const rankDiff = rank(a.status) - rank(b.status);
      if (rankDiff !== 0) return rankDiff;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });

  const folders = Array.from(new Set(quizzes.map((q) => q.folderName)));

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {highlightedMockTests.map((mt) => (
              <MockTestCard key={mt.id} mockTest={mt} myAttempt={myMockAttempts[mt.id]} router={router} user={user} />
            ))}
          </div>
        </div>
      )}

      {/* Folder Navigation Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setActiveFolderTab('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
            activeFolderTab === 'ALL'
              ? 'bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-500 text-white dark:text-slate-950 font-extrabold shadow-md shadow-cyan-500/20 border border-cyan-500/30'
              : 'bg-white dark:bg-[#091124] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1e2e56] hover:bg-slate-100 dark:hover:bg-[#0c152e] hover:border-cyan-500/40'
          }`}
        >
          <Folder className="w-3.5 h-3.5 text-cyan-400" />
          <span>All Folders ({quizzes.length})</span>
        </button>

        {folders.map((folder) => {
          const count = quizzes.filter((q) => q.folderName === folder).length;
          return (
            <button
              key={folder}
              onClick={() => setActiveFolderTab(folder)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
                activeFolderTab === folder
                  ? 'bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-500 text-white dark:text-slate-950 font-extrabold shadow-md shadow-cyan-500/20 border border-cyan-500/30'
                  : 'bg-white dark:bg-[#091124] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1e2e56] hover:bg-slate-100 dark:hover:bg-[#0c152e] hover:border-cyan-500/40'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
              <span>
                {folder === 'Root / No Folder' ? '🏠 Root Level' : folder} ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Quiz Cards Grid */}
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
            <Card key={quiz.id} hoverEffect className="flex flex-col justify-between space-y-4 bg-white dark:bg-[#0c152e] border border-slate-200/90 dark:border-[#1e2e56] shadow-xs hover:shadow-xl hover:border-cyan-500/40 transition-all duration-300 p-5 rounded-2xl">
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
                  onClick={() => handleStartTest(quiz.id)}
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
  const hasSubmitted = !!myAttempt?.submittedAt;

  const handleClick = () => {
    const targetUrl = `/mock-tests/${mockTest.id}`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  return (
    <Card hoverEffect className="flex flex-col justify-between space-y-4 bg-white dark:bg-[#0c152e] border border-cyan-500/30 dark:border-[#1e2e56] shadow-sm hover:shadow-xl hover:border-cyan-400 transition-all duration-300 p-5 rounded-2xl">
      <div className="space-y-3">
        <div className="flex justify-between items-center gap-2">
          {mockTest.status === 'LIVE' ? (
            <Badge variant="gold" className="font-bold flex items-center gap-1 animate-pulse">
              <Radio className="w-3 h-3" />
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
            <Badge variant="success" className="text-[10px] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>{hasSubmitted ? (myAttempt.rank ? `Rank #${myAttempt.rank}` : 'Attended') : 'Joined'}</span>
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

        {mockTest.status === 'UPCOMING' && (
          <div className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
            <Clock className="w-4 h-4 text-cyan-500 shrink-0 animate-pulse" />
            <span className="text-sm sm:text-base font-black font-mono text-cyan-700 dark:text-cyan-300 tracking-wide">
              {countdown}
            </span>
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
        <Button
          variant={mockTest.status === 'UPCOMING' ? 'outline' : 'gold'}
          size="sm"
          className="font-bold cursor-pointer"
          onClick={handleClick}
        >
          <span>
            {mockTest.status === 'LIVE'
              ? hasSubmitted
                ? 'View Live Rank List'
                : 'Join & Start'
              : mockTest.status === 'COMPLETED'
                ? 'View Final Rank List'
                : 'View Details'}
          </span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </Card>
  );
}
