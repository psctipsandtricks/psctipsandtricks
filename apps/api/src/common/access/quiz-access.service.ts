import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** The subset of a quiz needed to decide whether it is behind a paywall. */
export interface PaywallableQuiz {
  id: string;
  accessType?: string | null;
  isPremium?: boolean | null;
  price?: number | null;
  discountPercent?: number | null;
  finalPrice?: number | null;
  title?: string | null;
}

/** What the caller is allowed to do with a quiz, and why. */
export interface QuizAccessState {
  /** The quiz is sold rather than free. */
  isPaid: boolean;
  /** The caller may read questions and attempt it. */
  hasAccess: boolean;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  reason: 'FREE' | 'PURCHASED' | 'STAFF' | 'LOGIN_REQUIRED' | 'PAYMENT_REQUIRED';
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

  /** True when the user holds a settled payment for this specific quiz. */
  async hasPurchased(userId: string, quizId: string): Promise<boolean> {
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

  /** Every quiz this user has settled payment for — one query for list routes. */
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
    const { quizIds: purchased } = await this.getPurchasedQuizIds(actor?.id);

    return quizzes.map((quiz) => {
      const originalPrice = quiz.price ?? 0;
      const discountPercent = quiz.discountPercent ?? 0;
      const effectivePrice = (quiz.finalPrice !== undefined && quiz.finalPrice !== null && quiz.finalPrice > 0)
        ? quiz.finalPrice
        : originalPrice;
      let access: QuizAccessState;

      if (!this.isPaidQuiz(quiz)) {
        access = { isPaid: false, hasAccess: true, price: 0, originalPrice: 0, discountPercent: 0, reason: 'FREE' };
      } else if (!actor?.id) {
        access = { isPaid: true, hasAccess: false, price: effectivePrice, originalPrice, discountPercent, reason: 'LOGIN_REQUIRED' };
      } else {
        const bought = purchased.has(quiz.id);
        access = {
          isPaid: true,
          hasAccess: bought,
          price: effectivePrice,
          originalPrice,
          discountPercent,
          reason: bought ? 'PURCHASED' : 'PAYMENT_REQUIRED',
        };
      }

      return { ...this.stripQuestionsIfLocked(quiz, access), access };
    });
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

    if (!this.isPaidQuiz(quiz)) {
      return { isPaid: false, hasAccess: true, price: 0, originalPrice: 0, discountPercent: 0, reason: 'FREE' };
    }
    if (!actor?.id) {
      return { isPaid: true, hasAccess: false, price: effectivePrice, originalPrice, discountPercent, reason: 'LOGIN_REQUIRED' };
    }

    const purchased = await this.hasPurchased(actor.id, quiz!.id);
    return {
      isPaid: true,
      hasAccess: purchased,
      price: effectivePrice,
      originalPrice,
      discountPercent,
      reason: purchased ? 'PURCHASED' : 'PAYMENT_REQUIRED',
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
      throw new ForbiddenException(
        state.reason === 'LOGIN_REQUIRED'
          ? 'Log in to access this premium quiz.'
          : 'This is a premium quiz. Complete the payment to unlock and attempt it.',
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
