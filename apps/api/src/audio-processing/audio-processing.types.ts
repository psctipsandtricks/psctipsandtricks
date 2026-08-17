export type AudioEntityType = 'chapter' | 'topic' | 'subtopic';

export interface AudioSyncJobMessage {
  entityType: AudioEntityType;
  entityId: string;
}

/** One spoken sentence, pre-aligned to its position in the PDF and its audio timestamps. */
export interface AudioSyncSegment {
  pageNumber: number;
  text: string;
  startTime: number;
  endTime: number;
}

export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

export interface PdfPageText {
  pageNumber: number;
  /** Cleaned text for this page (headers/footers/page-numbers stripped). */
  text: string;
  /** Offset of this page's text within the full concatenated ground-truth string. */
  charOffset: number;
}

export interface PdfGroundTruth {
  fullText: string;
  pages: PdfPageText[];
}
