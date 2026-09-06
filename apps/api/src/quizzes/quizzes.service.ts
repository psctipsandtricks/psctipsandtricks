import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseQueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { Prisma } from '@prisma/client';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { PauseQuizDto } from './dto/pause-quiz.dto';
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

/**
 * The one ordering every quiz listing uses — admin table, website and mobile
 * app alike — so a drag in the admin panel is what students see.
 *
 * `createdAt asc` is the tie-breaker rather than decoration. Quizzes that
 * predate `orderIndex` all sit at the default 0, so they fall back to creation
 * order: oldest first, newest last. That is both a sane backfill-free default
 * and the behaviour asked for — a newly created quiz lands at the bottom.
 */
const QUIZ_ORDER: Prisma.QuizOrderByWithRelationInput[] = [
  { orderIndex: 'asc' },
  { createdAt: 'asc' },
];

export type QuizAnswerStatus = 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED';

/** One option as the review screens consume it, whatever shape it was stored in. */
export interface ReviewOption {
  id: string;
  text: string;
  explanation: string | null;
}

/**
 * Question options are stored as JSON and, depending on how the quiz was
 * authored, arrive either as `{ id, text }` objects or as bare strings. The
 * review contract exposes exactly one shape so neither client has to branch.
 */
function normalizeOptions(raw: unknown): ReviewOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((option, index) => {
    if (option && typeof option === 'object') {
      const record = option as Record<string, unknown>;
      return {
        id: typeof record.id === 'string' ? record.id : `opt-${index}`,
        text: typeof record.text === 'string' ? record.text : '',
        explanation: typeof record.explanation === 'string' ? record.explanation : null,
      };
    }
    return { id: `opt-${index}`, text: String(option ?? ''), explanation: null };
  });
}

