import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../data/models/book.dart';
import '../../data/models/mock_test.dart';
import '../quizzes/quizzes_providers.dart';

/// The books rail on the home screen — a short slice of the catalog rather
/// than the whole thing, so the tab paints in one small request.
final featuredBooksProvider =
    FutureProvider.autoDispose<List<Book>>((ref) async {
  ref.keepAlive();
  return ref.watch(booksRepositoryProvider).fetchBooks(limit: 10);
});

/// Premium question banks only.
///
/// Aliased to [premiumCarouselQuizzesProvider] so the Home Page and Quiz Hub
/// display the exact same 10 newest premium quizzes in the same release order.
final premiumQuizzesProvider = premiumCarouselQuizzesProvider;



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
