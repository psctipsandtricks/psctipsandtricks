import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseQueueService } from '../queue/queue.service';
import { Prisma } from '@prisma/client';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { CreateQuizFolderDto, UpdateQuizFolderDto } from './dto/quiz-folder.dto';
import { ReorderDto } from '../common/dto/library-folder.dto';
import { AccessActor, QuizAccessService } from '../common/access/quiz-access.service';
import { computeFinalScore } from '../common/scoring';

const CURATOR: AccessActor = { id: '', role: 'ADMIN' as any };

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

    const andClauses: Prisma.QuizWhereInput[] = [];

    // For student/published catalog or non-staff users, strictly exclude quizzes whose releaseDate is in the future
    if (isPublishedOnly || !this.quizAccess.isStaff(actor)) {
      andClauses.push({
        OR: [
          { releaseDate: null },
          { releaseDate: '' },
          { releaseDate: { lte: new Date().toISOString() } },
        ],
      });
    }

    if (isPublishedOnly) {
      andClauses.push({ isActive: true });
      andClauses.push({ questions: { some: {} } });
    }

    if (query?.folder && query.folder !== 'ALL') {
      andClauses.push({ folderName: query.folder });
    }

    if (query?.access && query.access !== 'ALL') {
      andClauses.push({ accessType: query.access });
    }

    if (query?.status && query.status !== 'ALL') {
      andClauses.push({ isActive: query.status === 'ACTIVE' });
    }

    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      andClauses.push({
        OR: [
          { title: { contains: s, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.QuizWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};

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
      // Callers that omit page/limit get every quiz as a bare array (the
      // browse page's current contract) — this cap is a safety net against
      // the catalog growing unbounded, not real pagination.
      take: 500,
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
            durationMinutes: true,
            totalQuestions: true,
            passingMarks: true,
            totalMarks: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      // The quiz-history page fetches every attempt as a bare array and
      // paginates client-side — this cap is a safety net for a long-tenured
      // student's history, not real pagination.
      take: 500,
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

  // --- Quiz Folders ---

  async listFolders(actor?: AccessActor | null, parentId?: string | null) {
    const isCurator = this.quizAccess.isStaff(actor);
    const folderWhere: Prisma.QuizFolderWhereInput = isCurator ? {} : { isActive: true };

    const [dbFolders, quizFolderCounts] = await Promise.all([
      this.prisma.quizFolder.findMany({
        where: folderWhere,
        include: { parent: true },
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.quiz.groupBy({
        by: ['folderName'],
        _count: { _all: true },
        where: isCurator ? {} : { isActive: true },
      }),
    ]);

    const countMap: Record<string, number> = {};
    for (const group of quizFolderCounts) {
      const name = (!group.folderName || group.folderName === 'Root / No Folder' || group.folderName === 'Root')
        ? 'Root'
        : group.folderName;
      countMap[name] = (countMap[name] || 0) + group._count._all;
    }

    // Map sub-folder counts
    const subFolderCountMap: Record<string, number> = {};
    for (const f of dbFolders) {
      if (f.parentId) {
        subFolderCountMap[f.parentId] = (subFolderCountMap[f.parentId] || 0) + 1;
      }
    }

    const seenNames = new Set<string>();
    const result: any[] = [];

    // Map stored db folders
    for (const f of dbFolders) {
      seenNames.add(f.name);
      result.push({
        id: f.id,
        name: f.name,
        title: f.name,
        parentId: f.parentId,
        parentName: f.parent?.name || null,
        description: f.description,
        orderIndex: f.orderIndex,
        isActive: f.isActive,
        quizCount: countMap[f.name] || 0,
        subFolderCount: subFolderCountMap[f.id] || 0,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      });
    }

    // Also include any custom folders discovered on quizzes that aren't yet in quizFolder table
    for (const [folderName, count] of Object.entries(countMap)) {
      if (folderName && folderName.toLowerCase() !== 'root' && !seenNames.has(folderName)) {
        seenNames.add(folderName);
        result.push({
          id: `virtual-${encodeURIComponent(folderName)}`,
          name: folderName,
          title: folderName,
          parentId: null,
          parentName: null,
          description: null,
          orderIndex: result.length,
          isActive: true,
          quizCount: count,
          subFolderCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    let filtered = result.filter((f) => f.name && f.name.toLowerCase() !== 'root');

    // Filter by parentId if explicitly requested
    if (parentId !== undefined && parentId !== null) {
      if (parentId === 'root' || parentId === 'null' || parentId === '') {
        filtered = filtered.filter((f) => !f.parentId);
      } else {
        // Find if parentId matches an ID or a Name
        const parentFolder = result.find((f) => f.id === parentId || f.name === parentId);
        const resolvedParentId = parentFolder ? parentFolder.id : parentId;
        filtered = filtered.filter((f) => f.parentId === resolvedParentId || (parentFolder && f.parentId === parentFolder.id));
      }
    }

    const sorted = filtered.sort((a, b) => a.orderIndex - b.orderIndex);
    return isCurator ? sorted : sorted.filter((f) => (f.quizCount || 0) > 0 || (f.subFolderCount || 0) > 0);
  }

  async findFolder(idOrName: string) {
    let folder = await this.prisma.quizFolder.findFirst({
      where: {
        OR: [{ id: idOrName }, { name: idOrName }],
      },
      include: {
        parent: true,
        children: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!folder) {
      if (idOrName === 'Root' || idOrName === 'root-folder') {
        return {
          id: 'root-folder',
          name: 'Root',
          title: 'Root',
          parentId: null,
          parent: null,
          children: [],
          description: 'Default root folder',
          orderIndex: -1,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      throw new NotFoundException('Quiz folder not found');
    }

    return folder;
  }

  async createFolder(dto: CreateQuizFolderDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Folder name is required');

    let parentId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.quizFolder.findFirst({
        where: { OR: [{ id: dto.parentId }, { name: dto.parentId }] },
      });
      if (parent) parentId = parent.id;
    }

    const existing = await this.prisma.quizFolder.findUnique({ where: { name } });
    if (existing) throw new BadRequestException(`Folder "${name}" already exists`);

    return this.prisma.quizFolder.create({
      data: {
        name,
        parentId,
        description: dto.description?.trim() || null,
        orderIndex: dto.orderIndex ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: { parent: true },
    });
  }

  async updateFolder(idOrName: string, dto: UpdateQuizFolderDto) {
    let folder = await this.prisma.quizFolder.findFirst({
      where: {
        OR: [{ id: idOrName }, { name: idOrName }],
      },
    });

    let parentId: string | null | undefined = undefined;
    if (dto.parentId !== undefined) {
      if (dto.parentId) {
        const parent = await this.prisma.quizFolder.findFirst({
          where: { OR: [{ id: dto.parentId }, { name: dto.parentId }] },
        });
        parentId = parent ? parent.id : null;
      } else {
        parentId = null;
      }
    }

    // If folder was virtual (e.g. created on-the-fly by assigning a quiz to it), create DB record
    if (!folder) {
      const oldName = idOrName.startsWith('virtual-') ? decodeURIComponent(idOrName.replace('virtual-', '')) : idOrName;
      const newName = dto.name ? dto.name.trim() : oldName;

      folder = await this.prisma.quizFolder.create({
        data: {
          name: newName,
          parentId: parentId || null,
          description: dto.description?.trim() || null,
          orderIndex: dto.orderIndex ?? 0,
          isActive: dto.isActive ?? true,
        },
      });

      if (newName !== oldName) {
        await this.prisma.quiz.updateMany({
          where: { folderName: oldName },
          data: { folderName: newName },
        });
      }

      return folder;
    }

    const newName = dto.name ? dto.name.trim() : folder.name;
    if (newName !== folder.name) {
      const duplicate = await this.prisma.quizFolder.findUnique({ where: { name: newName } });
      if (duplicate && duplicate.id !== folder.id) {
        throw new BadRequestException(`Folder "${newName}" already exists`);
      }
      // Cascade rename to existing quizzes in this folder
      await this.prisma.quiz.updateMany({
        where: { folderName: folder.name },
        data: { folderName: newName },
      });
    }

    return this.prisma.quizFolder.update({
      where: { id: folder.id },
      data: {
        name: newName,
        parentId: parentId !== undefined ? parentId : undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        orderIndex: dto.orderIndex !== undefined ? dto.orderIndex : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
      },
      include: { parent: true },
    });
  }

  async deleteFolder(idOrName: string) {
    const folder = await this.prisma.quizFolder.findFirst({
      where: {
        OR: [{ id: idOrName }, { name: idOrName }],
      },
    });

    const targetName = folder ? folder.name : (idOrName.startsWith('virtual-') ? decodeURIComponent(idOrName.replace('virtual-', '')) : idOrName);

    // Move any quizzes inside this folder to 'Root'
    await this.prisma.quiz.updateMany({
      where: { folderName: targetName },
      data: { folderName: 'Root' },
    });

    if (folder) {
      await this.prisma.quizFolder.delete({ where: { id: folder.id } });
    }

    return { success: true, message: `Folder "${targetName}" deleted, quizzes moved to Root.` };
  }

  async reorderFolders(dto: { items: { id: string; orderIndex: number }[] }) {
    await Promise.all(
      dto.items
        .filter((item) => item.id && !item.id.startsWith('virtual-') && item.id !== 'root-folder')
        .map((item) =>
          this.prisma.quizFolder
            .update({ where: { id: item.id }, data: { orderIndex: item.orderIndex } })
            .catch(() => null),
        ),
    );
    return this.listFolders(CURATOR);
  }
}
