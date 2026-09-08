import '../../core/utils/json.dart';
import 'mock_test.dart';

/// `GET /analytics/me/dashboard` — the student's personal study dashboard.
class StudentDashboard {
  const StudentDashboard({
    required this.stats,
    required this.trend,
    required this.recentAttempts,
    required this.subjects,
    required this.upcomingMockTests,
    required this.booksInProgress,
    required this.inProgressQuizzes,
  });

  final DashboardStats stats;
  final List<TrendPoint> trend;
  final List<DashboardAttempt> recentAttempts;
  final List<SubjectPerformance> subjects;
  final List<UpcomingMockTest> upcomingMockTests;
  final List<BookProgress> booksInProgress;
  final List<InProgressQuiz> inProgressQuizzes;

  bool get isEmpty =>
      stats.totalAttempts == 0 &&
      booksInProgress.isEmpty &&
      inProgressQuizzes.isEmpty;

  factory StudentDashboard.fromJson(Map<String, dynamic> json) =>
      StudentDashboard(
        stats: DashboardStats.fromJson(J.map(json['stats'])),
        trend: J.list(json['trend'], TrendPoint.fromJson),
        recentAttempts: J.list(json['recentAttempts'], DashboardAttempt.fromJson),
        subjects: J.list(json['subjects'], SubjectPerformance.fromJson),
        upcomingMockTests:
            J.list(json['upcomingMockTests'], UpcomingMockTest.fromJson),
        booksInProgress: J.list(json['booksInProgress'], BookProgress.fromJson),
        inProgressQuizzes:
            J.list(json['inProgressQuizzes'], InProgressQuiz.fromJson),
      );
}

class DashboardStats {
  const DashboardStats({
    required this.totalAttempts,
    required this.mockTestsTaken,
    required this.attemptsThisWeek,
    required this.averagePercent,
    required this.averagePercentThisWeek,
    required this.averagePercentLastWeek,
    required this.accuracyPercent,
    required this.studyHours,
    required this.studyHoursThisWeek,
    required this.passedCount,
    required this.streakDays,
    this.bestRank,
    this.previousBestRank,
  });

  final int totalAttempts;
  final int mockTestsTaken;
  final int attemptsThisWeek;
  final double averagePercent;
  final double averagePercentThisWeek;
  final double averagePercentLastWeek;
  final double accuracyPercent;
  final double studyHours;
  final double studyHoursThisWeek;
  final int passedCount;
  final int streakDays;
  final int? bestRank;
  final int? previousBestRank;

  /// Week-over-week change in average score, for the trend chip.
  double get weeklyDelta => averagePercentThisWeek - averagePercentLastWeek;

  factory DashboardStats.fromJson(Map<String, dynamic> json) => DashboardStats(
        totalAttempts: J.intVal(json['totalAttempts']),
        mockTestsTaken: J.intVal(json['mockTestsTaken']),
        attemptsThisWeek: J.intVal(json['attemptsThisWeek']),
        averagePercent: J.dbl(json['averagePercent']),
        averagePercentThisWeek: J.dbl(json['averagePercentThisWeek']),
        averagePercentLastWeek: J.dbl(json['averagePercentLastWeek']),
        accuracyPercent: J.dbl(json['accuracyPercent']),
        studyHours: J.dbl(json['studyHours']),
        studyHoursThisWeek: J.dbl(json['studyHoursThisWeek']),
        passedCount: J.intVal(json['passedCount']),
        streakDays: J.intVal(json['streakDays']),
        bestRank: J.intOrNull(json['bestRank']),
        previousBestRank: J.intOrNull(json['previousBestRank']),
      );
}

class TrendPoint {
  const TrendPoint({
    required this.label,
    required this.percentage,
    required this.accuracy,
    this.date,
  });

  final String label;
  final double percentage;
  final double accuracy;
  final DateTime? date;

  factory TrendPoint.fromJson(Map<String, dynamic> json) => TrendPoint(
        label: J.str(json['label']),
        percentage: J.dbl(json['percentage']),
        accuracy: J.dbl(json['accuracy']),
        date: J.dateOrNull(json['date']),
      );
}

class DashboardAttempt {
  const DashboardAttempt({
    required this.id,
    required this.quizId,
    required this.title,
    required this.category,
    required this.isMockTest,
    required this.score,
    required this.totalMarks,
    required this.percentage,
    required this.accuracy,
    required this.correctAnswers,
    required this.wrongAnswers,
    required this.unattempted,
    required this.passed,
    required this.timeTakenSeconds,
    this.rank,
    this.mockTestId,
    this.submittedAt,
  });

  final String id;
  final String quizId;
  final String title;
  final String category;
  final bool isMockTest;
  final String? mockTestId;
  final double score;
  final double totalMarks;
  final double percentage;
  final double accuracy;
  final int correctAnswers;
  final int wrongAnswers;
  final int unattempted;
  final int? rank;
  final bool passed;
  final int timeTakenSeconds;
  final DateTime? submittedAt;

  factory DashboardAttempt.fromJson(Map<String, dynamic> json) =>
      DashboardAttempt(
        id: J.str(json['id']),
        quizId: J.str(json['quizId']),
        title: J.str(json['title']),
        category: J.str(json['category']),
        isMockTest: J.boolVal(json['isMockTest']),
        mockTestId: J.strOrNull(json['mockTestId']),
        score: J.dbl(json['score']),
        totalMarks: J.dbl(json['totalMarks']),
        percentage: J.dbl(json['percentage']),
        accuracy: J.dbl(json['accuracy']),
        correctAnswers: J.intVal(json['correctAnswers']),
        wrongAnswers: J.intVal(json['wrongAnswers']),
        unattempted: J.intVal(json['unattempted']),
        rank: J.intOrNull(json['rank']),
        passed: J.boolVal(json['passed']),
        timeTakenSeconds: J.intVal(json['timeTakenSeconds']),
        submittedAt: J.dateOrNull(json['submittedAt']),
      );
}

