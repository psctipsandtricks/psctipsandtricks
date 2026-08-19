import { jsPDF } from 'jspdf';

export interface ExportPDFQuestionOption {
  id?: string;
  text: string;
  explanation?: string;
}

export interface ExportPDFQuestion {
  id: string;
  text: string;
  options: (string | ExportPDFQuestionOption)[];
  correct: number;
  explanation?: string;
  marks?: number;
  userSelection?: number;
}

export interface ExportPDFOptions {
  quizTitle: string;
  category?: string;
  score?: number;
  totalMarks?: number;
  questions: ExportPDFQuestion[];
}

/* ------------------------------------------------------------------ *
 * Malayalam-safe text rendering
 *
 * jsPDF's built-in fonts are WinAnsi encoded and jsPDF performs no
 * OpenType shaping, so Malayalam text (conjuncts, and vowel signs that
 * reorder around their base consonant) cannot be drawn with doc.text() —
 * it comes out as latin garbage. Any run that contains Malayalam is
 * therefore shaped by the browser on a canvas and placed into the PDF as
 * a high resolution image. Pure-ASCII runs keep using real PDF text so
 * they stay selectable and the file stays small.
 * ------------------------------------------------------------------ */

const MALAYALAM_RE = /[ഀ-ൿ]/;
const PX_PER_MM = 96 / 25.4;
const PT_TO_MM = 25.4 / 72;
/** Supersampling factor for rasterised text. CSS px are 96 dpi, so 2.4 ≈ 230 dpi. */
const RASTER_SCALE = 2.4;
/**
 * Antialiased text is full of near-duplicate colours, which is what makes
 * rasterised pages heavy. Snapping each channel to a small ramp costs no
 * visible quality at this resolution and roughly halves the PDF.
 */
const QUANT_LEVELS = 8;
/** Line height multiplier for Malayalam, which has tall marks and deep tails. */
const MALAYALAM_LINE_FACTOR = 1.6;

const ML_FONT_FAMILY = 'PSC Noto Sans Malayalam';
const ML_FONT_STACK = [
  `"${ML_FONT_FAMILY}"`,
  '"Noto Sans Malayalam"',
  '"Nirmala UI"',
  '"Malayalam Sangam MN"',
  '"Malayalam MN"',
  '"Kartika"',
  '"AnjaliOldLipi"',
  '"Meera"',
  'Helvetica',
  'Arial',
  'sans-serif',
].join(', ');

const hasMalayalam = (text: string) => MALAYALAM_RE.test(text);

let fontLoadPromise: Promise<void> | null = null;

/**
 * Registers the bundled Noto Sans Malayalam faces so rasterised text looks
 * identical on every device. Falls back to the platform's own Malayalam
 * font (Nirmala UI / Malayalam Sangam MN / Noto) if the files can't load.
 */
function ensureMalayalamFont(): Promise<void> {
  if (typeof window === 'undefined' || typeof (document as any).fonts === 'undefined') {
    return Promise.resolve();
  }
  if (!fontLoadPromise) {
    const faces: Array<{ weight: string; url: string }> = [
      { weight: '400', url: '/fonts/NotoSansMalayalam-Regular.woff2' },
      { weight: '700', url: '/fonts/NotoSansMalayalam-Bold.woff2' },
    ];
    fontLoadPromise = Promise.all(
      faces.map(async ({ weight, url }) => {
        try {
          const face = new FontFace(ML_FONT_FAMILY, `url(${url}) format('woff2')`, { weight, style: 'normal' });
          await face.load();
          (document as any).fonts.add(face);
        } catch {
          /* Bundled font unavailable — the system font stack takes over. */
        }
      })
    ).then(() => undefined);
  }
  return fontLoadPromise;
}

let measureCtx: CanvasRenderingContext2D | null = null;
let rasterCanvas: HTMLCanvasElement | null = null;

function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d')!;
  }
  return measureCtx;
}

