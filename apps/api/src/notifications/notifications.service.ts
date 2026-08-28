import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseQueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { BROADCAST_TOPIC, FcmClient } from './fcm.client';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: SupabaseQueueService,
    private storageService: StorageService,
    private fcm: FcmClient,
  ) {}

  async sendNotification(data: SendNotificationDto, sentById: string) {
    let scheduledDate: Date | null = null;
    if (data.scheduledFor) {
      const parsed = new Date(data.scheduledFor);
      if (!isNaN(parsed.getTime())) {
        scheduledDate = parsed;
      }
    }

    const isScheduled = scheduledDate && scheduledDate.getTime() > Date.now();
    const status = isScheduled ? 'SCHEDULED' : 'SENT';

    const notification = await this.prisma.notification.create({
      data: {
        title: data.title,
        body: data.body,
        userId: data.userId || null,
        target: data.target || 'all',
        type: data.type || 'ANNOUNCEMENT',
        status,
        scheduledFor: scheduledDate,
        route: data.route?.trim() || null,
        imageUrl: data.imageUrl?.trim() || null,
        sentById,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        sentBy: { select: { id: true, name: true } },
      },
    });

    // If not scheduled for future, enqueue immediate push dispatch
    if (!isScheduled) {
      try {
        await this.queueService.send('notifications', {
          id: notification.id,
          title: data.title,
          body: data.body,
          userId: data.userId,
          type: notification.type ?? undefined,
          route: notification.route ?? undefined,
          imageUrl: notification.imageUrl ?? undefined,
        });
      } catch (err) {
        this.logger.warn(`Push delivery enqueue skipped for notification ${notification.id}: ${err}`);
      }
    }

    return notification;
  }

  /**
   * Records the FCM token an installation is currently holding, and which
   * student — if any — is signed in on it.
   *
   * Upsert by token rather than by user: FCM reissues tokens on reinstall and
   * on cache clears, and a shared phone can carry the same token from one
   * student's session into another's. Re-pointing the row keeps the unique
   * token constraint honest and stops a stale row delivering someone else's
   * notifications.
   */
  async registerDevice(userId: string | null, dto: RegisterDeviceDto) {
    const device = await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: {
        token: dto.token,
        userId,
        platform: dto.platform ?? 'android',
        appVersion: dto.appVersion,
      },
      update: {
        userId,
        platform: dto.platform ?? 'android',
        appVersion: dto.appVersion,
        lastSeenAt: new Date(),
      },
      select: { id: true },
    });
    return { id: device.id, registered: true };
  }

  /**
   * Delivers a queued notification to devices.
   *
   * Called by the queue processor rather than by the send endpoint, so a slow
   * or unreachable FCM never holds up the admin's request. Throwing here is
   * meaningful: the poller retries, then archives after five attempts.
   */
  async deliverPush(message: {
    id: string;
    title: string;
    body: string;
    userId?: string;
    type?: string;
    route?: string;
    imageUrl?: string;
  }): Promise<void> {
    if (!this.fcm.isConfigured) {
      this.logger.warn(
        `Firebase is not configured — notification ${message.id} was saved but not pushed.`,
      );
      return;
    }

    const payload = {
      title: message.title,
      body: message.body,
      imageUrl: message.imageUrl,
      data: {
        notificationId: message.id,
        type: message.type ?? 'ANNOUNCEMENT',
        // Only sent when set: the app treats an absent route as "open the
        // notifications screen", and an empty string would not be absent.
        ...(message.route ? { route: message.route } : {}),
        ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
      },
    };

    if (!message.userId) {
      await this.fcm.sendToTopic(BROADCAST_TOPIC, payload);
      this.logger.log(`Broadcast notification ${message.id} to topic ${BROADCAST_TOPIC}`);
      return;
    }

    const devices = await this.prisma.deviceToken.findMany({
      where: { userId: message.userId },
      select: { token: true },
    });

    if (devices.length === 0) {
      this.logger.log(`No registered devices for user ${message.userId}; nothing to push.`);
      return;
    }

    const result = await this.fcm.sendToTokens(
      devices.map((d) => d.token),
      payload,
    );

    if (result.staleTokens.length > 0) {
      await this.prisma.deviceToken.deleteMany({
        where: { token: { in: result.staleTokens } },
      });
    }

    this.logger.log(
      `Notification ${message.id}: ${result.sent} delivered, ${result.failed} failed, ` +
        `${result.staleTokens.length} dead tokens pruned.`,
    );

    // Every send failing is a systemic problem (bad credentials, FCM down)
    // rather than a handful of dead phones — worth a retry.
    if (result.sent === 0 && result.failed > result.staleTokens.length) {
      throw new Error(`Every push for notification ${message.id} failed.`);
    }
  }

  async getUserNotifications(userId: string) {
    const now = new Date();
    return this.prisma.notification.findMany({
      where: {
        OR: [{ userId }, { target: 'all' }],
        AND: [
          {
            OR: [
              { status: 'SENT' },
              { scheduledFor: null },
              { scheduledFor: { lte: now } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  /**
   * What the composer has sent or scheduled recently, newest first.
   *
   * Includes the recipient and the sender so an admin can see at a glance
   * whether a notice went to everyone or to one student, and who sent it.
   */
  async listSentNotifications(limit = 100) {
    return this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      include: {
        user: { select: { id: true, name: true, email: true } },
        sentBy: { select: { id: true, name: true } },
      },
    });
  }

  async deleteNotification(id: string) {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Notification not found');
    return this.prisma.notification.delete({ where: { id } });
  }

  /**
   * Dispatches any scheduled notifications whose scheduled time has passed.
   */
  async processDueScheduledNotifications(): Promise<void> {
    try {
      const now = new Date();
      const due = await this.prisma.notification.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledFor: { lte: now },
        },
        take: 10,
      });

      for (const notif of due) {
        try {
          await this.prisma.notification.update({
            where: { id: notif.id },
            data: { status: 'SENT' },
          });

          await this.queueService.send('notifications', {
            id: notif.id,
            title: notif.title,
            body: notif.body,
            userId: notif.userId ?? undefined,
            type: notif.type ?? undefined,
            route: notif.route ?? undefined,
            imageUrl: notif.imageUrl ?? undefined,
          });
          this.logger.log(`Dispatched scheduled push notification ${notif.id}: "${notif.title}"`);
        } catch (err) {
          this.logger.error(`Failed processing scheduled notification ${notif.id}:`, err);
        }
      }
    } catch (err) {
      this.logger.error('Failed to fetch due scheduled notifications:', err);
    }
  }

  /**
   * Whether a push sent right now would actually reach a phone.
   *
   * The composer shows this up front: without it an admin sends into a
   * deployment with no Firebase credentials, sees "sent", and has no way to
   * tell that nothing was delivered.
   */
  async getPushStatus() {
    const [devices, students] = await Promise.all([
      this.prisma.deviceToken.count(),
      this.prisma.deviceToken
        .findMany({ where: { userId: { not: null } }, distinct: ['userId'], select: { userId: true } })
        .then((rows) => rows.length),
    ]);

    return {
      configured: this.fcm.isConfigured,
      devices,
      students,
    };
  }

  async listAnnouncements() {
    return this.prisma.announcementPopup.findMany({
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getActiveAnnouncements() {
    const now = new Date();
    return this.prisma.announcementPopup.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createAnnouncement(dto: CreateAnnouncementDto) {
    let orderIndex = dto.orderIndex;
    if (orderIndex === undefined || orderIndex === null) {
      const highest = await this.prisma.announcementPopup.findFirst({
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
      });
      orderIndex = (highest?.orderIndex ?? -1) + 1;
    }

    return this.prisma.announcementPopup.create({
      data: {
        title: dto.title,
        message: dto.message,
        imageUrl: dto.imageUrl,
        buttonText: dto.buttonText,
        redirectUrl: dto.redirectUrl,
        backgroundColor: dto.backgroundColor,
        isActive: dto.isActive ?? true,
        orderIndex,
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

  async reorderAnnouncements(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.announcementPopup.update({
          where: { id },
          data: { orderIndex: index },
        }),
      ),
    );
    return this.listAnnouncements();
  }

  async removeAnnouncement(id: string) {
    const existing = await this.prisma.announcementPopup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    return this.prisma.announcementPopup.delete({ where: { id } });
  }

  async uploadBannerImage(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No image file was provided.');
    const url = await this.storageService.upload(
      'book-covers',
      `announcements/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    return { url };
  }

  async uploadNotificationImage(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No image file was provided.');
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const url = await this.storageService.upload(
      'book-covers',
      `notifications/${Date.now()}-${cleanName}`,
      file.buffer,
      file.mimetype,
    );
    return { url };
  }
}
