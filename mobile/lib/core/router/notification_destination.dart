/// Where a notification says it should take the student.
///
/// A destination is whatever the admin panel typed into "Opens", which means it
/// can be a route this app does not have, a link meant for the website, or a
/// typo. Everything is checked against the routes that actually exist before it
/// is opened — an unrecognised destination must land the student on their
/// notification list, never on a blank screen or a router error.
class NotificationDestination {
  const NotificationDestination._({this.location, this.externalUrl});

  /// An in-app location, e.g. `/books/9f2c`.
  final String? location;

  /// A link to hand to the browser.
  final Uri? externalUrl;

  bool get isExternal => externalUrl != null;
}

/// Route shapes this app can actually open.
///
/// Written as patterns rather than compared against `AppRoutes` strings because
/// most destinations carry an id: `/books/<id>` is valid, `/books/<id>/nonsense`
/// is not. Anchored at both ends so a partial match cannot slip through.
final _knownRoutes = <RegExp>[
  RegExp(r'^/$'),
  RegExp(r'^/books$'),
  RegExp(r'^/books/downloads$'),
  // A book, and the reader for that book.
  RegExp(r'^/books/[^/]+$'),
  RegExp(r'^/books/[^/]+/read$'),
  RegExp(r'^/quizzes$'),
  RegExp(r'^/quizzes/history$'),
  RegExp(r'^/attempt/[^/]+$'),
  RegExp(r'^/mock-tests$'),
  RegExp(r'^/mock-tests/[^/]+$'),
  RegExp(r'^/library$'),
  RegExp(r'^/library/videos/[^/]+$'),
  RegExp(r'^/library/pdfs/[^/]+$'),
  RegExp(r'^/community$'),
  RegExp(r'^/community/[^/]+$'),
  RegExp(r'^/dashboard$'),
  RegExp(r'^/orders$'),
  RegExp(r'^/profile$'),
  RegExp(r'^/account$'),
  RegExp(r'^/notifications$'),
];

/// Resolves a raw destination, or null when there is nothing safe to open.
///
/// Null is the signal to fall back to the notification list, and it covers an
/// empty field, a route this build does not have, and anything that is not a
/// route or an http link at all.
NotificationDestination? resolveNotificationDestination(String? raw) {
  final value = (raw ?? '').trim();
  if (value.isEmpty) return null;

  if (value.startsWith('http://') || value.startsWith('https://')) {
    final uri = Uri.tryParse(value);
    // A string that starts with the scheme but will not parse is not a link.
    if (uri == null || uri.host.isEmpty) return null;
    return NotificationDestination._(externalUrl: uri);
  }

  // The admin panel accepts a path with or without its leading slash.
  final path = value.startsWith('/') ? value : '/$value';

  // Query and fragment are kept on the way through — `/books/x/read?resume=1`
  // is a real destination — but only the path decides whether it is known.
  final uri = Uri.tryParse(path);
  if (uri == null) return null;
  final normalised = uri.path.length > 1 && uri.path.endsWith('/')
      ? uri.path.substring(0, uri.path.length - 1)
      : uri.path;

  if (!_knownRoutes.any((pattern) => pattern.hasMatch(normalised))) return null;

  return NotificationDestination._(location: path);
}
