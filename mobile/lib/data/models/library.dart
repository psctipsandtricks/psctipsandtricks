import '../../core/utils/json.dart';

/// Shared shape of the two library folder levels. The video and PDF libraries
/// are both browsed as Exam → Chapter → item, so one model covers both.
class LibraryFolder {
  const LibraryFolder({
    required this.id,
    required this.title,
    required this.orderIndex,
    this.description,
    this.examId,
    this.itemCount = 0,
    this.chapterCount = 0,
  });

  final String id;
  final String title;
  final String? description;
  final int orderIndex;

  /// Set on chapter-level folders; null on exams.
  final String? examId;

  /// Videos or documents contained, depending on which library this came from.
  final int itemCount;
  final int chapterCount;

  factory LibraryFolder.fromJson(Map<String, dynamic> json) => LibraryFolder(
        id: J.str(json['id']),
        title: J.str(json['title']),
        description: J.strOrNull(json['description']),
        orderIndex: J.intVal(json['orderIndex']),
        examId: J.strOrNull(json['examId']),
        itemCount: J.intVal(json['videoCount'], J.intVal(json['documentCount'])),
        chapterCount: J.intVal(json['chapterCount']),
      );
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

  factory VideoItem.fromJson(Map<String, dynamic> json) => VideoItem(
        id: J.str(json['id']),
        chapterId: J.str(json['chapterId']),
        title: J.str(json['title']),
        description: J.strOrNull(json['description']),
        youtubeUrl: J.str(json['youtubeUrl']),
        youtubeVideoId: J.str(json['youtubeVideoId']),
        thumbnailUrl: J.str(json['thumbnailUrl']),
        pdfUrl: J.strOrNull(json['pdfUrl']),
        pdfFileName: J.strOrNull(json['pdfFileName']),
        orderIndex: J.intVal(json['orderIndex']),
      );
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
        chapterId: J.str(json['chapterId']),
        title: J.str(json['title']),
        description: J.strOrNull(json['description']),
        fileUrl: J.strOrNull(json['fileUrl']),
        fileName: J.strOrNull(json['fileName']),
        fileSizeBytes: J.intOrNull(json['fileSizeBytes']),
        orderIndex: J.intVal(json['orderIndex']),
      );
}
