import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseQueueService } from '../queue/queue.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: SupabaseQueueService,
  ) {}

  async sendNotification(data: SendNotificationDto, sentById: string) {
    const notification = await this.prisma.notification.create({
      data: {
        title: data.title,
        body: data.body,
        userId: data.userId || null,
        target: data.target || 'all',
        type: data.type || 'ANNOUNCEMENT',
        sentById,
      },
    });

    // The notification row is already saved; a queue outage must not turn a
    // successful send into an error for the admin. Delivery is retried by the
    // processor's own polling.
    try {
      await this.queueService.send('notifications', {
        id: notification.id,
        title: data.title,
        body: data.body,
        userId: data.userId,
      });
    } catch (err) {
      this.logger.warn(`Push delivery enqueue skipped for notification ${notification.id}: ${err}`);
    }

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

  async listAnnouncements() {
    return this.prisma.announcementPopup.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getActiveAnnouncements() {
    const now = new Date();
    return this.prisma.announcementPopup.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAnnouncement(dto: CreateAnnouncementDto) {
    return this.prisma.announcementPopup.create({
      data: {
        title: dto.title,
        message: dto.message,
        imageUrl: dto.imageUrl,
        isActive: dto.isActive ?? true,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async updateAnnouncement(id: string, dto: UpdateAnnouncementDto) {
    const existing = await this.prisma.announcementPopup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    return this.prisma.announcementPopup.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async removeAnnouncement(id: string) {
    const existing = await this.prisma.announcementPopup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    return this.prisma.announcementPopup.delete({ where: { id } });
  }
}
