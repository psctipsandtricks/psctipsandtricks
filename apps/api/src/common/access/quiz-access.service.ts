import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { subscriptionExpiryFrom } from './order-access-status';
import { QuizAccessState } from '@psc/shared-types';

export { QuizAccessState };

/** The subset of a quiz needed to decide whether it is behind a paywall. */
export interface PaywallableQuiz {
  id: string;
  accessType?: string | null;
  isPremium?: boolean | null;
  price?: number | null;
  discountPercent?: number | null;
  finalPrice?: number | null;
  title?: string | null;
  isLiveMock?: boolean | null;
  subscriptionType?: string | null;
  subscriptionDuration?: string | null;
  maxAttempts?: number | null;
}

/** Caller identity as populated on the request by the JWT strategy. */
export interface AccessActor {
  id: string;
  role?: UserRole | string | null;
  isPremium?: boolean | null;
}

/**
 * Decides who may read and attempt a paid quiz.
 */
@Injectable()
export class QuizAccessService {
  constructor(private prisma: PrismaService) {}

  isPaidQuiz(quiz: PaywallableQuiz | null | undefined): boolean {
    if (!quiz) return false;
    return quiz.accessType === 'PAID' || quiz.isPremium === true || (quiz.price ?? 0) > 0;
  }

  /** Staff need to preview and manage draft/paid content without the restrictions a student faces. */
  isStaff(actor?: AccessActor | null): boolean {
    return actor?.role === UserRole.ADMIN || actor?.role === UserRole.STAFF;
  }

