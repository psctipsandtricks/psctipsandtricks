import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseQueueService } from '../queue/queue.service';
import { Prisma } from '@prisma/client';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { AccessActor, QuizAccessService } from '../common/access/quiz-access.service';
import { computeFinalScore } from '../common/scoring';

/**
 * How far into the past a submitted release date may fall before it is
 * rejected. Covers the seconds between an admin picking "now" and the request
 * arriving, plus modest clock drift between their machine and the server.
 */
const RELEASE_DATE_GRACE_MS = 60_000;

@Injectable()
export class QuizzesService {
  constructor(
    private prisma: PrismaService,
    private queueService: SupabaseQueueService,
    private quizAccess: QuizAccessService,
  ) {}

  /**
   * A scheduled quiz is a draft as far as students are concerned: it exists,
   * but nothing about it is reachable until its release moment passes. Staff
   * are exempt so they can build and preview what they scheduled.
   */
  private isAwaitingRelease(
    quiz: { releaseDate?: string | null },
    actor?: AccessActor | null,
  ): boolean {
    if (!quiz.releaseDate) return false;
    if (this.quizAccess.isStaff(actor)) return false;
    const releaseAt = new Date(quiz.releaseDate).getTime();
    // A value that predates this feature and can't be parsed is treated as
    // "no schedule" — an unreadable date must never hide a live quiz.
    if (isNaN(releaseAt)) return false;
    return releaseAt > Date.now();
  }

  /**
   * A release moment may be now or later, never earlier — a past date would
   * publish the quiz the instant it was saved, which is not what "schedule"
   * means. The minute of leeway absorbs the gap between the admin picking a
   * time and the request landing, plus any client/server clock drift.
   */
  private assertReleaseDateNotInThePast(value: Date | string) {
    const releaseAt = value instanceof Date ? value : new Date(value);
    if (isNaN(releaseAt.getTime())) {
      throw new BadRequestException('Release date is not a valid date/time.');
    }
    if (releaseAt.getTime() < Date.now() - RELEASE_DATE_GRACE_MS) {
      throw new BadRequestException(
        'Release date and time cannot be in the past. Pick the current or a future date/time.',
      );
    }
  }

