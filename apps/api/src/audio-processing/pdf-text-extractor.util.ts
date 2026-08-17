import { PdfGroundTruth, PdfPageText } from './audio-processing.types';

// pdfjs-dist's legacy Node build ships ESM-only (.mjs). TypeScript compiling
// to CommonJS would otherwise downlevel `import()` into `require()`, which
// can't load an ESM-only package — this forces a real dynamic import.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;

const HEADER_FOOTER_BAND = 0.1; // top/bottom 10% of page height
const HEADER_FOOTER_MIN_PAGE_SHARE = 0.4; // must repeat on >=40% of pages to be dropped

interface RawLine {
  text: string;
  normalized: string;
  band: 'top' | 'bottom' | 'body';
}

function normalizeLine(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Extracts per-page text from a PDF to use as the "ground truth" the audio
 * transcript gets aligned against. Uses only pdfjs-dist's text content API
 * (no rendering/canvas involved), and strips likely headers/footers/page
 * numbers — lines in the top/bottom 10% of a page that repeat near-verbatim
 * across many pages, or bare page numbers — so they don't pollute alignment.
 */
export async function extractPdfGroundTruth(pdfBuffer: Buffer): Promise<PdfGroundTruth> {
  const pdfjs = await dynamicImport('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const doc = await loadingTask.promise;

  const pagesRaw: { pageNumber: number; lines: RawLine[] }[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      // pdfjs's text items aren't pre-grouped into lines — bucket them by
      // their (rounded) y position so multi-item lines reconstruct correctly.
      const lineMap = new Map<number, { texts: string[]; y: number }>();
      for (const item of content.items as any[]) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = item.transform[5];
        const key = Math.round(y);
        const bucket = lineMap.get(key) ?? { texts: [], y };
        bucket.texts.push(item.str);
        lineMap.set(key, bucket);
      }

      const lines: RawLine[] = Array.from(lineMap.values())
        .sort((a, b) => b.y - a.y) // PDF y grows upward — top of page first
        .map(({ texts, y }) => {
          const text = texts.join(' ').replace(/\s+/g, ' ').trim();
          const band: RawLine['band'] =
            y > viewport.height * (1 - HEADER_FOOTER_BAND)
              ? 'top'
              : y < viewport.height * HEADER_FOOTER_BAND
                ? 'bottom'
                : 'body';
          return { text, normalized: normalizeLine(text), band };
        })
        .filter((l) => l.text);

      pagesRaw.push({ pageNumber, lines });
      await page.cleanup();
    }
  } finally {
    await doc.destroy();
  }

  const bandLineCounts = new Map<string, number>();
  for (const { lines } of pagesRaw) {
    for (const line of lines) {
      if (line.band === 'body') continue;
      bandLineCounts.set(line.normalized, (bandLineCounts.get(line.normalized) ?? 0) + 1);
    }
  }
  const pageCount = pagesRaw.length || 1;
  const isBoilerplate = (line: RawLine) => {
    if (line.band === 'body') return false;
    if (/^\d+$/.test(line.normalized)) return true;
    const count = bandLineCounts.get(line.normalized) ?? 0;
    return count / pageCount >= HEADER_FOOTER_MIN_PAGE_SHARE;
  };

  const pages: PdfPageText[] = [];
  const chunks: string[] = [];
  let runningOffset = 0;
  for (const { pageNumber, lines } of pagesRaw) {
    const pageText = lines
      .filter((l) => !isBoilerplate(l))
      .map((l) => l.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ pageNumber, text: pageText, charOffset: runningOffset });
    const chunk = pageText ? `${pageText} ` : '';
    chunks.push(chunk);
    runningOffset += chunk.length;
  }

  return { fullText: chunks.join(''), pages };
}
