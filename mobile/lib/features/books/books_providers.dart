import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../data/models/book.dart';

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

/// The catalog for the active filters. Kept alive so returning to the Books tab
/// paints instantly from cache while a refresh runs behind it.
final booksProvider = FutureProvider.autoDispose<List<Book>>((ref) async {
  ref.keepAlive();
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
  return ref.watch(booksRepositoryProvider).fetchBook(id);
});

final bookReaderProvider = FutureProvider.autoDispose
    .family<BookReaderContent, String>((ref, bookId) async {
  ref.keepAlive();
  return ref.watch(booksRepositoryProvider).fetchReaderContent(bookId);
});

/// The saved resume point for a book, if the student has one.
final bookProgressProvider =
    FutureProvider.autoDispose.family<ReadingProgress?, String>((ref, bookId) async {
  final rows = await ref.watch(booksRepositoryProvider).fetchProgress(bookId);
  return rows.isEmpty ? null : rows.first;
});
