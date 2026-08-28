import { Injectable, Logger } from '@nestjs/common';
import { QueuePoller } from '../queue/queue-poller';
import { SupabaseQueueService } from '../queue/queue.service';
import { NotificationsService } from './notifications.service';

interface SendPushMessage {
  id: string;
  title: string;
  body: string;
  /** Absent for a broadcast, which goes to the FCM topic instead. */
  userId?: string;
  type?: string;
  route?: string;
  imageUrl?: string;
}

/**
 * Delivers queued notifications to devices.
 *
 * Delivery is a queue job rather than part of the send request so an admin's
 * "Send" returns as soon as the row is saved: a per-device FCM round trip for a
 * targeted send, or a topic fan-out for a broadcast, both happen behind them.
 * Failures are retried by the poller and archived after five attempts.
 */
@Injectable()
export class NotificationProcessor extends QueuePoller<SendPushMessage> {
  protected readonly queueName = 'notifications';
  protected readonly logger = new Logger(NotificationProcessor.name);
  private scheduleCheckInterval?: NodeJS.Timeout;

  constructor(
    queueService: SupabaseQueueService,
    private readonly notifications: NotificationsService,
  ) {
    super(queueService);
  }

  override async onModuleInit() {
    await super.onModuleInit();
    void this.notifications.processDueScheduledNotifications();
    this.scheduleCheckInterval = setInterval(() => {
      void this.notifications.processDueScheduledNotifications();
    }, 10000);
  }

  override onModuleDestroy() {
    super.onModuleDestroy();
    if (this.scheduleCheckInterval) clearInterval(this.scheduleCheckInterval);
  }

  protected async handle(message: SendPushMessage): Promise<void> {
    this.logger.log(`Dispatching push notification ${message.id}: ${message.title}`);
    await this.notifications.deliverPush(message);
  }
}