function getRasterCanvas(): HTMLCanvasElement {
  if (!rasterCanvas) {
    rasterCanvas = document.createElement('canvas');
  }
  return rasterCanvas;
}

interface TextStyle {
  /** Font size in points, matching jsPDF's setFontSize. */
  size: number;
  bold?: boolean;
  italic?: boolean;
  color: [number, number, number];
}

/** CSS font shorthand for a style at a given raster scale. */
function cssFont(style: TextStyle, scale: number): string {
  const px = style.size * PT_TO_MM * PX_PER_MM * scale;
  // Noto Sans Malayalam has no italic face; synthetic oblique on Malayalam
  // looks broken, so italics are dropped on the raster path.
  return `${style.bold ? '700' : '400'} ${px}px ${ML_FONT_STACK}`;
}

/** Splits into grapheme clusters so a hard break never lands inside a conjunct. */
function graphemes(text: string): string[] {
  const Segmenter = (Intl as any).Segmenter;
  if (typeof Segmenter === 'function') {
    try {
      const seg = new Segmenter(undefined, { granularity: 'grapheme' });
      return Array.from(seg.segment(text), (part: any) => part.segment as string);
    } catch {
      /* fall through */
    }
  }
  return Array.from(text);
}

/** Greedy word wrap using real browser text metrics. */
function wrapWithCanvas(text: string, maxWidthMm: number, style: TextStyle): string[] {
  const ctx = getMeasureCtx();
  ctx.font = cssFont(style, 1);
  const maxPx = maxWidthMm * PX_PER_MM;
  const lines: string[] = [];

  const pushWrapped = (word: string) => {
    // A single token wider than the column: break it on grapheme boundaries.
    let chunk = '';
    for (const g of graphemes(word)) {
      if (chunk && ctx.measureText(chunk + g).width > maxPx) {
        lines.push(chunk);
        chunk = g;
      } else {
        chunk += g;
      }
    }
    if (chunk) lines.push(chunk);
  };

  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxPx) {
        lines.push(line);
        if (ctx.measureText(word).width > maxPx) {
          pushWrapped(word);
          line = lines.pop() ?? '';
        } else {
          line = word;
        }
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }

  return lines.length ? lines : [''];
}

interface TextBlock {
  lines: string[];
  /** Baseline-to-baseline distance, mm. */
  lineHeight: number;
  /** Vertical space the block occupies in the layout flow, mm. */
  height: number;
  style: TextStyle;
  raster: boolean;
}

/**
 * Measures and wraps a run of text. Malayalam runs get a taller default
 * line height, and callers must use the returned `height` for layout so
 * cards grow to fit.
 */
function layoutText(
  doc: jsPDF,
  text: string,
  maxWidthMm: number,
  style: TextStyle,
  baseLineHeightMm: number
): TextBlock {
  const raster = hasMalayalam(text);
  const lineHeight = raster
    ? Math.max(baseLineHeightMm, style.size * PT_TO_MM * MALAYALAM_LINE_FACTOR)
    : baseLineHeightMm;

  let lines: string[];
  if (raster) {
    lines = wrapWithCanvas(text, maxWidthMm, style);
  } else {
    doc.setFont('helvetica', style.bold ? 'bold' : style.italic ? 'italic' : 'normal');
    doc.setFontSize(style.size);
    lines = doc.splitTextToSize(text, maxWidthMm) as string[];
    if (!lines.length) lines = [''];
  }

  return { lines, lineHeight, height: lines.length * lineHeight, style, raster };
}

/**
 * A text tile only ever holds one colour blended over one background, so every
 * pixel can be snapped to a step on that ramp. The background and the text
 * keep their exact colours (the tile must match the vector card behind it),
 * while the antialiasing in between collapses to a handful of values, which is
 * what the PNG deflate stream actually pays for.
 */
