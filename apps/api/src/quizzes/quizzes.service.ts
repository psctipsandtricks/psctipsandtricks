import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseQueueService } from '../queue/queue.service';
import { Prisma } from '@prisma/client';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@Injectable()
export class QuizzesService {
  constructor(
    private prisma: PrismaService,
    private queueService: SupabaseQueueService,
  ) {}

  async findAll(publishedOnly = false) {
    return this.prisma.quiz.findMany({
      where: publishedOnly ? { isActive: true } : undefined,
      include: {
        questions: true,
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

  async create(data: CreateQuizDto) {
    const { questions, ...quizData } = data;
    return this.prisma.quiz.create({
      data: {
        ...quizData,
        totalQuestions: questions?.length ?? 0,
        questions: questions
          ? {
              create: questions.map((q) => ({
                ...q,
                options: q.options as unknown as Prisma.InputJsonValue,
              })),
            }
          : undefined,
      },
      include: { questions: true },
    });
  }

  async update(id: string, data: CreateQuizDto) {
    const existing = await this.prisma.quiz.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Quiz not found');

    const { questions, ...quizData } = data;

    // Delete existing questions and recreate if questions array is provided
    if (questions) {
      await this.prisma.question.deleteMany({ where: { quizId: id } });
    }

    return this.prisma.quiz.update({
      where: { id },
      data: {
        ...quizData,
        totalQuestions: questions ? questions.length : existing.totalQuestions,
        questions: questions
          ? {
              create: questions.map((q) => ({
                ...q,
                options: q.options as unknown as Prisma.InputJsonValue,
              })),
            }
          : undefined,
      },
      include: { questions: true },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.quiz.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Quiz not found');
    return this.prisma.quiz.delete({ where: { id } });
  }

  async startAttempt(userId: string, quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    // Check if there is already an active IN_PROGRESS attempt
    const activeAttempt = await this.prisma.quizSubmission.findFirst({
      where: { userId, quizId, attemptStatus: 'IN_PROGRESS' },
      orderBy: { startedAt: 'desc' },
    });

    if (activeAttempt) {
      return activeAttempt;
    }

    // Count previous attempts to compute attempt number
    const count = await this.prisma.quizSubmission.count({
      where: { userId, quizId },
    });

    const newAttempt = await this.prisma.quizSubmission.create({
      data: {
        quizId,
        userId,
        attemptNumber: count + 1,
        attemptStatus: 'IN_PROGRESS',
        totalMarks: quiz.totalMarks,
        totalQuestions: quiz.totalQuestions || quiz.questions.length,
        score: 0,
        percentage: 0,
        passed: false,
        correctAnswers: 0,
        wrongAnswers: 0,
        unattempted: quiz.totalQuestions || quiz.questions.length,
        timeTakenSeconds: 0,
        startedAt: new Date(),
        answers: [] as unknown as Prisma.InputJsonValue,
      },
    });

    return newAttempt;
  }

  async getActiveAttempt(userId: string, quizId: string) {
    return this.prisma.quizSubmission.findFirst({
      where: { userId, quizId, attemptStatus: 'IN_PROGRESS' },
      orderBy: { startedAt: 'desc' },
    });
  }

  async submitQuiz(userId: string, quizId: string, payload: SubmitQuizDto, attemptId?: string) {
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
      const userAns = payload.answers.find((a) => a.questionId === q.id);
      if (!userAns || userAns.selectedOptionIndex === undefined || userAns.selectedOptionIndex === null) {
        unattempted++;
      } else if (userAns.selectedOptionIndex === q.correctOptionIndex) {
        score += q.marks;
        correctCount++;
      } else {
        score -= quiz.negativeMarkingValue;
        wrongCount++;
      }
    });

    const finalScore = Math.max(0, Math.round(score * 100) / 100);
    const totalMarks = quiz.totalMarks || 100;
    const percentage = Math.round((finalScore / (totalMarks || 1)) * 100 * 100) / 100;
    const passed = finalScore >= quiz.passingMarks;
    const totalQuestions = quiz.totalQuestions || quiz.questions.length;

    let submission;
    if (attemptId) {
      const existing = await this.prisma.quizSubmission.findUnique({ where: { id: attemptId } });
      if (existing && existing.userId === userId) {
        submission = await this.prisma.quizSubmission.update({
          where: { id: attemptId },
          data: {
            attemptStatus: 'COMPLETED',
            score: finalScore,
            totalMarks,
            percentage,
            totalQuestions,
            passed,
            correctAnswers: correctCount,
            wrongAnswers: wrongCount,
            unattempted,
            timeTakenSeconds: payload.timeTakenSeconds || 0,
            answers: (payload.answers || []) as unknown as Prisma.InputJsonValue,
            submittedAt: new Date(),
          },
        });
      }
    }

    if (!submission) {
      const count = await this.prisma.quizSubmission.count({ where: { userId, quizId } });
      submission = await this.prisma.quizSubmission.create({
        data: {
          quizId,
          userId,
          attemptNumber: count + 1,
          attemptStatus: 'COMPLETED',
          score: finalScore,
          totalMarks,
          percentage,
          totalQuestions,
          passed,
          correctAnswers: correctCount,
          wrongAnswers: wrongCount,
          unattempted,
          timeTakenSeconds: payload.timeTakenSeconds || 0,
          answers: (payload.answers || []) as unknown as Prisma.InputJsonValue,
          startedAt: new Date(Date.now() - (payload.timeTakenSeconds || 0) * 1000),
          submittedAt: new Date(),
        },
      });
    }

    // Enqueue background processing for rank generation
    try {
      await this.queueService.send('quiz-submissions', {
        submissionId: submission.id,
        quizId,
        userId,
      });
    } catch (e) {
      console.warn('Queue submission notification skipped:', e);
    }

    return submission;
  }

  async getStudentHistory(userId: string) {
    return this.prisma.quizSubmission.findMany({
      where: { userId },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            category: true,
            durationMinutes: true,
            totalQuestions: true,
            passingMarks: true,
            totalMarks: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getAdminHistory(quizId?: string, userId?: string) {
    const where: any = {};
    if (quizId) where.quizId = quizId;
    if (userId) where.userId = userId;

    return this.prisma.quizSubmission.findMany({
      where,
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            category: true,
            durationMinutes: true,
            totalQuestions: true,
            passingMarks: true,
            totalMarks: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }

  async getLeaderboard(quizId: string) {
    const submissions = await this.prisma.quizSubmission.findMany({
      where: { quizId, attemptStatus: 'COMPLETED' },
      include: { user: { select: { name: true, avatarUrl: true } } },
      orderBy: [{ score: 'desc' }, { timeTakenSeconds: 'asc' }],
      take: 20,
    });

    return submissions.map((sub, idx) => ({
      rank: idx + 1,
      userId: sub.userId,
      userName: sub.user?.name || 'Student',
      avatarUrl: sub.user?.avatarUrl,
      score: sub.score,
      timeTakenSeconds: sub.timeTakenSeconds,
      submittedAt: sub.submittedAt || sub.createdAt,
    }));
  }
}
