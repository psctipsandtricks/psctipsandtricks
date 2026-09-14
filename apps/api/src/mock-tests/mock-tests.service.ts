import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseQueueService } from '../queue/queue.service';
import { MockTestStatus, Prisma } from '@prisma/client';
import { CreateMockTestDto } from './dto/create-mock-test.dto';
import { SubmitQuizDto } from '../quizzes/dto/submit-quiz.dto';
import { AccessActor, QuizAccessService, QuizAccessState } from '../common/access/quiz-access.service';
import { computeFinalScore } from '../common/scoring';
import { SyncService } from '../sync/sync.service';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class MockTestsService {
  private readonly logger = new Logger(MockTestsService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: SupabaseQueueService,
    private quizAccess: QuizAccessService,
    private syncService: SyncService,
    private chatGateway: ChatGateway,
  ) {}

  async create(dto: CreateMockTestDto, createdById: string) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: dto.quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');

    const now = new Date();
    const scheduledAt = new Date(dto.scheduledAt);
    const endsAt = dto.endsAt
      ? new Date(dto.endsAt)
      : new Date(scheduledAt.getTime() + 24 * 60 * 60 * 1000);

    const status = now >= endsAt
      ? MockTestStatus.COMPLETED
      : scheduledAt <= now
      ? MockTestStatus.LIVE
      : MockTestStatus.UPCOMING;

    const [mockTest] = await this.prisma.$transaction([
      this.prisma.mockTest.create({
        data: {
          title: dto.title,
          quizId: dto.quizId,
          scheduledAt,
          endsAt,
          status,
          createdById,
        },
        include: {
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
      }),
      this.prisma.quiz.update({
        where: { id: dto.quizId },
        data: { isLiveMock: true },
      }),
    ]);

    this.syncService.emitEvent({
      domain: 'mockTests',
      action: 'create',
      timestamp: Date.now(),
      data: mockTest,
    });
    this.chatGateway.broadcastMockTestCreated(mockTest);

    return mockTest;
  }

  async remove(id: string) {
    const existing = await this.prisma.mockTest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Mock test not found');
    const res = await this.prisma.mockTest.delete({ where: { id } });

    this.syncService.emitEvent({
      domain: 'mockTests',
      action: 'delete',
      timestamp: Date.now(),
      data: { id },
    });
    this.chatGateway.broadcastMockTestDeleted(id);

    return res;
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
    if (dto.endsAt !== undefined) data.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.status !== undefined) {
      data.status = dto.status;
    } else if (data.scheduledAt || data.endsAt) {
      const sch = (data.scheduledAt as Date) || existing.scheduledAt;
      const end = (data.endsAt as Date) || existing.endsAt || new Date(sch.getTime() + 24 * 60 * 60 * 1000);
      const now = new Date();
      if (now >= end) {
        data.status = MockTestStatus.COMPLETED;
      } else if (sch <= now) {
        data.status = MockTestStatus.LIVE;
      } else {
        data.status = MockTestStatus.UPCOMING;
      }
    }

    const updated = await this.prisma.mockTest.update({
      where: { id },
      data,
      include: {
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
    });

    this.syncService.emitEvent({
      domain: 'mockTests',
      action: 'update',
      timestamp: Date.now(),
      data: updated,
    });
    this.chatGateway.broadcastMockTestUpdated(updated);

    return updated;
  }

  async findAll(
    status?: MockTestStatus,
    actor?: AccessActor | null,
    opts?: { page?: number; limit?: number },
  ) {
    const where = status ? { status } : undefined;
    const include = {
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
    };
    // Completed tests read best newest-first; the live/upcoming rails stay in
    // chronological order so the next test to start is at the top.
    const orderBy = {
      scheduledAt: status === MockTestStatus.COMPLETED ? ('desc' as const) : ('asc' as const),
    };

    // page/limit turns this into a numbered-pagination envelope (mobile's
    // completed rail); without them every caller keeps the bare array.
    let meta: { total: number; page: number; limit: number; totalPages: number } | null = null;
    let mockTests;
    if (opts?.page || opts?.limit) {
      const page = Math.max(1, Number(opts.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(opts.limit) || 10));
      const skip = (page - 1) * limit;
      const [total, rows] = await Promise.all([
        this.prisma.mockTest.count({ where }),
        this.prisma.mockTest.findMany({ where, include, orderBy, skip, take: limit }),
      ]);
      mockTests = rows;
      meta = { total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
    } else {
      mockTests = await this.prisma.mockTest.findMany({ where, include, orderBy });
    }

    // The listing must reflect purchase state up front — otherwise a premium
    // mock test's card reads "Join & Start" exactly like a free one, and the
    // paywall only shows up after the student has already clicked through.
    const { quizIds: purchased, hasAllAccess } = await this.quizAccess.getPurchasedQuizIds(actor?.id);

    // ...and this student's own standing in each one, for the same reason: a
    // card that cannot tell "not started" from "already submitted" has to
    // offer "Join now" to someone who has finished, and the join is then
    // refused by the server. One extra indexed read covers the whole page.
    // Empty for a signed-out caller, who has no attempts by definition.
    const myParticipation = actor?.id
      ? await this.prisma.mockTestParticipant.findMany({
          where: { userId: actor.id, mockTestId: { in: mockTests.map((mt) => mt.id) } },
          select: { mockTestId: true, submittedAt: true, score: true, rank: true },
        })
      : [];
    const mine = new Map(myParticipation.map((p) => [p.mockTestId, p]));

    const data = mockTests.map((mt) => {
      const price = mt.quiz?.price ?? 0;
      let access: QuizAccessState;

      // Same verdict shape as `getAccessState`, `reason` included: without it
      // a signed-out student is told to pay for a test they may already own,
      // instead of being sent to log in first.
      if (!this.quizAccess.isPaidQuiz(mt.quiz)) {
        access = { isPaid: false, hasAccess: true, price: 0, reason: 'FREE' };
      } else if (!actor?.id) {
        access = { isPaid: true, hasAccess: false, price, reason: 'LOGIN_REQUIRED' };
      } else {
        const bought = purchased.has(mt.quizId);
        access = {
          isPaid: true,
          hasAccess: bought,
          price,
          reason: bought ? 'PURCHASED' : 'PAYMENT_REQUIRED',
        };
      }

      const participant = mine.get(mt.id);
      return {
        ...mt,
        access,
        joined: !!participant,
        submitted: !!participant?.submittedAt,
        myScore: participant?.score ?? null,
        myRank: participant?.rank ?? null,
      };
    });

    return meta ? { data, ...meta } : data;
  }

  async findOne(id: string, actor?: AccessActor | null) {
    const mockTest = await this.prisma.mockTest.findUnique({
      where: { id },
      include: {
        quiz: { include: { questions: true } },
        participants: {
          include: { user: { select: { name: true, avatarUrl: true } } },
          // Same rule as `getLeaderboard` and the background rank recompute:
          // highest score first, then the faster of two equal scores. A
          // participant who has not submitted yet (`score`/`timeTakenMs` both
          // null) sorts to the end rather than being ordered arbitrarily.
          orderBy: [
            { score: { sort: 'desc', nulls: 'last' } },
            { timeTakenMs: { sort: 'asc', nulls: 'last' } },
            { submittedAt: { sort: 'asc', nulls: 'last' } },
          ],
        },
      },
    });
    if (!mockTest) throw new NotFoundException('Mock test not found');

    // The questions carry the answer key, so they only ship to callers who are
    // entitled. `access` tells the client whether to show the paywall.
    const quizPayload = mockTest.quiz ? { ...mockTest.quiz, isLiveMock: true } : null;
    const access = await this.quizAccess.getAccessState(actor, quizPayload);

    // The caller's own row, lifted out of `participants` so a client does not
    // have to search a list of strangers for itself. Mirrors `myParticipant`
    // in `mock-tests/[id]/page.tsx`, which is what decides between the taking
    // view and the rank list there.
    const participant = actor?.id ? mockTest.participants.find((p) => p.userId === actor.id) : undefined;

    return {
      ...mockTest,
      quiz: this.quizAccess.stripQuestionsIfLocked(mockTest.quiz, access),
      access,
      joined: !!participant,
      submitted: !!participant?.submittedAt,
      myScore: participant?.score ?? null,
      myRank: participant?.rank ?? null,
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
    const quizPayload = mockTest.quiz ? { ...mockTest.quiz, isLiveMock: true } : null;
    await this.quizAccess.assertCanAttempt(actor, quizPayload);

    const now = new Date();
    const endsAt = mockTest.endsAt ? new Date(mockTest.endsAt) : new Date(mockTest.scheduledAt.getTime() + 24 * 60 * 60 * 1000);
    if (now >= endsAt || mockTest.status === MockTestStatus.COMPLETED) {
      if (mockTest.status !== MockTestStatus.COMPLETED) {
        await this.prisma.mockTest.update({ where: { id: mockTestId }, data: { status: MockTestStatus.COMPLETED } });
      }
      throw new BadRequestException('This live mock test session has ended.');
    }

    if (mockTest.status === MockTestStatus.UPCOMING && now >= mockTest.scheduledAt) {
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
    const submitQuizPayload = mockTest.quiz ? { ...mockTest.quiz, isLiveMock: true } : null;
    await this.quizAccess.assertCanAttempt(actor, submitQuizPayload);

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

    // Prefer the millisecond-precision duration the client sends; fall back to
    // the whole-second one converted up, for a caller that has not been
    // updated to send the finer value yet. Rank ties are broken on this, so it
    // has to be the most precise figure available either way.
    const timeTakenMs = payload.timeTakenMs ?? (payload.timeTakenSeconds ?? 0) * 1000;
    const submittedAt = new Date();

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
        startedAt: new Date(submittedAt.getTime() - timeTakenMs),
        submittedAt,
      },
    });

    const updated = await this.prisma.mockTestParticipant.update({
      where: { mockTestId_userId: { mockTestId, userId } },
      data: { score, timeTakenMs, submittedAt },
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
      // Highest score first; among equal scores, whoever finished in less
      // wall-clock time ranks higher. `submittedAt` only breaks a tie between
      // two participants that also tie on `timeTakenMs` (identical millisecond
      // duration, or a submission from before this field existed).
      orderBy: [
        { score: 'desc' },
        { timeTakenMs: { sort: 'asc', nulls: 'last' } },
        { submittedAt: 'asc' },
      ],
      take: 100,
    });
    return participants.map((p, idx) => ({
      rank: idx + 1,
      userId: p.userId,
      userName: p.user.name || 'Student Participant',
      avatarUrl: p.user.avatarUrl,
      score: p.score ?? 0,
      timeTakenMs: p.timeTakenMs,
      totalMarks,
    }));
  }
}
