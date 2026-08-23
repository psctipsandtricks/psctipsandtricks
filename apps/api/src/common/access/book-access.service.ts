import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessActor } from './quiz-access.service';

/** The subset of a book needed to decide whether it is behind a paywall. */
export interface PaywallableBook {
  id: string;
  isPremium?: boolean | null;
  finalPrice?: number | null;
  price?: number | null;
}

export interface BookSubscriptionAccessInfo {
  isSubscription: boolean;
  validTill?: string | null;
  isExpired: boolean;
  expiresInDays?: number | null;
}

/** What the caller is allowed to do with a book, and why. */
export interface BookAccessState {
  /** The book is sold rather than free. */
  isPaid: boolean;
  /** The caller may download/read it. */
  hasAccess: boolean;
  price: number;
  reason: 'FREE' | 'PURCHASED' | 'STAFF' | 'LOGIN_REQUIRED' | 'PAYMENT_REQUIRED';
  subscription?: BookSubscriptionAccessInfo | null;
}

/**
 * Decides who may download/read a paid e-book. Entitlement comes from an active,
 * non-expired SUCCESS order for that specific book.
 */
@Injectable()
export class BookAccessService {
  constructor(private prisma: PrismaService) {}

  isPaidBook(book: PaywallableBook | null | undefined): boolean {
    if (!book) return false;
    return book.isPremium === true || (book.finalPrice ?? book.price ?? 0) > 0;
  }

  isStaff(actor?: AccessActor | null): boolean {
    return actor?.role === UserRole.ADMIN || actor?.role === UserRole.STAFF;
  }

  /** True when the user holds an active, non-expired settled payment for this book. */
  async hasPurchased(userId: string, bookId: string): Promise<boolean> {
    const now = new Date();
    const paidOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        bookId,
        status: 'SUCCESS',
        OR: [{ validTill: null }, { validTill: { gt: now } }],
      },
      select: { id: true },
    });
    return !!paidOrder;
  }

  /** Every book this user currently has active, valid access for — one query for list routes. */
  async getPurchasedBookIds(userId?: string | null): Promise<Set<string>> {
    if (!userId) return new Set();
    const now = new Date();
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: 'SUCCESS',
        bookId: { not: null },
        OR: [{ validTill: null }, { validTill: { gt: now } }],
      },
      select: { bookId: true },
    });
    return new Set(orders.map((o) => o.bookId as string));
  }

  async getAccessState(
    actor: AccessActor | null | undefined,
    book: PaywallableBook | null | undefined,
  ): Promise<BookAccessState> {
    const price = book?.finalPrice ?? book?.price ?? 0;

    if (!this.isPaidBook(book)) {
      return { isPaid: false, hasAccess: true, price: 0, reason: 'FREE', subscription: null };
    }
    if (!actor?.id) {
      return { isPaid: true, hasAccess: false, price, reason: 'LOGIN_REQUIRED', subscription: null };
    }

    const now = new Date();
    // Find latest successful order for this book
    const order = await this.prisma.order.findFirst({
      where: { userId: actor.id, bookId: book!.id, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, validTill: true, accessType: true },
    });

    if (!order) {
      return {
        isPaid: true,
        hasAccess: false,
        price,
        reason: 'PAYMENT_REQUIRED',
        subscription: null,
      };
    }

    if (order.validTill) {
      const validTillDate = new Date(order.validTill);
      const isExpired = validTillDate.getTime() <= now.getTime();
      const diffMs = validTillDate.getTime() - now.getTime();
      const expiresInDays = isExpired ? 0 : Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      return {
        isPaid: true,
        hasAccess: !isExpired,
        price,
        reason: !isExpired ? 'PURCHASED' : 'PAYMENT_REQUIRED',
        subscription: {
          isSubscription: true,
          validTill: validTillDate.toISOString(),
          isExpired,
          expiresInDays,
        },
      };
    }

    // Full time access / Lifetime purchase
    return {
      isPaid: true,
      hasAccess: true,
      price,
      reason: 'PURCHASED',
      subscription: null,
    };
  }

  /** List-route counterpart: tags every row with its access state and hides the PDF url until paid for. */
  async redactBookList<T extends PaywallableBook & { pdfUrl?: string | null }>(
    actor: AccessActor | null | undefined,
    books: T[],
  ): Promise<(T & { access: BookAccessState })[]> {
    const now = new Date();

    // Fetch user's latest orders for these books if logged in
    const userOrdersMap = new Map<string, { validTill: Date | null; accessType: string | null }>();
    if (actor?.id) {
      const bookIds = books.map((b) => b.id);
      const orders = await this.prisma.order.findMany({
        where: {
          userId: actor.id,
          bookId: { in: bookIds },
          status: 'SUCCESS',
        },
        orderBy: { createdAt: 'desc' },
        select: { bookId: true, validTill: true, accessType: true },
      });
      for (const ord of orders) {
        if (ord.bookId && !userOrdersMap.has(ord.bookId)) {
          userOrdersMap.set(ord.bookId, { validTill: ord.validTill, accessType: ord.accessType });
        }
      }
    }

    return books.map((book) => {
      const price = book.finalPrice ?? book.price ?? 0;
      let access: BookAccessState;

      if (!this.isPaidBook(book)) {
        access = { isPaid: false, hasAccess: true, price: 0, reason: 'FREE', subscription: null };
      } else if (!actor?.id) {
        access = { isPaid: true, hasAccess: false, price, reason: 'LOGIN_REQUIRED', subscription: null };
      } else {
        const order = userOrdersMap.get(book.id);
        if (!order) {
          access = { isPaid: true, hasAccess: false, price, reason: 'PAYMENT_REQUIRED', subscription: null };
        } else if (order.validTill) {
          const validTillDate = new Date(order.validTill);
          const isExpired = validTillDate.getTime() <= now.getTime();
          const diffMs = validTillDate.getTime() - now.getTime();
          const expiresInDays = isExpired ? 0 : Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          access = {
            isPaid: true,
            hasAccess: !isExpired,
            price,
            reason: !isExpired ? 'PURCHASED' : 'PAYMENT_REQUIRED',
            subscription: {
              isSubscription: true,
              validTill: validTillDate.toISOString(),
              isExpired,
              expiresInDays,
            },
          };
        } else {
          access = { isPaid: true, hasAccess: true, price, reason: 'PURCHASED', subscription: null };
        }
      }

      return { ...this.stripPdfIfLocked(book, access), access };
    });
  }

  /** Gate for the actual download action. */
  async assertCanDownload(
    actor: AccessActor | null | undefined,
    book: PaywallableBook | null | undefined,
  ): Promise<BookAccessState> {
    const state = await this.getAccessState(actor, book);
    if (!state.hasAccess) {
      if (state.subscription?.isExpired) {
        throw new ForbiddenException(
          'Your subscription for this book has expired. Please renew to continue reading and downloading.',
        );
      }
      throw new ForbiddenException(
        state.reason === 'LOGIN_REQUIRED'
          ? 'Log in to download this premium book.'
          : 'This is a premium book. Complete the payment to unlock the download.',
      );
    }
    return state;
  }

  /** Removes the PDF url from a book the caller has not paid for, so a locked book can still be described without leaking the file. */
  stripPdfIfLocked<T extends { pdfUrl?: string | null } | null | undefined>(book: T, state: BookAccessState): T {
    if (!book || state.hasAccess) return book;
    return { ...(book as object), pdfUrl: null } as T;
  }
}