@Injectable()
export class QuizzesService {
  constructor(
    private prisma: PrismaService,
    private queueService: SupabaseQueueService,
    private quizAccess: QuizAccessService,
    private storageService: StorageService,
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

    // For student/published catalog or non-staff users, strictly exclude inactive, future-dated, draft, or orphaned quizzes
    if (isPublishedOnly || !this.quizAccess.isStaff(actor)) {
      andClauses.push({
        OR: [
          { releaseDate: null },
          { releaseDate: '' },
          { releaseDate: { lte: new Date().toISOString() } },
        ],
      });
      andClauses.push({ isActive: true });
      andClauses.push({ questions: { some: {} } });

      // Ensure quizzes belong to active, existing folders
      const activeFolders = await this.prisma.quizFolder.findMany({
        where: { isActive: true },
        select: { name: true },
      });
      const activeFolderNames = activeFolders.map((f) => f.name);
      andClauses.push({ folderName: { in: activeFolderNames } });
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
          orderBy: QUIZ_ORDER,
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
      orderBy: QUIZ_ORDER,
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

  private static resolveFinalPrice(price: number, discountPercent: number) {
    const safeDiscount = Math.min(100, Math.max(0, discountPercent));
    return Math.round(price - (price * safeDiscount) / 100);
  }

  async create(data: CreateQuizDto) {
    const { questions, ...quizData } = data;
    const questionCount = questions?.length ?? 0;

    if (quizData.releaseDate) {
      this.assertReleaseDateNotInThePast(quizData.releaseDate);
    }

    const isPaid = quizData.accessType === 'PAID' || quizData.isPremium === true;
    const price = isPaid ? Math.max(0, Number(quizData.price) || 0) : 0;
    const discountPercent = isPaid ? Math.min(100, Math.max(0, Number(quizData.discountPercent) || 0)) : 0;
    const finalPrice = isPaid
      ? (quizData.finalPrice !== undefined && Number(quizData.finalPrice) > 0
          ? Number(quizData.finalPrice)
          : QuizzesService.resolveFinalPrice(price, discountPercent))
      : 0;

    return this.prisma.quiz.create({
      data: {
        ...quizData,
        price,
        discountPercent,
        finalPrice,
        totalQuestions: questionCount,
        orderIndex: await this.nextOrderIndex(quizData.folderName),
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

    const accessType = (quizData.accessType ?? existing.accessType) as string;
    const isPaid = accessType === 'PAID' || quizData.isPremium === true || (quizData.isPremium === undefined && existing.isPremium);
    if (!isPaid && quizData.accessType !== undefined) {
      quizData.price = 0;
      quizData.discountPercent = 0;
      quizData.finalPrice = 0;
    } else if (isPaid) {
      const price = quizData.price !== undefined ? Math.max(0, Number(quizData.price) || 0) : existing.price;
      const discountPercent = quizData.discountPercent !== undefined ? Math.min(100, Math.max(0, Number(quizData.discountPercent) || 0)) : existing.discountPercent;
      const finalPrice = quizData.finalPrice !== undefined && Number(quizData.finalPrice) > 0
        ? Number(quizData.finalPrice)
        : QuizzesService.resolveFinalPrice(price, discountPercent);
      if (quizData.price !== undefined) quizData.price = price;
      if (quizData.discountPercent !== undefined) quizData.discountPercent = discountPercent;
      quizData.finalPrice = finalPrice;
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

  async uploadImage(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file was uploaded');
    const url = await this.storageService.upload(
      'quiz-images',
      `uploads/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    return { url };
  }

  async uploadQuizImage(id: string, file: Express.Multer.File) {
    const existing = await this.prisma.quiz.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Quiz not found');
    if (!file) throw new BadRequestException('No file was uploaded');

    const url = await this.storageService.upload(
      'quiz-images',
      `${id}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );

    const updated = await this.prisma.quiz.update({
      where: { id },
      data: { imageUrl: url },
    });

    return { url, quiz: updated };
  }

  async removeQuizImage(id: string) {
    const existing = await this.prisma.quiz.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Quiz not found');

    return this.prisma.quiz.update({
      where: { id },
      data: { imageUrl: null },
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

  async pauseAttempt(userId: string, quizId: string, dto: PauseQuizDto, attemptId?: string) {
    const active = await this.prisma.quizSubmission.findFirst({
      where: {
        ...(attemptId ? { id: attemptId } : { userId, quizId, attemptStatus: 'IN_PROGRESS' }),
        userId,
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!active || active.attemptStatus !== 'IN_PROGRESS') {
      throw new NotFoundException('No active quiz attempt found to pause');
    }

    const updated = await this.prisma.quizSubmission.update({
      where: { id: active.id },
      data: {
        timeTakenSeconds: typeof dto.timeTakenSeconds === 'number' ? dto.timeTakenSeconds : active.timeTakenSeconds,
        answers: (dto.answers ?? active.answers) as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
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

  /**
   * The answer key alongside what the student actually picked, for one
   * submitted attempt. This is the single source of truth behind the result /
   * review screens on both the website and the mobile app — neither client
   * re-derives correctness locally.
   *
   * Questions come back in the quiz's own order, so the review reads in the
   * same sequence the student answered them.
   */
  async getAttemptReview(actor: AccessActor, attemptId: string) {
    const submission = await this.prisma.quizSubmission.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: { questions: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
        },
      },
    });

    // 404 rather than 403 for someone else's attempt — a guessed id must not
    // confirm that the attempt exists.
    if (!submission || (submission.userId !== actor.id && !this.quizAccess.isStaff(actor))) {
      throw new NotFoundException('Attempt not found');
    }
    if (submission.attemptStatus !== 'COMPLETED') {
      throw new BadRequestException('This attempt has not been submitted yet.');
    }

    const quiz = submission.quiz;
    const selectionByQuestion = new Map<string, number>();
    for (const raw of Array.isArray(submission.answers) ? submission.answers : []) {
      const answer = raw as { questionId?: unknown; selectedOptionIndex?: unknown };
      if (typeof answer?.questionId !== 'string') continue;
      if (typeof answer.selectedOptionIndex !== 'number') continue;
      selectionByQuestion.set(answer.questionId, answer.selectedOptionIndex);
    }

    // Explanations — both the per-option notes and the question's own — are a
    // premium perk. A free quiz's review shows only whether each answer was
    // right and which option was correct, so they are stripped from the
    // payload here rather than left to each client to hide.
    const isPremiumQuiz = this.quizAccess.isPaidQuiz(quiz);

    let matchedAnswers = 0;
    const questions = quiz.questions.map((question, index) => {
      const options = normalizeOptions(question.options).map((option) =>
        isPremiumQuiz ? option : { ...option, explanation: null },
      );
      const recorded = selectionByQuestion.get(question.id);
      if (recorded !== undefined) matchedAnswers++;

      // An index the options no longer cover (an edited quiz) is treated as no
      // answer rather than silently pointing at the wrong option text.
      const selectedOptionIndex =
        recorded !== undefined && recorded >= 0 && recorded < options.length ? recorded : null;
      const correctOptionIndex =
        question.correctOptionIndex >= 0 && question.correctOptionIndex < options.length
          ? question.correctOptionIndex
          : null;

      const status: QuizAnswerStatus =
        selectedOptionIndex === null
          ? 'UNATTEMPTED'
          : selectedOptionIndex === correctOptionIndex
            ? 'CORRECT'
            : 'INCORRECT';

      return {
        id: question.id,
        // 1-based so clients can label "Question 3" without recomputing it.
        number: index + 1,
        text: question.text,
        marks: question.marks,
        explanation: isPremiumQuiz ? question.explanation : null,
        options,
        selectedOptionIndex,
        selectedOptionText: selectedOptionIndex === null ? null : options[selectedOptionIndex].text,
        correctOptionIndex,
        correctOptionText: correctOptionIndex === null ? null : options[correctOptionIndex].text,
        status,
        isCorrect: status === 'CORRECT',
      };
    });

    // Saving a quiz recreates its questions with fresh ids, which orphans the
    // question ids stored on older attempts. Rather than render every answer
    // as skipped without explanation, say so and let the client warn.
    const answersStale = selectionByQuestion.size > 0 && matchedAnswers === 0;

    const negativeDeducted = quiz.negativeMarkingEnabled
      ? Math.floor(submission.wrongAnswers / Math.max(1, quiz.negativeMarkingEvery)) *
        quiz.negativeMarkingDeduct
      : 0;

    return {
      id: submission.id,
      quizId: submission.quizId,
      quizTitle: quiz.title,
      // The solutions PDF is a premium-only download, offered only once an
      // attempt is submitted — this is the payload both clients render that
      // result screen from, so it is the natural place to carry the gate.
      // It also decides whether the explanations above were included.
      isPremium: isPremiumQuiz,
      attemptNumber: submission.attemptNumber,
      attemptStatus: submission.attemptStatus,
      score: submission.score,
      totalMarks: submission.totalMarks,
      percentage: submission.percentage,
      passed: submission.passed,
      passingMarks: quiz.passingMarks,
      totalQuestions: submission.totalQuestions,
      correctAnswers: submission.correctAnswers,
      wrongAnswers: submission.wrongAnswers,
      unattempted: submission.unattempted,
      timeTakenSeconds: submission.timeTakenSeconds,
      startedAt: submission.startedAt,
      submittedAt: submission.submittedAt,
      negativeMarking: {
        enabled: quiz.negativeMarkingEnabled,
        every: quiz.negativeMarkingEvery,
        deduct: quiz.negativeMarkingDeduct,
        allowNegativeScore: quiz.allowNegativeScore,
        deducted: Math.round(negativeDeducted * 100) / 100,
      },
      answersStale,
      questions,
    };
  }

  async getStudentHistory(
    userId: string,
    opts?: { page?: number; limit?: number },
  ) {
    const include = {
      quiz: {
        select: {
          id: true,
          title: true,
          durationMinutes: true,
          totalQuestions: true,
          passingMarks: true,
          totalMarks: true,
          // Lets the history card mark an attempt as Free vs Premium, and gate
          // the "Solutions PDF" download to premium quizzes only.
          accessType: true,
          isPremium: true,
          price: true,
        },
      },
    };

    // With page/limit the caller (mobile app) gets a numbered-pagination
    // envelope of *completed* attempts only, plus a summary computed over every
    // completed attempt — not just the visible page. Without them the website
    // still receives the full bare array it filters and paginates itself.
    if (opts?.page || opts?.limit) {
      const page = Math.max(1, Number(opts.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(opts.limit) || 10));
      const skip = (page - 1) * limit;
      const where = { userId, attemptStatus: 'COMPLETED' as const };

      const [total, data, passed, agg] = await Promise.all([
        this.prisma.quizSubmission.count({ where }),
        this.prisma.quizSubmission.findMany({
          where,
          include,
          orderBy: [{ submittedAt: 'desc' }, { startedAt: 'desc' }],
          skip,
          take: limit,
        }),
        this.prisma.quizSubmission.count({ where: { ...where, passed: true } }),
        this.prisma.quizSubmission.aggregate({ where, _avg: { percentage: true } }),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        summary: {
          attempts: total,
          passed,
          avgPercentage: agg._avg.percentage ?? 0,
        },
      };
    }

    return this.prisma.quizSubmission.findMany({
      where: { userId },
      include,
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
        by: ['folderName', 'accessType'],
        _count: { _all: true },
        where: isCurator
          ? {}
          : {
              isActive: true,
              questions: { some: {} },
              OR: [
                { releaseDate: null },
                { releaseDate: '' },
                { releaseDate: { lte: new Date().toISOString() } },
              ],
            },
      }),
    ]);

    const countMap: Record<string, number> = {};
    const directFreeMap: Record<string, number> = {};
    const directPaidMap: Record<string, number> = {};
    for (const group of quizFolderCounts) {
      const name = (!group.folderName || group.folderName === 'Root / No Folder' || group.folderName === 'Root')
        ? 'Root'
        : group.folderName;
      countMap[name] = (countMap[name] || 0) + group._count._all;
      const bucket = group.accessType === 'PAID' ? directPaidMap : directFreeMap;
      bucket[name] = (bucket[name] || 0) + group._count._all;
    }

    // Map sub-folder counts
    const subFolderCountMap: Record<string, number> = {};
    const childrenByParent: Record<string, typeof dbFolders> = {};
    for (const f of dbFolders) {
      if (f.parentId) {
        subFolderCountMap[f.parentId] = (subFolderCountMap[f.parentId] || 0) + 1;
        (childrenByParent[f.parentId] ||= []).push(f);
      }
    }

    /**
     * Free/paid totals roll up through the tree: a parent whose own quizzes all
     * live in its sub-folders still has to survive an access-type filter, so it
     * counts every descendant's quizzes as well as its own.
     */
    const accessTotals = new Map<string, { free: number; paid: number }>();
    const inProgress = new Set<string>();
    const rollUpAccessTotals = (folder: (typeof dbFolders)[number]): { free: number; paid: number } => {
      const cached = accessTotals.get(folder.id);
      if (cached) return cached;
      // Guards a corrupt parent chain that loops back on itself.
      if (inProgress.has(folder.id)) return { free: 0, paid: 0 };
      inProgress.add(folder.id);
      let free = directFreeMap[folder.name] || 0;
      let paid = directPaidMap[folder.name] || 0;
      for (const child of childrenByParent[folder.id] || []) {
        const childTotals = rollUpAccessTotals(child);
        free += childTotals.free;
        paid += childTotals.paid;
      }
      inProgress.delete(folder.id);
      const totals = { free, paid };
      accessTotals.set(folder.id, totals);
      return totals;
    };

    const seenNames = new Set<string>();
    const result: any[] = [];

    // Map stored db folders
    for (const f of dbFolders) {
      seenNames.add(f.name);
      const access = rollUpAccessTotals(f);
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
        freeQuizCount: access.free,
        paidQuizCount: access.paid,
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
          // Discovered from quiz.folderName alone, so it can have no children.
          freeQuizCount: directFreeMap[folderName] || 0,
          paidQuizCount: directPaidMap[folderName] || 0,
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
        // Bottom of its parent unless the caller pinned a position. `?? 0`
        // would have put every new folder at the top the moment real
        // positions existed, which is the opposite of what a new folder wants.
        orderIndex: dto.orderIndex ?? (await this.nextFolderOrderIndex(parentId)),
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

    const folderNamesToDelete: string[] = [];
    const folderIdsToDelete: string[] = [];

    if (folder) {
      folderNamesToDelete.push(folder.name);
      folderIdsToDelete.push(folder.id);

      const collectDescendants = async (parentId: string) => {
        const children = await this.prisma.quizFolder.findMany({
          where: { parentId },
        });
        for (const child of children) {
          folderNamesToDelete.push(child.name);
          folderIdsToDelete.push(child.id);
          await collectDescendants(child.id);
        }
      };

      await collectDescendants(folder.id);
    } else {
      const targetName = idOrName.startsWith('virtual-')
        ? decodeURIComponent(idOrName.replace('virtual-', ''))
        : idOrName;
      folderNamesToDelete.push(targetName);
    }

    // 1. Permanently delete all quizzes in this folder and its subfolders
    if (folderNamesToDelete.length > 0) {
      await this.prisma.quiz.deleteMany({
        where: { folderName: { in: folderNamesToDelete } },
      });
    }

    // 2. Delete the folders from database
    if (folderIdsToDelete.length > 0) {
      await this.prisma.quizFolder.deleteMany({
        where: { id: { in: folderIdsToDelete } },
      });
    }

    return {
      success: true,
      message: `Folder "${folder?.name || idOrName}" and all its contents were deleted successfully.`,
    };
  }

  /**
   * Where a brand-new quiz goes: one past whatever sits lowest in its folder.
   *
   * Deliberately the bottom, not the top. An admin arranges a folder to read
   * as a syllabus — Chapter 1 first — and a new chapter belongs after the last
   * one, not ahead of it.
   */
  private async nextOrderIndex(folderName?: string | null): Promise<number> {
    const last = await this.prisma.quiz.findFirst({
      where: { folderName: folderName ?? 'Root' },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    return last ? last.orderIndex + 1 : 0;
  }

  /**
   * Applies a drag-to-reorder from the admin table.
   *
   * `items` carry absolute positions within the folder — the admin table is
   * paginated server-side, so a row's index on screen is not its index in the
   * folder, and the client is the only side that knows the page offset.
   */
  async reorderQuizzes(dto: { items: { id: string; orderIndex: number }[] }) {
    const items = (dto.items ?? []).filter((item) => !!item.id);
    if (items.length === 0) return { success: true, updated: 0 };

    const touched = await this.prisma.quiz.findMany({
      where: { id: { in: items.map((i) => i.id) } },
      select: { id: true, folderName: true },
    });
    if (touched.length === 0) throw new NotFoundException('No matching quizzes to reorder');

    // A drag happens inside one folder's table, but grouping costs nothing and
    // keeps a mixed request from writing one folder's positions into another.
    const folderOf = new Map(touched.map((q) => [q.id, q.folderName ?? 'Root']));
    const byFolder = new Map<string, { id: string; orderIndex: number }[]>();
    for (const item of items) {
      const folder = folderOf.get(item.id);
      if (!folder) continue;
      const bucket = byFolder.get(folder);
      if (bucket) bucket.push(item);
      else byFolder.set(folder, [item]);
    }

    let updated = 0;
    for (const [folderName, folderItems] of byFolder) {
      updated += await this.spliceFolderOrder(folderName, folderItems);
    }

    return { success: true, updated };
  }

  /**
   * Moves one quiz to an absolute position in its folder, shifting whatever
   * sits between out of the way — what the "Move to Position" dialog and the
   * Up/Down buttons need.
   *
   * Separate from {@link reorderQuizzes} because it is a different operation:
   * a drag hands over the new order of the rows on screen, whereas this is one
   * quiz jumping a distance that may cross pages the admin cannot even see.
   */
  async moveQuizToPosition(id: string, toPosition: number) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      select: { id: true, folderName: true },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    const folderName = quiz.folderName ?? 'Root';
    const position = Math.max(0, Math.trunc(toPosition));
    await this.spliceFolderOrder(folderName, [{ id, orderIndex: position }]);

    return { success: true, position };
  }

  /**
   * Rebuilds a folder's order: the named quizzes land on the absolute
   * positions asked for, everything else keeps its relative order and closes
   * up around them. The result is written as a dense 0..n-1 run.
   *
   * Rebuilding from the folder's *current* order — rather than writing the
   * incoming positions and hoping the rest sort themselves out — is what makes
   * this correct on data that predates `orderIndex`. Those rows all still hold
   * 0, so a bare write would leave them sorting ahead of every quiz that just
   * received a real position. Reading the display order first, then renumbering
   * the whole folder, retires those zeroes the first time a folder is touched.
   */
  private async spliceFolderOrder(
    folderName: string,
    items: { id: string; orderIndex: number }[],
  ): Promise<number> {
    const current = await this.prisma.quiz.findMany({
      where: { folderName },
      orderBy: QUIZ_ORDER,
      select: { id: true, orderIndex: true },
    });
    if (current.length === 0) return 0;

    const currentIds = current.map((q) => q.id);
    const known = new Set(currentIds);
    const moving = items
      .filter((item) => known.has(item.id))
      .sort((a, b) => a.orderIndex - b.orderIndex);
    if (moving.length === 0) return 0;

    const movingIds = new Set(moving.map((m) => m.id));
    const rest = currentIds.filter((id) => !movingIds.has(id));

    const next: string[] = [];
    let cursor = 0;
    for (const move of moving) {
      const target = Math.max(0, Math.min(currentIds.length - 1, move.orderIndex));
      while (next.length < target && cursor < rest.length) next.push(rest[cursor++]);
      next.push(move.id);
    }
    while (cursor < rest.length) next.push(rest[cursor++]);

    const currentIndex = new Map(current.map((q) => [q.id, q.orderIndex]));
    const drifted = next
      .map((id, position) => ({ id, position }))
      .filter(({ id, position }) => currentIndex.get(id) !== position);
    if (drifted.length === 0) return 0;

    await this.prisma.$transaction(
      drifted.map(({ id, position }) =>
        this.prisma.quiz.update({ where: { id }, data: { orderIndex: position } }),
      ),
    );
    return drifted.length;
  }

  /** One past the lowest folder sitting under the same parent. */
  private async nextFolderOrderIndex(parentId: string | null): Promise<number> {
    const last = await this.prisma.quizFolder.findFirst({
      where: { parentId: parentId ?? null },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    return last ? last.orderIndex + 1 : 0;
  }

  /**
   * Applies a drag-to-reorder of folders.
   *
   * Rebuilt from the siblings' current order rather than writing the incoming
   * positions straight through, for the same reason the quiz table needs it:
   * folders that have never been reordered all still hold the default 0, and a
   * bare write would leave them sorting ahead of every folder that just
   * received a real position.
   */
  async reorderFolders(dto: { items: { id: string; orderIndex: number }[] }) {
    // Virtual folders are synthesised from quiz `folderName`s and have no row
    // to update; the root pseudo-folder has none either.
    const items = (dto.items ?? []).filter(
      (item) => item.id && !item.id.startsWith('virtual-') && item.id !== 'root-folder',
    );
    if (items.length === 0) return this.listFolders(CURATOR);

    const touched = await this.prisma.quizFolder.findMany({
      where: { id: { in: items.map((i) => i.id) } },
      select: { id: true, parentId: true },
    });

    // Folders are ordered within their parent, so a request that spans levels
    // is split before anything is written.
    const parentOf = new Map(touched.map((f) => [f.id, f.parentId ?? null]));
    const byParent = new Map<string | null, { id: string; orderIndex: number }[]>();
    for (const item of items) {
      if (!parentOf.has(item.id)) continue;
      const parent = parentOf.get(item.id)!;
      const bucket = byParent.get(parent);
      if (bucket) bucket.push(item);
      else byParent.set(parent, [item]);
    }

    for (const [parentId, siblings] of byParent) {
      await this.spliceFolderPositions(parentId, siblings);
    }

    return this.listFolders(CURATOR);
  }

  /**
   * Rebuilds one parent's child order: the named folders land on the positions
   * asked for, their siblings keep their relative order and close up around
   * them, and the result is written as a dense 0..n-1 run.
   */
  private async spliceFolderPositions(
    parentId: string | null,
    items: { id: string; orderIndex: number }[],
  ): Promise<number> {
    const current = await this.prisma.quizFolder.findMany({
      where: { parentId: parentId ?? null },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, orderIndex: true },
    });
    if (current.length === 0) return 0;

    const currentIds = current.map((f) => f.id);
    const known = new Set(currentIds);
    const moving = items
      .filter((item) => known.has(item.id))
      .sort((a, b) => a.orderIndex - b.orderIndex);
    if (moving.length === 0) return 0;

    const movingIds = new Set(moving.map((m) => m.id));
    const rest = currentIds.filter((id) => !movingIds.has(id));

    const next: string[] = [];
    let cursor = 0;
    for (const move of moving) {
      const target = Math.max(0, Math.min(currentIds.length - 1, move.orderIndex));
      while (next.length < target && cursor < rest.length) next.push(rest[cursor++]);
      next.push(move.id);
    }
    while (cursor < rest.length) next.push(rest[cursor++]);

    const currentIndex = new Map(current.map((f) => [f.id, f.orderIndex]));
    const drifted = next
      .map((id, position) => ({ id, position }))
      .filter(({ id, position }) => currentIndex.get(id) !== position);
    if (drifted.length === 0) return 0;

    await this.prisma.$transaction(
      drifted.map(({ id, position }) =>
        this.prisma.quizFolder.update({ where: { id }, data: { orderIndex: position } }),
      ),
    );
    return drifted.length;
  }
}
