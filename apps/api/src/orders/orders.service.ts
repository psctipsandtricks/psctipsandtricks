import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async createOrder(userId: string, data: CreateOrderDto) {
    const razorpayOrderId = `order_sim_${Date.now()}`;

    return this.prisma.order.create({
      data: {
        userId,
        bookId: data.bookId || null,
        quizId: data.quizId || null,
        amount: data.amount,
        currency: 'INR',
        status: 'PENDING',
        razorpayOrderId,
      },
    });
  }

  async verifyPayment(orderId: string, razorpayPaymentId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'SUCCESS',
        razorpayPaymentId,
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

  async findAll() {
    return this.prisma.order.findMany({
      include: {
        user: { select: { name: true, email: true } },
        book: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
