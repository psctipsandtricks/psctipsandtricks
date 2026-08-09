import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SupabaseQueueService } from './queue.service';

const POLL_INTERVAL_MS = 3000;
const DRAIN_INTERVAL_MS = 250;
const VISIBILITY_TIMEOUT_SECONDS = 30;
const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 5;

/**
 * Polls a pgmq queue on an interval and hands each message to `handle`.
 * Messages are deleted on success; after MAX_ATTEMPTS failed attempts a
 * message is archived instead of retried forever.
 */
export abstract class QueuePoller<T = unknown> implements OnModuleInit, OnModuleDestroy {
  protected abstract readonly queueName: string;
  protected abstract readonly logger: Logger;

  private stopped = false;
  private timer?: NodeJS.Timeout;

  constructor(protected readonly queueService: SupabaseQueueService) {}

  protected abstract handle(message: T): Promise<void>;

  async onModuleInit() {
    await this.queueService.ensureQueue(this.queueName);
    this.scheduleNext(0);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private scheduleNext(delayMs: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.poll(), delayMs);
  }

  private async poll() {
    let hadMessages = false;
    try {
      const messages = await this.queueService.read<T>(this.queueName, VISIBILITY_TIMEOUT_SECONDS, BATCH_SIZE);
      hadMessages = messages.length > 0;
      for (const msg of messages) {
        try {
          await this.handle(msg.message);
          await this.queueService.delete(this.queueName, msg.msgId);
        } catch (err) {
          this.logger.error(`Failed processing message ${msg.msgId} (attempt ${msg.readCount}): ${err}`);
          if (msg.readCount >= MAX_ATTEMPTS) {
            this.logger.error(`Giving up on message ${msg.msgId} after ${msg.readCount} attempts — archiving`);
            await this.queueService.archive(this.queueName, msg.msgId);
          }
        }
      }
    } catch (err) {
      this.logger.error(`Poll failed for queue "${this.queueName}": ${err}`);
    } finally {
      this.scheduleNext(hadMessages ? DRAIN_INTERVAL_MS : POLL_INTERVAL_MS);
    }
  }
}
