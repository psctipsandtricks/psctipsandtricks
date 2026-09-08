import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../data/models/quiz.dart';

enum QuizAccessTier { free, premium }

/// Where the student currently is in the folder tree. The hub is a drill-down,
/// so the whole path is kept to render breadcrumbs and to walk back up.
class FolderPath {
  const FolderPath(this.segments);

  final List<QuizFolder> segments;

  static const root = FolderPath(<QuizFolder>[]);

  QuizFolder? get current => segments.isEmpty ? null : segments.last;
  String? get currentId => current?.id;
  bool get isRoot => segments.isEmpty;

  FolderPath push(QuizFolder folder) => FolderPath([...segments, folder]);

  FolderPath popTo(int index) =>
      FolderPath(segments.sublist(0, (index + 1).clamp(0, segments.length)));

  FolderPath pop() => segments.isEmpty
      ? this
      : FolderPath(segments.sublist(0, segments.length - 1));
}

/// The currently selected top-level access tier (Free vs Premium).
/// When null, the user is on the main Quiz Hub page viewing both category folders.
final quizAccessTierProvider =
    StateProvider<QuizAccessTier?>((ref) => null);

final folderPathProvider =
    StateProvider<FolderPath>((ref) => FolderPath.root);

final quizSearchProvider = StateProvider<String>((ref) => '');

/// The 10 most recently added premium quizzes, ordered by creation date.
/// Shared between the Home page and the Quiz Module carousel.
///
/// The server does the sorting and the trimming, so this pulls ten rows rather
/// than the whole catalog.
final premiumCarouselQuizzesProvider =
    FutureProvider.autoDispose<List<Quiz>>((ref) async {
  final rows = await ref.watch(quizzesRepositoryProvider).fetchQuizzes(
        publishedOnly: true,
        accessType: 'PAID',
        sort: 'newest',
        limit: 10,
      );
  return rows.where((q) => q.isActive && q.totalQuestions > 0).toList();
});

/// All database quiz folders, with their rolled-up per-tier quiz counts.
///
/// This is the only request the hub makes on entry: folders carry their own
/// counts, so the browse tree renders before any quiz has been loaded.
final allQuizFoldersProvider =
    FutureProvider.autoDispose<List<QuizFolder>>((ref) async {
  return ref.watch(quizzesRepositoryProvider).fetchFolders();
});

/// Catalog-wide totals for the two tier cards on the hub's landing screen.
final quizTierCountsProvider =
    FutureProvider.autoDispose<Map<QuizAccessTier, int>>((ref) async {
  final repo = ref.watch(quizzesRepositoryProvider);
  final results = await Future.wait([
    repo.fetchQuizCount(accessType: 'FREE'),
    repo.fetchQuizCount(accessType: 'PAID'),
  ]);
  return {
    QuizAccessTier.free: results[0],
    QuizAccessTier.premium: results[1],
  };
});

/// How many quizzes of one tier a folder holds, counting every folder beneath
/// it. Read straight off the folder record — the server rolled it up.
int folderQuizCountFor(QuizFolder folder, QuizAccessTier? tier) {
  switch (tier) {
    case QuizAccessTier.premium:
      return folder.paidQuizCount;
    case QuizAccessTier.free:
      return folder.freeQuizCount;
    case null:
      return folder.freeQuizCount + folder.paidQuizCount;
  }
}

/// Sub-folders at the current drill-down level scoped to the selected tier.
final quizFoldersProvider =
    FutureProvider.autoDispose<List<QuizFolder>>((ref) async {
  if (ref.watch(quizSearchProvider).isNotEmpty) return const [];
  final tier = ref.watch(quizAccessTierProvider);
  if (tier == null) return const [];

  final path = ref.watch(folderPathProvider);
  final allFolders = await ref.watch(allQuizFoldersProvider.future);

  final parentId = path.currentId;
  final directChildren = allFolders.where((f) {
    if (f.name.trim().toLowerCase() == 'root') return false;
    if (parentId == null) {
      return f.parentId == null || f.parentId!.isEmpty;
    }
    return f.parentId == parentId;
  });

  // Only folders that hold quizzes of this tier, directly or in a descendant.
  return directChildren.where((f) => folderQuizCountFor(f, tier) > 0).toList();
});

/// Quizzes at the current level, or matching the active search.
///
/// One folder's worth at a time: the request carries the folder name and the
/// tier, so opening a folder loads that folder and nothing else. `folder: Root`
/// asks for the quizzes filed at the top level rather than inside any folder.
final quizzesProvider = FutureProvider.autoDispose<List<Quiz>>((ref) async {
  final search = ref.watch(quizSearchProvider).trim();
  final tier = ref.watch(quizAccessTierProvider);
  final path = ref.watch(folderPathProvider);

  // The landing screen shows tier cards only — nothing to fetch yet.
  if (tier == null && search.isEmpty) return const <Quiz>[];

  final accessType = switch (tier) {
    QuizAccessTier.premium => 'PAID',
    QuizAccessTier.free => 'FREE',
    null => null,
  };

  final rows = await ref.watch(quizzesRepositoryProvider).fetchQuizzes(
        publishedOnly: true,
        accessType: accessType,
        // A search spans the whole tier; browsing is pinned to one folder.
        search: search.isEmpty ? null : search,
        folderName: search.isNotEmpty ? null : (path.current?.name ?? 'Root'),
        limit: 100,
      );

  final now = DateTime.now();
  return rows.where((q) {
    if (!q.isActive) return false;
    if (q.totalQuestions <= 0) return false;
    if (q.releaseDate != null && q.releaseDate!.isAfter(now)) return false;
    return true;
  }).toList();
});

