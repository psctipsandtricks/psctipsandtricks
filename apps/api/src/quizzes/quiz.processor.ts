import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Processor('quiz-submissions')
@Injectable()
export class QuizProcessor extends WorkerHost {
  private readonly logger = new Logger(QuizProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing quiz submission job ${job.id} for quiz ${job.data.quizId}`);
    const { submissionId, quizId, userId } = job.data;

    // Simulate background rank calculation & leaderboard update
    const submissions = await this.prisma.quizSubmission.findMany({
      where: { quizId },
      orderBy: [
        { score: 'desc' },
        { timeTakenSeconds: 'asc' },
      ],
    });

    const rank = submissions.findIndex((s) => s.id === submissionId) + 1;
    this.logger.log(`Calculated rank for submission ${submissionId}: #${rank} out of ${submissions.length}`);

    return { submissionId, rank, totalParticipants: submissions.length };
  }
}
