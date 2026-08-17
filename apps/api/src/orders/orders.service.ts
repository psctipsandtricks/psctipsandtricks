import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import { RazorpayService } from './razorpay.service';

/** Marks an order as admin-granted rather than paid through Razorpay — the admin orders table reads this prefix to show a "Manual" badge. */
export const MANUAL_ORDER_TAG = 'MANUAL_GRANT';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private razorpayService: RazorpayService,
  ) {}

  async createOrder(userId: string, data: CreateOrderDto) {
    let amount = data.amount;

    if (data.quizId) {
      const quiz = await this.prisma.quiz.findUnique({
        where: { id: data.quizId },
        select: { price: true, accessType: true, isPremium: true },
      });
      if (!quiz) throw new NotFoundException('Quiz not found');

      const isPaidQuiz = quiz.accessType === 'PAID' || quiz.isPremium || (quiz.price ?? 0) > 0;
      if (!isPaidQuiz) throw new BadRequestException('This quiz is free — no payment is needed.');

      amount = quiz.price ?? 0;
    } else if (data.bookId) {
      const book = await this.prisma.book.findUnique({
        where: { id: data.bookId },
        select: { price: true, finalPrice: true, isPremium: true },
      });
      if (!book) throw new NotFoundException('Book not found');

      const isPaidBook = book.isPremium || (book.price ?? 0) > 0;
      if (!isPaidBook) throw new BadRequestException('This book is free — no payment is needed.');

      // `finalPrice` already has the book's own discount applied — charging
      // `price` here would bill the student more than the listing showed.
      amount = book.finalPrice ?? book.price ?? 0;
    }

    // Apply coupon discount if provided
    if (data.couponCode) {
      const coupon = await this.prisma.coupon.findUnique({
        where: { code: data.couponCode.toUpperCase() },
      });
      if (coupon && coupon.isActive && coupon.validTill > new Date()) {
        const discountAmount = Math.min(
          (amount * coupon.discountPercent) / 100,
          coupon.maxDiscountAmount,
        );
        amount = Math.max(0, Math.round(amount - discountAmount));
        await this.prisma.coupon.update({
          where: { id: coupon.id },
          data: { usageCount: { increment: 1 } },
        });
      }
    }

    // 1. Create order entry in database
    const localOrder = await this.prisma.order.create({
      data: {
        userId,
        bookId: data.bookId || null,
        quizId: data.quizId || null,
        amount,
        currency: 'INR',
        status: 'PENDING',
      },
    });

    // 2. Create Razorpay order via RazorpayService
    const rzpOrder = await this.razorpayService.createOrder({
      amountInRupees: amount,
      receipt: localOrder.id,
      notes: {
        userId,
        bookId: data.bookId || '',
        quizId: data.quizId || '',
      },
    });

    // 3. Update database record with razorpayOrderId
    const updatedOrder = await this.prisma.order.update({
      where: { id: localOrder.id },
      data: {
        razorpayOrderId: rzpOrder.id,
      },
    });

    return {
      ...updatedOrder,
      razorpayOrderId: rzpOrder.id,
      keyId: rzpOrder.keyId,
      mode: this.razorpayService.getMode(),
      isSimulated: rzpOrder.isSimulated,
    };
  }

  /** Grants a book/quiz to a user without going through Razorpay — for support/testing use, admin- or manageOrders-staff-only. */
  async createManualOrder(grantedByUserId: string, dto: CreateManualOrderDto) {
    if (!dto.bookId && !dto.quizId) {
      throw new BadRequestException('Provide either a bookId or a quizId.');
    }
    if (dto.bookId && dto.quizId) {
      throw new BadRequestException('Provide only one of bookId or quizId, not both.');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!targetUser) throw new NotFoundException('User not found');

    let amount = dto.amount;
    if (dto.bookId) {
      const book = await this.prisma.book.findUnique({
        where: { id: dto.bookId },
        select: { finalPrice: true, price: true },
      });
      if (!book) throw new NotFoundException('Book not found');
      if (amount === undefined) amount = book.finalPrice ?? book.price ?? 0;
    } else if (dto.quizId) {
      const quiz = await this.prisma.quiz.findUnique({ where: { id: dto.quizId }, select: { price: true } });
      if (!quiz) throw new NotFoundException('Quiz not found');
      if (amount === undefined) amount = quiz.price ?? 0;
    }

    const notePart = dto.note ? `_${dto.note.slice(0, 60).replace(/\s+/g, '_')}` : '';
    const order = await this.prisma.order.create({
      data: {
        userId: dto.userId,
        bookId: dto.bookId || null,
        quizId: dto.quizId || null,
        amount: amount ?? 0,
        currency: 'INR',
        status: 'SUCCESS',
        razorpayOrderId: MANUAL_ORDER_TAG,
        razorpayPaymentId: `granted_by_${grantedByUserId}${notePart}`,
      },
      include: {
        user: { select: { name: true, email: true } },
        book: { select: { title: true } },
        quiz: { select: { title: true } },
      },
    });

    await this.prisma.user.update({ where: { id: dto.userId }, data: { isPremium: true } });

    return order;
  }

  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const { orderId, paymentId, razorpayOrderId, razorpaySignature } = dto;

    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');

    // Perform signature verification
    const targetRzpOrderId = razorpayOrderId || order.razorpayOrderId || '';
    const isValidSignature = this.razorpayService.verifyPaymentSignature({
      razorpayOrderId: targetRzpOrderId,
      razorpayPaymentId: paymentId,
      razorpaySignature,
    });

    if (!isValidSignature) {
      throw new BadRequestException('Payment verification failed. Invalid Razorpay signature.');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'SUCCESS',
        razorpayPaymentId: paymentId,
      },
    });

    if (order.userId) {
      await this.prisma.user.update({
        where: { id: order.userId },
        data: { isPremium: true },
      });
    }

    return updated;
  }

  async handleWebhook(rawBody: string, signature: string) {
    const isValid = this.razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    try {
      const payload = JSON.parse(rawBody);
      const event = payload.event;

      if (event === 'order.paid' || event === 'payment.captured') {
        const entity = payload.payload?.payment?.entity || payload.payload?.order?.entity;
        const razorpayOrderId = entity?.order_id || entity?.id;
        const razorpayPaymentId = entity?.id;

        if (razorpayOrderId) {
          const order = await this.prisma.order.findFirst({ where: { razorpayOrderId } });
          if (order && order.status !== 'SUCCESS') {
            await this.prisma.order.update({
              where: { id: order.id },
              data: { status: 'SUCCESS', razorpayPaymentId },
            });
            if (order.userId) {
              await this.prisma.user.update({
                where: { id: order.userId },
                data: { isPremium: true },
              });
            }
          }
        }
      }
      return { status: 'ok' };
    } catch (err: any) {
      throw new BadRequestException(`Webhook handling error: ${err?.message}`);
    }
  }

  async findAll(query?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};

    if (query?.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    if (query?.type && query.type !== 'ALL') {
      if (query.type === 'BOOK') {
        where.bookId = { not: null };
      } else if (query.type === 'QUIZ') {
        where.quizId = { not: null };
      }
    }

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { id: { contains: s, mode: 'insensitive' } },
        { razorpayPaymentId: { contains: s, mode: 'insensitive' } },
        { razorpayOrderId: { contains: s, mode: 'insensitive' } },
        { legacyOrderNumber: { contains: s, mode: 'insensitive' } },
        { user: { name: { contains: s, mode: 'insensitive' } } },
        { user: { email: { contains: s, mode: 'insensitive' } } },
        { user: { phoneNumber: { contains: s, mode: 'insensitive' } } },
        { book: { title: { contains: s, mode: 'insensitive' } } },
        { quiz: { title: { contains: s, mode: 'insensitive' } } },
      ];
    }

    if (query?.page || query?.limit) {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
      const skip = (page - 1) * limit;

      const [total, data, statusGroups] = await Promise.all([
        this.prisma.order.count({ where }),
        this.prisma.order.findMany({
          where,
          include: {
            user: { select: { name: true, email: true, phoneNumber: true, avatarUrl: true } },
            book: { select: { title: true } },
            quiz: { select: { title: true } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.order.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
          _sum: { amount: true },
        }),
      ]);

      let successCount = 0;
      let pendingCount = 0;
      let refundedCount = 0;
      let cancelledCount = 0;
      let failedCount = 0;
      let revenue = 0;

      for (const item of statusGroups) {
        if (item.status === 'SUCCESS') {
          successCount = item._count._all;
          revenue = item._sum.amount || 0;
        } else if (item.status === 'PENDING') {
          pendingCount = item._count._all;
        } else if (item.status === 'REFUNDED') {
          refundedCount = item._count._all;
        } else if (item.status === 'CANCELLED') {
          cancelledCount = item._count._all;
        } else if (item.status === 'FAILED') {
          failedCount = item._count._all;
        }
      }

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        metrics: {
          total,
          successCount,
          pendingCount,
          refundedCount,
          cancelledCount,
          failedCount,
          revenue,
        },
      };
    }

    return this.prisma.order.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phoneNumber: true, avatarUrl: true } },
        book: { select: { title: true } },
        quiz: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateOrder(id: string, dto: { status?: any; amount?: number; description?: string; razorpayPaymentId?: string }) {
    const existing = await this.prisma.order.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.razorpayPaymentId !== undefined ? { razorpayPaymentId: dto.razorpayPaymentId } : {}),
      },
      include: {
        user: { select: { name: true, email: true, phoneNumber: true, avatarUrl: true } },
        book: { select: { title: true } },
        quiz: { select: { title: true } },
      },
    });

    return updated;
  }

  /** A student's own purchase history — "My Orders" on the public site. */
  async findMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        book: { select: { id: true, title: true, coverUrl: true } },
        quiz: { select: { id: true, title: true, isLiveMock: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Completed orders for a user (Admin/Staff view) */
  async findUserOrders(userIdOrEmail: string) {
    return this.prisma.order.findMany({
      where: {
        status: 'SUCCESS',
        OR: [
          { userId: userIdOrEmail },
          { user: { email: { equals: userIdOrEmail, mode: 'insensitive' } } },
        ],
      },
      include: {
        book: { select: { id: true, title: true, coverUrl: true, price: true, finalPrice: true } },
        quiz: { select: { id: true, title: true, isLiveMock: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