  async findAll(
    options?:
      | boolean
      | {
          publishedOnly?: boolean;
          page?: number;
          limit?: number;
          search?: string;
          folder?: string;
          access?: string;
          status?: string;
        },
    actor?: AccessActor | null,
  ) {
    const isPublishedOnly = typeof options === 'boolean' ? options : options?.publishedOnly ?? false;
    const query = typeof options === 'object' ? options : undefined;

    const where: any = {};

    if (!this.quizAccess.isStaff(actor)) {
      where.OR = [{ releaseDate: null }, { releaseDate: { lte: new Date().toISOString() } }];
    }

    if (isPublishedOnly) {
      where.isActive = true;
      where.questions = { some: {} };
    }

    if (query?.folder && query.folder !== 'ALL') {
      where.folderName = query.folder;
    }

    if (query?.access && query.access !== 'ALL') {
      where.accessType = query.access;
    }

    if (query?.status && query.status !== 'ALL') {
      where.isActive = query.status === 'ACTIVE';
    }

    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: s, mode: 'insensitive' } },
            { category: { contains: s, mode: 'insensitive' } },
            { topic: { contains: s, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (query?.page || query?.limit) {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
      const skip = (page - 1) * limit;

      const [total, quizzes] = await Promise.all([
        this.prisma.quiz.count({ where }),
        this.prisma.quiz.findMany({
          where,
          include: {
            questions: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
            _count: { select: { questions: true, submissions: true } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const redacted = await this.quizAccess.redactQuizList(actor, quizzes);
      return {
        data: redacted,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const quizzes = await this.prisma.quiz.findMany({
      where,
      include: {
        questions: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
        _count: { select: { questions: true, submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.quizAccess.redactQuizList(actor, quizzes);
  }

  async findOne(id: string, actor?: AccessActor | null) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { questions: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    // A questionless quiz is a draft in progress — students must not be able
    // to reach it directly by URL even though it's already hidden from the
    // list. 404 (not 403) so a guessed ID doesn't confirm a draft exists.
    // Staff still need full access to keep building it.
    if (quiz.questions.length === 0 && !this.quizAccess.isStaff(actor)) {
      throw new NotFoundException('Quiz not found');
    }

    // Same treatment for a quiz whose release moment has not arrived: 404 so a
    // direct link can't be used to jump the schedule.
    if (this.isAwaitingRelease(quiz, actor)) {
      throw new NotFoundException('Quiz not found');
    }

    // Questions hold the answer key, so a paid quiz is described but not
    // revealed until the caller has paid for it.
    const access = await this.quizAccess.getAccessState(actor, quiz);
    return { ...this.quizAccess.stripQuestionsIfLocked(quiz, access), access };
  }

  async create(data: CreateQuizDto) {
    const { questions, ...quizData } = data;
    const questionCount = questions?.length ?? 0;

    if (quizData.releaseDate) {
      this.assertReleaseDateNotInThePast(quizData.releaseDate);
    }

    return this.prisma.quiz.create({
      data: {
        category: data.category || 'General',
        ...quizData,
        totalQuestions: questionCount,
        isActive: quizData.isActive ?? true,
        questions: questions
          ? {
              create: questions.map((q, order) => ({
                ...q,
                order,
                options: q.options as unknown as Prisma.InputJsonValue,
              })),
            }
          : undefined,
      },
      include: { questions: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
    });
  }

  async update(id: string, data: UpdateQuizDto) {
    const existing = await this.prisma.quiz.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });
    if (!existing) throw new NotFoundException('Quiz not found');

    const { questions, ...rest } = data;

    // A partial update must only touch the columns the caller actually sent —
    // an explicit `undefined` key would still be handed to Prisma otherwise.
    const quizData = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined),
    );

    // Only a *changed* release moment has to be in the future — re-saving a
    // quiz that went live last month must not be rejected for carrying its own
    // (now past) release date back to the server.
    if (quizData.releaseDate) {
      const incoming = String(quizData.releaseDate);
      const unchanged =
        !!existing.releaseDate &&
        new Date(existing.releaseDate).getTime() === new Date(incoming).getTime();
      if (!unchanged) this.assertReleaseDateNotInThePast(incoming);
    }

    // Delete existing questions and recreate if questions array is provided
    if (questions) {
      await this.prisma.question.deleteMany({ where: { quizId: id } });
    }

    const previousQuestionCount = existing._count.questions;
    const newQuestionCount = questions ? questions.length : previousQuestionCount;

    return this.prisma.quiz.update({
      where: { id },
      data: {
        ...quizData,
        totalQuestions: newQuestionCount,
        questions: questions
          ? {
              create: questions.map((q, order) => ({
                ...q,
                order,
                options: q.options as unknown as Prisma.InputJsonValue,
              })),
            }
          : undefined,
      },
      include: { questions: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.quiz.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Quiz not found');
    return this.prisma.quiz.delete({ where: { id } });
  }

  async startAttempt(actor: AccessActor, quizId: string) {
    const userId = actor.id;
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.questions.length === 0) throw new NotFoundException('Quiz not found');
    // A scheduled quiz cannot be started early, even by someone holding the id.
    if (this.isAwaitingRelease(quiz, actor)) throw new NotFoundException('Quiz not found');

    // A premium quiz cannot be started without a settled payment.
    await this.quizAccess.assertCanAttempt(actor, quiz);

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

  async submitQuiz(actor: AccessActor, quizId: string, payload: SubmitQuizDto, attemptId?: string) {
    const userId = actor.id;
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.questions.length === 0) throw new NotFoundException('Quiz not found');
    if (this.isAwaitingRelease(quiz, actor)) throw new NotFoundException('Quiz not found');

    // Re-checked at submit as well as at start, so a reversal between the two
    // cannot leave a scoring path open.
    await this.quizAccess.assertCanAttempt(actor, quiz);

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
        wrongCount++;
      }
    });

    const finalScore = computeFinalScore(score, wrongCount, quiz);
    const totalMarks = quiz.totalMarks || 100;
    const percentage = Math.round((finalScore / (totalMarks || 1)) * 100 * 100) / 100;
    const totalQuestions = quiz.totalQuestions || quiz.questions.length;
    const passingThreshold = quiz.passingMarks ?? 40;
    const requiredScore = passingThreshold <= 100 ? (passingThreshold / 100) * totalMarks : passingThreshold;
    const passed = percentage >= passingThreshold || finalScore >= requiredScore;

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
