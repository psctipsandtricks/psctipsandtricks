import '../../core/network/api_client.dart';
import '../../core/utils/json.dart';
import '../models/mock_test.dart';
import '../models/paginated.dart';
import '../models/quiz.dart';

class MockTestsRepository {
  MockTestsRepository(this._api);

  final ApiClient _api;

  Future<List<MockTest>> fetchMockTests({MockTestStatus? status}) async {
    final res = await _api.get<dynamic>(
      '/mock-tests',
      query: {if (status != null) 'status': status.name.toUpperCase()},
    );
    return J.rows(res)
        .whereType<Map>()
        .map((e) => MockTest.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  /// One numbered page of mock tests for a single status (used by the
  /// "Completed" rail).
  Future<Paginated<MockTest>> fetchMockTestsPage({
    required MockTestStatus status,
    required int page,
    int limit = 10,
  }) async {
    final res = await _api.get<dynamic>(
      '/mock-tests',
      query: {
        'status': status.name.toUpperCase(),
        'page': page,
        'limit': limit,
      },
    );
    return Paginated.fromJson(res, MockTest.fromJson);
  }

  Future<MockTest> fetchMockTest(String id) async {
    final res = await _api.get<Map<String, dynamic>>('/mock-tests/$id');
    return MockTest.fromJson(res);
  }

  Future<void> join(String id) => _api.post<dynamic>('/mock-tests/$id/join');

  Future<void> submit(String id, QuizSubmission submission) =>
      _api.post<dynamic>('/mock-tests/$id/submit', body: submission.toJson());

  Future<List<LeaderboardEntry>> fetchLeaderboard(String id) async {
    final res = await _api.get<dynamic>('/mock-tests/$id/leaderboard');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => LeaderboardEntry.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<MockTestParticipant>> fetchMyAttempts() async {
    final res = await _api.get<dynamic>('/mock-tests/my-attempts');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => MockTestParticipant.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}
