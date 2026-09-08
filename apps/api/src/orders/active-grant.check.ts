/**
 * Assertions for the rule behind "already purchased and currently active".
 *
 * Run with `npm run check:grants`. A plain script rather than a spec because
 * the API has no test runner; it exits non-zero on the first wrong answer.
 *
 * The same predicate is written twice on purpose — once as a Prisma `where` in
 * `createManualOrder`, once in the admin modal that greys the item out — so it
 * is worth pinning what it means in one readable place.
 */

// A module, not a global script: each check file declares its own `check`
// and `failures`, and without this they would collide with the others.
export {};
interface OrderRow {
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  bookId?: string | null;
  quizId?: string | null;
  validTill?: Date | null;
}

/** Mirrors the guard's `where` clause, and the modal's filter. */
function isActiveFor(
  rows: OrderRow[],
  item: { bookId?: string; quizId?: string },
  now = new Date(),
): boolean {
  return rows.some((o) => {
    if (o.status !== 'SUCCESS') return false;
    if (item.bookId ? o.bookId !== item.bookId : o.quizId !== item.quizId) return false;
    // No expiry means lifetime access.
    return o.validTill == null || o.validTill.getTime() > now.getTime();
  });
}

const now = new Date('2026-09-08T10:00:00Z');
const past = new Date('2026-08-01T10:00:00Z');
const future = new Date('2026-12-01T10:00:00Z');

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — got ${actual}, want ${expected}`);
}

check('nothing bought', isActiveFor([], { bookId: 'b1' }, now), false);

check(
  'a lifetime purchase blocks a second grant',
  isActiveFor([{ status: 'SUCCESS', bookId: 'b1', validTill: null }], { bookId: 'b1' }, now),
  true,
);

check(
  'a live subscription blocks a second grant',
  isActiveFor([{ status: 'SUCCESS', bookId: 'b1', validTill: future }], { bookId: 'b1' }, now),
  true,
);

check(
  'an expired subscription does not — re-granting is how it is renewed',
  isActiveFor([{ status: 'SUCCESS', bookId: 'b1', validTill: past }], { bookId: 'b1' }, now),
  false,
);

check(
  'a refunded order does not block',
  isActiveFor([{ status: 'REFUNDED', bookId: 'b1', validTill: null }], { bookId: 'b1' }, now),
  false,
);

check(
  'a pending order does not block',
  isActiveFor([{ status: 'PENDING', bookId: 'b1', validTill: null }], { bookId: 'b1' }, now),
  false,
);

check(
  'owning one book says nothing about another',
  isActiveFor([{ status: 'SUCCESS', bookId: 'b1', validTill: null }], { bookId: 'b2' }, now),
  false,
);

check(
  'a book and a quiz are not confused for each other',
  isActiveFor([{ status: 'SUCCESS', bookId: 'b1', validTill: null }], { quizId: 'b1' }, now),
  false,
);

check(
  'a quiz already held blocks a second grant',
  isActiveFor([{ status: 'SUCCESS', quizId: 'q1', validTill: null }], { quizId: 'q1' }, now),
  true,
);

check(
  'an expired grant alongside a live one still blocks',
  isActiveFor(
    [
      { status: 'SUCCESS', bookId: 'b1', validTill: past },
      { status: 'SUCCESS', bookId: 'b1', validTill: future },
    ],
    { bookId: 'b1' },
    now,
  ),
  true,
);

check(
  'expiring exactly now is no longer active',
  isActiveFor([{ status: 'SUCCESS', bookId: 'b1', validTill: now }], { bookId: 'b1' }, now),
  false,
);

console.log(failures === 0 ? '\nactive grants: all checks passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
