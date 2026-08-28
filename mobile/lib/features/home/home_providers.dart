import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/providers/app_providers.dart';
import '../../data/models/book.dart';
import '../../data/models/mock_test.dart';
import '../../data/models/notification.dart';
import '../../data/models/quiz.dart';

/// The books rail on the home screen — a short slice of the catalog rather
/// than the whole thing, so the tab paints in one small request.
final featuredBooksProvider =
    FutureProvider.autoDispose<List<Book>>((ref) async {
  ref.keepAlive();
  return ref.watch(booksRepositoryProvider).fetchBooks(limit: 10);
});

/// Premium question banks only.
///
/// Filtered client-side rather than with `access=PAID`, because the server
/// treats a quiz as paid when *any* of accessType, isPremium or a non-zero
/// price says so — a server-side accessType filter would miss the other two.
/// [Quiz.isPaid] mirrors that predicate exactly.
final premiumQuizzesProvider =
    FutureProvider.autoDispose<List<Quiz>>((ref) async {
  ref.keepAlive();
  final quizzes =
      await ref.watch(quizzesRepositoryProvider).fetchQuizzes(limit: 40);
  final premium = quizzes.where((q) => q.isPaid).toList()
    // Newest first, so a freshly published bank leads the rail and its "New"
    // badge is the first thing seen.
    ..sort((a, b) => (b.createdAt ?? DateTime(0))
        .compareTo(a.createdAt ?? DateTime(0)));
  return premium.take(12).toList();
});

/// The mock test running right now, if there is one.
///
/// Failure is swallowed: a mock test is a bonus on the home screen, and a
/// signed-out student or a flaky call should not take the whole page down.
final liveMockTestProvider =
    FutureProvider.autoDispose<MockTest?>((ref) async {
  try {
    final mocks = await ref
        .watch(mockTestsRepositoryProvider)
        .fetchMockTests(status: MockTestStatus.live);
    if (mocks.isNotEmpty) return mocks.first;

    // Nothing live: surface the next one starting soon so the card still has
    // something worth showing.
    final upcoming = await ref
        .watch(mockTestsRepositoryProvider)
        .fetchMockTests(status: MockTestStatus.upcoming);
    if (upcoming.isEmpty) return null;
    upcoming.sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
    final next = upcoming.first;
    return next.startsIn.inHours <= 48 ? next : null;
  } catch (_) {
    return null;
  }
});

/// Popups inside their scheduled window. Failure is silent: an announcement is
/// never important enough to break the home screen.
final activeAnnouncementsProvider =
    FutureProvider.autoDispose<List<AnnouncementPopup>>((ref) async {
  try {
    return await ref
        .watch(notificationsRepositoryProvider)
        .fetchActiveAnnouncements();
  } catch (_) {
    return const [];
  }
});

/// Announcements the student has already dealt with — closed, opened, or acted
/// on with the card's button.
///
/// Persisted by id, so a notice met once does not return on the next launch,
/// and read synchronously so the home screen never paints a card the student
/// has already seen and then yanks it away.
class SeenAnnouncementsController extends StateNotifier<Set<String>> {
  SeenAnnouncementsController(this._prefs)
      : super(_prefs.getStringList(_key)?.toSet() ?? <String>{});

  static const _key = 'psc_seen_announcements';

  /// The list is otherwise append-only, and the server never asks about a
  /// notice that has already expired — only the newest ids are worth keeping.
  static const _maxRemembered = 200;

  final SharedPreferences _prefs;

  void markSeen(String id) {
    if (state.contains(id)) return;
    // A LinkedHashSet keeps insertion order, so trimming drops the oldest ids.
    final ids = [...state, id];
    final kept = ids.length > _maxRemembered
        ? ids.sublist(ids.length - _maxRemembered)
        : ids;
    state = kept.toSet();
    _prefs.setStringList(_key, kept);
  }
}

final seenAnnouncementsProvider =
    StateNotifierProvider<SeenAnnouncementsController, Set<String>>(
  (ref) => SeenAnnouncementsController(ref.watch(sharedPrefsProvider)),
);

/// The queue the home screen walks one card at a time: active announcements
/// the student has not closed or opened yet, in the order the API returned.
final pendingAnnouncementsProvider =
    Provider.autoDispose<List<AnnouncementPopup>>((ref) {
  final active = ref.watch(activeAnnouncementsProvider).valueOrNull ?? const [];
  final seen = ref.watch(seenAnnouncementsProvider);
  return active.where((a) => !seen.contains(a.id)).toList();
});
