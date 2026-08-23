import '../../core/network/api_client.dart';
import '../../core/utils/json.dart';
import '../models/quiz.dart';

class QuizzesRepository {
  QuizzesRepository(this._api);

  final ApiClient _api;

  /// Folders at one level of the hierarchy. `parentId` null lists the roots.
  Future<List<QuizFolder>> fetchFolders({String? parentId}) async {
    final res = await _api.get<dynamic>(
      '/quizzes/folders',
      query: {if (parentId != null) 'parentId': parentId},
    );
    return J.rows(res)
        .whereType<Map>()
        .map((e) => QuizFolder.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<Quiz>> fetchQuizzes({
    String? search,
    String? folderId,
    String? category,
    bool publishedOnly = true,
    int page = 1,
    int limit = 30,
  }) async {
    final res = await _api.get<dynamic>(
      '/quizzes',
      query: {
        'publishedOnly': publishedOnly,
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
        if (folderId != null) 'folderId': folderId,
        if (category != null && category.isNotEmpty && category != 'All')
          'category': category,
      },
    );
    return J.rows(res)
        .whereType<Map>()
        .map((e) => Quiz.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  /// A single quiz. The server withholds `questions` on a premium quiz the
  /// caller has not paid for and returns an `access` verdict instead.
  Future<Quiz> fetchQuiz(String id) async {
    final res = await _api.get<Map<String, dynamic>>('/quizzes/$id');
    return Quiz.fromJson(res);
  }

  /// Starts a new attempt, or returns the one already in progress.
  Future<QuizAttempt?> startAttempt(String quizId) async {
    final res = await _api.post<dynamic>('/quizzes/$quizId/attempts/start');
    final map = J.mapOrNull(res);
    return map == null ? null : QuizAttempt.fromJson(map);
  }

  Future<QuizAttempt?> fetchActiveAttempt(String quizId) async {
    final res = await _api.get<dynamic>('/quizzes/$quizId/attempts/active');
    final map = J.mapOrNull(res);
    return map == null || map.isEmpty ? null : QuizAttempt.fromJson(map);
  }

  Future<void> submitAttempt(
    String quizId,
    QuizSubmission submission, {
    String? attemptId,
  }) {
    return _api.post<dynamic>(
      '/quizzes/$quizId/submit',
      body: {
        ...submission.toJson(),
        if (attemptId != null) 'attemptId': attemptId,
      },
    );
  }

  Future<List<QuizAttempt>> fetchMyAttempts() async {
    final res = await _api.get<dynamic>('/quizzes/history/me');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => QuizAttempt.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<LeaderboardEntry>> fetchLeaderboard(String quizId) async {
    final res = await _api.get<dynamic>('/quizzes/$quizId/leaderboard');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => LeaderboardEntry.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}
