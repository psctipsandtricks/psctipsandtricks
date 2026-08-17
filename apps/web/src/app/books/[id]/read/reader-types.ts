import { AudioSyncSegment, AudioSyncStatus, ReaderChapter } from '@psc/shared-types';

/** One continuously-scrolling block in the reader — a Topic, or one of its Subtopics. */
export interface ReadingUnit {
  unitIndex: number;
  chapterId: string;
  chapterTitle: string;
  /** 1-based position of this unit's chapter, for the "Chapter 3" divider heading. */
  chapterNumber: number;
  /** True on the first unit of each chapter — the reader renders a divider above it. */
  isChapterStart: boolean;
  /** 1-based position of this topic within its chapter (subtopics share their parent's number). */
  topicNumber: number;
  /** The Topic this unit resumes to — ReadingProgress only tracks topic granularity, so a subtopic unit still saves its parent topic's id. */
  topicId: string;
  kind: 'topic' | 'subtopic';
  id: string;
  title: string;
  description?: string | null;
  youtubeUrl?: string | null;
  audioUrl?: string | null;
  pdfUrl?: string | null;
  audioSyncStatus?: AudioSyncStatus | null;
  audioSyncSegments?: AudioSyncSegment[] | null;
}

export interface ChapterSummary {
  chapterId: string;
  chapterNumber: number;
  title: string;
  orderIndex: number;
  unitStart: number;
  unitEnd: number;
  hasYoutube?: boolean;
  hasAudio?: boolean;
  hasPdf?: boolean;
  topics?: {
    id: string;
    title: string;
    unitIndex: number;
    chapterNumber: number;
    topicNumber: number;
    kind: 'topic' | 'subtopic';
    youtubeUrl?: string | null;
    audioUrl?: string | null;
    pdfUrl?: string | null;
  }[];
}

export function flattenChapters(chapters: ReaderChapter[]): ReadingUnit[] {
  const units: ReadingUnit[] = [];
  let chapterNumber = 0;

  for (const chapter of chapters) {
    if (chapter.topics.length === 0) continue;
    chapterNumber += 1;
    let topicNumber = 0;
    let isChapterStart = true;

    for (const topic of chapter.topics) {
      topicNumber += 1;
      units.push({
        unitIndex: units.length,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterNumber,
        isChapterStart,
        topicNumber,
        topicId: topic.id,
        kind: 'topic',
        id: topic.id,
        title: topic.title,
        description: topic.description,
        youtubeUrl: topic.youtubeUrl,
        audioUrl: topic.audioUrl,
        pdfUrl: topic.pdfUrl,
        audioSyncStatus: topic.audioSyncStatus,
        audioSyncSegments: topic.audioSyncSegments,
      });
      isChapterStart = false;

      for (const subtopic of topic.subtopics) {
        units.push({
          unitIndex: units.length,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          chapterNumber,
          isChapterStart: false,
          topicNumber,
          topicId: topic.id,
          kind: 'subtopic',
          id: subtopic.id,
          title: subtopic.title,
          description: subtopic.description,
          youtubeUrl: subtopic.youtubeUrl,
          audioUrl: subtopic.audioUrl,
          pdfUrl: subtopic.pdfUrl,
          audioSyncStatus: subtopic.audioSyncStatus,
          audioSyncSegments: subtopic.audioSyncSegments,
        });
      }
    }
  }
  return units;
}

export function buildChapterSummaries(chapters: ReaderChapter[], units: ReadingUnit[]): ChapterSummary[] {
  return chapters
    .filter((c) => units.some((u) => u.chapterId === c.id))
    .map((chapter) => {
      const chapterUnits = units.filter((u) => u.chapterId === chapter.id);
      const indices = units.map((u, idx) => (u.chapterId === chapter.id ? idx : -1)).filter((idx) => idx >= 0);
      const chapterNumber = chapterUnits[0]?.chapterNumber || 1;
      return {
        chapterId: chapter.id,
        chapterNumber,
        title: chapter.title,
        orderIndex: chapter.orderIndex,
        unitStart: indices[0],
        unitEnd: indices[indices.length - 1],
        hasYoutube: chapterUnits.some((u) => Boolean(u.youtubeUrl)),
        hasAudio: chapterUnits.some((u) => Boolean(u.audioUrl)),
        hasPdf: chapterUnits.some((u) => Boolean(u.pdfUrl)),
        topics: chapterUnits.map((u) => ({
          id: u.id,
          title: u.title,
          unitIndex: u.unitIndex,
          chapterNumber: u.chapterNumber,
          topicNumber: u.topicNumber,
          kind: u.kind,
          youtubeUrl: u.youtubeUrl,
          audioUrl: u.audioUrl,
          pdfUrl: u.pdfUrl,
        })),
      };
    });
}
