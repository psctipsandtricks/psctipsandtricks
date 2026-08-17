import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardAnalytics() {
    const [totalUsers, totalQuizzes, totalBooks, totalOrders, revenueResult] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.quiz.count(),
      this.prisma.book.count(),
      this.prisma.order.count({ where: { status: 'SUCCESS' } }),
      this.prisma.order.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
      }),
    ]);

    const recentSubmissions = await this.prisma.quizSubmission.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        quiz: { select: { title: true } },
      },
    });

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