function quantizeToRamp(
  c: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  bg: [number, number, number],
  fg: [number, number, number]
) {
  if (QUANT_LEVELS < 2) return;

  // Blend factors are read off whichever channel separates fg from bg most.
  let ch = 0;
  let span = 0;
  for (let i = 0; i < 3; i++) {
    const d = Math.abs(fg[i] - bg[i]);
    if (d > span) {
      span = d;
      ch = i;
    }
  }
  if (span < 8) return; // Text is invisible against its background anyway.

  // getImageData/putImageData work in device pixels, ignoring the transform.
  const img = c.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;
  const steps = QUANT_LEVELS - 1;
  const base = bg[ch];
  const range = fg[ch] - bg[ch];

  // Precompute the ramp so the inner loop is three table reads.
  const ramp = new Uint8Array(QUANT_LEVELS * 3);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    ramp[s * 3] = Math.round(bg[0] + (fg[0] - bg[0]) * t);
    ramp[s * 3 + 1] = Math.round(bg[1] + (fg[1] - bg[1]) * t);
    ramp[s * 3 + 2] = Math.round(bg[2] + (fg[2] - bg[2]) * t);
  }

  for (let i = 0; i < data.length; i += 4) {
    let t = (data[i + ch] - base) / range;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const s = Math.round(t * steps) * 3;
    data[i] = ramp[s];
    data[i + 1] = ramp[s + 1];
    data[i + 2] = ramp[s + 2];
  }
  c.putImageData(img, 0, 0);
}

/** Draws a measured block with `firstBaselineY` as the baseline of line 1. */
function drawText(
  doc: jsPDF,
  block: TextBlock,
  x: number,
  firstBaselineY: number,
  /** Flat colour behind the text, so raster tiles stay opaque and compress well. */
  background: [number, number, number],
  align: 'left' | 'center' = 'left'
) {
  const { lines, lineHeight, style } = block;
  const [r, g, b] = style.color;

  if (!block.raster) {
    doc.setFont('helvetica', style.bold ? 'bold' : style.italic ? 'italic' : 'normal');
    doc.setFontSize(style.size);
    doc.setTextColor(r, g, b);
    lines.forEach((line, i) => {
      doc.text(line, x, firstBaselineY + i * lineHeight, align === 'center' ? { align: 'center' } : undefined);
    });
    return;
  }

  const ctx = getMeasureCtx();
  ctx.font = cssFont(style, 1);
  const sizePx = style.size * PT_TO_MM * PX_PER_MM;

  let widthPx = 0;
  let ascentPx = sizePx * 1.1;
  let descentPx = sizePx * 0.45;
  for (const line of lines) {
    const m = ctx.measureText(line);
    widthPx = Math.max(widthPx, m.width);
    ascentPx = Math.max(ascentPx, m.fontBoundingBoxAscent || 0, m.actualBoundingBoxAscent || 0);
    descentPx = Math.max(descentPx, m.fontBoundingBoxDescent || 0, m.actualBoundingBoxDescent || 0);
  }
  if (widthPx <= 0) return;

  const padPx = sizePx * 0.15;
  const lineHeightPx = lineHeight * PX_PER_MM;
  const blockWidthPx = widthPx + padPx * 2;
  const blockHeightPx = ascentPx + (lines.length - 1) * lineHeightPx + descentPx + padPx * 2;

  const canvas = getRasterCanvas();
  canvas.width = Math.max(1, Math.ceil(blockWidthPx * RASTER_SCALE));
  canvas.height = Math.max(1, Math.ceil(blockHeightPx * RASTER_SCALE));

  const c = canvas.getContext('2d', { willReadFrequently: true })!;
  c.setTransform(RASTER_SCALE, 0, 0, RASTER_SCALE, 0, 0);
  c.fillStyle = `rgb(${background[0]}, ${background[1]}, ${background[2]})`;
  c.fillRect(0, 0, blockWidthPx, blockHeightPx);

  c.font = cssFont(style, 1);
  c.fillStyle = `rgb(${r}, ${g}, ${b})`;
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  lines.forEach((line, i) => {
    c.fillText(line, padPx, padPx + ascentPx + i * lineHeightPx);
  });

  quantizeToRamp(c, canvas, background, style.color);

  const widthMm = blockWidthPx / PX_PER_MM;
  const heightMm = blockHeightPx / PX_PER_MM;
  const left = align === 'center' ? x - widthMm / 2 : x - padPx / PX_PER_MM;
  const top = firstBaselineY - (ascentPx + padPx) / PX_PER_MM;

  doc.addImage(canvas, 'PNG', left, top, widthMm, heightMm, undefined, 'FAST');
}

