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
      // Highest score first; a tie goes to whoever finished in less wall-clock
      // time (millisecond precision), with `submittedAt` as a last resort for
      // a genuine dead heat or a submission from before `timeTakenMs` existed.
      // Mirrors `MockTestsService.getLeaderboard` and `.findOne` exactly, since
      // this is what actually gets persisted to `rank` and broadcast live.
      orderBy: [
        { score: 'desc' },
        { timeTakenMs: { sort: 'asc', nulls: 'last' } },
        { submittedAt: 'asc' },
      ],
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

    const endsAt = mockTest.endsAt
      ? new Date(mockTest.endsAt)
      : new Date(mockTest.scheduledAt.getTime() + 24 * 60 * 60_000);
    const now = new Date();
    if (now >= endsAt) {
      await this.prisma.mockTest.update({ where: { id: mockTestId }, data: { status: MockTestStatus.COMPLETED } });
      this.logger.log(`Mock test ${mockTestId} marked COMPLETED`);
    } else if (mockTest.status === MockTestStatus.UPCOMING && now >= mockTest.scheduledAt) {
      await this.prisma.mockTest.update({ where: { id: mockTestId }, data: { status: MockTestStatus.LIVE } });
    }
  }
}
