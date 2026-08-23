import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../data/models/book.dart';
import '../../data/models/notification.dart';
import '../../data/models/quiz.dart';

/// The books rail on the home screen — a short slice of the catalog rather
/// than the whole thing, so the tab paints in one small request.
final featuredBooksProvider =
    FutureProvider.autoDispose<List<Book>>((ref) async {
  ref.keepAlive();
  return ref.watch(booksRepositoryProvider).fetchBooks(limit: 10);
});

final latestQuizzesProvider =
    FutureProvider.autoDispose<List<Quiz>>((ref) async {
  ref.keepAlive();
  return ref.watch(quizzesRepositoryProvider).fetchQuizzes(limit: 10);
});

/// Popups inside their scheduled window. Failure here is silent: an
/// announcement is never important enough to break the home screen.
final activeAnnouncementsProvider =
    FutureProvider.autoDispose<List<AnnouncementPopup>>((ref) async {
  try {
    return await ref
        .watch(notificationsRepositoryProvider)
        .fetchActiveAnnouncements();
  } catch (_) {
    return const [];
  }
});
