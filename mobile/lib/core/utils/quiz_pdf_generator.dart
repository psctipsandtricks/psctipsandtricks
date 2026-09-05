import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

/// One option of a solutions-PDF question — mirrors the website's
/// `ExportPDFQuestionOption`.
class QuizPdfOption {
  const QuizPdfOption({required this.text, this.explanation});
  final String text;
  final String? explanation;
}

/// One question of a solutions PDF — mirrors the website's
/// `ExportPDFQuestion`, down to `userSelection` being an index rather than an
/// id, so both builds treat an unattempted question identically.
class QuizPdfQuestion {
  const QuizPdfQuestion({
    required this.text,
    required this.options,
    required this.correctIndex,
    this.explanation,
    this.marks,
    this.userSelection,
  });

  final String text;
  final List<QuizPdfOption> options;
  final int correctIndex;
  final String? explanation;
  final double? marks;

  /// Null when the student has not picked an option for this question yet.
  final int? userSelection;
}

/// Builds the same "solutions PDF" the website offers on a premium quiz: every
/// question, every option marked correct / the student's own pick, and any
/// explanation text, watermarked as a personal revision copy.
///
/// Malayalam has no native PDF-text path here, for the same reason the
/// website's jsPDF build avoids its own text renderer for it: the `pdf`
/// package maps Unicode code points straight to glyphs with no OpenType
/// shaping, so reordering vowel signs and conjuncts come out wrong. Any run
/// containing Malayalam is instead laid out and rasterised through Flutter's
/// own text engine — which does shape it correctly, the same way a browser's
/// canvas does for the website — and embedded as an image. A plain run stays
/// real, selectable PDF text.
class QuizPdfGenerator {
  const QuizPdfGenerator._();

  static final RegExp _malayalamPattern = RegExp(r'[ഀ-ൿ]');
  static bool _hasMalayalam(String text) => _malayalamPattern.hasMatch(text);

  /// Supersampling factor for rasterised text, so it stays crisp once placed
  /// into the PDF at its true point size.
  static const double _rasterScale = 2.5;

  static const PdfColor _white = PdfColor.fromInt(0xFFFFFFFF);
  static const PdfColor _slate900 = PdfColor.fromInt(0xFF0F172A);
  static const PdfColor _slate800 = PdfColor.fromInt(0xFF1E293B);
  static const PdfColor _slate600 = PdfColor.fromInt(0xFF475569);
  static const PdfColor _slate500 = PdfColor.fromInt(0xFF64748B);
  static const PdfColor _slate400 = PdfColor.fromInt(0xFF94A3B8);
  static const PdfColor _slate300 = PdfColor.fromInt(0xFFCBD5E1);
  static const PdfColor _slate200 = PdfColor.fromInt(0xFFE2E8F0);
  static const PdfColor _slate100 = PdfColor.fromInt(0xFFF1F5F9);
  static const PdfColor _emerald50 = PdfColor.fromInt(0xFFECFDF5);
  static const PdfColor _emerald300 = PdfColor.fromInt(0xFF6EE7B7);
  static const PdfColor _emerald500 = PdfColor.fromInt(0xFF10B981);
  static const PdfColor _emerald800 = PdfColor.fromInt(0xFF065F46);
  static const PdfColor _rose50 = PdfColor.fromInt(0xFFFFF1F2);
  static const PdfColor _rose300 = PdfColor.fromInt(0xFFFDA4AF);
  static const PdfColor _rose500 = PdfColor.fromInt(0xFFF43F5E);
  static const PdfColor _rose800 = PdfColor.fromInt(0xFF881337);
  static const PdfColor _amber100 = PdfColor.fromInt(0xFFFEF3C7);
  static const PdfColor _amber400 = PdfColor.fromInt(0xFFFBBF24);
  static const PdfColor _amber700 = PdfColor.fromInt(0xFFB45309);
  static const PdfColor _amber800 = PdfColor.fromInt(0xFF92400E);

  static const double _margin = 32;
  static const _pageFormat = PdfPageFormat.a4;
  static double get _contentWidth => _pageFormat.availableWidth - _margin * 2;

