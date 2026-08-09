import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
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

    const submissions = await this.prisma.quizSubmission.findMany({
      where: { quizId },
      include: { user: { select: { name: true, avatarUrl: true } } },
      orderBy: [{ score: 'desc' }, { timeTakenSeconds: 'asc' }],
    });

    const rank = submissions.findIndex((s) => s.id === submissionId) + 1;
    this.logger.log(`Calculated rank for submission ${submissionId}: #${rank} out of ${submissions.length}`);

    if (quiz?.isLiveMock) {
      const leaderboard = submissions.slice(0, 20).map((sub, idx) => ({
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
