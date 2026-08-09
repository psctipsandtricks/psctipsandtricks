import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseQueueService } from '../queue/queue.service';
import { MockTestStatus, Prisma } from '@prisma/client';
import { CreateMockTestDto } from './dto/create-mock-test.dto';
import { SubmitQuizDto } from '../quizzes/dto/submit-quiz.dto';

@Injectable()
export class MockTestsService {
  constructor(
    private prisma: PrismaService,
    private queueService: SupabaseQueueService,
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

  async findAll(status?: MockTestStatus) {
    return this.prisma.mockTest.findMany({
      where: status ? { status } : undefined,
      include: {
        quiz: { select: { title: true, durationMinutes: true, totalMarks: true, totalQuestions: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOne(id: string) {
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
    return mockTest;
  }

  async getMyAttempts(userId: string) {
    return this.prisma.mockTestParticipant.findMany({ where: { userId } });
  }

  async join(mockTestId: string, userId: string) {
    const mockTest = await this.prisma.mockTest.findUnique({ where: { id: mockTestId } });
    if (!mockTest) throw new NotFoundException('Mock test not found');

    if (mockTest.status === MockTestStatus.UPCOMING && new Date() >= mockTest.scheduledAt) {
      await this.prisma.mockTest.update({ where: { id: mockTestId }, data: { status: MockTestStatus.LIVE } });
    }

    return this.prisma.mockTestParticipant.upsert({
      where: { mockTestId_userId: { mockTestId, userId } },
      create: { mockTestId, userId },
      update: {},
    });
  }

  async submit(mockTestId: string, userId: string, payload: SubmitQuizDto) {
    const mockTest = await this.prisma.mockTest.findUnique({
      where: { id: mockTestId },
      include: { quiz: { include: { questions: true } } },
    });
    if (!mockTest) throw new NotFoundException('Mock test not found');

    const participant = await this.prisma.mockTestParticipant.findUnique({
      where: { mockTestId_userId: { mockTestId, userId } },
    });
    if (!participant) throw new BadRequestException('You must join this mock test before submitting');
    if (participant.submittedAt) throw new BadRequestException('You have already submitted this mock test');

    let score = 0;
    mockTest.quiz.questions.forEach((q) => {
      const userAns = payload.answers.find((a) => a.questionId === q.id);
      if (!userAns || userAns.selectedOptionIndex === undefined || userAns.selectedOptionIndex === null) return;
      if (userAns.selectedOptionIndex === q.correctOptionIndex) {
        score += q.marks;
      } else {
        score -= mockTest.quiz.negativeMarkingValue;
      }
    });
    score = Math.max(0, Math.round(score * 100) / 100);

    await this.prisma.quizSubmission.create({
      data: {
        quizId: mockTest.quizId,
        userId,
        score,
        totalMarks: mockTest.quiz.totalMarks,
        passed: score >= mockTest.quiz.passingMarks,
        correctAnswers: 0,
        wrongAnswers: 0,
        unattempted: 0,
        timeTakenSeconds: payload.timeTakenSeconds || 0,
        answers: (payload.answers || []) as unknown as Prisma.InputJsonValue,
      },
    });

    const updated = await this.prisma.mockTestParticipant.update({
      where: { mockTestId_userId: { mockTestId, userId } },
      data: { score, submittedAt: new Date() },
    });

    await this.queueService.send('mock-tests', { mockTestId });

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
