import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getUsageStats() {
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

  async getSubjectPerformance() {
    const quizzes = await this.prisma.quiz.findMany({
      select: {
        id: true,
        title: true,
        category: true,
        submissions: { select: { score: true, totalMarks: true, passed: true } },
      },
    });

    return quizzes.map((quiz) => {
      const attempts = quiz.submissions.length;
      const avgScore = attempts
        ? quiz.submissions.reduce((sum, s) => sum + s.score, 0) / attempts
        : 0;
      const passRate = attempts
        ? (quiz.submissions.filter((s) => s.passed).length / attempts) * 100
        : 0;

      return {
        quizId: quiz.id,
        title: quiz.title,
        subject: quiz.category,
        attempts,
        averageScore: Math.round(avgScore * 100) / 100,
        passRatePercent: Math.round(passRate * 100) / 100,
      };
    });
  }
}
