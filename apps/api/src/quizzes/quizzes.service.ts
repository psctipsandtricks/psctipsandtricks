import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseQueueService } from '../queue/queue.service';
import { Prisma } from '@prisma/client';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { AccessActor, QuizAccessService } from '../common/access/quiz-access.service';
import { computeFinalScore } from '../common/scoring';

@Injectable()
export class QuizzesService {
  constructor(
    private prisma: PrismaService,
    private queueService: SupabaseQueueService,
    private quizAccess: QuizAccessService,
  ) {}

  async findAll(publishedOnly = false, actor?: AccessActor | null) {
    const quizzes = await this.prisma.quiz.findMany({
      // A quiz with no questions yet is a draft — even if `isActive` is
      // somehow true, it must never appear in the public/student list.
      where: publishedOnly ? { isActive: true, questions: { some: {} } } : undefined,
      include: {
        questions: true,
        _count: { select: { questions: true, submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // This route is public, so paid quizzes must not ship their answer key to
    // browsers that have not paid for them.
    return this.quizAccess.redactQuizList(actor, quizzes);
  }

  async findOne(id: string, actor?: AccessActor | null) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { questions: true },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    // A questionless quiz is a draft in progress — students must not be able
    // to reach it directly by URL even though it's already hidden from the
    // list. 404 (not 403) so a guessed ID doesn't confirm a draft exists.
    // Staff still need full access to keep building it.
    if (quiz.questions.length === 0 && !this.quizAccess.isStaff(actor)) {
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
    return this.prisma.quiz.create({
      data: {
        category: data.category || 'General',
        ...quizData,
        totalQuestions: questionCount,
        // A quiz can't go live for students before it has at least one
        // question, regardless of what the admin form's toggle sent — force
        // it hidden here, and the first question saved via update() below
        // flips it back on automatically.
        isActive: questionCount > 0 ? (quizData.isActive ?? true) : false,
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

    // Delete existing questions and recreate if questions array is provided
    if (questions) {
      await this.prisma.question.deleteMany({ where: { quizId: id } });
    }

    const previousQuestionCount = existing._count.questions;
    const newQuestionCount = questions ? questions.length : previousQuestionCount;

    // Auto-publish the instant a quiz gains its first question, and
    // auto-hide it the instant it loses its last one — overriding whatever
    // `isActive` the request asked for, so an empty quiz can never be left
    // reachable by students. A quiz that already had questions and still
    // does keeps the admin's explicit isActive choice untouched.
    let isActiveOverride: boolean | undefined;
    if (newQuestionCount === 0) {
      isActiveOverride = false;
    } else if (previousQuestionCount === 0 && newQuestionCount > 0) {
      isActiveOverride = true;
    }

    return this.prisma.quiz.update({
      where: { id },
      data: {
        ...quizData,
        totalQuestions: newQuestionCount,
        ...(isActiveOverride !== undefined ? { isActive: isActiveOverride } : {}),
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

  async startAttempt(actor: AccessActor, quizId: string) {
    const userId = actor.id;
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.questions.length === 0) throw new NotFoundException('Quiz not found');

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
      include: { questions: true },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.questions.length === 0) throw new NotFoundException('Quiz not found');

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
