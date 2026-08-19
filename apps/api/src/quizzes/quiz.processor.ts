import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { Prisma } from '@prisma/client';
import { QueuePoller } from '../queue/queue-poller';
import { SupabaseQueueService } from '../queue/queue.service';

interface CalculateRankMessage {
  submissionId: string;
  quizId: string;
  userId: string;
}

@Injectable()
export class QuizProcessor extends QueuePoller<CalculateRankMessage> {
  protected readonly queueName = 'quiz-submissions';
  protected readonly logger = new Logger(QuizProcessor.name);

  constructor(
    queueService: SupabaseQueueService,
    private prisma: PrismaService,
    private chatGateway: ChatGateway,
  ) {
    super(queueService);
  }

  protected async handle({ submissionId, quizId }: CalculateRankMessage): Promise<void> {
    this.logger.log(`Processing quiz submission ${submissionId} for quiz ${quizId}`);

    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });

    // Rank is this submission's 1-based position under the same ORDER BY the
    // old code sorted the full table with in Node (`score desc, timeTakenSeconds
    // asc`) — computed by Postgres via ROW_NUMBER() rather than pulling every
    // submission for this quiz across the wire on every single submit. Must
    // use ROW_NUMBER() (positional, ties broken by whatever order Postgres's
    // sort naturally returns them in) rather than a COUNT of "who scored
    // higher" — a COUNT-based rank gives tied submissions the same rank
    // (skipping the next number), which is a different, non-equivalent
    // ranking scheme from what this queue's `findIndex`-based rank produced.
    const rankRows = await this.prisma.$queryRaw<{ rn: bigint; total: bigint }[]>(
      Prisma.sql`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY score DESC, "timeTakenSeconds" ASC) AS rn, COUNT(*) OVER () AS total
          FROM "QuizSubmission"
          WHERE "quizId" = ${quizId}
        )
        SELECT rn, total FROM ranked WHERE id = ${submissionId}
      `,
    );
    const rank = rankRows[0] ? Number(rankRows[0].rn) : null;
    const total = rankRows[0] ? Number(rankRows[0].total) : 0;
    if (rank === null) return;
    this.logger.log(`Calculated rank for submission ${submissionId}: #${rank} out of ${total}`);

    if (quiz?.isLiveMock) {
      const topSubmissions = await this.prisma.quizSubmission.findMany({
        where: { quizId },
        include: { user: { select: { name: true, avatarUrl: true } } },
        orderBy: [{ score: 'desc' }, { timeTakenSeconds: 'asc' }],
        take: 20,
      });
      const leaderboard = topSubmissions.map((sub, idx) => ({
        rank: idx + 1,
        userId: sub.userId,
        userName: sub.user.name,
        avatarUrl: sub.user.avatarUrl,
        score: sub.score,
        timeTakenSeconds: sub.timeTakenSeconds,
      }));
      this.chatGateway.broadcastRankUpdate(quizId, leaderboard);
    }
  }
}