class SubjectPerformance {
  const SubjectPerformance({
    required this.category,
    required this.attempts,
    required this.averagePercent,
    this.accuracyPercent,
  });

  final String category;
  final int attempts;
  final double averagePercent;
  final double? accuracyPercent;

  factory SubjectPerformance.fromJson(Map<String, dynamic> json) =>
      SubjectPerformance(
        category: J.str(json['category'], 'General'),
        attempts: J.intVal(json['attempts']),
        averagePercent: J.dbl(json['averagePercent']),
        accuracyPercent: J.dblOrNull(json['accuracyPercent']),
      );
}

class UpcomingMockTest {
  const UpcomingMockTest({
    required this.id,
    required this.title,
    required this.scheduledAt,
    required this.status,
    required this.participantCount,
    required this.joined,
    required this.submitted,
    this.quizTitle,
    this.durationMinutes,
    this.totalQuestions,
    this.totalMarks,
  });

  final String id;
  final String title;
  final String? quizTitle;
  final DateTime scheduledAt;
  final MockTestStatus status;
  final int? durationMinutes;
  final int? totalQuestions;
  final double? totalMarks;
  final int participantCount;
  final bool joined;
  final bool submitted;

  factory UpcomingMockTest.fromJson(Map<String, dynamic> json) =>
      UpcomingMockTest(
        id: J.str(json['id']),
        title: J.str(json['title']),
        quizTitle: J.strOrNull(json['quizTitle']),
        scheduledAt: J.date(json['scheduledAt']),
        status: mockStatusFrom(json['status']),
        durationMinutes: J.intOrNull(json['durationMinutes']),
        totalQuestions: J.intOrNull(json['totalQuestions']),
        totalMarks: J.dblOrNull(json['totalMarks']),
        participantCount: J.intVal(json['participantCount']),
        joined: J.boolVal(json['joined']),
        submitted: J.boolVal(json['submitted']),
      );
}

class BookProgress {
  const BookProgress({
    required this.bookId,
    required this.title,
    required this.author,
    required this.coverUrl,
    this.heroCoverUrl,
    required this.category,
    required this.progressPercent,
    required this.isCompleted,
    this.lastChapterTitle,
    this.lastTopicTitle,
    this.lastReadAt,
  });

  final String bookId;
  final String title;
  final String author;
  final String coverUrl;
  final String? heroCoverUrl;
  final String category;
  final int progressPercent;
  final bool isCompleted;
  final String? lastChapterTitle;
  final String? lastTopicTitle;
  final DateTime? lastReadAt;

  String get resumeLabel =>
      lastTopicTitle ?? lastChapterTitle ?? 'Start from the beginning';

  /// The 3:4 hero cover — the portrait artwork that actually looks like a
  /// book. Mirrors `Book.effectiveHeroCoverUrl`: the 16:9 catalog banner is
  /// the fallback, for titles that have no hero cover uploaded yet.
  String get effectiveHeroCoverUrl {
    final hero = heroCoverUrl?.trim();
    if (hero != null && hero.isNotEmpty) return hero;
    return coverUrl.trim();
  }

  /// The 16:9 catalog cover, falling back to the hero cover. Mirrors
  /// `Book.effectiveCatalogCoverUrl`.
  String get effectiveCatalogCoverUrl {
    final cover = coverUrl.trim();
    if (cover.isNotEmpty) return cover;
    return heroCoverUrl?.trim() ?? '';
  }

  factory BookProgress.fromJson(Map<String, dynamic> json) => BookProgress(
        bookId: J.str(json['bookId']),
        title: J.str(json['title']),
        author: J.str(json['author']),
        coverUrl: J.str(json['coverUrl']),
        heroCoverUrl: J.strOrNull(json['heroCoverUrl']),
        category: J.str(json['category']),
        progressPercent: J.intVal(json['progressPercent']),
        isCompleted: J.boolVal(json['isCompleted']),
        lastChapterTitle: J.strOrNull(json['lastChapterTitle']),
        lastTopicTitle: J.strOrNull(json['lastTopicTitle']),
        lastReadAt: J.dateOrNull(json['lastReadAt']),
      );
}

/// A quiz attempt the student started but hasn't submitted yet — drives the
/// dashboard's "Resume Quiz" list.
class InProgressQuiz {
  const InProgressQuiz({
    required this.id,
    required this.quizId,
    required this.title,
    required this.totalQuestions,
    required this.answeredCount,
    required this.progressPercent,
    required this.remainingSeconds,
    this.startedAt,
  });

  final String id;
  final String quizId;
  final String title;
  final int totalQuestions;
  final int answeredCount;
  final int progressPercent;
  final int remainingSeconds;
  final DateTime? startedAt;

  factory InProgressQuiz.fromJson(Map<String, dynamic> json) => InProgressQuiz(
        id: J.str(json['id']),
        quizId: J.str(json['quizId']),
        title: J.str(json['title'], 'Practice Quiz'),
        totalQuestions: J.intVal(json['totalQuestions']),
        answeredCount: J.intVal(json['answeredCount']),
        progressPercent: J.intVal(json['progressPercent']),
        remainingSeconds: J.intVal(json['remainingSeconds']),
        startedAt: J.dateOrNull(json['startedAt']),
      );
}
