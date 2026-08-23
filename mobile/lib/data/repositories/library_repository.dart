import '../../core/network/api_client.dart';
import '../../core/utils/json.dart';
import '../models/library.dart';

/// The video and PDF study libraries. Both are browsed Exam → Chapter → item,
/// so one repository serves them by swapping the path prefix.
class LibraryRepository {
  LibraryRepository(this._api);

  final ApiClient _api;

  Future<List<LibraryFolder>> fetchVideoExams() => _folders('/videos/exams');

  Future<List<LibraryFolder>> fetchVideoChapters(String examId) =>
      _folders('/videos/exams/$examId/chapters');

  Future<List<VideoItem>> fetchVideos(String chapterId) async {
    final res = await _api.get<dynamic>('/videos/chapters/$chapterId/videos');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => VideoItem.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<LibraryFolder>> fetchPdfExams() => _folders('/pdfs/exams');

  Future<List<LibraryFolder>> fetchPdfChapters(String examId) =>
      _folders('/pdfs/exams/$examId/chapters');

  Future<List<PdfDocument>> fetchDocuments(String chapterId) async {
    final res = await _api.get<dynamic>('/pdfs/chapters/$chapterId/documents');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => PdfDocument.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<LibraryFolder>> _folders(String path) async {
    final res = await _api.get<dynamic>(path);
    return J.rows(res)
        .whereType<Map>()
        .map((e) => LibraryFolder.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}
