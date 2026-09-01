import '../../data/models/book.dart';
import '../../data/models/pdf_sync.dart';

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
    this.syncCues,
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

  /// The unit's PDF↔audio timing map, when one has been authored.
  final PdfSyncMap? syncCues;

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
          syncCues: topic.syncCues,
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
            syncCues: subtopic.syncCues,
          ),
        );
      }
    }
  }
  return units;
}

/// A topic and the subtopics filed under it — the sidebar's second level.
///
/// The reader itself pages through the flat [ReadingUnit] list; this grouping
/// exists only so the contents sidebar can show the shape a student recognises
/// from the book, chapter → topic → subtopic, instead of one long list where a
/// subtopic looks like a topic that happens to be indented.
class TopicGroup {
  const TopicGroup({required this.topic, required this.subtopics});

  final ReadingUnit topic;
  final List<ReadingUnit> subtopics;

  bool get hasSubtopics => subtopics.isNotEmpty;

  bool containsUnit(int index) =>
      topic.unitIndex == index ||
      subtopics.any((subtopic) => subtopic.unitIndex == index);

  /// Whether opening this group would reveal any narration — what decides if a
  /// collapsed topic still deserves a headphones hint.
  bool get hasAudioAnywhere =>
      topic.hasAudio || subtopics.any((subtopic) => subtopic.hasAudio);
}

/// A chapter and the span of units it covers — the contents sidebar's model.
class ChapterSummary {
  const ChapterSummary({
    required this.chapterId,
    required this.chapterNumber,
    required this.title,
    required this.units,
    required this.topics,
  });

  final String chapterId;
  final int chapterNumber;
  final String title;

  /// Every unit in the chapter, topics and subtopics alike, in reading order.
  final List<ReadingUnit> units;

  /// The same units as a two-level tree.
  final List<TopicGroup> topics;

  int get unitStart => units.first.unitIndex;
  int get unitEnd => units.last.unitIndex;

  bool containsUnit(int index) => index >= unitStart && index <= unitEnd;
}

/// Splits one chapter's units into topics and the subtopics beneath them.
///
/// [flattenChapters] always emits a topic immediately before its own
/// subtopics, so a single forward pass is enough. A leading subtopic cannot
/// occur, but is given its own group rather than dropped if it ever does.
List<TopicGroup> _groupTopics(List<ReadingUnit> chapterUnits) {
  final groups = <TopicGroup>[];
  for (final unit in chapterUnits) {
    if (!unit.isSubtopic || groups.isEmpty) {
      groups.add(TopicGroup(topic: unit, subtopics: <ReadingUnit>[]));
    } else {
      groups.last.subtopics.add(unit);
    }
  }
  return groups;
}

List<ChapterSummary> buildChapterSummaries(List<ReadingUnit> units) {
  // Units arrive in reading order, so a chapter's units are always contiguous.
  final byChapter = <List<ReadingUnit>>[];
  for (final unit in units) {
    if (byChapter.isNotEmpty &&
        byChapter.last.first.chapterId == unit.chapterId) {
      byChapter.last.add(unit);
    } else {
      byChapter.add(<ReadingUnit>[unit]);
    }
  }

  return [
    for (final chapterUnits in byChapter)
      ChapterSummary(
        chapterId: chapterUnits.first.chapterId,
        chapterNumber: chapterUnits.first.chapterNumber,
        title: chapterUnits.first.chapterTitle,
        units: chapterUnits,
        topics: _groupTopics(chapterUnits),
      ),
  ];
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
