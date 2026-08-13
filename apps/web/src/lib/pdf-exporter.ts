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

export function generateQuizSolutionsPDF({
  quizTitle,
  category = 'PSC Practice Test',
  score,
  totalMarks,
  questions,
}: ExportPDFOptions) {
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
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(margin, y, contentWidth, 26, 3, 3, 'F');
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 26, 3, 3, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(quizTitle, margin + 5, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const metaText = `Category: ${category}   |   Total Questions: ${questions.length}   |   Date: ${dateStr}`;
  doc.text(metaText, margin + 5, y + 17);

  if (score !== undefined && totalMarks !== undefined) {
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

  y += 32;

  // --- QUESTIONS LIST ---
  questions.forEach((q, qIndex) => {
    checkAddPage(38);

    // Question Number Badge
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(margin, y, 14, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`Q${qIndex + 1}`, margin + 7, y + 4.5, { align: 'center' });

    // Question Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    const splitQuestionText = doc.splitTextToSize(q.text, contentWidth - 18);
    doc.text(splitQuestionText, margin + 18, y + 4.8);

    y += Math.max(9, splitQuestionText.length * 5 + 4);

    // Options A, B, C, D...
    q.options.forEach((optRaw, optIdx) => {
      const optObj = typeof optRaw === 'string' ? { id: `opt-${optIdx}`, text: optRaw } : optRaw;
      const optionLetter = String.fromCharCode(65 + optIdx);
      const isCorrect = optIdx === q.correct;
      const isUserChoice = q.userSelection !== undefined && q.userSelection === optIdx;

      // Determine Explanation text for option (only if explicitly provided)
      const explanationText = optObj.explanation ? optObj.explanation.trim() : '';
      const hasOptionExplanation = explanationText.length > 0;

      // Calculate heights and spacing
      const textWidth = contentWidth - 55; // Leave room for right status badge
      const optTextLines = doc.splitTextToSize(`${optObj.text}`, textWidth);
      const textHeight = optTextLines.length * 4.5;

      const explLines = hasOptionExplanation ? doc.splitTextToSize(`Explanation: ${explanationText}`, contentWidth - 30) : [];
      const explHeight = hasOptionExplanation ? explLines.length * 4.2 : 0;

      // Total Card Height with generous padding & vertical spacing
      const topPadding = 4;
      const verticalGap = hasOptionExplanation ? 4.5 : 0;
      const bottomPadding = 4;
      const totalCardHeight = Math.max(12, topPadding + textHeight + verticalGap + explHeight + bottomPadding);

      checkAddPage(totalCardHeight + 4);

      // Card Background & Border Styling
      if (isCorrect) {
        doc.setFillColor(236, 253, 245); // emerald-50
        doc.setDrawColor(110, 231, 183); // emerald-300
      } else if (isUserChoice && !isCorrect) {
        doc.setFillColor(255, 241, 242); // rose-50
        doc.setDrawColor(253, 164, 175); // rose-300
      } else {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.setDrawColor(226, 232, 240); // slate-200
      }
      doc.setLineWidth(0.3);
      doc.roundedRect(margin + 2, y, contentWidth - 2, totalCardHeight, 2, 2, 'FD');

      // Option Letter Square/Circle Badge
      if (isCorrect) {
        doc.setFillColor(16, 185, 129); // emerald-500
        doc.setTextColor(255, 255, 255);
      } else if (isUserChoice && !isCorrect) {
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
      doc.setFont('helvetica', isCorrect ? 'bold' : 'normal');
      doc.setFontSize(9.5);
      if (isCorrect) doc.setTextColor(6, 78, 59); // emerald-900
      else if (isUserChoice) doc.setTextColor(136, 19, 55); // rose-900
      else doc.setTextColor(30, 41, 59); // slate-800

      const optTextY = y + topPadding + 3.5;
      doc.text(optTextLines, margin + 15, optTextY);

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
      if (hasOptionExplanation) {
        const explY = optTextY + textHeight + 2.5;

        // Vertical accent bar on explanation
        if (isCorrect) doc.setDrawColor(16, 185, 129);
        else if (isUserChoice) doc.setDrawColor(244, 63, 94);
        else doc.setDrawColor(203, 213, 225);

        doc.setLineWidth(0.8);
        doc.line(margin + 15, explY - 2.5, margin + 15, explY + explHeight - 3);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        if (isCorrect) doc.setTextColor(4, 120, 87); // emerald-700
        else if (isUserChoice) doc.setTextColor(190, 18, 60); // rose-700
        else doc.setTextColor(100, 116, 139); // slate-500

        doc.text(explLines, margin + 18, explY);
      }

      y += totalCardHeight + 3;
    });

    // Overall Question Explanation (If available)
    if (q.explanation && q.explanation.trim() !== '') {
      const overallLines = doc.splitTextToSize(`Question Summary Note: ${q.explanation.trim()}`, contentWidth - 14);
      const overallHeight = overallLines.length * 4.2 + 6;
      checkAddPage(overallHeight + 3);

      doc.setFillColor(254, 243, 199); // amber-100
      doc.setDrawColor(251, 191, 36); // amber-400
      doc.setLineWidth(0.4);
      doc.roundedRect(margin + 2, y, contentWidth - 2, overallHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(180, 83, 9); // amber-700
      doc.text(overallLines, margin + 7, y + 5.5);

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
  // Render watermark ON TOP with 14% opacity so it's 100% visible over white & filled cards
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    try {
      doc.saveGraphicsState();
      const gState = new (doc as any).GState({ opacity: 0.14 });
      doc.setGState(gState);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(42);
      doc.setTextColor(71, 85, 105); // slate-600

      // Main diagonal watermark
      doc.text('PSC TIPS & TRICKS', pageWidth / 2, pageHeight / 2 - 8, {
        align: 'center',
        angle: 35,
      });

      doc.setFontSize(16);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('OFFICIAL EXAM SOLUTION & RATIONALE GUIDE', pageWidth / 2, pageHeight / 2 + 14, {
        align: 'center',
        angle: 35,
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
  const sanitizedTitle = quizTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const fileName = `${sanitizedTitle}_solutions.pdf`;

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
