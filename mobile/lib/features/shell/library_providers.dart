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

/// Loads the full content of a video folder (subfolders and direct videos).
final videoFolderContentProvider = FutureProvider.autoDispose
    .family<VideoFolderContent, String>((ref, folderId) {
  ref.keepAlive();
  return ref.watch(libraryRepositoryProvider).fetchVideoFolder(folderId);
});

/// Loads the full content of a PDF folder (subfolders and direct documents).
final pdfFolderContentProvider = FutureProvider.autoDispose
    .family<PdfFolderContent, String>((ref, folderId) {
  ref.keepAlive();
  return ref.watch(libraryRepositoryProvider).fetchPdfFolder(folderId);
});

final videoChaptersProvider = FutureProvider.autoDispose
    .family<List<LibraryFolder>, String>((ref, examId) {
  return ref.watch(libraryRepositoryProvider).fetchVideoChapters(examId);
});

final pdfChaptersProvider = FutureProvider.autoDispose
    .family<List<LibraryFolder>, String>((ref, examId) {
  return ref.watch(libraryRepositoryProvider).fetchPdfChapters(examId);
});

/// Videos inside one chapter. Fetched only when that chapter is expanded.
final chapterVideosProvider =
    FutureProvider.autoDispose.family<List<VideoItem>, String>((ref, chapterId) {
  ref.keepAlive();
  return ref.watch(libraryRepositoryProvider).fetchVideos(chapterId);
});

/// Documents inside one chapter. Fetched only when that chapter is expanded.
final chapterDocumentsProvider = FutureProvider.autoDispose
    .family<List<PdfDocument>, String>((ref, chapterId) {
  ref.keepAlive();
  return ref.watch(libraryRepositoryProvider).fetchDocuments(chapterId);
});
