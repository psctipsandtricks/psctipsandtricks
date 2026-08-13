import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { RazorpayService } from './razorpay.service';

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

  async findAll() {
    return this.prisma.order.findMany({
      include: {
        user: { select: { name: true, email: true } },
        book: { select: { title: true } },
        quiz: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
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
}