/// Where this student stands on every quiz they have opened, keyed by quiz id.
///
/// One request for the whole hub: each card reads its own entry to decide
/// between Start, Resume and Retake, and to show how many attempts have
/// actually been completed. Empty for a signed-out visitor, who has none.
final quizAttemptSummaryProvider =
    FutureProvider.autoDispose<Map<String, QuizAttemptSummary>>((ref) async {
  final signedIn = ref.watch(authControllerProvider).isAuthenticated;
  if (!signedIn) return const {};
  final rows = await ref.watch(quizzesRepositoryProvider).fetchAttemptSummary();
  return {for (final row in rows) row.quizId: row};
});

final quizDetailProvider =
    FutureProvider.autoDispose.family<Quiz, String>((ref, id) {
  return ref.watch(quizzesRepositoryProvider).fetchQuiz(id);
});

/// Filter options available for the Quiz History / My Attempts screen.
const quizHistoryFilterOptions = [
  'All',
  'Passed',
  'Needs Work',
  'In Progress',
  'Free',
  'Premium',
];

/// Search query on quiz history screen.
final quizHistorySearchProvider = StateProvider.autoDispose<String>((ref) => '');

/// Selected filter chip on quiz history screen.
final quizHistoryFilterProvider =
    StateProvider.autoDispose<String>((ref) => 'All');

/// Which page of the attempt history is on screen. Resets to 1 when the route
/// is left.
final quizHistoryPageIndexProvider = StateProvider.autoDispose<int>((ref) => 1);

/// All attempts for the current student.
final allQuizAttemptsProvider =
    FutureProvider.autoDispose<List<QuizAttempt>>((ref) async {
  final repo = ref.watch(quizzesRepositoryProvider);
  return repo.fetchMyAttempts();
});

/// Everything the Quiz History screen renders: lifetime stats header, plus the
/// filtered and paginated attempt list.
class QuizHistoryView {
  const QuizHistoryView({
    required this.attempts,
    required this.page,
    required this.totalPages,
    required this.totalFiltered,
    required this.lifetimeAttempts,
    required this.lifetimePassed,
    required this.lifetimeAvgPercentage,
  });

  final List<QuizAttempt> attempts;
  final int page;
  final int totalPages;
  final int totalFiltered;
  final int lifetimeAttempts;
  final int lifetimePassed;
  final double lifetimeAvgPercentage;

  bool get isEmpty => attempts.isEmpty;
}

/// Provider that computes lifetime statistics and applies search, filter,
/// and pagination.
final quizHistoryViewProvider =
    Provider.autoDispose<AsyncValue<QuizHistoryView>>((ref) {
  final attemptsAsync = ref.watch(allQuizAttemptsProvider);
  final search = ref.watch(quizHistorySearchProvider).trim().toLowerCase();
  final filter = ref.watch(quizHistoryFilterProvider);
  final page = ref.watch(quizHistoryPageIndexProvider);
  const pageSize = 10;

  return attemptsAsync.whenData((allAttempts) {
    // Lifetime overall stats (computed from completed attempts)
    final completedAttempts = allAttempts
        .where((a) => a.status != AttemptStatus.inProgress)
        .toList();
    final lifetimeAttempts = allAttempts.length;
    final lifetimePassed = completedAttempts.where((a) => a.passed).length;
    final totalPercentage =
        completedAttempts.fold<double>(0, (sum, a) => sum + a.percentage);
    final lifetimeAvg = completedAttempts.isNotEmpty
        ? totalPercentage / completedAttempts.length
        : 0.0;

    // Filter attempts
    final filtered = allAttempts.where((attempt) {
      if (search.isNotEmpty) {
        final title = (attempt.quizTitle ?? '').toLowerCase();
        if (!title.contains(search)) return false;
      }

      switch (filter) {
        case 'Passed':
          return attempt.passed && attempt.status != AttemptStatus.inProgress;
        case 'Needs Work':
          return !attempt.passed && attempt.status != AttemptStatus.inProgress;
        case 'In Progress':
          return attempt.status == AttemptStatus.inProgress;
        case 'Free':
          return !attempt.quizIsPremium;
        case 'Premium':
          return attempt.quizIsPremium;
        case 'All':
        default:
          return true;
      }
    }).toList();

    final totalPages = (filtered.length / pageSize).ceil().clamp(1, 9999);
    final clampedPage = page.clamp(1, totalPages);
    final startIndex = (clampedPage - 1) * pageSize;
    final pagedItems = filtered.skip(startIndex).take(pageSize).toList();

    return QuizHistoryView(
      attempts: pagedItems,
      page: clampedPage,
      totalPages: totalPages,
      totalFiltered: filtered.length,
      lifetimeAttempts: lifetimeAttempts,
      lifetimePassed: lifetimePassed,
      lifetimeAvgPercentage: lifetimeAvg,
    );
  });
});

/// Kept for backwards compatibility with single-page fetches if needed.
final quizHistoryPageProvider =
    FutureProvider.autoDispose<QuizHistoryPage>((ref) async {
  final page = ref.watch(quizHistoryPageIndexProvider);
  return ref.watch(quizzesRepositoryProvider).fetchMyAttemptsPage(page: page);
});

/// One submitted attempt, questions and answer key included.
final attemptReviewProvider =
    FutureProvider.autoDispose.family<AttemptReview, String>((ref, attemptId) {
  return ref.watch(quizzesRepositoryProvider).fetchAttemptReview(attemptId);
});

final quizLeaderboardProvider = FutureProvider.autoDispose
    .family<List<LeaderboardEntry>, String>((ref, quizId) {
  return ref.watch(quizzesRepositoryProvider).fetchLeaderboard(quizId);
});


