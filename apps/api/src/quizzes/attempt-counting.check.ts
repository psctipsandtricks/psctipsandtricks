/**
 * Assertions for the attempt-counting rule, run against a stand-in for the
 * QuizSubmission table.
 *
 * Run with `npm run check:attempts`. A plain script rather than a spec because
 * the API has no test runner; it exits non-zero on the first wrong answer.
 *
 * The rule under test: an attempt is an attempt only once it has been
 * submitted. Opening a quiz and leaving leaves an IN_PROGRESS row; starting
 * over retires that row as ABANDONED. Neither is counted, and neither takes an
 * attempt number — which is what `countCompletedAttempts() + 1` guarantees in
 * `quizzes.service.ts`.
 */

// A module, not a global script: each check file declares its own `check`
// and `failures`, and without this they would collide with the others.
export {};
type Status = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
interface Row {
  id: string;
  attemptNumber: number;
  attemptStatus: Status;
}

/** The subset of the service's behaviour this script pins. */
class Attempts {
  private rows: Row[] = [];
  private seq = 0;

  private get completedCount() {
    return this.rows.filter((r) => r.attemptStatus === 'COMPLETED').length;
  }

  private get active() {
    return this.rows.find((r) => r.attemptStatus === 'IN_PROGRESS') ?? null;
  }

  /** Mirrors `startAttempt`. */
  start(restart = false): Row {
    const active = this.active;
    if (active && !restart) return active;
    if (active) active.attemptStatus = 'ABANDONED';

    const row: Row = {
      id: `a${++this.seq}`,
      attemptNumber: this.completedCount + 1,
      attemptStatus: 'IN_PROGRESS',
    };
    this.rows.push(row);
    return row;
  }

  /** Mirrors the update branch of `submitQuiz`. */
  submit(): Row {
    const active = this.active;
    if (!active) throw new Error('nothing to submit');
    active.attemptStatus = 'COMPLETED';
    return active;
  }

  /** Mirrors `getAttemptSummary` for one quiz. */
  summary() {
    return {
      completedCount: this.completedCount,
      inProgressAttemptId: this.active?.id ?? null,
    };
  }
}

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${name} — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`,
  );
}

// Never opened.
{
  const a = new Attempts();
  check('nothing opened counts nothing', a.summary(), {
    completedCount: 0,
    inProgressAttemptId: null,
  });
}

// Opened and walked away from.
{
  const a = new Attempts();
  const first = a.start();
  check('the first attempt is numbered 1', first.attemptNumber, 1);
  check('an unfinished attempt is not counted', a.summary(), {
    completedCount: 0,
    inProgressAttemptId: 'a1',
  });
  check('coming back resumes the same attempt', a.start().id, 'a1');
}

// Submitting is what counts.
{
  const a = new Attempts();
  a.start();
  a.submit();
  check('a submitted attempt counts once', a.summary(), {
    completedCount: 1,
    inProgressAttemptId: null,
  });
  check('the retake is numbered 2', a.start().attemptNumber, 2);
  a.submit();
  check('and counts on submit', a.summary().completedCount, 2);
}

// Starting over does not inflate anything.
{
  const a = new Attempts();
  a.start();
  const restarted = a.start(true);
  check('starting over issues a new attempt', restarted.id, 'a2');
  check('starting over does not count as an attempt', a.summary(), {
    completedCount: 0,
    inProgressAttemptId: 'a2',
  });
  check('the fresh attempt is still numbered 1', restarted.attemptNumber, 1);
  a.submit();
  check('only the submitted one counts', a.summary().completedCount, 1);
}

// A long, messy history: three submits and a lot of walking away.
{
  const a = new Attempts();
  a.start();
  a.submit(); // 1
  a.start(); // a2
  a.start(true); // a2 abandoned, a3 opened
  a.submit(); // 2
  const open = a.start(); // a4, left open
  check('abandoned and open rows never inflate the count', a.summary(), {
    completedCount: 2,
    inProgressAttemptId: 'a4',
  });
  // Four rows exist; two were submitted, so this one is the third attempt.
  check('the open attempt is numbered 3', open.attemptNumber, 3);
  a.submit();
  check('three submitted attempts', a.summary().completedCount, 3);
}

console.log(failures === 0 ? '\nattempt counting: all checks passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
