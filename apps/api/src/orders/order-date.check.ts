/**
 * Assertions for the rule behind an order's recorded date.
 *
 * Run with `npm run check:order-dates`. A plain script rather than a spec
 * because the API has no test runner; it exits non-zero on the first wrong
 * answer.
 *
 * Two rules are pinned here, both of which were wrong in ways an admin could
 * see. The filter boundary is written twice on purpose — once in the browser
 * (`localDayBoundaryIso` in the admin orders page), once here — because the
 * table renders each order's date in the admin's timezone and the filter has to
 * cut the range at the same instants the display does. And re-dating a
 * subscription order has to move the window that purchase bought, or the admin
 * is shown one purchase date while the student's access still runs from the old.
 */

// A module, not a global script: each check file declares its own `check`
// and `failures`, and without this they would collide with the others.
export {};

/** Mirrors `rangeBoundary` in orders.service.ts. */
function rangeBoundary(value: string | undefined, edge: 'start' | 'end'): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (edge === 'start') parsed.setUTCHours(0, 0, 0, 0);
    else parsed.setUTCHours(23, 59, 59, 999);
  }
  return parsed;
}

/** Mirrors `localDayBoundaryIso` in the admin orders page. */
function localDayBoundaryIso(dateStr: string, edge: 'start' | 'end', offsetMinutes: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  const ms = edge === 'start' ? 0 : 24 * 60 * 60 * 1000 - 1;
  // A timezone `offsetMinutes` ahead of UTC starts its day that much earlier.
  return new Date(utcMidnight + ms + offsetMinutes * 60_000).toISOString();
}

/** Whether an order made at `at` shows up under a filter for the single day `day`. */
function inDayFilter(at: Date, day: string, offsetMinutes: number): boolean {
  const gte = rangeBoundary(localDayBoundaryIso(day, 'start', -offsetMinutes), 'start')!;
  const lte = rangeBoundary(localDayBoundaryIso(day, 'end', -offsetMinutes), 'end')!;
  return at.getTime() >= gte.getTime() && at.getTime() <= lte.getTime();
}

import { subscriptionExpiryFrom } from '../common/access/order-access-status';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — got ${actual}, want ${expected}`);
}

// An admin in IST (UTC+5:30) filtering for 1 Sep. Each instant below is the
// moment an order was placed, written as the UTC it is stored as.
const IST = 330;

check(
  'an order at 00:00 on the filtered day is in it',
  inDayFilter(new Date('2026-08-31T18:30:00.000Z'), '2026-09-01', IST),
  true,
);

check(
  'an order at 02:00, once dropped by the UTC-midnight cut, is in it',
  inDayFilter(new Date('2026-08-31T20:30:00.000Z'), '2026-09-01', IST),
  true,
);

check(
  'an order at 23:59:59 on the filtered day is in it',
  inDayFilter(new Date('2026-09-01T18:29:59.000Z'), '2026-09-01', IST),
  true,
);

check(
  'the last moment of the previous day is not',
  inDayFilter(new Date('2026-08-31T18:29:59.999Z'), '2026-09-01', IST),
  false,
);

check(
  'the first moment of the next day is not — it belongs to 2 Sep',
  inDayFilter(new Date('2026-09-01T18:30:00.000Z'), '2026-09-01', IST),
  false,
);

check(
  'an admin in UTC gets the same day, cut at their own midnight',
  inDayFilter(new Date('2026-09-01T00:00:00.000Z'), '2026-09-01', 0),
  true,
);

check(
  'a bare YYYY-MM-DD still means the whole UTC day, for callers with no timezone',
  rangeBoundary('2026-09-01', 'start')!.toISOString() +
    '..' +
    rangeBoundary('2026-09-01', 'end')!.toISOString(),
  '2026-09-01T00:00:00.000Z..2026-09-01T23:59:59.999Z',
);

// Re-dating a subscription order moves the window it bought. This is the rule
// `updateOrder` applies, and the one `createManualOrder` applies to a backdated
// grant — both count the term from the purchase, never from today.
check(
  'a 1-year subscription backdated to 1 Sep 2026 runs to 1 Sep 2027',
  subscriptionExpiryFrom('1_YEAR', new Date('2026-09-01T11:17:00.000Z')).toISOString(),
  '2027-09-01T11:17:00.000Z',
);

check(
  'a 1-month subscription backdated to 1 Sep 2026 runs to 1 Oct 2026',
  subscriptionExpiryFrom('1_MONTH', new Date('2026-09-01T11:17:00.000Z')).toISOString(),
  '2026-10-01T11:17:00.000Z',
);

check(
  'a backdated grant that has already lapsed comes out expired, not fresh',
  subscriptionExpiryFrom('1_MONTH', new Date('2026-01-10T00:00:00.000Z')).getTime() <
    new Date('2026-09-09T00:00:00.000Z').getTime(),
  true,
);

console.log(failures === 0 ? '\norder dates: all checks passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
