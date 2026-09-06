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
  RegExp(r'^/attempt-result/[^/]+$'),
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

/// A website path and the app path that means the same thing.
class _RouteAlias {
  const _RouteAlias(this.pattern, this.build);

  /// Matched against the normalised path.
  final RegExp pattern;

  /// Builds the app path from the match. May carry its own query string.
  final String Function(Match) build;
}

/// Website routes rewritten to their app equivalent.
///
/// One notification is sent to both platforms from a single free-text "Opens"
/// field, so a link is usually typed in the shape the *website* uses. Where the
/// app has the same destination under a different path, the link is translated
/// rather than thrown away — anything with no equivalent still falls back to
/// the notification list.
///
/// Only consulted after [_knownRoutes] misses, so a real app route that merely
/// looks like a web one — `/quizzes/history` against `/quizzes/<id>` — is never
/// rewritten.
final _routeAliases = <_RouteAlias>[
  // The website gives a quiz its own page; the app goes straight into the
  // attempt, which is exactly what tapping that quiz in the app does.
  _RouteAlias(RegExp(r'^/quizzes/([^/]+)$'), (m) => '/attempt/${m[1]}'),
  // The app files videos and PDFs as two tabs of one library screen.
  _RouteAlias(RegExp(r'^/videos$'), (_) => '/library?tab=videos'),
  _RouteAlias(RegExp(r'^/pdfs$'), (_) => '/library?tab=pdfs'),
  _RouteAlias(RegExp(r'^/videos/([^/]+)$'), (m) => '/library/videos/${m[1]}'),
  _RouteAlias(RegExp(r'^/pdfs/([^/]+)$'), (m) => '/library/pdfs/${m[1]}'),
];

/// Rewrites a website path to the app's equivalent, or null when there is none.
String? _aliasFor(String path, Uri original) {
  for (final alias in _routeAliases) {
    final match = alias.pattern.firstMatch(path);
    if (match == null) continue;

    final target = Uri.parse(alias.build(match));
    // A rewrite that does not itself land on a real route is a mistake in the
    // table above, not somewhere to send a student.
    if (!_knownRoutes.any((pattern) => pattern.hasMatch(target.path))) return null;

    // The alias's own parameters are what make the destination work (`tab`), so
    // they win; anything the admin typed that the app still reads (`title` on a
    // video or PDF list) is carried through alongside them.
    final params = {...original.queryParameters, ...target.queryParameters};
    final query = params.isEmpty ? '' : '?${Uri(queryParameters: params).query}';
    final fragment = original.fragment.isNotEmpty ? '#${original.fragment}' : '';
    return '${target.path}$query$fragment';
  }
  return null;
}

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

  if (!_knownRoutes.any((pattern) => pattern.hasMatch(normalised))) {
    // Not a route this app has — but it may be the website's name for one.
    final aliased = _aliasFor(normalised, uri);
    return aliased == null ? null : NotificationDestination._(location: aliased);
  }

  // The *normalised* path is what gets opened, not the raw one. go_router
  // matches on path segments, so a trailing slash makes `/books/<id>/` miss
  // `/books/:id` and land on the "page does not exist" screen — which is the
  // one outcome this function exists to prevent.
  final query = uri.hasQuery ? '?${uri.query}' : '';
  final fragment = uri.fragment.isNotEmpty ? '#${uri.fragment}' : '';
  return NotificationDestination._(location: '$normalised$query$fragment');
}
