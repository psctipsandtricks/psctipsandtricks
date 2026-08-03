import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QuizzesService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('quiz-submissions') private quizQueue: Queue,
  ) {}

  async findAll() {
    return this.prisma.quiz.findMany({
      include: {
        _count: { select: { questions: true, submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { questions: true },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  async create(data: any) {
    const { questions, ...quizData } = data;
    return this.prisma.quiz.create({
      data: {
        ...quizData,
        questions: questions ? { create: questions } : undefined,
      },
    });
  }

  async submitQuiz(userId: string, quizId: string, payload: any) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unattempted = 0;

    quiz.questions.forEach((q) => {
      const userAns = payload.answers.find((a: any) => a.questionId === q.id);
      if (!userAns || userAns.selectedOptionIndex === undefined || userAns.selectedOptionIndex === null) {
        unattempted++;
      } else if (userAns.selectedOptionIndex === q.correctOptionIndex) {
        score += q.marks;
        correctCount++;
      } else {
        score -= 0.33; // negative marking
        wrongCount++;
      }
    });

    const passed = score >= quiz.passingMarks;

    const submission = await this.prisma.quizSubmission.create({
      data: {
        quizId,
        userId,
        score: Math.max(0, Math.round(score * 100) / 100),
        totalMarks: quiz.totalMarks,
        passed,
        correctAnswers: correctCount,
        wrongAnswers: wrongCount,
        unattempted,
        timeTakenSeconds: payload.timeTakenSeconds || 0,
        answers: payload.answers || [],
      },
    });

    // Enqueue background processing for rank generation
    await this.quizQueue.add('calculate-rank', {
      submissionId: submission.id,
      quizId,
      userId,
    });

    return submission;
  }

  async getLeaderboard(quizId: string) {
    const submissions = await this.prisma.quizSubmission.findMany({
      where: { quizId },
      include: { user: { select: { name: true, avatarUrl: true } } },
      orderBy: [{ score: 'desc' }, { timeTakenSeconds: 'asc' }],
      take: 20,
    });

    return submissions.map((sub, idx) => ({
      rank: idx + 1,
      userId: sub.userId,
      userName: sub.user.name,
      avatarUrl: sub.user.avatarUrl,
      score: sub.score,
      timeTakenSeconds: sub.timeTakenSeconds,
    }));
  }
}
