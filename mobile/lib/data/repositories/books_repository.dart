import '../../core/network/api_client.dart';
import '../../core/utils/json.dart';
import '../models/book.dart';

class BooksRepository {
  BooksRepository(this._api);

  final ApiClient _api;

  /// Catalog listing. `publishedOnly` is forced on — the app never shows a
  /// draft book, and guests only ever see the guest-visible subset.
  Future<List<Book>> fetchBooks({
    String? search,
    String? category,
    int page = 1,
    int limit = 24,
  }) async {
    final res = await _api.get<dynamic>(
      '/books',
      query: {
        'publishedOnly': true,
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
        if (category != null && category.isNotEmpty && category != 'All')
          'category': category,
      },
    );
    return J.rows(res)
        .whereType<Map>()
        .map((e) => Book.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Book> fetchBook(String id) async {
    final res = await _api.get<Map<String, dynamic>>('/books/$id');
    return Book.fromJson(res);
  }

  /// The full chapter → topic → subtopic tree for the reader.
  Future<BookReaderContent> fetchReaderContent(String bookId) async {
    final res = await _api.get<Map<String, dynamic>>('/books/$bookId/reader');
    return BookReaderContent.fromJson(res);
  }

  /// Registers a download and returns the signed PDF URL, when the book has one.
  Future<String?> requestDownload(String bookId) async {
    final res = await _api.post<Map<String, dynamic>>('/books/$bookId/download');
    return J.strOrNull(res['url']);
  }

  Future<List<ReadingProgress>> fetchProgress(String bookId) async {
    final res = await _api.get<dynamic>(
      '/library/progress',
      query: {'bookId': bookId},
    );
    return J.rows(res)
        .whereType<Map>()
        .map((e) => ReadingProgress.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> saveProgress({
    required String bookId,
    String? chapterId,
    String? topicId,
    required int progressPercent,
  }) {
    return _api.post<dynamic>(
      '/library/progress',
      body: {
        'bookId': bookId,
        if (chapterId != null) 'chapterId': chapterId,
        if (topicId != null) 'topicId': topicId,
        'progressPercent': progressPercent,
      },
    );
  }
}
