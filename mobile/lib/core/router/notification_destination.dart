/// Where a notification says it should take the student.
///
/// A destination is whatever the admin panel typed into "Opens" or attached
/// as a route/url/deep-link, which means it can be an in-app route, a website
/// link, an external URL, or a typo. Everything is checked against the routes
/// that actually exist before it is opened.
class NotificationDestination {
  const NotificationDestination._({this.location, this.externalUrl});

  /// An in-app location, e.g. `/books/9f2c` or `/attempt/q1`.
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
  RegExp(r'^/login$'),
  RegExp(r'^/signup$'),
  RegExp(r'^/register$'),
  RegExp(r'^/forgot-password$'),
];

/// A website or legacy path and the app path that means the same thing.
class _RouteAlias {
  const _RouteAlias(this.pattern, this.build);

  /// Matched against the normalised path.
  final RegExp pattern;

  /// Builds the app path from the match. May carry its own query string.
  final String Function(Match) build;
}

/// Website and alternate route aliases rewritten to their app equivalent.
final _routeAliases = <_RouteAlias>[
  // Quizzes: direct attempt
  _RouteAlias(RegExp(r'^/quizzes/([^/]+)$'), (m) => '/attempt/${m[1]}'),
  _RouteAlias(RegExp(r'^/quizzes/([^/]+)/attempt$'), (m) => '/attempt/${m[1]}'),
  _RouteAlias(RegExp(r'^/quizzes/([^/]+)/result$'), (m) => '/attempt-result/${m[1]}'),
  _RouteAlias(RegExp(r'^/quiz/([^/]+)$'), (m) => '/attempt/${m[1]}'),
  _RouteAlias(RegExp(r'^/quiz-history$'), (_) => '/quizzes/history'),

  // Mock tests
  _RouteAlias(RegExp(r'^/mock-tests/([^/]+)/attempt$'), (m) => '/mock-tests/${m[1]}'),
  _RouteAlias(RegExp(r'^/mock-test/([^/]+)$'), (m) => '/mock-tests/${m[1]}'),

  // Books
  _RouteAlias(RegExp(r'^/book/([^/]+)$'), (m) => '/books/${m[1]}'),
  _RouteAlias(RegExp(r'^/book/([^/]+)/read$'), (m) => '/books/${m[1]}/read'),
  _RouteAlias(RegExp(r'^/downloads$'), (_) => '/books/downloads'),

  // Account / Profile / Community
  _RouteAlias(RegExp(r'^/me$'), (_) => '/account'),
  _RouteAlias(RegExp(r'^/user$'), (_) => '/account'),
  _RouteAlias(RegExp(r'^/chat/([^/]+)$'), (m) => '/community/${m[1]}'),

  // Library & Media
  _RouteAlias(RegExp(r'^/videos$'), (_) => '/library?tab=videos'),
  _RouteAlias(RegExp(r'^/pdfs$'), (_) => '/library?tab=pdfs'),
  _RouteAlias(RegExp(r'^/videos/([^/]+)$'), (m) => '/library/videos/${m[1]}'),
  _RouteAlias(RegExp(r'^/pdfs/([^/]+)$'), (m) => '/library/pdfs/${m[1]}'),
];

/// Rewrites a path to the app's equivalent, or null when there is none.
String? _aliasFor(String path, Uri original) {
  for (final alias in _routeAliases) {
    final match = alias.pattern.firstMatch(path);
    if (match == null) continue;

    final target = Uri.parse(alias.build(match));
    if (!_knownRoutes.any((pattern) => pattern.hasMatch(target.path))) return null;

    final params = {...original.queryParameters, ...target.queryParameters};
    final query = params.isEmpty ? '' : '?${Uri(queryParameters: params).query}';
    final fragment = original.fragment.isNotEmpty ? '#${original.fragment}' : '';
    return '${target.path}$query$fragment';
  }
  return null;
}

/// Tries to resolve a path (with query/fragment) to an in-app route location.
String? _resolveInAppPath(String rawPath, Uri uri) {
  final path = rawPath.startsWith('/') ? rawPath : '/$rawPath';
  final parsed = Uri.tryParse(path);
  if (parsed == null) return null;

  final normalised = parsed.path.length > 1 && parsed.path.endsWith('/')
      ? parsed.path.substring(0, parsed.path.length - 1)
      : parsed.path;

  if (_knownRoutes.any((pattern) => pattern.hasMatch(normalised))) {
    final query = uri.hasQuery ? '?${uri.query}' : (parsed.hasQuery ? '?${parsed.query}' : '');
    final fragment = uri.fragment.isNotEmpty ? '#${uri.fragment}' : (parsed.fragment.isNotEmpty ? '#${parsed.fragment}' : '');
    return '$normalised$query$fragment';
  }

  return _aliasFor(normalised, uri);
}

/// Resolves a raw destination into an in-app destination or external URL.
///
/// Null is returned when there is nothing valid to open, signaling fallback
/// to the notifications list.
NotificationDestination? resolveNotificationDestination(String? raw) {
  final value = (raw ?? '').trim();
  if (value.isEmpty) return null;

  // Handle custom schemes or web URLs: psctips://, psctipsandtricks://, http://, https://
  final isUriWithScheme = value.contains('://') ||
      value.startsWith('http://') ||
      value.startsWith('https://');

  if (isUriWithScheme) {
    final uri = Uri.tryParse(value);
    if (uri == null) return null;

    // Check if the URI path resolves to an in-app route
    if (uri.path.isNotEmpty && uri.path != '/') {
      final inApp = _resolveInAppPath(uri.path, uri);
      if (inApp != null) {
        return NotificationDestination._(location: inApp);
      }
    }

    // Custom app schemes (e.g. psctips://books/123)
    if (uri.scheme == 'psctips' ||
        uri.scheme == 'psctipsandtricks' ||
        uri.scheme == 'app') {
      final hostAndPath = '/${uri.host}${uri.path}';
      final inApp = _resolveInAppPath(hostAndPath, uri);
      if (inApp != null) {
        return NotificationDestination._(location: inApp);
      }
      return null;
    }

    // If it's a valid web link with a host, treat as external URL for the browser
    if ((uri.scheme == 'http' || uri.scheme == 'https') && uri.host.isNotEmpty) {
      return NotificationDestination._(externalUrl: uri);
    }

    return null;
  }

  // Pure in-app path: '/books/123', 'quizzes/456', etc.
  final inApp = _resolveInAppPath(value, Uri.tryParse(value.startsWith('/') ? value : '/$value') ?? Uri());
  if (inApp != null) {
    return NotificationDestination._(location: inApp);
  }

  return null;
}

