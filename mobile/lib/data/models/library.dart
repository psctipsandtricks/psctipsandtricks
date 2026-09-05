import '../../core/utils/json.dart';

/// Shared shape of library folders (exams, categories, chapters).
class LibraryFolder {
  const LibraryFolder({
    required this.id,
    required this.title,
    required this.orderIndex,
    this.description,
    this.parentId,
    this.examId,
    this.itemCount = 0,
    this.chapterCount = 0,
    this.directItemCount = 0,
  });

  final String id;
  final String title;
  final String? description;
  final int orderIndex;

  /// Set on child folders; null on root exams/categories.
  final String? parentId;
  final String? examId;

  /// Videos or documents contained (total / recursive count).
  final int itemCount;

  /// Number of subfolders / chapters.
  final int chapterCount;

  /// Direct videos or documents inside this folder.
  final int directItemCount;

  bool get hasSubfolders => chapterCount > 0;
  bool get hasDirectItems => directItemCount > 0;

  factory LibraryFolder.fromJson(Map<String, dynamic> json) {
    final title = J.str(json['title'] ?? json['name']);
    final parentId = J.strOrNull(json['parentId'] ?? json['examId']);
    final itemCount = J.intVal(
      json['videoCount'] ?? json['documentCount'] ?? json['itemCount'],
    );
    final directItemCount = J.intVal(
      json['directVideoCount'] ?? json['directDocumentCount'],
      itemCount,
    );
    final chapterCount = J.intVal(
      json['subFolderCount'] ?? json['chapterCount'],
    );

    return LibraryFolder(
      id: J.str(json['id']),
      title: title,
      description: J.strOrNull(json['description']),
      orderIndex: J.intVal(json['orderIndex']),
      parentId: parentId,
      examId: parentId,
      itemCount: itemCount,
      chapterCount: chapterCount,
      directItemCount: directItemCount,
    );
  }
}

/// Full content of a video folder: its metadata, subfolders, and direct videos.
class VideoFolderContent {
  const VideoFolderContent({
    required this.folder,
    this.subfolders = const [],
    this.videos = const [],
  });

  final LibraryFolder folder;
  final List<LibraryFolder> subfolders;
  final List<VideoItem> videos;

  bool get isEmpty => subfolders.isEmpty && videos.isEmpty;

  factory VideoFolderContent.fromJson(Map<String, dynamic> json) =>
      VideoFolderContent(
        folder: LibraryFolder.fromJson(json),
        subfolders: J.list(json['children'], LibraryFolder.fromJson),
        videos: J.list(json['videos'], VideoItem.fromJson),
      );
}

/// Full content of a PDF folder: its metadata, subfolders, and direct documents.
class PdfFolderContent {
  const PdfFolderContent({
    required this.folder,
    this.subfolders = const [],
    this.documents = const [],
  });

  final LibraryFolder folder;
  final List<LibraryFolder> subfolders;
  final List<PdfDocument> documents;

  bool get isEmpty => subfolders.isEmpty && documents.isEmpty;

  factory PdfFolderContent.fromJson(Map<String, dynamic> json) =>
      PdfFolderContent(
        folder: LibraryFolder.fromJson(json),
        subfolders: J.list(json['children'], LibraryFolder.fromJson),
        documents: J.list(json['documents'], PdfDocument.fromJson),
      );
}

/// Extracts the 11-character YouTube video ID from various link shapes
/// (watch, shorts, embed, youtu.be, or bare ID).
String extractYoutubeId(String input) {
  final raw = input.trim();
  if (raw.isEmpty) return '';
  final videoIdRegex = RegExp(r'^[A-Za-z0-9_-]{11}$');
  if (videoIdRegex.hasMatch(raw)) return raw;

  final regExp = RegExp(
    r'(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts|live)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})',
    caseSensitive: false,
  );
  final match = regExp.firstMatch(raw);
  if (match != null && match.groupCount >= 1) {
    return match.group(1) ?? '';
  }
  return '';
}

