import '../../data/models/book.dart';

/// One readable block in the reader — a Topic, or one of its Subtopics.
///
/// Ported from the website's `reader-types.ts` so both surfaces number
/// chapters and topics identically and resume to the same place.
class ReadingUnit {
  const ReadingUnit({
    required this.unitIndex,
    required this.chapterId,
    required this.chapterTitle,
    required this.chapterNumber,
    required this.isChapterStart,
    required this.topicNumber,
    required this.topicId,
    required this.isSubtopic,
    required this.id,
    required this.title,
    this.description,
    this.youtubeUrl,
    this.audioUrl,
    this.pdfUrl,
  });

  final int unitIndex;
  final String chapterId;
  final String chapterTitle;

  /// 1-based position of this unit's chapter, for the "Chapter 3" divider.
  final int chapterNumber;

  /// True on the first unit of each chapter.
  final bool isChapterStart;

  /// 1-based position within the chapter; subtopics share their parent's number.
  final int topicNumber;

  /// Progress is only tracked at topic granularity, so a subtopic unit still
  /// saves its parent topic's id.
  final String topicId;

  final bool isSubtopic;
  final String id;
  final String title;
  final String? description;
  final String? youtubeUrl;
  final String? audioUrl;
  final String? pdfUrl;

  bool get hasAudio => (audioUrl ?? '').isNotEmpty;
  bool get hasVideo => (youtubeUrl ?? '').isNotEmpty;
  bool get hasPdf => (pdfUrl ?? '').isNotEmpty;
  bool get hasMedia => hasAudio || hasVideo || hasPdf;
  bool get hasBody => (description ?? '').trim().isNotEmpty;
}

/// Walks the chapter tree into the flat, ordered list the reader pages through.
/// Chapters with no topics are skipped — there would be nothing to show.
List<ReadingUnit> flattenChapters(List<Chapter> chapters) {
  final units = <ReadingUnit>[];
  var chapterNumber = 0;

  for (final chapter in chapters) {
    if (chapter.topics.isEmpty) continue;
    chapterNumber += 1;
    var topicNumber = 0;
    var isChapterStart = true;

    for (final topic in chapter.topics) {
      topicNumber += 1;
      units.add(
        ReadingUnit(
          unitIndex: units.length,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          chapterNumber: chapterNumber,
          isChapterStart: isChapterStart,
          topicNumber: topicNumber,
          topicId: topic.id,
          isSubtopic: false,
          id: topic.id,
          title: topic.title,
          description: topic.description,
          youtubeUrl: topic.youtubeUrl,
          audioUrl: topic.audioUrl,
          pdfUrl: topic.pdfUrl,
        ),
      );
      isChapterStart = false;

      for (final subtopic in topic.subtopics) {
        units.add(
          ReadingUnit(
            unitIndex: units.length,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            chapterNumber: chapterNumber,
            isChapterStart: false,
            topicNumber: topicNumber,
            topicId: topic.id,
            isSubtopic: true,
            id: subtopic.id,
            title: subtopic.title,
            description: subtopic.description,
            youtubeUrl: subtopic.youtubeUrl,
            audioUrl: subtopic.audioUrl,
            pdfUrl: subtopic.pdfUrl,
          ),
        );
      }
    }
  }
  return units;
}

/// A chapter and the span of units it covers — the contents drawer's model.
class ChapterSummary {
  const ChapterSummary({
    required this.chapterId,
    required this.chapterNumber,
    required this.title,
    required this.units,
  });

  final String chapterId;
  final int chapterNumber;
  final String title;
  final List<ReadingUnit> units;

  int get unitStart => units.first.unitIndex;
  int get unitEnd => units.last.unitIndex;

  bool containsUnit(int index) => index >= unitStart && index <= unitEnd;
}

List<ChapterSummary> buildChapterSummaries(List<ReadingUnit> units) {
  final summaries = <ChapterSummary>[];
  for (final unit in units) {
    if (summaries.isNotEmpty && summaries.last.chapterId == unit.chapterId) {
      summaries.last.units.add(unit);
    } else {
      summaries.add(
        ChapterSummary(
          chapterId: unit.chapterId,
          chapterNumber: unit.chapterNumber,
          title: unit.chapterTitle,
          units: [unit],
        ),
      );
    }
  }
  return summaries;
}

/// Locates the unit a saved progress row points at. Prefers the exact topic,
/// then falls back to the chapter's first unit, matching the website's rule.
int resolveResumeIndex(
  List<ReadingUnit> units, {
  String? topicId,
  String? chapterId,
}) {
  if (topicId != null) {
    final byTopic =
        units.indexWhere((u) => !u.isSubtopic && u.id == topicId);
    if (byTopic >= 0) return byTopic;
  }
  if (chapterId != null) {
    final byChapter = units.indexWhere((u) => u.chapterId == chapterId);
    if (byChapter >= 0) return byChapter;
  }
  return -1;
}
