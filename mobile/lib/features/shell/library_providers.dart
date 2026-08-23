import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../data/models/library.dart';

final videoExamsProvider =
    FutureProvider.autoDispose<List<LibraryFolder>>((ref) async {
  ref.keepAlive();
  return ref.watch(libraryRepositoryProvider).fetchVideoExams();
});

final pdfExamsProvider =
    FutureProvider.autoDispose<List<LibraryFolder>>((ref) async {
  ref.keepAlive();
  return ref.watch(libraryRepositoryProvider).fetchPdfExams();
});

final videoChaptersProvider = FutureProvider.autoDispose
    .family<List<LibraryFolder>, String>((ref, examId) {
  return ref.watch(libraryRepositoryProvider).fetchVideoChapters(examId);
});

final pdfChaptersProvider = FutureProvider.autoDispose
    .family<List<LibraryFolder>, String>((ref, examId) {
  return ref.watch(libraryRepositoryProvider).fetchPdfChapters(examId);
});

/// Videos inside one chapter. Fetched only when that chapter is expanded, so
/// opening an exam with twenty chapters costs one request, not twenty.
final chapterVideosProvider =
    FutureProvider.autoDispose.family<List<VideoItem>, String>((ref, chapterId) {
  ref.keepAlive();
  return ref.watch(libraryRepositoryProvider).fetchVideos(chapterId);
});

final chapterDocumentsProvider = FutureProvider.autoDispose
    .family<List<PdfDocument>, String>((ref, chapterId) {
  ref.keepAlive();
  return ref.watch(libraryRepositoryProvider).fetchDocuments(chapterId);
});
