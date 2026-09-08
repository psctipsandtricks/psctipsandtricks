/**
 * Whether the student can actually use what an order bought them.
 *
 * Deliberately separate from `Order.status`, which is about the *payment*: a
 * captured payment for a lapsed subscription is a SUCCESS order that grants
 * nothing, and the two answers have to be told apart wherever a human is
 * looking at a purchase record.
 */
export type OrderAccessState =
  /** Paid for, and it never runs out. */
  | 'FULL_ACCESS'
  /** Paid for, and it runs out on `validTill`. */
  | 'TIME_LIMITED'
  /** Was time-limited, and that date has passed. */
  | 'EXPIRED'
  /** The order never settled, or was reversed — nothing was ever granted. */
  | 'NOT_GRANTED';

export interface OrderAccessStatus {
  state: OrderAccessState;
  /** ISO. Set for `TIME_LIMITED` and `EXPIRED`; null when access has no end. */
  validTill: string | null;
  /** Whole days remaining, for `TIME_LIMITED`. Zero once expired. */
  expiresInDays: number | null;
  /** For `NOT_GRANTED`, the order status that withheld access. */
  reason?: string | null;
}

/** The book fields that decide whether a purchase is dated. */
export interface AccessBookShape {
  subscriptionType?: string | null;
  subscriptionDuration?: string | null;
}

export interface AccessOrderShape {
  status: string;
  validTill?: Date | string | null;
  createdAt: Date | string;
  book?: AccessBookShape | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * When a subscription bought at [from] runs out.
 *
 * The single implementation: the reader, the orders service and the admin
 * status column all resolve expiry through here, so an admin can never be shown
 * "valid until" one date while the app enforces another.
 */
export function subscriptionExpiryFrom(
  duration: string | null | undefined,
  from: Date = new Date(),
): Date {
  const validTill = new Date(from);
  switch (duration) {
    case '1_MONTH':
      validTill.setMonth(validTill.getMonth() + 1);
      break;
    case '3_MONTHS':
      validTill.setMonth(validTill.getMonth() + 3);
      break;
    case '6_MONTHS':
      validTill.setMonth(validTill.getMonth() + 6);
      break;
    case '1_YEAR':
      validTill.setFullYear(validTill.getFullYear() + 1);
      break;
    default:
      validTill.setMonth(validTill.getMonth() + 1);
      break;
  }
  return validTill;
}

/**
 * Resolves what an order currently entitles its buyer to.
 *
 * `validTill` on the order is authoritative when it is there. It is not always
 * there: it has only been written since subscriptions were introduced, so a
 * subscription book bought before then — or imported from the legacy app — has
 * a null `validTill` on a row that is nevertheless dated. Those are recovered
 * the same way the student-facing access check recovers them, from the book's
 * own duration counted from the purchase, rather than being reported as
 * lifetime access nobody actually has.
 */
export function resolveOrderAccessStatus(
  order: AccessOrderShape,
  now: Date = new Date(),
): OrderAccessStatus {
  // Only a settled payment grants anything. Pending, failed, cancelled and
  // refunded orders all leave the student with nothing, for different reasons —
  // the reason is carried through so the caller can say which.
  if (order.status !== 'SUCCESS') {
    return {
      state: 'NOT_GRANTED',
      validTill: null,
      expiresInDays: null,
      reason: order.status,
    };
  }

  const effective =
    order.validTill ??
    (order.book?.subscriptionType === 'SUBSCRIPTION'
      ? subscriptionExpiryFrom(order.book.subscriptionDuration, new Date(order.createdAt))
      : null);

  if (!effective) {
    return { state: 'FULL_ACCESS', validTill: null, expiresInDays: null };
  }

  const validTill = new Date(effective);
  if (Number.isNaN(validTill.getTime())) {
    // An unparseable date is not evidence of a limit; treat it as no limit
    // rather than denying access on the strength of a bad row.
    return { state: 'FULL_ACCESS', validTill: null, expiresInDays: null };
  }

  if (validTill.getTime() <= now.getTime()) {
    return {
      state: 'EXPIRED',
      validTill: validTill.toISOString(),
      expiresInDays: 0,
    };
  }

  return {
    state: 'TIME_LIMITED',
    validTill: validTill.toISOString(),
    expiresInDays: Math.max(1, Math.ceil((validTill.getTime() - now.getTime()) / MS_PER_DAY)),
  };
}
