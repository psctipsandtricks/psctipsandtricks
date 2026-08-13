import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseQueueService } from '../queue/queue.service';
import { MockTestStatus, Prisma } from '@prisma/client';
import { CreateMockTestDto } from './dto/create-mock-test.dto';
import { SubmitQuizDto } from '../quizzes/dto/submit-quiz.dto';
import { AccessActor, QuizAccessService } from '../common/access/quiz-access.service';
import { computeFinalScore } from '../common/scoring';

@Injectable()
export class MockTestsService {
  private readonly logger = new Logger(MockTestsService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: SupabaseQueueService,
    private quizAccess: QuizAccessService,
  ) {}

  async create(dto: CreateMockTestDto, createdById: string) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: dto.quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');

    return this.prisma.mockTest.create({
      data: {
        title: dto.title,
        quizId: dto.quizId,
        scheduledAt: new Date(dto.scheduledAt),
        createdById,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.mockTest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Mock test not found');
    return this.prisma.mockTest.delete({ where: { id } });
  }

  async update(id: string, dto: Partial<CreateMockTestDto> & { status?: MockTestStatus }) {
    const existing = await this.prisma.mockTest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Mock test not found');

    const data: Prisma.MockTestUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.quizId !== undefined) {
      const quiz = await this.prisma.quiz.findUnique({ where: { id: dto.quizId } });
      if (!quiz) throw new NotFoundException('Quiz not found');
      data.quiz = { connect: { id: dto.quizId } };
    }
    if (dto.scheduledAt !== undefined) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.mockTest.update({
      where: { id },
      data,
    });
  }

  async findAll(status?: MockTestStatus, actor?: AccessActor | null) {
    const mockTests = await this.prisma.mockTest.findMany({
      where: status ? { status } : undefined,
      include: {
        // accessType/price let the listing show a premium lock and its cost
        // before the student opens the test.
        quiz: {
          select: {
            id: true,
            title: true,
            durationMinutes: true,
            totalMarks: true,
            totalQuestions: true,
            accessType: true,
            isPremium: true,
            price: true,
          },
        },
        _count: { select: { participants: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // The listing must reflect purchase state up front — otherwise a premium
    // mock test's card reads "Join & Start" exactly like a free one, and the
    // paywall only shows up after the student has already clicked through.
    const isStaff = actor?.role === 'ADMIN' || actor?.role === 'STAFF';
    const purchased = isStaff ? new Set<string>() : await this.quizAccess.getPurchasedQuizIds(actor?.id);

    return mockTests.map((mt) => {
      const isPaid = this.quizAccess.isPaidQuiz(mt.quiz);
      const hasAccess = !isPaid || isStaff || purchased.has(mt.quizId);
      return { ...mt, access: { isPaid, hasAccess, price: mt.quiz?.price ?? 0 } };
    });
  }

  async findOne(id: string, actor?: AccessActor | null) {
    const mockTest = await this.prisma.mockTest.findUnique({
      where: { id },
      include: {
        quiz: { include: { questions: true } },
        participants: {
          include: { user: { select: { name: true, avatarUrl: true } } },
          orderBy: [{ score: 'desc' }],
        },
      },
    });
    if (!mockTest) throw new NotFoundException('Mock test not found');

    // The questions carry the answer key, so they only ship to callers who are
    // entitled. `access` tells the client whether to show the paywall.
    const access = await this.quizAccess.getAccessState(actor, mockTest.quiz);
    return {
      ...mockTest,
      quiz: this.quizAccess.stripQuestionsIfLocked(mockTest.quiz, access),
      access,
    };
  }

  async getMyAttempts(userId: string) {
    return this.prisma.mockTestParticipant.findMany({ where: { userId } });
  }

  async join(mockTestId: string, actor: AccessActor) {
    const userId = actor.id;
    const mockTest = await this.prisma.mockTest.findUnique({
      where: { id: mockTestId },
      include: { quiz: true },
    });
    if (!mockTest) throw new NotFoundException('Mock test not found');

    // A premium mock test cannot be entered without a settled payment.
    await this.quizAccess.assertCanAttempt(actor, mockTest.quiz);

    if (mockTest.status === MockTestStatus.UPCOMING && new Date() >= mockTest.scheduledAt) {
      await this.prisma.mockTest.update({ where: { id: mockTestId }, data: { status: MockTestStatus.LIVE } });
    }

    return this.prisma.mockTestParticipant.upsert({
      where: { mockTestId_userId: { mockTestId, userId } },
      create: { mockTestId, userId },
      update: {},
    });
  }

  async submit(mockTestId: string, actor: AccessActor, payload: SubmitQuizDto) {
    const userId = actor.id;
    const mockTest = await this.prisma.mockTest.findUnique({
      where: { id: mockTestId },
      include: { quiz: { include: { questions: true } } },
    });
    if (!mockTest) throw new NotFoundException('Mock test not found');

    // Re-checked here as well as on join: a refund or reversal between the two
    // must not leave a scoring path open.
    await this.quizAccess.assertCanAttempt(actor, mockTest.quiz);

    const participant = await this.prisma.mockTestParticipant.findUnique({
      where: { mockTestId_userId: { mockTestId, userId } },
    });
    if (!participant) throw new BadRequestException('You must join this mock test before submitting');
    if (participant.submittedAt) throw new BadRequestException('You have already submitted this mock test');

    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unattempted = 0;

    mockTest.quiz.questions.forEach((q) => {
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
    score = computeFinalScore(score, wrongCount, mockTest.quiz);

    const totalMarks = mockTest.quiz.totalMarks || 100;
    const percentage = Math.round((score / (totalMarks || 1)) * 100 * 100) / 100;

    // The per-question tallies are already known from the scoring loop above;
    // persisting them (rather than zeros) is what lets the student dashboard
    // report a real accuracy for mock tests instead of an empty breakdown.
    await this.prisma.quizSubmission.create({
      data: {
        quizId: mockTest.quizId,
        userId,
        attemptStatus: 'COMPLETED',
        score,
        totalMarks,
        percentage,
        totalQuestions: mockTest.quiz.totalQuestions || mockTest.quiz.questions.length,
        passed: percentage >= (mockTest.quiz.passingMarks ?? 40) || score >= ((mockTest.quiz.passingMarks ?? 40) <= 100 ? ((mockTest.quiz.passingMarks ?? 40) / 100) * totalMarks : (mockTest.quiz.passingMarks ?? 40)),
        correctAnswers: correctCount,
        wrongAnswers: wrongCount,
        unattempted,
        timeTakenSeconds: payload.timeTakenSeconds || 0,
        answers: (payload.answers || []) as unknown as Prisma.InputJsonValue,
        startedAt: new Date(Date.now() - (payload.timeTakenSeconds || 0) * 1000),
        submittedAt: new Date(),
      },
    });

    const updated = await this.prisma.mockTestParticipant.update({
      where: { mockTestId_userId: { mockTestId, userId } },
      data: { score, submittedAt: new Date() },
    });

    // Rank recomputation is a background concern. The submission is already
    // persisted at this point, so a queue outage must not fail the response —
    // otherwise the student sees an error, retries, and is permanently locked
    // out by the "already submitted" guard above. Mirrors QuizzesService.
    try {
      await this.queueService.send('mock-tests', { mockTestId });
    } catch (err) {
      this.logger.warn(`Rank recompute enqueue skipped for mock test ${mockTestId}: ${err}`);
    }

    return updated;
  }

  async getLeaderboard(mockTestId: string) {
    const mockTest = await this.prisma.mockTest.findUnique({
      where: { id: mockTestId },
      select: { quiz: { select: { totalMarks: true } } },
    });
    const totalMarks = mockTest?.quiz?.totalMarks ?? 100;

    const participants = await this.prisma.mockTestParticipant.findMany({
      where: { mockTestId, submittedAt: { not: null } },
      include: { user: { select: { name: true, avatarUrl: true } } },
      orderBy: [{ score: 'desc' }, { submittedAt: 'asc' }],
      take: 100,
    });
    return participants.map((p, idx) => ({
      rank: idx + 1,
      userId: p.userId,
      userName: p.user.name || 'Student Participant',
      avatarUrl: p.user.avatarUrl,
      score: p.score ?? 0,
      totalMarks,
    }));
  }
}
