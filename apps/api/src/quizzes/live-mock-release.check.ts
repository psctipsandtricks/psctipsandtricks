/**
 * Assertions for the live-mock release window — the rule that decides whether
 * a quiz held back from the catalog is still reachable by the students sitting
 * the session it belongs to.
 *
 * Run with `npm run check:live-mock`. A plain script rather than a spec because
 * the API has no test runner; it exits non-zero on the first wrong answer.
 *
 * The rule under test: an admin who turns on "Live Mock Test Session" no longer
 * picks a release moment — it is pinned to the end of the session, so the paper
 * cannot be practised out of the folders while the rank list is still moving.
 * That leaves `findOne` and `startAttempt` refusing the very students who are
 * meant to be sitting it, which `isLiveMockSessionOpen` is the exemption for.
 * Both boundaries matter: too tight and a room full of students is locked out
 * of a paper mid-exam; too loose and the paper stays reachable after its
 * session has closed.
 */

// A module, not a global script: each check file declares its own `check`
// and `failures`, and without this they would collide with the others.
export {};

import { isLiveMockSessionOpen } from './quizzes.service';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${name} — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`,
  );
}

const at = (iso: string) => new Date(iso);
const START = at('2026-09-10T10:00:00.000Z');
const END = at('2026-09-10T12:00:00.000Z');
const open = { scheduledAt: START, endsAt: END, status: 'LIVE' };

// No session at all: an ordinary scheduled quiz, which stays unreachable.
{
  check('a quiz with no session is never exempt', isLiveMockSessionOpen(null, START), false);
  check('undefined is treated the same', isLiveMockSessionOpen(undefined, START), false);
}

// Before the session opens.
{
  check(
    'a minute before the start, still closed',
    isLiveMockSessionOpen(open, at('2026-09-10T09:59:00.000Z')),
    false,
  );
  check('the exact start moment is open', isLiveMockSessionOpen(open, START), true);
}

// While it runs — the case that must not break, because it is a live exam.
{
  check(
    'mid-session the paper is reachable',
    isLiveMockSessionOpen(open, at('2026-09-10T11:00:00.000Z')),
    true,
  );
  check(
    'a second before the end, still reachable',
    isLiveMockSessionOpen(open, at('2026-09-10T11:59:59.000Z')),
    true,
  );
}

// The close. The end moment is also the quiz's release moment, so the exemption
// must stop exactly as the ordinary release takes over — no gap, no overlap.
{
  check('the exact end moment is closed', isLiveMockSessionOpen(open, END), false);
  check(
    'after the end it is closed',
    isLiveMockSessionOpen(open, at('2026-09-10T12:00:01.000Z')),
    false,
  );
}

// A session the processor has already marked finished is finished, whatever the
// clock says — that flag is what the rest of the app reads.
{
  const completed = { ...open, status: 'COMPLETED' };
  check(
    'COMPLETED wins over a still-future end',
    isLiveMockSessionOpen(completed, at('2026-09-10T11:00:00.000Z')),
    false,
  );
}

// No explicit end: the mock test service falls back to 24 hours after the
// start, and this has to agree with it or the two disagree about when the
// session — and so the release — actually happened.
{
  const openEnded = { scheduledAt: START, endsAt: null, status: 'LIVE' };
  check(
    'open-ended is reachable 23 hours in',
    isLiveMockSessionOpen(openEnded, at('2026-09-11T09:00:00.000Z')),
    true,
  );
  check(
    'open-ended closes at 24 hours',
    isLiveMockSessionOpen(openEnded, at('2026-09-11T10:00:00.000Z')),
    false,
  );
}

// An UPCOMING row whose start has passed but which nothing has promoted yet is
// still a session in progress; status only closes the window when COMPLETED.
{
  const notYetPromoted = { ...open, status: 'UPCOMING' };
  check(
    'an unpromoted session mid-window is still open',
    isLiveMockSessionOpen(notYetPromoted, at('2026-09-10T11:00:00.000Z')),
    true,
  );
}

console.log(
  failures === 0 ? '\nlive mock release window: all checks passed' : `\n${failures} failed`,
);
process.exit(failures === 0 ? 0 : 1);
