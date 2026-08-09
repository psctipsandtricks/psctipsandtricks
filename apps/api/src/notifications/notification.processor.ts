import { Injectable, Logger } from '@nestjs/common';
import { QueuePoller } from '../queue/queue-poller';
import { SupabaseQueueService } from '../queue/queue.service';

interface SendPushMessage {
  id: string;
  title: string;
  body: string;
  userId?: string;
}

@Injectable()
export class NotificationProcessor extends QueuePoller<SendPushMessage> {
  protected readonly queueName = 'notifications';
  protected readonly logger = new Logger(NotificationProcessor.name);

  constructor(queueService: SupabaseQueueService) {
    super(queueService);
  }

  protected async handle(message: SendPushMessage): Promise<void> {
    this.logger.log(`Dispatching push notification ${message.id}: ${message.title}`);
    // Simulate FCM Push Notification dispatch
  }
}
