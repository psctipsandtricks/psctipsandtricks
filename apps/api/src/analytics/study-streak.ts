/**
 * How far the students' calendar day is ahead of UTC.
 *
 * A streak is counted in calendar days, and which day a study session belongs
 * to depends on where the student is — not on where the server happens to run,
 * which is UTC. This app's students sit their exams in Kerala, so their day
 * starts at midnight IST. India keeps no daylight saving, so a fixed offset is
 * exact rather than an approximation, and stepping back in 24-hour jumps always
 * lands on the previous calendar day.
 */
export const APP_UTC_OFFSET_MINUTES = 330; // UTC+05:30

/** The `YYYY-MM-DD` the instant falls on, in the students' own timezone. */
export function localDayKey(
  at: Date,
  offsetMinutes: number = APP_UTC_OFFSET_MINUTES,
): string {
  return new Date(at.getTime() + offsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Consecutive days with at least one study session, counting back from today.
 *
 * Yesterday still counts as the head of the streak: a student who studied last
 * night has not broken anything by not having started yet this morning, and
 * showing them a zero before the day is out would be both wrong and dispiriting.
 * The streak only ends once a whole day has gone by with nothing in it.
 */
export function computeStreakDays(
  sessions: Iterable<Date>,
  now: Date = new Date(),
  offsetMinutes: number = APP_UTC_OFFSET_MINUTES,
): number {
  const studied = new Set<string>();
  for (const at of sessions) studied.add(localDayKey(at, offsetMinutes));
  if (studied.size === 0) return 0;

  const dayBack = (days: number) =>
    localDayKey(new Date(now.getTime() - days * 24 * 60 * 60 * 1000), offsetMinutes);

  let offset = studied.has(dayBack(0)) ? 0 : studied.has(dayBack(1)) ? 1 : -1;
  if (offset < 0) return 0;

  let streak = 0;
  while (studied.has(dayBack(offset))) {
    streak++;
    offset++;
  }
  return streak;
}
