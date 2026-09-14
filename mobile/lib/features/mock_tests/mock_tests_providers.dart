import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../data/models/mock_test.dart';
import '../../data/models/paginated.dart';
import '../../data/models/quiz.dart';

/// Everything the Mock tests screen renders in one shot: the (small) live and
/// upcoming rails in full, plus one numbered page of the completed archive.
class MockTestsView {
  const MockTestsView({
    required this.live,
    required this.upcoming,
    required this.completed,
  });

  final List<MockTest> live;
  final List<MockTest> upcoming;
  final Paginated<MockTest> completed;

  bool get isEmpty =>
      live.isEmpty && upcoming.isEmpty && completed.totalItems == 0;
}

/// Available filter options on the Mock Tests screen.
const mockTestFilterOptions = [
  'All',
  'Live Now',
  'Upcoming',
  'Completed',
  'Free',
  'Paid',
];

/// Search query for mock tests.
final mockTestsSearchProvider = StateProvider.autoDispose<String>((ref) => '');

/// Selected filter chip on mock tests screen.
final mockTestsFilterProvider = StateProvider.autoDispose<String>((ref) => 'All');

/// Active page index for mock tests pagination.
final mockTestsPageIndexProvider = StateProvider.autoDispose<int>((ref) => 1);

/// Which page of the completed archive is on screen (used in grouped default view).
final completedMocksPageIndexProvider =
    StateProvider.autoDispose<int>((ref) => 1);

/// Fetches all mock tests for filtering, searching, and pagination.
final allMockTestsProvider =
    FutureProvider.autoDispose<List<MockTest>>((ref) async {
  final repo = ref.watch(mockTestsRepositoryProvider);
  return repo.fetchMockTests();
});

/// Mock tests filtered by current search query and selected filter chip.
final filteredMockTestsProvider =
    Provider.autoDispose<AsyncValue<List<MockTest>>>((ref) {
  final allAsync = ref.watch(allMockTestsProvider);
  final search = ref.watch(mockTestsSearchProvider).trim().toLowerCase();
  final filter = ref.watch(mockTestsFilterProvider);

  return allAsync.whenData((all) {
    return all.where((mock) {
      // Search filter
      if (search.isNotEmpty) {
        final matchesTitle = mock.title.toLowerCase().contains(search);
        final matchesQuiz =
            mock.quiz?.title.toLowerCase().contains(search) ?? false;
        if (!matchesTitle && !matchesQuiz) return false;
      }

      // Category / status filter
      switch (filter) {
        case 'Live Now':
          return mock.status == MockTestStatus.live;
        case 'Upcoming':
          return mock.status == MockTestStatus.upcoming;
        case 'Completed':
          return mock.status == MockTestStatus.completed;
        case 'Free':
          return !mock.isPaid;
        case 'Paid':
          return mock.isPaid;
        case 'All':
        default:
          return true;
      }
    }).toList();
  });
});

final mockTestsViewProvider =
    FutureProvider.autoDispose<MockTestsView>((ref) async {
  final repo = ref.watch(mockTestsRepositoryProvider);
  final page = ref.watch(completedMocksPageIndexProvider);

  final rails = await Future.wait([
    repo.fetchMockTests(status: MockTestStatus.live),
    repo.fetchMockTests(status: MockTestStatus.upcoming),
  ]);
  final completed = await repo.fetchMockTestsPage(
    status: MockTestStatus.completed,
    page: page,
  );

  final live = [...rails[0]]
    ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
  final upcoming = [...rails[1]]
    ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));

  return MockTestsView(live: live, upcoming: upcoming, completed: completed);
});

final mockTestProvider =
    FutureProvider.autoDispose.family<MockTest, String>((ref, id) {
  return ref.watch(mockTestsRepositoryProvider).fetchMockTest(id);
});

final mockLeaderboardProvider = FutureProvider.autoDispose
    .family<List<LeaderboardEntry>, String>((ref, id) {
  return ref.watch(mockTestsRepositoryProvider).fetchLeaderboard(id);
});

final myMockAttemptsProvider =
    FutureProvider.autoDispose<List<MockTestParticipant>>((ref) {
  return ref.watch(mockTestsRepositoryProvider).fetchMyAttempts();
});

/// The mock tests this student has already sat, by id.
///
/// The list and detail payloads carry `submitted` themselves and that is the
/// source of truth; this is the belt to those braces. `/my-attempts` has
/// reported the student's own participation since long before `submitted`
/// existed, so a phone talking to an API that predates it — an app updated
/// ahead of the server, which is the normal order of a release — still knows
/// not to offer a join for a paper already handed in.
///
/// Signed out it asks nothing: there are no attempts to have, and the request
/// would be a 401 on every build of the home screen. A failed call reads as
/// "nothing submitted", which falls back to the payload's own answer rather
/// than overriding it.
final submittedMockTestIdsProvider = Provider.autoDispose<Set<String>>((ref) {
  // Signed out there is nothing to ask about, and the request would be a 401
  // on every build of the home screen.
  if (ref.watch(currentUserProvider) == null) return const <String>{};
  final attempts = ref.watch(myMockAttemptsProvider).valueOrNull;
  if (attempts == null) return const <String>{};
  return {
    for (final attempt in attempts)
      if (attempt.submittedAt != null) attempt.mockTestId,
  };
});

/// Whether [mock] has been submitted by this student, according to either the
/// payload it arrived in or the student's own attempt list.
bool mockTestSubmitted(WidgetRef ref, MockTest mock) =>
    mock.submitted || ref.watch(submittedMockTestIdsProvider).contains(mock.id);

