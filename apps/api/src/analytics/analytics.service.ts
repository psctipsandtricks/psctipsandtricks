import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TtlCache } from '../common/ttl-cache';

const USAGE_STATS_TTL_MS = 30_000;
const SUBJECT_PERFORMANCE_TTL_MS = 30_000;
const STUDENT_DASHBOARD_TTL_MS = 15_000;
const ADMIN_DASHBOARD_SUMMARY_TTL_MS = 30_000;

@Injectable()
export class AnalyticsService {
  private readonly usageStatsCache = new TtlCache<Awaited<ReturnType<AnalyticsService['computeUsageStats']>>>();
  private readonly subjectPerformanceCache = new TtlCache<Awaited<ReturnType<AnalyticsService['computeSubjectPerformance']>>>();
  private readonly studentDashboardCache = new TtlCache<Awaited<ReturnType<AnalyticsService['computeStudentDashboard']>>>();
  private readonly adminDashboardSummaryCache = new TtlCache<Awaited<ReturnType<AnalyticsService['computeAdminDashboardSummary']>>>();

  constructor(private prisma: PrismaService) {}

  async getUsageStats() {
    const cached = this.usageStatsCache.get('usageStats');
    if (cached) return cached;
    const result = await this.computeUsageStats();
    this.usageStatsCache.set('usageStats', result, USAGE_STATS_TTL_MS);
    return result;
  }

