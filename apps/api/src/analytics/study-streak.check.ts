/**
 * Assertions for the study-streak day arithmetic.
 *
 * Run with `npm run check:streak`. This is a plain script rather than a spec
 * because the API has no test runner; it exits non-zero on the first wrong
 * answer, so it works the same way in CI.
 */
import { computeStreakDays, localDayKey } from './study-streak';

/** An instant written as the wall-clock time a student in Kerala would read. */
const ist = (wallClock: string) => new Date(`${wallClock}+05:30`);

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — got ${actual}, want ${expected}`);
}

// A day belongs to the student's calendar, not the server's. Both of these
// read as the previous day in UTC, which is what the streak used to count.
check('01:00 is still that day', localDayKey(ist('2026-09-08T01:00')), '2026-09-08');
check('23:30 is still that day', localDayKey(ist('2026-09-08T23:30')), '2026-09-08');

// The two cases the UTC arithmetic got wrong.
check(
  'consecutive days that share a UTC day count as two',
  computeStreakDays(
    [ist('2026-09-06T23:00'), ist('2026-09-07T04:00')],
    ist('2026-09-07T09:00'),
  ),
  2,
);
check(
  'one day split across two UTC days counts as one',
  computeStreakDays(
    [ist('2026-09-07T04:00'), ist('2026-09-07T22:00')],
    ist('2026-09-07T20:00'),
  ),
  1,
);
check(
  'a run of early-morning sessions stays unbroken',
  computeStreakDays(
    [ist('2026-09-06T02:00'), ist('2026-09-07T02:00'), ist('2026-09-08T02:00')],
    ist('2026-09-08T09:00'),
  ),
  3,
);

const evening = ist('2026-09-08T20:00');
check('studied today', computeStreakDays([ist('2026-09-08T19:00')], evening), 1);
check(
  'studied yesterday, not yet today',
  computeStreakDays([ist('2026-09-07T19:00')], evening),
  1,
);
check(
  'a whole day missed ends it',
  computeStreakDays([ist('2026-09-06T19:00')], evening),
  0,
);
check(
  'five days running',
  computeStreakDays(
    [4, 3, 2, 1, 0].map((back) => ist(`2026-09-0${8 - back}T19:00`)),
    evening,
  ),
  5,
);
check(
  'a gap mid-run stops the count there',
  computeStreakDays(
    [ist('2026-09-08T19:00'), ist('2026-09-06T19:00'), ist('2026-09-05T19:00')],
    evening,
  ),
  1,
);
check(
  'three sessions in one day are one day',
  computeStreakDays(
    [ist('2026-09-08T08:00'), ist('2026-09-08T13:00'), ist('2026-09-08T21:00')],
    evening,
  ),
  1,
);
check('nothing attempted', computeStreakDays([], evening), 0);
check(
  'just past midnight, having studied last evening',
  computeStreakDays([ist('2026-09-08T21:00')], ist('2026-09-09T00:30')),
  1,
);

console.log(failures === 0 ? '\nstudy streak: all checks passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
