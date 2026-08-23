import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../data/models/mock_test.dart';
import '../../data/models/quiz.dart';

final mockTestsProvider =
    FutureProvider.autoDispose<List<MockTest>>((ref) async {
  ref.keepAlive();
  return ref.watch(mockTestsRepositoryProvider).fetchMockTests();
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