  private async computeUsageStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, activeUsers30d, totalAttempts, totalBookReads, totalOrders, revenue] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.quizSubmission.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: thirtyDaysAgo } },
      }).then((rows) => rows.length),
      this.prisma.quizSubmission.count(),
      this.prisma.readingProgress.count(),
      this.prisma.order.count({ where: { status: 'SUCCESS' } }),
      this.prisma.order.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
    ]);

    return {
      totalUsers,
      activeUsers30d,
      totalQuizAttempts: totalAttempts,
      totalBookReads,
      totalOrders,
      totalRevenue: revenue._sum.amount || 0,
    };
  }

  async getAdminDashboardSummary() {
    const cached = this.adminDashboardSummaryCache.get('adminDashboardSummary');
    if (cached) return cached;
    const result = await this.computeAdminDashboardSummary();
    this.adminDashboardSummaryCache.set('adminDashboardSummary', result, ADMIN_DASHBOARD_SUMMARY_TTL_MS);
    return result;
  }

  private async computeAdminDashboardSummary() {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      registeredStudents,
      totalOrders,
      totalRevenueResult,
      monthlyRevenueResult,
      recentOrders,
      sixMonthOrders,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.order.count({ where: { status: 'SUCCESS' } }),
      this.prisma.order.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      this.prisma.order.aggregate({
        where: {
          status: 'SUCCESS',
          createdAt: { gte: startOfCurrentMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          book: { select: { title: true } },
          quiz: { select: { title: true } },
        },
      }),
      this.prisma.order.findMany({
        where: {
          status: 'SUCCESS',
          createdAt: { gte: sixMonthsAgo },
        },
        select: {
          amount: true,
          createdAt: true,
        },
      }),
    ]);

    const monthsNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const revenueChartData = Array.from({ length: 6 }).map((_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      const mName = monthsNames[d.getMonth()];
      const mYear = d.getFullYear();
      const mMonth = d.getMonth();

      const rev = sixMonthOrders
        .filter((o) => {
          const od = new Date(o.createdAt);
          return od.getMonth() === mMonth && od.getFullYear() === mYear;
        })
        .reduce((sum, o) => sum + (o.amount || 0), 0);

      return { month: mName, revenue: rev };
    });

    return {
      totalRevenue: totalRevenueResult._sum.amount || 0,
      totalOrders,
      monthlyRevenue: monthlyRevenueResult._sum.amount || 0,
      registeredStudents,
      revenueChartData,
      recentOrders,
    };
  }

  /**
   * Everything the student's personal dashboard renders, in one round trip.
   *
   * Submitting a mock test writes two rows — a MockTestParticipant (score and
   * rank) and a QuizSubmission (the per-question breakdown) — with no foreign
   * key between them. They are correlated below on quizId plus a submittedAt
   * within a minute of each other, so a mock test appears once with both its
   * rank and its accuracy rather than twice with half the numbers each.
   */
  async getStudentDashboard(userId: string) {
    const cached = this.studentDashboardCache.get(userId);
    if (cached) return { ...cached, generatedAt: new Date() };

    const result = await this.computeStudentDashboard(userId);
    this.studentDashboardCache.set(userId, result, STUDENT_DASHBOARD_TTL_MS);
    return result;
  }

  private async computeStudentDashboard(userId: string) {
    const now = Date.now();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

    const [submissions, participants, upcoming, readingRows] = await Promise.all([
      this.prisma.quizSubmission.findMany({
        where: { userId, attemptStatus: 'COMPLETED' },
        include: {
          quiz: { select: { id: true, title: true, passingMarks: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.mockTestParticipant.findMany({
        where: { userId, submittedAt: { not: null } },
        include: { mockTest: { select: { id: true, title: true, quizId: true, scheduledAt: true } } },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.mockTest.findMany({
        where: { status: { in: ['UPCOMING', 'LIVE'] }, quiz: { totalQuestions: { gt: 0 } } },
        include: {
          quiz: { select: { title: true, durationMinutes: true, totalMarks: true, totalQuestions: true } },
          _count: { select: { participants: true } },
          participants: { where: { userId }, select: { id: true, submittedAt: true } },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
      }),
      this.prisma.readingProgress.findMany({
        where: { userId, book: { isPublished: true } },
        include: {
          book: { select: { id: true, title: true, author: true, coverUrl: true, category: true } },
          chapter: { select: { id: true, title: true } },
          topic: { select: { id: true, title: true } },
        },
        orderBy: { lastReadAt: 'desc' },
        take: 12,
      }),
    ]);

    const submittedAtOf = (s: (typeof submissions)[number]) => (s.submittedAt ?? s.createdAt).getTime();

    // Claim each participant row against at most one submission so two attempts
    // at the same mock test cannot both bind to the same breakdown.
    const claimed = new Set<string>();
    const mockRowFor = (s: (typeof submissions)[number]) => {
      const at = submittedAtOf(s);
      const match = participants.find(
        (p) =>
          !claimed.has(p.id) &&
          p.mockTest?.quizId === s.quizId &&
          p.submittedAt !== null &&
          Math.abs(p.submittedAt.getTime() - at) <= 60 * 1000,
      );
      if (match) claimed.add(match.id);
      return match;
    };

    const attempts = submissions.map((s) => {
      const mock = mockRowFor(s);
      const attempted = s.correctAnswers + s.wrongAnswers;
      const totalMarks = s.totalMarks || 0;
      const percentage =
        s.percentage || (totalMarks > 0 ? Math.round((s.score / totalMarks) * 100 * 100) / 100 : 0);

      return {
        id: s.id,
        quizId: s.quizId,
        title: mock?.mockTest?.title || s.quiz?.title || 'Practice Quiz',
        category: 'Quiz',
        isMockTest: !!mock,
        mockTestId: mock?.mockTest?.id ?? null,
        score: s.score,
        totalMarks,
        percentage,
        // Accuracy is correct-out-of-attempted. Submissions written before the
        // breakdown was recorded have no attempted count, so they fall back to
        // the score percentage rather than reporting a misleading 0%.
        accuracy: attempted > 0 ? Math.round((s.correctAnswers / attempted) * 100) : percentage,
        correctAnswers: s.correctAnswers,
        wrongAnswers: s.wrongAnswers,
        unattempted: s.unattempted,
        rank: mock?.rank ?? null,
        passed: s.passed || percentage >= (s.quiz?.passingMarks ?? 40),
        timeTakenSeconds: s.timeTakenSeconds,
        submittedAt: s.submittedAt ?? s.createdAt,
      };
    });

    const inWindow = (from: Date, to?: Date) =>
      attempts.filter((a) => a.submittedAt >= from && (!to || a.submittedAt < to));

    const thisWeek = inWindow(weekAgo);
    const lastWeek = inWindow(twoWeeksAgo, weekAgo);

    const average = (values: number[]) =>
      values.length ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10 : 0;
    const hoursOf = (rows: typeof attempts) =>
      Math.round((rows.reduce((sum, a) => sum + a.timeTakenSeconds, 0) / 3600) * 10) / 10;

    const ranked = attempts.filter((a) => a.rank !== null) as (typeof attempts[number] & { rank: number })[];
    const bestRank = ranked.length ? Math.min(...ranked.map((a) => a.rank)) : null;
    const previousBestRank = ranked.length > 1 ? Math.min(...ranked.slice(1).map((a) => a.rank)) : null;

    // Consecutive days with at least one submission, counting back from today.
    // A gap of one day is tolerated at the head so the streak does not read as
    // broken until the student has actually missed a full day.
    const dayKeys = new Set(attempts.map((a) => a.submittedAt.toISOString().slice(0, 10)));
    const dayKeyOf = (offset: number) =>
      new Date(now - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let streakDays = 0;
    if (dayKeys.has(dayKeyOf(0)) || dayKeys.has(dayKeyOf(1))) {
      let offset = dayKeys.has(dayKeyOf(0)) ? 0 : 1;
      while (dayKeys.has(dayKeyOf(offset))) {
        streakDays++;
        offset++;
      }
    }

    const byCategory = new Map<string, { attempts: number; total: number; correct: number; answered: number }>();
    attempts.forEach((a) => {
      const bucket = byCategory.get(a.category) || { attempts: 0, total: 0, correct: 0, answered: 0 };
      bucket.attempts++;
      bucket.total += a.percentage;
      bucket.correct += a.correctAnswers;
      bucket.answered += a.correctAnswers + a.wrongAnswers;
      byCategory.set(a.category, bucket);
    });

    const subjects = [...byCategory.entries()]
      .map(([category, b]) => ({
        category,
        attempts: b.attempts,
        averagePercent: Math.round((b.total / b.attempts) * 10) / 10,
        accuracyPercent: b.answered > 0 ? Math.round((b.correct / b.answered) * 100) : null,
      }))
      .sort((a, b) => b.averagePercent - a.averagePercent);

    return {
      stats: {
        totalAttempts: attempts.length,
        mockTestsTaken: attempts.filter((a) => a.isMockTest).length,
        attemptsThisWeek: thisWeek.length,
        averagePercent: average(attempts.map((a) => a.percentage)),
        averagePercentThisWeek: average(thisWeek.map((a) => a.percentage)),
        averagePercentLastWeek: average(lastWeek.map((a) => a.percentage)),
        accuracyPercent: average(attempts.map((a) => a.accuracy)),
        bestRank,
        previousBestRank,
        rankedAttempts: ranked.length,
        studyHours: hoursOf(attempts),
        studyHoursThisWeek: hoursOf(thisWeek),
        passedCount: attempts.filter((a) => a.passed).length,
        streakDays,
      },
      // Oldest first so the trend chart reads left to right.
      trend: attempts
        .slice(0, 10)
        .reverse()
        .map((a) => ({
          label: a.title,
          date: a.submittedAt,
          percentage: a.percentage,
          accuracy: a.accuracy,
        })),
      recentAttempts: attempts.slice(0, 8),
      subjects,
      upcomingMockTests: upcoming.map((mt) => ({
        id: mt.id,
        title: mt.title,
        quizTitle: mt.quiz?.title ?? null,
        scheduledAt: mt.scheduledAt,
        status: mt.status,
        durationMinutes: mt.quiz?.durationMinutes ?? null,
        totalQuestions: mt.quiz?.totalQuestions ?? null,
        totalMarks: mt.quiz?.totalMarks ?? null,
        participantCount: mt._count.participants,
        joined: mt.participants.length > 0,
        submitted: mt.participants.some((p) => p.submittedAt !== null),
      })),
      // Books the student has opened in the reader — drives the dashboard's
      // "Continue Reading" list. A row only exists once they've actually read.
      booksInProgress: readingRows.map((row) => {
        const percent = Math.max(0, Math.min(100, Math.round(row.progressPercent)));
        return {
          bookId: row.bookId,
          title: row.book.title,
          author: row.book.author,
          coverUrl: row.book.coverUrl,
          category: row.book.category,
          progressPercent: percent,
          isCompleted: percent >= 100,
          lastChapterTitle: row.chapter?.title ?? null,
          lastTopicTitle: row.topic?.title ?? null,
          lastReadAt: row.lastReadAt,
        };
      }),
      generatedAt: new Date(),
    };
  }

  async getSubjectPerformance() {
    const cached = this.subjectPerformanceCache.get('subjectPerformance');
    if (cached) return cached;
    const result = await this.computeSubjectPerformance();
    this.subjectPerformanceCache.set('subjectPerformance', result, SUBJECT_PERFORMANCE_TTL_MS);
    return result;
  }

  private async computeSubjectPerformance() {
    // Aggregated in SQL (LEFT JOIN so a quiz with zero submissions still
    // appears with zero stats, matching the old behavior) rather than
    // pulling every quiz's entire submission history into Node just to
    // average/count it — that scan only gets more expensive as attempts
    // accumulate, with no query change needed to trigger the slowdown.
    const rows = await this.prisma.$queryRaw<
      { quizId: string; title: string; subject: string; attempts: number; averageScore: number; passRatePercent: number }[]
    >(
      Prisma.sql`
        SELECT
          q.id AS "quizId",
          q.title,
          q.category AS subject,
          COUNT(s.id)::int AS attempts,
          COALESCE(AVG(s.score), 0)::float AS "averageScore",
          COALESCE(COUNT(*) FILTER (WHERE s.passed) * 100.0 / NULLIF(COUNT(s.id), 0), 0)::float AS "passRatePercent"
        FROM "Quiz" q
        LEFT JOIN "QuizSubmission" s ON s."quizId" = q.id
        GROUP BY q.id, q.title, q.category
      `,
    );

    return rows.map((r) => ({
      quizId: r.quizId,
      title: r.title,
      subject: r.subject,
      attempts: r.attempts,
      averageScore: Math.round(r.averageScore * 100) / 100,
      passRatePercent: Math.round(r.passRatePercent * 100) / 100,
    }));
  }
}
