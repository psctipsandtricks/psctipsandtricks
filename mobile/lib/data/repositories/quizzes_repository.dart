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
    String? folderName,
    String? accessType,
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
        // The API keys this off Quiz.folderName, not the folder's id.
        if (folderName != null && folderName.isNotEmpty) 'folder': folderName,
        if (accessType != null) 'access': accessType,
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

  /// Pauses an active in-progress attempt, saving elapsed time and answers.
  Future<QuizAttempt?> pauseAttempt(
    String quizId, {
    required int timeTakenSeconds,
    required List<QuizAnswer> answers,
    String? attemptId,
    int? currentIndex,
  }) async {
    final res = await _api.post<dynamic>(
      '/quizzes/$quizId/attempts/pause${attemptId != null ? '?attemptId=$attemptId' : ''}',
      body: {
        'timeTakenSeconds': timeTakenSeconds,
        'answers': answers.map((a) => a.toJson()).toList(),
        if (currentIndex != null) 'currentIndex': currentIndex,
      },
    );
    final map = J.mapOrNull(res);
    return map == null || map.isEmpty ? null : QuizAttempt.fromJson(map);
  }

  /// Scores and persists the attempt. Resolves to the stored attempt, whose id
  /// addresses the review endpoint below.
  Future<QuizAttempt?> submitAttempt(
    String quizId,
    QuizSubmission submission, {
    String? attemptId,
  }) async {
    final res = await _api.post<dynamic>(
      '/quizzes/$quizId/submit',
      body: {
        ...submission.toJson(),
        if (attemptId != null) 'attemptId': attemptId,
      },
    );
    final map = J.mapOrNull(res);
    return map == null || map.isEmpty ? null : QuizAttempt.fromJson(map);
  }

  /// The scored attempt with its full answer key. The website renders its
  /// result page from this same payload, so both stay in step.
  Future<AttemptReview> fetchAttemptReview(String attemptId) async {
    final res = await _api.get<Map<String, dynamic>>(
      '/quizzes/attempts/$attemptId/review',
    );
    return AttemptReview.fromJson(res);
  }

  Future<List<QuizAttempt>> fetchMyAttempts() async {
    final res = await _api.get<dynamic>('/quizzes/history/me');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => QuizAttempt.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  /// One numbered page of the student's completed attempts, plus the lifetime
  /// summary the history header shows.
  Future<QuizHistoryPage> fetchMyAttemptsPage({
    required int page,
    int limit = 10,
  }) async {
    final res = await _api.get<dynamic>(
      '/quizzes/history/me',
      query: {'page': page, 'limit': limit},
    );
    return QuizHistoryPage.fromJson(res);
  }

  Future<List<LeaderboardEntry>> fetchLeaderboard(String quizId) async {
    final res = await _api.get<dynamic>('/quizzes/$quizId/leaderboard');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => LeaderboardEntry.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}
