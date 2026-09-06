/**
 * Where a notification says it should take the student.
 *
 * A destination is whatever the admin panel typed into "Opens", which means it
 * can be a route this site does not have, a link meant for the mobile app, or a
 * typo. Everything is checked against the routes that actually exist before it
 * is opened — an unrecognised destination must land the student on their
 * notification list, never on a 404.
 */
export interface NotificationDestination {
  /** An in-app location, e.g. `/books/9f2c`. */
  href?: string;
  /** A link to open in a new tab. */
  externalUrl?: string;
}

/**
 * Route shapes this site can actually open.
 *
 * Written as patterns rather than compared against a list of literals because
 * most destinations carry an id: `/books/<id>` is valid, `/books/<id>/nonsense`
 * is not. Anchored at both ends so a partial match cannot slip through.
 *
 * Deliberately narrower than the mobile app's list — the same broadcast reaches
 * both, and a route only the app has (`/books/<id>/read`, `/attempt/<id>`) must
 * fall back here rather than 404.
 */
const KNOWN_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/books$/,
  /^\/books\/[^/]+$/,
  /^\/quizzes$/,
  /^\/quizzes\/[^/]+$/,
  /^\/mock-tests$/,
  /^\/mock-tests\/[^/]+$/,
  /^\/videos$/,
  /^\/videos\/[^/]+$/,
  /^\/pdfs$/,
  /^\/pdfs\/[^/]+$/,
  /^\/community$/,
  /^\/community\/[^/]+$/,
  /^\/dashboard$/,
  /^\/orders$/,
  /^\/profile$/,
  /^\/notifications$/,
];

/**
 * Resolves a raw destination, or null when there is nothing safe to open.
 *
 * Null is the signal to leave the student on the notification list, and it
 * covers an empty field, a route this site does not have, and anything that is
 * not a route or an http link at all.
 */
export function resolveNotificationDestination(raw?: string | null): NotificationDestination | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const url = new URL(value);
      // A string that starts with the scheme but will not parse is not a link.
      if (!url.host) return null;
      return { externalUrl: url.toString() };
    } catch {
      return null;
    }
  }

  // Reject protocol-relative and scheme-like values outright: `//evil.com` and
  // `javascript:alert(1)` are neither a path we own nor an http link.
  if (value.startsWith('//') || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)) return null;

  // The admin panel accepts a path with or without its leading slash.
  const path = value.startsWith('/') ? value : `/${value}`;

  // Query and fragment are kept on the way through — `/quizzes?filter=free` is
  // a real destination — but only the path decides whether it is known.
  let parsed: URL;
  try {
    parsed = new URL(path, 'https://placeholder.invalid');
  } catch {
    return null;
  }
  const normalised =
    parsed.pathname.length > 1 && parsed.pathname.endsWith('/')
      ? parsed.pathname.slice(0, -1)
      : parsed.pathname;

  if (!KNOWN_ROUTES.some((pattern) => pattern.test(normalised))) return null;

  return { href: `${parsed.pathname}${parsed.search}${parsed.hash}` };
}
