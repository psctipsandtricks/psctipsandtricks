import { diffArrays } from 'diff';
import { AudioSyncSegment, PdfGroundTruth, TimedWord } from './audio-processing.types';

interface PdfToken {
  normalized: string;
  charStart: number;
  charEnd: number;
  timeStart?: number;
  timeEnd?: number;
}

function normalizeToken(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function tokenizePdfText(fullText: string): PdfToken[] {
  const tokens: PdfToken[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fullText))) {
    const normalized = normalizeToken(m[0]);
    if (!normalized) continue;
    tokens.push({ normalized, charStart: m.index, charEnd: m.index + m[0].length });
  }
  return tokens;
}

/**
 * Aligns whisper.cpp's word-level timestamps onto the PDF's word tokens with
 * an LCS-based diff on normalized tokens (tolerant of punctuation/OCR/
 * pronunciation differences — only exact normalized-token matches count as
 * "aligned"; everything else gets timestamps interpolated between the
 * nearest aligned neighbors, or flat-extrapolated at the very start/end).
 */
function alignWordsToPdf(whisperWords: TimedWord[], fullText: string): PdfToken[] {
  const pdfTokens = tokenizePdfText(fullText);
  const pdfNormalized = pdfTokens.map((t) => t.normalized);
  const whisperNormalized = whisperWords.map((w, i) => normalizeToken(w.word) || `__empty_${i}`);

  const diff = diffArrays(pdfNormalized, whisperNormalized);

  let pdfIdx = 0;
  let whisperIdx = 0;
  for (const part of diff) {
    if (!part.added && !part.removed) {
      for (let k = 0; k < part.value.length; k++) {
        pdfTokens[pdfIdx].timeStart = whisperWords[whisperIdx].start;
        pdfTokens[pdfIdx].timeEnd = whisperWords[whisperIdx].end;
        pdfIdx++;
        whisperIdx++;
      }
    } else if (part.removed) {
      pdfIdx += part.value.length;
    } else if (part.added) {
      whisperIdx += part.value.length;
    }
  }

  // Interpolate unmatched tokens between nearest aligned neighbors.
  let i = 0;
  while (i < pdfTokens.length) {
    if (pdfTokens[i].timeStart !== undefined) {
      i++;
      continue;
    }
    let j = i;
    while (j < pdfTokens.length && pdfTokens[j].timeStart === undefined) j++;
    const before = i > 0 ? pdfTokens[i - 1].timeEnd : undefined;
    const after = j < pdfTokens.length ? pdfTokens[j].timeStart : undefined;
    for (let k = i; k < j; k++) {
      let t: number;
      if (before !== undefined && after !== undefined) {
        t = before + ((after - before) * (k - i + 1)) / (j - i + 1);
      } else if (before !== undefined) {
        t = before;
      } else if (after !== undefined) {
        t = after;
      } else {
        t = 0;
      }
      pdfTokens[k].timeStart = t;
      pdfTokens[k].timeEnd = t;
    }
    i = j;
  }

  return pdfTokens;
}

/** Splits text into sentences with Node's built-in Intl.Segmenter (no dependency needed). */
function segmentSentences(fullText: string): { text: string; start: number; end: number }[] {
  const segmenter = new (Intl as any).Segmenter(undefined, { granularity: 'sentence' });
  const out: { text: string; start: number; end: number }[] = [];
  for (const seg of segmenter.segment(fullText)) {
    const raw = seg.segment as string;
    const text = raw.trim();
    if (!text) continue;
    out.push({ text, start: seg.index, end: seg.index + raw.length });
  }
  return out;
}

function pageForOffset(pages: PdfGroundTruth['pages'], offset: number): number {
  let page = pages[0]?.pageNumber ?? 1;
  for (const p of pages) {
    if (p.charOffset <= offset) page = p.pageNumber;
    else break;
  }
  return page;
}

/**
 * Full alignment pipeline: sentence-segments the PDF ground truth (across
 * page boundaries, so a sentence spanning a page break is one segment) and
 * assigns each sentence a {startTime, endTime} from its aligned/interpolated
 * word timestamps. Sentences with zero matched words are dropped rather than
 * emitting a bogus {0,0}.
 */
export function buildAudioSyncSegments(groundTruth: PdfGroundTruth, whisperWords: TimedWord[]): AudioSyncSegment[] {
  if (!groundTruth.fullText.trim() || whisperWords.length === 0) return [];

  const alignedTokens = alignWordsToPdf(whisperWords, groundTruth.fullText);
  const sentences = segmentSentences(groundTruth.fullText);

  const segments: AudioSyncSegment[] = [];
  let tokenCursor = 0;
  for (const sentence of sentences) {
    while (tokenCursor < alignedTokens.length && alignedTokens[tokenCursor].charStart < sentence.start) tokenCursor++;
    let cursor = tokenCursor;
    let start: number | undefined;
    let end: number | undefined;
    while (cursor < alignedTokens.length && alignedTokens[cursor].charStart < sentence.end) {
      const token = alignedTokens[cursor];
      if (token.timeStart !== undefined) start = start === undefined ? token.timeStart : Math.min(start, token.timeStart);
      if (token.timeEnd !== undefined) end = end === undefined ? token.timeEnd : Math.max(end, token.timeEnd);
      cursor++;
    }
    if (start === undefined || end === undefined) continue;

    segments.push({
      pageNumber: pageForOffset(groundTruth.pages, sentence.start),
      text: sentence.text,
      startTime: start,
      endTime: end,
    });
  }

  return segments;
}
