import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('notifications') private notifQueue: Queue,
  ) {}

  async sendNotification(data: { title: string; body: string; userId?: string; type?: string }) {
    const notification = await this.prisma.notification.create({
      data: {
        title: data.title,
        body: data.body,
        userId: data.userId || null,
        type: data.type || 'ANNOUNCEMENT',
      },
    });

    await this.notifQueue.add('send-push', {
      id: notification.id,
      title: data.title,
      body: data.body,
      userId: data.userId,
    });

    return notification;
  }

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: {
        OR: [{ userId }, { userId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
