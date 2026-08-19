import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { MockTestStatus, Prisma } from '@prisma/client';
import { QueuePoller } from '../queue/queue-poller';
import { SupabaseQueueService } from '../queue/queue.service';

interface RecomputeRankMessage {
  mockTestId: string;
}

@Injectable()
export class MockTestProcessor extends QueuePoller<RecomputeRankMessage> {
  protected readonly queueName = 'mock-tests';
  protected readonly logger = new Logger(MockTestProcessor.name);

  constructor(
    queueService: SupabaseQueueService,
    private prisma: PrismaService,
    private chatGateway: ChatGateway,
  ) {
    super(queueService);
  }

  protected async handle({ mockTestId }: RecomputeRankMessage): Promise<void> {
    this.logger.log(`Recomputing rank list for mock test ${mockTestId}`);

    const participants = await this.prisma.mockTestParticipant.findMany({
      where: { mockTestId, submittedAt: { not: null } },
      include: { user: { select: { name: true, avatarUrl: true } } },
      orderBy: [{ score: 'desc' }],
    });

    // A single bulk UPDATE...FROM(VALUES...) instead of one round trip per
    // participant — a live mock test with hundreds/thousands of submitters
    // otherwise means hundreds/thousands of sequential UPDATEs on every
    // submission's rank recompute.
    if (participants.length > 0) {
      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "MockTestParticipant" AS p
          SET rank = v.rank
          FROM (VALUES ${Prisma.join(
            participants.map((p, idx) => Prisma.sql`(${p.id}::text, ${idx + 1}::int)`),
          )}) AS v(id, rank)
          WHERE p.id = v.id
        `,
      );
    }

    const leaderboard = participants.slice(0, 50).map((p, idx) => ({
      rank: idx + 1,
      userId: p.userId,
      userName: p.user.name,
      avatarUrl: p.user.avatarUrl,
      score: p.score,
    }));

    this.chatGateway.broadcastMockTestRankUpdate(mockTestId, leaderboard);

    const mockTest = await this.prisma.mockTest.findUnique({
      where: { id: mockTestId },
      include: { quiz: { select: { durationMinutes: true } } },
    });
    if (!mockTest || mockTest.status === MockTestStatus.COMPLETED) return;

    const endsAt = new Date(mockTest.scheduledAt.getTime() + mockTest.quiz.durationMinutes * 60_000);
    const now = new Date();
    if (now >= endsAt) {
      await this.prisma.mockTest.update({ where: { id: mockTestId }, data: { status: MockTestStatus.COMPLETED } });
      this.logger.log(`Mock test ${mockTestId} marked COMPLETED`);
    } else if (mockTest.status === MockTestStatus.UPCOMING && now >= mockTest.scheduledAt) {
      await this.prisma.mockTest.update({ where: { id: mockTestId }, data: { status: MockTestStatus.LIVE } });
    }
  }
}