  static Future<Uint8List> generate({
    required String quizTitle,
    String category = 'PSC Practice Test',
    double? score,
    double? totalMarks,
    required List<QuizPdfQuestion> questions,
  }) async {
    Uint8List? logoBytes;
    try {
      logoBytes = (await rootBundle.load('assets/icon/app_logo.png'))
          .buffer
          .asUint8List();
    } catch (_) {
      // A missing/renamed asset must not stop the whole PDF from building —
      // the watermark is decoration, not the point of the document.
      logoBytes = null;
    }

    final content = <pw.Widget>[
      await _banner(
        quizTitle: quizTitle,
        category: category,
        score: score,
        totalMarks: totalMarks,
        questionCount: questions.length,
      ),
    ];

    for (var qi = 0; qi < questions.length; qi++) {
      final question = questions[qi];
      content.add(await _questionHeader(qi, question));
      for (var oi = 0; oi < question.options.length; oi++) {
        content.add(await _optionCard(question, oi));
      }
      final note = question.explanation?.trim();
      if (note != null && note.isNotEmpty) {
        content.add(await _noteBox(note));
      }
      content.add(pw.Container(
        margin: const pw.EdgeInsets.only(top: 4, bottom: 14),
        height: 0.6,
        color: _slate200,
      ));
    }

    final doc = pw.Document();
    doc.addPage(
      pw.MultiPage(
        maxPages: 300,
        header: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: [
            pw.Text(
              'PSC TIPS & TRICKS  -  OFFICIAL SOLUTION & RATIONALE GUIDE',
              style: pw.TextStyle(
                fontSize: 8,
                fontWeight: pw.FontWeight.bold,
                color: _slate400,
              ),
            ),
            pw.SizedBox(height: 3),
            pw.Container(height: 0.6, color: _slate200),
            pw.SizedBox(height: 8),
          ],
        ),
        footer: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: [
            pw.SizedBox(height: 6),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(
                  'PSC Tips And Tricks Learning Platform  -  Personal Student Revision Copy',
                  style: pw.TextStyle(fontSize: 7.5, color: _slate400),
                ),
                pw.Text(
                  'Page ${context.pageNumber} of ${context.pagesCount}',
                  style: pw.TextStyle(
                    fontSize: 7.5,
                    fontWeight: pw.FontWeight.bold,
                    color: _slate400,
                  ),
                ),
              ],
            ),
          ],
        ),
        pageTheme: pw.PageTheme(
          pageFormat: _pageFormat,
          margin: const pw.EdgeInsets.fromLTRB(_margin, _margin + 12, _margin, _margin + 16),
          // On top of the content, at low opacity — matching the website's
          // own "overlay watermark" pass, which draws after every card so it
          // stays visible over filled backgrounds rather than being covered
          // by them.
          buildForeground: (context) => logoBytes == null
              ? pw.SizedBox()
              : pw.FullPage(
                  ignoreMargins: true,
                  child: pw.Center(
                    child: pw.Opacity(
                      opacity: 0.09,
                      child: pw.Column(
                        mainAxisSize: pw.MainAxisSize.min,
                        children: [
                          pw.Image(
                            pw.MemoryImage(logoBytes),
                            width: 200,
                            height: 200,
                          ),
                          pw.SizedBox(height: 12),
                          pw.Text(
                            'PSC TIPS AND TRICKS',
                            style: pw.TextStyle(
                              fontSize: 24,
                              fontWeight: pw.FontWeight.bold,
                              color: _slate600,
                            ),
                          ),
                          pw.SizedBox(height: 4),
                          pw.Text(
                            'OFFICIAL EXAM SOLUTION & RATIONALE GUIDE',
                            style: pw.TextStyle(fontSize: 11, color: _slate500),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
        ),
        build: (context) => content,
      ),
    );

    return doc.save();
  }

  static Future<pw.Widget> _banner({
    required String quizTitle,
    required String category,
    double? score,
    double? totalMarks,
    required int questionCount,
  }) async {
    final hasScore = score != null && totalMarks != null;
    final titleWidth = _contentWidth - 20 - (hasScore ? 76 : 0);
    final dateStr = _formatDate(DateTime.now());

    return pw.Container(
      width: double.infinity,
      margin: const pw.EdgeInsets.only(bottom: 16),
      padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(
        color: _slate100,
        borderRadius: pw.BorderRadius.circular(6),
        border: pw.Border.all(color: _slate300, width: 0.8),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Expanded(
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                await _run(
                  quizTitle,
                  fontSize: 14,
                  bold: true,
                  color: _slate900,
                  maxWidth: titleWidth,
                ),
                pw.SizedBox(height: 6),
                pw.Text(
                  'Category: $category   |   Total Questions: $questionCount   |   Date: $dateStr',
                  style: pw.TextStyle(fontSize: 8.5, color: _slate600),
                ),
              ],
            ),
          ),
          if (hasScore) ...[
            pw.SizedBox(width: 10),
            pw.Container(
              width: 66,
              padding: const pw.EdgeInsets.symmetric(vertical: 6),
              decoration: pw.BoxDecoration(
                color: _amber100,
                borderRadius: pw.BorderRadius.circular(4),
                border: pw.Border.all(color: _amber400, width: 0.8),
              ),
              child: pw.Column(
                children: [
                  pw.Text(
                    'SCORE',
                    style: pw.TextStyle(
                      fontSize: 6.5,
                      fontWeight: pw.FontWeight.bold,
                      color: _amber700,
                    ),
                  ),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    '${_num(score)} / ${_num(totalMarks)}',
                    style: pw.TextStyle(
                      fontSize: 11,
                      fontWeight: pw.FontWeight.bold,
                      color: _amber800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  static Future<pw.Widget> _questionHeader(int index, QuizPdfQuestion q) async {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 8),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: pw.BoxDecoration(
              color: _slate800,
              borderRadius: pw.BorderRadius.circular(3),
            ),
            child: pw.Text(
              'Q${index + 1}',
              style: pw.TextStyle(
                fontSize: 8.5,
                fontWeight: pw.FontWeight.bold,
                color: _white,
              ),
            ),
          ),
          pw.SizedBox(width: 8),
          pw.Expanded(
            child: await _run(
              q.text,
              fontSize: 10.5,
              bold: true,
              color: _slate900,
              maxWidth: _contentWidth - 60,
            ),
          ),
          if (q.marks != null) ...[
            pw.SizedBox(width: 6),
            pw.Text(
              '${_num(q.marks)} ${q.marks == 1 ? 'mark' : 'marks'}',
              style: pw.TextStyle(fontSize: 7.5, color: _slate500),
            ),
          ],
        ],
      ),
    );
  }

  static Future<pw.Widget> _optionCard(QuizPdfQuestion q, int optionIndex) async {
    final option = q.options[optionIndex];
    final letter = String.fromCharCode(65 + optionIndex);
    final isCorrect = optionIndex == q.correctIndex;
    final isUserChoice = q.userSelection != null && q.userSelection == optionIndex;

    final bg = isCorrect ? _emerald50 : (isUserChoice ? _rose50 : _white);
    final border = isCorrect ? _emerald300 : (isUserChoice ? _rose300 : _slate200);
    final textColor = isCorrect ? _emerald800 : (isUserChoice ? _rose800 : _slate800);
    final badgeBg = isCorrect ? _emerald500 : (isUserChoice ? _rose500 : _slate200);
    final badgeText = isCorrect || isUserChoice ? _white : _slate600;

    final explanation = option.explanation?.trim();
    final hasExplanation = explanation != null && explanation.isNotEmpty;

    return pw.Container(
      width: double.infinity,
      margin: const pw.EdgeInsets.only(bottom: 6),
      padding: const pw.EdgeInsets.all(8),
      decoration: pw.BoxDecoration(
        color: bg,
        borderRadius: pw.BorderRadius.circular(4),
        border: pw.Border.all(color: border, width: 0.8),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Container(
                width: 15,
                height: 15,
                alignment: pw.Alignment.center,
                decoration: pw.BoxDecoration(
                  color: badgeBg,
                  borderRadius: pw.BorderRadius.circular(3),
                ),
                child: pw.Text(
                  letter,
                  style: pw.TextStyle(
                    fontSize: 8.5,
                    fontWeight: pw.FontWeight.bold,
                    color: badgeText,
                  ),
                ),
              ),
              pw.SizedBox(width: 8),
              pw.Expanded(
                child: await _run(
                  option.text,
                  fontSize: 9.5,
                  bold: isCorrect,
                  color: textColor,
                  maxWidth: _contentWidth - 120,
                ),
              ),
              if (isCorrect || isUserChoice) ...[
                pw.SizedBox(width: 6),
                pw.Container(
                  padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: pw.BoxDecoration(
                    color: isCorrect ? _emerald500 : _rose500,
                    borderRadius: pw.BorderRadius.circular(3),
                  ),
                  child: pw.Text(
                    isCorrect ? 'CORRECT ANSWER' : 'YOUR SELECTION',
                    style: pw.TextStyle(
                      fontSize: 6,
                      fontWeight: pw.FontWeight.bold,
                      color: _white,
                    ),
                  ),
                ),
              ],
            ],
          ),
          if (hasExplanation) ...[
            pw.SizedBox(height: 5),
            pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Container(width: 0.9, height: 12, color: border),
                pw.SizedBox(width: 6),
                pw.Expanded(
                  child: await _run(
                    'Explanation: $explanation',
                    fontSize: 8.2,
                    italic: true,
                    color: textColor,
                    maxWidth: _contentWidth - 40,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  static Future<pw.Widget> _noteBox(String explanation) async {
    return pw.Container(
      width: double.infinity,
      margin: const pw.EdgeInsets.only(top: 2, bottom: 4),
      padding: const pw.EdgeInsets.all(8),
      decoration: pw.BoxDecoration(
        color: _amber100,
        borderRadius: pw.BorderRadius.circular(4),
        border: pw.Border.all(color: _amber400, width: 0.8),
      ),
      child: await _run(
        'Question Summary Note: $explanation',
        fontSize: 8.5,
        bold: true,
        color: _amber700,
        maxWidth: _contentWidth - 20,
      ),
    );
  }

  /// One run of text: real PDF text for anything plain-ASCII, a rasterised
  /// image for anything containing Malayalam. See the class doc for why.
  static Future<pw.Widget> _run(
    String text, {
    required double fontSize,
    required double maxWidth,
    bool bold = false,
    bool italic = false,
    PdfColor color = _slate900,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return pw.SizedBox();

    if (!_hasMalayalam(trimmed)) {
      return pw.Text(
        trimmed,
        style: pw.TextStyle(
          fontSize: fontSize,
          fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
          fontStyle: italic ? pw.FontStyle.italic : pw.FontStyle.normal,
          color: color,
        ),
      );
    }

    final raster = await _rasterize(
      trimmed,
      fontSize: fontSize,
      bold: bold,
      italic: italic,
      color: color,
      maxWidth: maxWidth,
    );
    return pw.Image(
      pw.MemoryImage(raster.png),
      width: raster.width,
      height: raster.height,
      fit: pw.BoxFit.fill,
    );
  }

  static Future<_Raster> _rasterize(
    String text, {
    required double fontSize,
    required bool bold,
    required bool italic,
    required PdfColor color,
    required double maxWidth,
  }) async {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          fontFamily: 'NotoSansMalayalam',
          fontSize: fontSize * _rasterScale,
          fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
          fontStyle: italic ? FontStyle.italic : FontStyle.normal,
          height: 1.45,
          color: Color.fromARGB(
            (color.alpha * 255).round(),
            (color.red * 255).round(),
            (color.green * 255).round(),
            (color.blue * 255).round(),
          ),
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: (maxWidth * _rasterScale).clamp(1, double.infinity));

    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);
    painter.paint(canvas, ui.Offset.zero);
    final picture = recorder.endRecording();

    final width = painter.width.ceil().clamp(1, 1 << 16);
    final height = painter.height.ceil().clamp(1, 1 << 16);
    final image = await picture.toImage(width, height);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    painter.dispose();

    return _Raster(
      png: byteData!.buffer.asUint8List(),
      width: width / _rasterScale,
      height: height / _rasterScale,
    );
  }

  static String _num(double? value) {
    if (value == null) return '0';
    final rounded = (value * 100).round() / 100;
    return rounded == rounded.roundToDouble()
        ? rounded.toInt().toString()
        : rounded.toStringAsFixed(2);
  }

  static String _formatDate(DateTime date) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${months[date.month - 1]} ${date.day}, ${date.year}';
  }
}

class _Raster {
  const _Raster({required this.png, required this.width, required this.height});
  final Uint8List png;
  final double width;
  final double height;
}
