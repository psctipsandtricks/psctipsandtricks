import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../data/models/quiz.dart';

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

final folderPathProvider =
    StateProvider<FolderPath>((ref) => FolderPath.root);

final quizSearchProvider = StateProvider<String>((ref) => '');

/// Sub-folders of the current level. Skipped entirely while a search is active,
/// since search spans the whole library rather than one folder.
final quizFoldersProvider =
    FutureProvider.autoDispose<List<QuizFolder>>((ref) async {
  if (ref.watch(quizSearchProvider).isNotEmpty) return const [];
  final path = ref.watch(folderPathProvider);
  return ref.watch(quizzesRepositoryProvider).fetchFolders(
        parentId: path.currentId,
      );
});

/// Quizzes at the current level, or matching the active search.
final quizzesProvider = FutureProvider.autoDispose<List<Quiz>>((ref) async {
  final search = ref.watch(quizSearchProvider);
  final path = ref.watch(folderPathProvider);
  return ref.watch(quizzesRepositoryProvider).fetchQuizzes(
        search: search.isEmpty ? null : search,
        folderName: search.isEmpty ? path.current?.name : null,
      );
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

final quizLeaderboardProvider = FutureProvider.autoDispose
    .family<List<LeaderboardEntry>, String>((ref, quizId) {
  return ref.watch(quizzesRepositoryProvider).fetchLeaderboard(quizId);
});
