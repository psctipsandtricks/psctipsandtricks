import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/features/pdfs/annotations/pdf_highlight.dart';
import 'package:psc_tips_tricks_mobile/features/pdfs/annotations/pdf_highlight_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  /// A 400-wide viewport showing A4-ish pages at zoom 1, scrolled to the top.
  /// `pageHeight` is what one page occupies; offsets are negative going down,
  /// which is the convention both platform viewers report.
  const atTop = PdfViewport(
    offset: Offset.zero,
    scale: 1,
    pageHeight: 560,
    pageWidth: 400,
  );

  PdfHighlight stroke(
    String id, {
    int page = 0,
    List<Offset> points = const [Offset(0.2, 0.5), Offset(0.8, 0.5)],
  }) =>
      PdfHighlight(
        id: id,
        page: page,
        points: points,
        colorValue: kDefaultHighlightColor,
        width: kDefaultHighlightWidth,
        createdAt: DateTime.utc(2026, 9, 8, 10),
      );

  group('placing a touch on a page', () {
    test('a touch near the top of page one lands on page one', () {
      final at = pdfPointFromScreen(const Offset(200, 280), atTop, pageCount: 5)!;

      expect(at.page, 0);
      expect(at.position.dx, closeTo(0.5, 0.001));
      expect(at.position.dy, closeTo(0.5, 0.001));
    });

    test('scrolled down two pages, the same touch lands on page three', () {
      // Two pages up and out of sight: the offset is negative by that much.
      const scrolled = PdfViewport(
        offset: Offset(0, -1120),
        scale: 1,
        pageHeight: 560,
        pageWidth: 400,
      );

      final at = pdfPointFromScreen(const Offset(200, 280), scrolled, pageCount: 5)!;

      expect(at.page, 2);
      expect(at.position.dy, closeTo(0.5, 0.001));
    });

    test('zoom does not move where a touch lands on the page', () {
      // Zoomed 2x and scrolled so the same point of the page is under the
      // finger: the page fraction is what has to stay put, because that is what
      // gets stored.
      const zoomed = PdfViewport(
        offset: Offset(-400, -560),
        scale: 2,
        pageHeight: 1120,
        pageWidth: 800,
      );

      final at = pdfPointFromScreen(const Offset(0, 0), zoomed, pageCount: 5)!;

      expect(at.page, 0);
      expect(at.position.dx, closeTo(0.5, 0.001));
      expect(at.position.dy, closeTo(0.5, 0.001));
    });

    test('a touch past the last page belongs to no page', () {
      const scrolled = PdfViewport(
        offset: Offset(0, -1120),
        scale: 1,
        pageHeight: 560,
        pageWidth: 400,
      );

      // Page 2 is the last of three; anything below it is off the document.
      expect(
        pdfPointFromScreen(const Offset(200, 700), scrolled, pageCount: 3),
        isNull,
      );
    });

    test('a touch in the margin beside a zoomed page belongs to no page', () {
      const zoomed = PdfViewport(
        offset: Offset(40, 0),
        scale: 1,
        pageHeight: 560,
        pageWidth: 400,
      );

      // Left of where the page starts drawing.
      expect(pdfPointFromScreen(const Offset(10, 100), zoomed, pageCount: 3), isNull);
    });

    test('a viewport with no geometry yet places nothing', () {
      const unready = PdfViewport(
        offset: Offset.zero,
        scale: 1,
        pageHeight: 0,
        pageWidth: 0,
      );

      expect(pdfPointFromScreen(const Offset(10, 10), unready, pageCount: 3), isNull);
    });

    test('screen and page coordinates are inverses of each other', () {
      const screen = Offset(137, 921);
      const viewport = PdfViewport(
        offset: Offset(-12, -640),
        scale: 1.3,
        pageHeight: 700,
        pageWidth: 520,
      );

      final at = pdfPointFromScreen(screen, viewport, pageCount: 9)!;
      final back = pdfPointToScreen(at.page, at.position, viewport);

      expect(back.dx, closeTo(screen.dx, 0.001));
      expect(back.dy, closeTo(screen.dy, 0.001));
    });
  });

  group('the eraser', () {
    test('rubs out a stroke it is dragged across', () {
      // The stroke runs along y = 0.5 from x 0.2 to 0.8.
      expect(eraserHitsHighlight(stroke('a'), 0, const Offset(0.5, 0.5)), isTrue);
    });

    test('reaches a little way around the line, not just the pixels', () {
      // A fingertip is imprecise; aiming near a highlight means that highlight.
      expect(
        eraserHitsHighlight(stroke('a'), 0, const Offset(0.5, 0.5 + kEraserRadius / 2)),
        isTrue,
      );
    });

    test('leaves alone a stroke it never got near', () {
      expect(eraserHitsHighlight(stroke('a'), 0, const Offset(0.5, 0.9)), isFalse);
      // Past the end of the line, not just off to one side.
      expect(eraserHitsHighlight(stroke('a'), 0, const Offset(0.95, 0.5)), isFalse);
    });

    test('never reaches a stroke on another page', () {
      // The same spot on the next page down is a different piece of paper.
      expect(
        eraserHitsHighlight(stroke('a', page: 3), 4, const Offset(0.5, 0.5)),
        isFalse,
      );
    });

    test('a dot can be rubbed out as readily as a line', () {
      final dot = stroke('a', points: const [Offset(0.4, 0.4)]);

      expect(eraserHitsHighlight(dot, 0, const Offset(0.4, 0.4)), isTrue);
      expect(eraserHitsHighlight(dot, 0, const Offset(0.9, 0.9)), isFalse);
    });
  });

  group('thinning a stroke', () {
    test('drops points too close together to see', () {
      // A fast drag reports a point per frame, most of them a fraction of the
      // line's own width apart.
      final dense = [for (var i = 0; i < 200; i++) Offset(i * 0.0005, 0.5)];

      final thinned = thinStrokePoints(dense);

      expect(thinned.length, lessThan(dense.length));
      expect(thinned.first, dense.first);
      // Where the finger lifted always survives, or the stroke visibly ends
      // short of where it was drawn.
      expect(thinned.last, dense.last);
    });

    test('leaves a short stroke exactly as drawn', () {
      const two = [Offset(0.1, 0.1), Offset(0.9, 0.9)];

      expect(thinStrokePoints(two), two);
    });
  });

  group('storing a stroke', () {
    test('survives the round trip through JSON', () {
      final original = stroke('a', page: 4, points: const [
        Offset(0.1, 0.2),
        Offset(0.3, 0.4),
        Offset(0.5, 0.6),
      ]);

      final restored =
          PdfHighlight.fromJson(jsonDecode(jsonEncode(original.toJson())))!;

      expect(restored.id, 'a');
      expect(restored.page, 4);
      expect(restored.points, original.points);
      expect(restored.colorValue, original.colorValue);
      expect(restored.width, original.width);
    });

    test('a corrupt stroke is dropped, not thrown', () {
      // Losing one mark beats losing the page it was on.
      expect(PdfHighlight.fromJson(const {'id': 'a'}), isNull);
      expect(
        PdfHighlight.fromJson(const {'id': 'a', 'page': 0, 'points': <double>[]}),
        isNull,
      );
      expect(
        PdfHighlight.fromJson(const {'id': 'a', 'page': 0, 'points': ['x', 'y']}),
        isNull,
      );
    });
  });

  group('one student cannot see another\'s marks', () {
    late Directory sandbox;
    const doc = 'https://cdn.test/kerala-history.pdf';

    setUp(() {
      sandbox = Directory.systemTemp.createTempSync('pdf_highlights_test');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/path_provider'),
        (call) async =>
            call.method == 'getApplicationSupportDirectory' ? sandbox.path : null,
      );
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/path_provider'), null);
      if (sandbox.existsSync()) sandbox.deleteSync(recursive: true);
    });

    test('each user reads back only their own', () async {
      final store = PdfHighlightStore();

      await store.save('anita', doc, [stroke('a1')]);
      await store.save('bala', doc, [stroke('b1'), stroke('b2')]);

      expect((await store.load('anita', doc)).map((h) => h.id), ['a1']);
      expect((await store.load('bala', doc)).map((h) => h.id), ['b1', 'b2']);
    });

    test('highlights are kept apart per document too', () async {
      final store = PdfHighlightStore();
      await store.save('anita', doc, [stroke('a1')]);

      expect(await store.load('anita', 'https://cdn.test/other.pdf'), isEmpty);
    });

    test('erasing is as durable as drawing', () async {
      final store = PdfHighlightStore();
      await store.save('anita', doc, [stroke('a1'), stroke('a2')]);

      // The whole set is rewritten, so a stroke that is gone stays gone.
      await store.save('anita', doc, [stroke('a2')]);

      expect((await store.load('anita', doc)).map((h) => h.id), ['a2']);
    });

    test('erasing the last one takes the file away', () async {
      final store = PdfHighlightStore();
      await store.save('anita', doc, [stroke('a1')]);
      await store.save('anita', doc, []);

      expect(await store.load('anita', doc), isEmpty);
      expect(
        Directory('${sandbox.path}/pdf_highlights').listSync(),
        isEmpty,
        reason: 'an emptied document should not leave a file behind',
      );
    });

    test('nobody signed in means nothing is stored or read', () async {
      final store = PdfHighlightStore();
      await store.save('', doc, [stroke('a1')]);

      expect(await store.load('', doc), isEmpty);
    });

    test('a corrupt file degrades to no highlights instead of throwing',
        () async {
      final store = PdfHighlightStore();
      await store.save('anita', doc, [stroke('a1')]);

      final file = Directory('${sandbox.path}/pdf_highlights')
          .listSync()
          .whereType<File>()
          .single;
      await file.writeAsString('{not json');

      expect(await store.load('anita', doc), isEmpty);
    });

    test('signing out takes every student\'s marks off the device', () async {
      final store = PdfHighlightStore();
      await store.save('anita', doc, [stroke('a1')]);
      await store.save('bala', doc, [stroke('b1')]);

      await store.clear();

      expect(await store.load('anita', doc), isEmpty);
      expect(await store.load('bala', doc), isEmpty);
    });
  });
}
