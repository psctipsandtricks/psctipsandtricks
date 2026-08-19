import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TtlCache } from '../common/ttl-cache';

const DASHBOARD_CACHE_TTL_MS = 30_000;

@Injectable()
export class AdminService {
  private readonly cache = new TtlCache<Awaited<ReturnType<AdminService['computeDashboardAnalytics']>>>();

  constructor(private prisma: PrismaService) {}

  async getDashboardAnalytics() {
    const cached = this.cache.get('dashboard');
    if (cached) return cached;

    const result = await this.computeDashboardAnalytics();
    this.cache.set('dashboard', result, DASHBOARD_CACHE_TTL_MS);
    return result;
  }

  private async computeDashboardAnalytics() {
    const [totalUsers, totalQuizzes, totalBooks, totalOrders, revenueResult, recentSubmissions] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.quiz.count(),
        this.prisma.book.count(),
        this.prisma.order.count({ where: { status: 'SUCCESS' } }),
        this.prisma.order.aggregate({
          where: { status: 'SUCCESS' },
          _sum: { amount: true },
        }),
        this.prisma.quizSubmission.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { name: true, email: true } },
            quiz: { select: { title: true } },
          },
        }),
      ]);

    return {
      totalUsers,
      totalQuizzes,
      totalBooks,
      totalOrders,
      totalRevenue: revenueResult._sum.amount || 0,
      recentSubmissions,
    };
  }
}
