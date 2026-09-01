import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
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

/// Fetches all published quizzes for the catalog, shared between carousel,
/// folder counting, and drill-down lists. Strictly excludes inactive, deleted,
/// or draft quizzes.
final publishedQuizzesProvider =
    FutureProvider.autoDispose<List<Quiz>>((ref) async {
  final raw = await ref.watch(quizzesRepositoryProvider).fetchQuizzes(
        publishedOnly: true,
        limit: 200,
      );
  final now = DateTime.now();
  return raw.where((q) {
    if (!q.isActive) return false;
    if (q.totalQuestions <= 0) return false;
    if (q.releaseDate != null && q.releaseDate!.isAfter(now)) return false;
    return true;
  }).toList();
});

/// The 10 most recently added premium quizzes, ordered by release/creation date.
/// Shared between the Home page and the Quiz Module carousel for 100% consistency.
final premiumCarouselQuizzesProvider =
    FutureProvider.autoDispose<List<Quiz>>((ref) async {
  final all = await ref.watch(publishedQuizzesProvider.future);
  final premium = all.where((q) => q.isPaid && q.isActive && q.totalQuestions > 0).toList()
    ..sort((a, b) => (b.createdAt ?? DateTime(0))
        .compareTo(a.createdAt ?? DateTime(0)));
  return premium.take(10).toList();
});

/// All database quiz folders.
final allQuizFoldersProvider =
    FutureProvider.autoDispose<List<QuizFolder>>((ref) async {
  return ref.watch(quizzesRepositoryProvider).fetchFolders();
});

/// Calculates the number of quizzes in a folder (including any nested subfolders)
/// matching a specific access tier.
int computeFolderQuizCount({
  required String folderName,
  required List<Quiz> quizzes,
  required List<QuizFolder> allFolders,
  QuizAccessTier? tier,
}) {
  final scoped = tier == null
      ? quizzes
      : quizzes.where((q) => tier == QuizAccessTier.premium ? q.isPaid : !q.isPaid);

  final directCount = scoped.where(
    (q) => (q.folderName ?? '').trim().toLowerCase() == folderName.trim().toLowerCase(),
  ).length;

  final folderRecord = allFolders.where(
    (f) => f.name.trim().toLowerCase() == folderName.trim().toLowerCase(),
  ).firstOrNull;

  if (folderRecord == null) return directCount;

  final childFolders = allFolders.where(
    (f) =>
        f.parentId == folderRecord.id &&
        f.name.trim().toLowerCase() != 'root',
  );

  final descendantCount = childFolders.fold<int>(
    0,
    (sum, child) => sum + computeFolderQuizCount(
      folderName: child.name,
      quizzes: quizzes,
      allFolders: allFolders,
      tier: tier,
    ),
  );

  return directCount + descendantCount;
}

/// Sub-folders at the current drill-down level scoped to the selected tier.
final quizFoldersProvider =
    FutureProvider.autoDispose<List<QuizFolder>>((ref) async {
  if (ref.watch(quizSearchProvider).isNotEmpty) return const [];
  final tier = ref.watch(quizAccessTierProvider);
  if (tier == null) return const [];

  final path = ref.watch(folderPathProvider);
  final allFolders = await ref.watch(allQuizFoldersProvider.future);
  final allQuizzes = await ref.watch(publishedQuizzesProvider.future);

  final parentId = path.currentId;
  final directChildren = allFolders.where((f) {
    if (parentId == null) {
      return f.parentId == null || f.parentId!.isEmpty;
    }
    return f.parentId == parentId;
  }).toList();

  // Filter only folders that contain active quizzes of this tier (directly or in children)
  return directChildren.where((f) {
    final count = computeFolderQuizCount(
      folderName: f.name,
      quizzes: allQuizzes,
      allFolders: allFolders,
      tier: tier,
    );
    return count > 0;
  }).toList();
});

/// Quizzes at the current level, or matching the active search.
final quizzesProvider = FutureProvider.autoDispose<List<Quiz>>((ref) async {
  final search = ref.watch(quizSearchProvider);
  final tier = ref.watch(quizAccessTierProvider);
  final path = ref.watch(folderPathProvider);
  final all = await ref.watch(publishedQuizzesProvider.future);

  if (search.isNotEmpty) {
    final query = search.trim().toLowerCase();
    return all.where((q) {
      final matchesSearch = q.title.toLowerCase().contains(query) ||
          (q.topic?.toLowerCase().contains(query) ?? false) ||
          (q.folderName?.toLowerCase().contains(query) ?? false);
      final matchesTier = tier == null
          ? true
          : (tier == QuizAccessTier.premium ? q.isPaid : !q.isPaid);
      return matchesSearch && matchesTier;
    }).toList();
  }

  if (tier == null) {
    return const <Quiz>[];
  }

  // If inside a folder, match folderName; if at tier root, match root quizzes
  final currentFolder = path.current?.name;
  return all.where((q) {
    final matchesTier = tier == QuizAccessTier.premium ? q.isPaid : !q.isPaid;
    if (!matchesTier) return false;

    if (currentFolder == null) {
      // At tier root: show quizzes that have no folder or are in 'Root'
      final fName = (q.folderName ?? '').trim();
      return fName.isEmpty || fName.toLowerCase() == 'root';
    } else {
      return (q.folderName ?? '').trim().toLowerCase() ==
          currentFolder.trim().toLowerCase();
    }
  }).toList();
});

final quizDetailProvider =
    FutureProvider.autoDispose.family<Quiz, String>((ref, id) {
  return ref.watch(quizzesRepositoryProvider).fetchQuiz(id);
});

final quizHistoryProvider =
    FutureProvider.autoDispose<List<QuizAttempt>>((ref) async {
  ref.keepAlive();
  return ref.watch(quizzesRepositoryProvider).fetchMyAttempts();
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

