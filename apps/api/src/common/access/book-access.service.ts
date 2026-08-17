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

/** What the caller is allowed to do with a book, and why. */
export interface BookAccessState {
  /** The book is sold rather than free. */
  isPaid: boolean;
  /** The caller may download/read it. */
  hasAccess: boolean;
  price: number;
  reason: 'FREE' | 'PURCHASED' | 'STAFF' | 'LOGIN_REQUIRED' | 'PAYMENT_REQUIRED';
}

/**
 * Decides who may download a paid e-book. Mirrors QuizAccessService exactly:
 * entitlement comes from a SUCCESS order for that specific book, never from
 * the account-wide `user.isPremium` flag — that flag is set by any
 * successful purchase, so trusting it would unlock every paid book after a
 * single unrelated payment.
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

  /** True when the user holds a settled payment for this book. */
  async hasPurchased(userId: string, bookId: string): Promise<boolean> {
    const paidOrder = await this.prisma.order.findFirst({
      where: { userId, bookId, status: 'SUCCESS' },
      select: { id: true },
    });
    return !!paidOrder;
  }

  /** Every book this user has settled payment for — one query for list routes. */
  async getPurchasedBookIds(userId?: string | null): Promise<Set<string>> {
    if (!userId) return new Set();
    const orders = await this.prisma.order.findMany({
      where: { userId, status: 'SUCCESS', bookId: { not: null } },
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
      return { isPaid: false, hasAccess: true, price: 0, reason: 'FREE' };
    }
    if (this.isStaff(actor)) {
      return { isPaid: true, hasAccess: true, price, reason: 'STAFF' };
    }
    if (!actor?.id) {
      return { isPaid: true, hasAccess: false, price, reason: 'LOGIN_REQUIRED' };
    }

    const purchased = await this.hasPurchased(actor.id, book!.id);
    return {
      isPaid: true,
      hasAccess: purchased,
      price,
      reason: purchased ? 'PURCHASED' : 'PAYMENT_REQUIRED',
    };
  }

  /** List-route counterpart: tags every row with its access state and hides the PDF url until paid for. */
  async redactBookList<T extends PaywallableBook & { pdfUrl?: string | null }>(
    actor: AccessActor | null | undefined,
    books: T[],
  ): Promise<(T & { access: BookAccessState })[]> {
    const staff = this.isStaff(actor);
    const purchased = staff ? new Set<string>() : await this.getPurchasedBookIds(actor?.id);

    return books.map((book) => {
      const price = book.finalPrice ?? book.price ?? 0;
      let access: BookAccessState;

      if (!this.isPaidBook(book)) {
        access = { isPaid: false, hasAccess: true, price: 0, reason: 'FREE' };
      } else if (staff) {
        access = { isPaid: true, hasAccess: true, price, reason: 'STAFF' };
      } else if (!actor?.id) {
        access = { isPaid: true, hasAccess: false, price, reason: 'LOGIN_REQUIRED' };
      } else {
        const bought = purchased.has(book.id);
        access = { isPaid: true, hasAccess: bought, price, reason: bought ? 'PURCHASED' : 'PAYMENT_REQUIRED' };
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
