import '../../core/network/api_client.dart';
import '../../core/utils/json.dart';
import '../models/library.dart';

/// The video and PDF study libraries. Both support recursive folders,
/// subfolders (chapters), and direct videos/documents.
class LibraryRepository {
  LibraryRepository(this._api);

  final ApiClient _api;

  // --- Videos ---

  Future<List<LibraryFolder>> fetchVideoExams() =>
      _folders('/videos/folders?parentId=root');

  Future<VideoFolderContent> fetchVideoFolder(String folderId) async {
    try {
      final res = await _api.get<dynamic>('/videos/folders/$folderId');
      if (res is Map<String, dynamic>) {
        return VideoFolderContent.fromJson(res);
      } else if (res is Map) {
        return VideoFolderContent.fromJson(Map<String, dynamic>.from(res));
      }
    } catch (_) {}

    // Fallback: fetch subfolders and direct videos separately
    final subfolders = await fetchVideoChapters(folderId);
    final videos = await fetchVideos(folderId);
    return VideoFolderContent(
      folder: LibraryFolder(id: folderId, title: '', orderIndex: 0),
      subfolders: subfolders,
      videos: videos,
    );
  }

  Future<List<LibraryFolder>> fetchVideoChapters(String examId) =>
      _folders('/videos/folders?parentId=$examId');

  Future<List<VideoItem>> fetchVideos(String folderOrChapterId) async {
    final res = await _api.get<dynamic>('/videos?folderId=$folderOrChapterId');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => VideoItem.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  // --- PDFs ---

  Future<List<LibraryFolder>> fetchPdfExams() =>
      _folders('/pdfs/folders?parentId=root');

  Future<PdfFolderContent> fetchPdfFolder(String folderId) async {
    try {
      final res = await _api.get<dynamic>('/pdfs/folders/$folderId');
      if (res is Map<String, dynamic>) {
        return PdfFolderContent.fromJson(res);
      } else if (res is Map) {
        return PdfFolderContent.fromJson(Map<String, dynamic>.from(res));
      }
    } catch (_) {}

    // Fallback: fetch subfolders and direct documents separately
    final subfolders = await fetchPdfChapters(folderId);
    final documents = await fetchDocuments(folderId);
    return PdfFolderContent(
      folder: LibraryFolder(id: folderId, title: '', orderIndex: 0),
      subfolders: subfolders,
      documents: documents,
    );
  }

  Future<List<LibraryFolder>> fetchPdfChapters(String examId) =>
      _folders('/pdfs/folders?parentId=$examId');

  Future<List<PdfDocument>> fetchDocuments(String folderOrChapterId) async {
    final res = await _api.get<dynamic>('/pdfs?folderId=$folderOrChapterId');
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
