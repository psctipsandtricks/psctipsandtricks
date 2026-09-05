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



/// The mock tests worth showing at the top of the home screen: every test
/// running right now (LIVE) as well as upcoming ones, sorted so LIVE tests appear
/// first, followed by upcoming tests sorted by scheduled start time.
///
/// Failure is swallowed: a mock test is a bonus on the home screen, and a
/// signed-out student or a flaky call should not take the whole page down.
final liveMockTestsProvider =
    FutureProvider.autoDispose<List<MockTest>>((ref) async {
  try {
    final all = await ref.watch(mockTestsRepositoryProvider).fetchMockTests();
    final active = all
        .where((m) =>
            (m.status == MockTestStatus.live ||
             m.status == MockTestStatus.upcoming) &&
            (m.quiz?.totalQuestions ?? 0) > 0)
        .toList();

    active.sort((a, b) {
      final aRank = a.status == MockTestStatus.live ? 0 : 1;
      final bRank = b.status == MockTestStatus.live ? 0 : 1;
      final rankDiff = aRank.compareTo(bRank);
      if (rankDiff != 0) return rankDiff;
      return a.scheduledAt.compareTo(b.scheduledAt);
    });

    return active;
  } catch (_) {
    return const [];
  }
});