function buildFileName(quizTitle: string): string {
  // Latin, digits and Malayalam are kept; everything else collapses to "_".
  const slug = quizTitle
    .replace(/[^0-9A-Za-zഀ-ൿ]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return `${(slug || 'quiz').slice(0, 80)}_solutions.pdf`;
}

async function loadLogoWatermarkDataUrl(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 500;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 500, 500);
          resolve(canvas.toDataURL('image/png'));
          return;
        }
      } catch {
        // ignore
      }
      resolve(null);
    };
    img.onerror = () => resolve(null);
    img.src = '/watermark-logo.svg';
  });
}

export async function generateQuizSolutionsPDF({
  quizTitle,
  category = 'PSC Practice Test',
  score,
  totalMarks,
  questions,
}: ExportPDFOptions) {
  const [_, logoWatermarkUrl] = await Promise.all([
    ensureMalayalamFont(),
    loadLogoWatermarkDataUrl(),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const WHITE: [number, number, number] = [255, 255, 255];
  const BANNER_BG: [number, number, number] = [241, 245, 249]; // slate-100
  const CORRECT_BG: [number, number, number] = [236, 253, 245]; // emerald-50
  const WRONG_BG: [number, number, number] = [255, 241, 242]; // rose-50
  const NEUTRAL_BG: [number, number, number] = [248, 250, 252]; // slate-50
  const NOTE_BG: [number, number, number] = [254, 243, 199]; // amber-100

  const renderHeaderFooter = () => {
    const totalPages = doc.getNumberOfPages();

    // 1. HEADER BAR
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('PSC TIPS & TRICKS  •  OFFICIAL SOLUTION & RATIONALE GUIDE', margin, margin - 4);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, margin - 2, pageWidth - margin, margin - 2);

    // 2. FOOTER BAR
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text('PSC Tips And Tricks Learning Platform  •  Personal Student Revision Copy', margin, pageHeight - 8);
  };

  const checkAddPage = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 15) {
      doc.addPage();
      y = margin + 10;
      renderHeaderFooter();
    }
  };

  // Render header and footer on Page 1
  renderHeaderFooter();

  // --- TOP HEADER BANNER CARD ---
  const hasScore = score !== undefined && totalMarks !== undefined;
  const titleStyle: TextStyle = { size: 15, bold: true, color: [15, 23, 42] }; // slate-900
  const titleWidth = contentWidth - (hasScore ? 48 : 10);
  const titleBlock = layoutText(doc, quizTitle, titleWidth, titleStyle, 6.5);
  // Two lines of title keep the banner from dominating the first page.
  titleBlock.lines = titleBlock.lines.slice(0, 2);
  titleBlock.height = titleBlock.lines.length * titleBlock.lineHeight;

  const bannerHeight = Math.max(26, titleBlock.height + 17);

  doc.setFillColor(...BANNER_BG);
  doc.roundedRect(margin, y, contentWidth, bannerHeight, 3, 3, 'F');
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, bannerHeight, 3, 3, 'D');

  drawText(doc, titleBlock, margin + 5, y + 9, BANNER_BG);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const metaText = `Category: ${category}   |   Total Questions: ${questions.length}   |   Date: ${dateStr}`;
  const metaBlock = layoutText(doc, metaText, contentWidth - 10, { size: 8.5, color: [71, 85, 105] }, 4.2);
  drawText(doc, metaBlock, margin + 5, y + bannerHeight - 9, BANNER_BG);

  if (hasScore) {
    // Score Badge Pill
    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(251, 191, 36); // amber-400
    doc.roundedRect(pageWidth - margin - 38, y + 5, 33, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text('SCORE ACHIEVED', pageWidth - margin - 21.5, y + 9.5, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(146, 64, 14); // amber-800
    doc.text(`${score} / ${totalMarks}`, pageWidth - margin - 21.5, y + 16, { align: 'center' });
  }

  y += bannerHeight + 6;

  // --- QUESTIONS LIST ---
  questions.forEach((q, qIndex) => {
    // Question Text (measured first so a long question can start on a fresh page)
    const questionStyle: TextStyle = { size: 10.5, bold: true, color: [15, 23, 42] };
    const questionBlock = layoutText(doc, q.text, contentWidth - 18, questionStyle, 5);

    checkAddPage(Math.min(questionBlock.height + 24, 60));

    // Question Number Badge
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(margin, y, 14, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`Q${qIndex + 1}`, margin + 7, y + 4.5, { align: 'center' });

    drawText(doc, questionBlock, margin + 18, y + 4.8, WHITE);

    y += Math.max(9, questionBlock.height + 4);

    // Options A, B, C, D...
    q.options.forEach((optRaw, optIdx) => {
      const optObj = typeof optRaw === 'string' ? { id: `opt-${optIdx}`, text: optRaw } : optRaw;
      const optionLetter = String.fromCharCode(65 + optIdx);
      const isCorrect = optIdx === q.correct;
      const isUserChoice = q.userSelection !== undefined && q.userSelection === optIdx;

      const cardBg = isCorrect ? CORRECT_BG : isUserChoice ? WRONG_BG : NEUTRAL_BG;

      // Determine Explanation text for option (only if explicitly provided)
      const explanationText = optObj.explanation ? optObj.explanation.trim() : '';
      const hasOptionExplanation = explanationText.length > 0;

      // Calculate heights and spacing
      const textWidth = contentWidth - 55; // Leave room for right status badge
      const optStyle: TextStyle = {
        size: 9.5,
        bold: isCorrect,
        color: isCorrect ? [6, 78, 59] : isUserChoice ? [136, 19, 55] : [30, 41, 59],
      };
      const optBlock = layoutText(doc, optObj.text, textWidth, optStyle, 4.5);
      const textHeight = optBlock.height;

      const explStyle: TextStyle = {
        size: 8.5,
        italic: true,
        color: isCorrect ? [4, 120, 87] : isUserChoice ? [190, 18, 60] : [100, 116, 139],
      };
      const explBlock = hasOptionExplanation
        ? layoutText(doc, `Explanation: ${explanationText}`, contentWidth - 30, explStyle, 4.2)
        : null;
      const explHeight = explBlock ? explBlock.height : 0;

      // Total Card Height with generous padding & vertical spacing
      const topPadding = 4;
      const verticalGap = hasOptionExplanation ? 4.5 : 0;
      const bottomPadding = 4;
      const totalCardHeight = Math.max(12, topPadding + textHeight + verticalGap + explHeight + bottomPadding);

      checkAddPage(totalCardHeight + 4);

      // Card Background & Border Styling
      doc.setFillColor(...cardBg);
      if (isCorrect) {
        doc.setDrawColor(110, 231, 183); // emerald-300
      } else if (isUserChoice) {
        doc.setDrawColor(253, 164, 175); // rose-300
      } else {
        doc.setDrawColor(226, 232, 240); // slate-200
      }
      doc.setLineWidth(0.3);
      doc.roundedRect(margin + 2, y, contentWidth - 2, totalCardHeight, 2, 2, 'FD');

      // Option Letter Square/Circle Badge
      if (isCorrect) {
        doc.setFillColor(16, 185, 129); // emerald-500
        doc.setTextColor(255, 255, 255);
      } else if (isUserChoice) {
        doc.setFillColor(244, 63, 94); // rose-500
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setFillColor(226, 232, 240); // slate-200
        doc.setTextColor(71, 85, 105); // slate-600
      }
      doc.roundedRect(margin + 5, y + 3.5, 6.5, 6.5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(optionLetter, margin + 8.25, y + 8, { align: 'center' });

      // Option Title Text
      const optTextY = y + topPadding + 3.5;
      drawText(doc, optBlock, margin + 15, optTextY, cardBg);

      // Status Pill Badges (Right side of Option card)
      if (isCorrect) {
        doc.setFillColor(16, 185, 129); // emerald-500
        doc.roundedRect(pageWidth - margin - 32, y + 3.5, 30, 6, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('CORRECT ANSWER', pageWidth - margin - 17, y + 7.5, { align: 'center' });
      } else if (isUserChoice) {
        doc.setFillColor(244, 63, 94); // rose-500
        doc.roundedRect(pageWidth - margin - 32, y + 3.5, 30, 6, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('YOUR SELECTION', pageWidth - margin - 17, y + 7.5, { align: 'center' });
      }

      // Option Explanation Sub-Section (Only if an explanation text is explicitly provided)
      if (explBlock) {
        const explY = optTextY + textHeight + 2.5;

        // Vertical accent bar on explanation
        if (isCorrect) doc.setDrawColor(16, 185, 129);
        else if (isUserChoice) doc.setDrawColor(244, 63, 94);
        else doc.setDrawColor(203, 213, 225);

        doc.setLineWidth(0.8);
        doc.line(margin + 15, explY - 2.5, margin + 15, explY + explHeight - 3);

        drawText(doc, explBlock, margin + 18, explY, cardBg);
      }

      y += totalCardHeight + 3;
    });

    // Overall Question Explanation (If available)
    if (q.explanation && q.explanation.trim() !== '') {
      const noteStyle: TextStyle = { size: 8.5, bold: true, color: [180, 83, 9] }; // amber-700
      const noteBlock = layoutText(
        doc,
        `Question Summary Note: ${q.explanation.trim()}`,
        contentWidth - 14,
        noteStyle,
        4.2
      );
      const overallHeight = noteBlock.height + 6;
      checkAddPage(overallHeight + 3);

      doc.setFillColor(...NOTE_BG);
      doc.setDrawColor(251, 191, 36); // amber-400
      doc.setLineWidth(0.4);
      doc.roundedRect(margin + 2, y, contentWidth - 2, overallHeight, 2, 2, 'FD');

      drawText(doc, noteBlock, margin + 7, y + 5.5, NOTE_BG);

      y += overallHeight + 5;
    } else {
      y += 3;
    }

    // Divider Line between Questions
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  });

  // --- OVERLAY WATERMARK PASS ON ALL PAGES ---
  // Render watermark ON TOP with subtle opacity so it's clearly visible over white & filled cards
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    try {
      doc.saveGraphicsState();
      const gState = new (doc as any).GState({ opacity: 0.12 });
      doc.setGState(gState);

      if (logoWatermarkUrl) {
        const logoSize = 92; // mm
        const logoX = (pageWidth - logoSize) / 2;
        const logoY = (pageHeight - logoSize) / 2 - 10;
        doc.addImage(logoWatermarkUrl, 'PNG', logoX, logoY, logoSize, logoSize, undefined, 'FAST');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(71, 85, 105); // slate-600

      // Watermark text below the central emblem
      doc.text('PSC TIPS AND TRICKS', pageWidth / 2, pageHeight / 2 + 48, {
        align: 'center',
      });

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('OFFICIAL EXAM SOLUTION & RATIONALE GUIDE', pageWidth / 2, pageHeight / 2 + 55, {
        align: 'center',
      });

      doc.restoreGraphicsState();
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(36);
      doc.setTextColor(215, 222, 232);
      doc.text('PSC TIPS & TRICKS', pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 35,
      });
    }
  }

  // Direct Download without triggering browser File System Access API picker modal
  const fileName = buildFileName(quizTitle);

  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
