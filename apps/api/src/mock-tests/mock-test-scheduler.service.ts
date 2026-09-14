import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseQueueService } from '../queue/queue.service';
import { MockTestStatus } from '@prisma/client';
import { SyncService } from '../sync/sync.service';
import { ChatGateway } from '../chat/chat.gateway';

const TICK_INTERVAL_MS = 15_000;

/**
 * Periodically sweeps mock tests so status transitions happen on schedule
 * instead of only as a side effect of someone calling join()/submit().
 * Rank recompute + the actual COMPLETED transition happen in
 * MockTestProcessor — this just enqueues that work at the right time.
 */
@Injectable()
export class MockTestSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MockTestSchedulerService.name);
  private timer?: NodeJS.Timeout;
  private stopped = false;

  constructor(
    private prisma: PrismaService,
    private queueService: SupabaseQueueService,
    private syncService: SyncService,
    private chatGateway: ChatGateway,
  ) {}

  onModuleInit() {
    this.scheduleNext(0);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private scheduleNext(delayMs: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), delayMs);
  }

  private async tick() {
    try {
      const now = new Date();

      const transitionResult = await this.prisma.mockTest.updateMany({
        where: { status: MockTestStatus.UPCOMING, scheduledAt: { lte: now } },
        data: { status: MockTestStatus.LIVE },
      });

      if (transitionResult.count > 0) {
        this.syncService.emitEvent({
          domain: 'mockTests',
          action: 'statusChange',
          timestamp: Date.now(),
        });
        this.chatGateway.broadcastContentSync('mockTests');
      }

      const liveTests = await this.prisma.mockTest.findMany({
        where: { status: MockTestStatus.LIVE },
        include: { quiz: { select: { durationMinutes: true } } },
      });

      for (const test of liveTests) {
        const endsAt = test.endsAt
          ? new Date(test.endsAt)
          : new Date(test.scheduledAt.getTime() + 24 * 60 * 60_000);
        if (now >= endsAt) {
          await this.queueService.send('mock-tests', { mockTestId: test.id });
        }
      }
    } catch (err) {
      this.logger.error(`Sweep failed: ${err}`);
    } finally {
      this.scheduleNext(TICK_INTERVAL_MS);
    }
  }
}