class VideoItem {
  const VideoItem({
    required this.id,
    required this.chapterId,
    required this.title,
    required this.youtubeUrl,
    required this.youtubeVideoId,
    required this.thumbnailUrl,
    required this.orderIndex,
    this.description,
    this.pdfUrl,
    this.pdfFileName,
  });

  final String id;
  final String chapterId;
  final String title;
  final String? description;
  final String youtubeUrl;
  final String youtubeVideoId;
  final String thumbnailUrl;
  final String? pdfUrl;
  final String? pdfFileName;
  final int orderIndex;

  bool get hasNotes => (pdfUrl ?? '').isNotEmpty;

  /// Returns a valid thumbnail URL, falling back to YouTube public image servers
  /// if the stored thumbnailUrl is missing or not reachable.
  String get effectiveThumbnailUrl {
    final thumb = thumbnailUrl.trim();
    if (thumb.isNotEmpty && thumb.startsWith('http')) {
      return thumb;
    }
    final vid = youtubeVideoId.isNotEmpty
        ? youtubeVideoId
        : extractYoutubeId(youtubeUrl);
    if (vid.isNotEmpty) {
      return 'https://img.youtube.com/vi/$vid/hqdefault.jpg';
    }
    return '';
  }

  factory VideoItem.fromJson(Map<String, dynamic> json) {
    final youtubeUrl = J.str(json['youtubeUrl']);
    var youtubeVideoId = J.str(json['youtubeVideoId']);
    var thumb = J.str(json['thumbnailUrl']);

    if (youtubeVideoId.isEmpty && youtubeUrl.isNotEmpty) {
      youtubeVideoId = extractYoutubeId(youtubeUrl);
    }

    if (thumb.isEmpty && youtubeVideoId.isNotEmpty) {
      thumb = 'https://img.youtube.com/vi/$youtubeVideoId/hqdefault.jpg';
    }

    return VideoItem(
      id: J.str(json['id']),
      chapterId: J.str(json['chapterId'] ?? json['folderId']),
      title: J.str(json['title']),
      description: J.strOrNull(json['description']),
      youtubeUrl: youtubeUrl,
      youtubeVideoId: youtubeVideoId,
      thumbnailUrl: thumb,
      pdfUrl: J.strOrNull(json['pdfUrl']),
      pdfFileName: J.strOrNull(json['pdfFileName']),
      orderIndex: J.intVal(json['orderIndex']),
    );
  }
}

class PdfDocument {
  const PdfDocument({
    required this.id,
    required this.chapterId,
    required this.title,
    required this.orderIndex,
    this.description,
    this.fileUrl,
    this.fileName,
    this.fileSizeBytes,
  });

  final String id;
  final String chapterId;
  final String title;
  final String? description;
  final String? fileUrl;
  final String? fileName;
  final int? fileSizeBytes;
  final int orderIndex;

  bool get isReadable => (fileUrl ?? '').isNotEmpty;

  /// Human-readable size for the document card, e.g. "2.4 MB".
  String get readableSize {
    final bytes = fileSizeBytes;
    if (bytes == null || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    var value = bytes.toDouble();
    var unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit++;
    }
    return '${value.toStringAsFixed(value >= 10 || unit == 0 ? 0 : 1)} ${units[unit]}';
  }

  factory PdfDocument.fromJson(Map<String, dynamic> json) => PdfDocument(
        id: J.str(json['id']),
        chapterId: J.str(json['chapterId'] ?? json['folderId']),
        title: J.str(json['title']),
        description: J.strOrNull(json['description']),
        fileUrl: J.strOrNull(json['fileUrl']),
        fileName: J.strOrNull(json['fileName']),
        fileSizeBytes: J.intOrNull(json['fileSizeBytes']),
        orderIndex: J.intVal(json['orderIndex']),
      );
}
