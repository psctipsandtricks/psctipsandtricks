import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../data/models/book.dart';
import '../../data/models/offline.dart';
import '../offline/offline_providers.dart';

/// Active catalog filters. Held as one object so a change to either field
/// produces a single refetch rather than two.
class BookQuery {
  const BookQuery({this.search = '', this.category = 'All'});

  final String search;
  final String category;

  BookQuery copyWith({String? search, String? category}) =>
      BookQuery(search: search ?? this.search, category: category ?? this.category);

  @override
  bool operator ==(Object other) =>
      other is BookQuery && other.search == search && other.category == category;

  @override
  int get hashCode => Object.hash(search, category);
}

final bookQueryProvider = StateProvider<BookQuery>((ref) => const BookQuery());

/// The signed-in student's id, or null for a guest.
///
/// Watched by every provider whose answer depends on who is asking. The API
/// decides "you own this" / "log in" / "pay" per caller, and these providers
/// are kept alive for the session — so without this dependency a verdict
/// fetched before sign-in stays pinned for the rest of the app's life. That is
/// what left a purchased book showing "Unlock full access" next to its own
/// "Continue reading" card: the resume row was fetched as the signed-in user,
/// the access verdict was the guest one from before the session resolved.
///
/// Selected down to the id so a profile edit does not refetch the catalog.
String? _viewerId(Ref ref) =>
    ref.watch(currentUserProvider.select((user) => user?.id));

/// The catalog for the active filters. Kept alive so returning to the Books tab
/// paints instantly from cache while a refresh runs behind it.
final booksProvider = FutureProvider.autoDispose<List<Book>>((ref) async {
  ref.keepAlive();
  _viewerId(ref);
  final query = ref.watch(bookQueryProvider);
  return ref.watch(booksRepositoryProvider).fetchBooks(
        search: query.search,
        category: query.category,
      );
});

/// Categories present in the catalog, derived from what the API returned so the
/// filter row never offers an option with no results behind it.
final bookCategoriesProvider = Provider.autoDispose<List<String>>((ref) {
  final books = ref.watch(booksProvider).valueOrNull ?? const <Book>[];
  final categories = books
      .map((b) => b.category)
      .where((c) => c.isNotEmpty)
      .toSet()
      .toList()
    ..sort();
  return ['All', ...categories];
});

final bookDetailProvider =
    FutureProvider.autoDispose.family<Book, String>((ref, id) async {
  ref.keepAlive();
  _viewerId(ref);
  return ref.watch(booksRepositoryProvider).fetchBook(id);
});

/// What the reader is reading from, and the local copy behind it if there is one.
class ReaderSource {
  const ReaderSource({required this.content, this.offline});

  final BookReaderContent content;

  /// Non-null only when the content came out of the vault.
  final OfflineBook? offline;

  bool get isOffline => offline != null;
}

/// Resolves the reader's content, preferring a valid local copy.
///
/// Offline-first rather than network-first: a downloaded book must open with
/// no connection at all, and going to the network when a good copy is already
/// on disk would make the common case slower for no benefit. A copy whose lease
/// has lapsed or gone stale is skipped, so the network path — and with it the
/// server's access check — is what decides.
final readerSourceProvider =
    FutureProvider.autoDispose.family<ReaderSource, String>((ref, bookId) async {
  ref.keepAlive();
  _viewerId(ref);

  final offline = ref.watch(offlineBookProvider(bookId));
  if (offline != null && offline.isReadable) {
    return ReaderSource(
      content: BookReaderContent.fromJson(offline.readerJson),
      offline: offline,
    );
  }

  final content =
      await ref.watch(booksRepositoryProvider).fetchReaderContent(bookId);
  return ReaderSource(content: content);
});

/// The saved resume point for a book, if the student has one.
final bookProgressProvider =
    FutureProvider.autoDispose.family<ReadingProgress?, String>((ref, bookId) async {
  final rows = await ref.watch(booksRepositoryProvider).fetchProgress(bookId);
  return rows.isEmpty ? null : rows.first;
});