  /** Checks if an actual settled SUCCESS order exists in database for this user and quiz. */
  async hasSettledOrder(userId: string, quizId: string): Promise<boolean> {
    const paidOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        status: 'SUCCESS',
        quizId,
      },
      select: { id: true },
    });
    return !!paidOrder;
  }

  /**
   * True when the user holds a settled payment for this specific quiz.
   * Staff and Admin users follow the exact same access & payment restrictions as students.
   */
  async hasPurchased(userId: string, quizId: string): Promise<boolean> {
    return this.hasSettledOrder(userId, quizId);
  }

  /**
   * Every quiz this user has settled payment for — one query for list routes.
   * Staff and Admin users are subject to the same access & payment restrictions as students.
   */
  async getPurchasedQuizIds(userId?: string | null): Promise<{ quizIds: Set<string>; hasAllAccess: boolean }> {
    if (!userId) return { quizIds: new Set(), hasAllAccess: false };

    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: 'SUCCESS',
        quizId: { not: null },
      },
      select: { quizId: true },
    });
    const quizIds = new Set(orders.filter((o) => o.quizId).map((o) => o.quizId as string));
    return { quizIds, hasAllAccess: false };
  }

  /**
   * List-route counterpart to `stripQuestionsIfLocked`: drops the answer key
   * from each paid quiz the caller has not bought, and tags every row with its
   * access state so the client can render locks.
   */
  async redactQuizList<T extends PaywallableQuiz & { questions?: unknown[] }>(
    actor: AccessActor | null | undefined,
    quizzes: T[],
  ): Promise<(T & { access: QuizAccessState })[]> {
    if (!actor?.id) {
      return quizzes.map((quiz) => {
        const originalPrice = quiz.price ?? 0;
        const discountPercent = quiz.discountPercent ?? 0;
        const effectivePrice = (quiz.finalPrice !== undefined && quiz.finalPrice !== null && quiz.finalPrice > 0)
          ? quiz.finalPrice
          : originalPrice;
        let access: QuizAccessState;

        if (!this.isPaidQuiz(quiz)) {
          access = {
            isPaid: false,
            hasAccess: true,
            price: 0,
            originalPrice: 0,
            discountPercent: 0,
            reason: 'FREE',
            canRepurchase: false,
          };
        } else {
          access = {
            isPaid: true,
            hasAccess: false,
            price: effectivePrice,
            originalPrice,
            discountPercent,
            reason: 'LOGIN_REQUIRED',
            subscriptionType: quiz.subscriptionType || 'FULL_TIME_ACCESS',
            subscriptionDuration: quiz.subscriptionDuration,
            maxAttempts: quiz.subscriptionType === 'SUBSCRIPTION' ? (quiz.maxAttempts ?? 5) : null,
            canRepurchase: false,
          };
        }

        const mockTestId = (quiz as any).mockTestId ?? (quiz as any).mockTests?.[0]?.id ?? null;
        return { ...this.stripQuestionsIfLocked(quiz, access), mockTestId, access };
      });
    }

    const results = await Promise.all(
      quizzes.map(async (quiz) => {
        const access = await this.getAccessState(actor, quiz);
        const mockTestId = (quiz as any).mockTestId ?? (quiz as any).mockTests?.[0]?.id ?? null;
        return { ...this.stripQuestionsIfLocked(quiz, access), mockTestId, access };
      }),
    );
    return results;
  }

  async getAccessState(
    actor: AccessActor | null | undefined,
    quiz: PaywallableQuiz | null | undefined,
  ): Promise<QuizAccessState> {
    const originalPrice = quiz?.price ?? 0;
    const discountPercent = quiz?.discountPercent ?? 0;
    const effectivePrice = (quiz?.finalPrice !== undefined && quiz?.finalPrice !== null && quiz.finalPrice > 0)
      ? quiz.finalPrice
      : originalPrice;

    const subscriptionType = quiz?.subscriptionType || 'FULL_TIME_ACCESS';
    const subscriptionDuration = quiz?.subscriptionDuration || null;
    const maxAttempts = subscriptionType === 'SUBSCRIPTION' ? (quiz?.maxAttempts ?? 5) : null;

    if (!this.isPaidQuiz(quiz)) {
      return {
        isPaid: false,
        hasAccess: true,
        price: 0,
        originalPrice: 0,
        discountPercent: 0,
        reason: 'FREE',
        subscriptionType: 'FULL_TIME_ACCESS',
        subscriptionDuration: null,
        maxAttempts: null,
        attemptsUsed: 0,
        remainingAttempts: null,
        canRepurchase: false,
      };
    }

    if (!actor?.id) {
      return {
        isPaid: true,
        hasAccess: false,
        price: effectivePrice,
        originalPrice,
        discountPercent,
        reason: 'LOGIN_REQUIRED',
        subscriptionType,
        subscriptionDuration,
        maxAttempts,
        attemptsUsed: 0,
        remainingAttempts: maxAttempts,
        canRepurchase: false,
      };
    }

    // Look for the latest settled SUCCESS order for this quiz
    const latestOrder = await this.prisma.order.findFirst({
      where: {
        userId: actor.id,
        status: 'SUCCESS',
        quizId: quiz!.id,
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (!latestOrder) {
      return {
        isPaid: true,
        hasAccess: false,
        price: effectivePrice,
        originalPrice,
        discountPercent,
        reason: 'PAYMENT_REQUIRED',
        subscriptionType,
        subscriptionDuration,
        maxAttempts,
        attemptsUsed: 0,
        remainingAttempts: maxAttempts,
        canRepurchase: false,
      };
    }

    if (subscriptionType === 'SUBSCRIPTION') {
      const orderDate = latestOrder.paidAt || latestOrder.createdAt;
      const validTill = latestOrder.validTill
        ? new Date(latestOrder.validTill)
        : subscriptionExpiryFrom(subscriptionDuration, orderDate);
      const isExpired = new Date().getTime() > validTill.getTime();

      // Count completed submissions created under this grant (since orderDate)
      const attemptsUsed = await this.prisma.quizSubmission.count({
        where: {
          userId: actor.id,
          quizId: quiz!.id,
          attemptStatus: 'COMPLETED',
          createdAt: { gte: orderDate },
        },
      });

      const limit = maxAttempts ?? 5;
      const isAttemptLimitReached = attemptsUsed >= limit;
      const remainingAttempts = Math.max(0, limit - attemptsUsed);

      if (isExpired) {
        return {
          isPaid: true,
          hasAccess: false,
          price: effectivePrice,
          originalPrice,
          discountPercent,
          reason: 'SUBSCRIPTION_EXPIRED',
          subscriptionType,
          subscriptionDuration,
          validTill: validTill.toISOString(),
          maxAttempts: limit,
          attemptsUsed,
          remainingAttempts,
          canRepurchase: true,
        };
      }

      if (isAttemptLimitReached) {
        return {
          isPaid: true,
          hasAccess: false,
          price: effectivePrice,
          originalPrice,
          discountPercent,
          reason: 'ATTEMPTS_EXHAUSTED',
          subscriptionType,
          subscriptionDuration,
          validTill: validTill.toISOString(),
          maxAttempts: limit,
          attemptsUsed,
          remainingAttempts: 0,
          canRepurchase: true,
        };
      }

      return {
        isPaid: true,
        hasAccess: true,
        price: effectivePrice,
        originalPrice,
        discountPercent,
        reason: 'PURCHASED',
        subscriptionType,
        subscriptionDuration,
        validTill: validTill.toISOString(),
        maxAttempts: limit,
        attemptsUsed,
        remainingAttempts,
        canRepurchase: false,
      };
    }

    // FULL_TIME_ACCESS
    return {
      isPaid: true,
      hasAccess: true,
      price: effectivePrice,
      originalPrice,
      discountPercent,
      reason: 'PURCHASED',
      subscriptionType: 'FULL_TIME_ACCESS',
      subscriptionDuration: null,
      validTill: null,
      maxAttempts: null,
      attemptsUsed: 0,
      remainingAttempts: null,
      canRepurchase: false,
    };
  }

  /**
   * Gate for anything that lets a user take part: starting an attempt, joining
   * a live mock test, or submitting answers.
   */
  async assertCanAttempt(
    actor: AccessActor | null | undefined,
    quiz: PaywallableQuiz | null | undefined,
  ): Promise<QuizAccessState> {
    const state = await this.getAccessState(actor, quiz);
    if (!state.hasAccess) {
      if (state.reason === 'LOGIN_REQUIRED') {
        throw new ForbiddenException('Log in to access this premium quiz.');
      }
      if (state.reason === 'SUBSCRIPTION_EXPIRED') {
        throw new ForbiddenException('Your subscription for this quiz has expired. Please repurchase to continue.');
      }
      if (state.reason === 'ATTEMPTS_EXHAUSTED') {
        throw new ForbiddenException(
          `You have exhausted the maximum attempts (${state.maxAttempts ?? 5}) for this quiz. Please repurchase to continue.`,
        );
      }
      throw new ForbiddenException(
        'This is a premium quiz. Complete the payment to unlock and attempt it.',
      );
    }
    return state;
  }

  /**
   * Removes the answer key from a quiz the caller has not paid for, so a locked
   * quiz can still be described (title, price, duration) without leaking it.
   */
  stripQuestionsIfLocked<T extends { questions?: unknown[] } | null | undefined>(
    quiz: T,
    state: QuizAccessState,
  ): T {
    if (!quiz || state.hasAccess) return quiz;
    return { ...(quiz as object), questions: [] } as T;
  }
}
