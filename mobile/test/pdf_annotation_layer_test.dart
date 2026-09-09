import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/features/pdfs/annotations/pdf_annotation_layer.dart';
import 'package:psc_tips_tricks_mobile/features/pdfs/annotations/pdf_highlight.dart';

void main() {
  /// A 400x800 window onto 400x560 pages, scrolled to the top.
  const viewport = PdfViewport(
    offset: Offset.zero,
    scale: 1,
    pageHeight: 560,
    pageWidth: 400,
  );

  PdfHighlight stroke(String id, {int page = 0}) => PdfHighlight(
        id: id,
        page: page,
        // Across the middle of the page: screen y = 0.5 * 560 = 280.
        points: const [Offset(0.1, 0.5), Offset(0.9, 0.5)],
        colorValue: kDefaultHighlightColor,
        width: kDefaultHighlightWidth,
        createdAt: DateTime.utc(2026, 9, 8),
      );

  /// Pumps the layer over a scrollable stand-in for the document, so a test can
  /// tell whether a touch reached the viewer underneath or was taken by a tool.
  Future<ScrollController> pump(
    WidgetTester tester, {
    required PdfAnnotationTool tool,
    List<PdfHighlight> highlights = const [],
    void Function(PdfHighlight)? onAdded,
    void Function(Set<String>)? onErased,
    PdfViewport? view = viewport,
  }) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final controller = ScrollController();
    addTearDown(controller.dispose);

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Stack(
          fit: StackFit.expand,
          children: [
            // Stands in for the native viewer, which owns its own scrolling.
            ListView(
              controller: controller,
              children: [
                for (var i = 0; i < 30; i++)
                  SizedBox(height: 100, child: Text('row $i')),
              ],
            ),
            PdfAnnotationLayer(
              tool: tool,
              // A notifier because the painter repaints straight off it, with
              // no rebuild in between — that is what keeps the marks glued to
              // the page while it scrolls.
              viewport: ValueNotifier<PdfViewport?>(view),
              pageCount: 5,
              highlights: highlights,
              onHighlightAdded: onAdded ?? (_) {},
              onHighlightsErased: onErased ?? (_) {},
            ),
          ],
        ),
      ),
    ));
    await tester.pump();
    return controller;
  }

  group('with no tool in hand', () {
    testWidgets('the document scrolls exactly as it did before', (tester) async {
      // The layer is always mounted, so this is the case that has to stay
      // true: a reader who never touches the marker must not notice it exists.
      final controller = await pump(tester, tool: PdfAnnotationTool.none);

      await tester.drag(find.text('row 1'), const Offset(0, -200));
      await tester.pump();

      expect(controller.offset, greaterThan(0));
    });

    testWidgets('a drag draws nothing', (tester) async {
      final drawn = <PdfHighlight>[];
      await pump(
        tester,
        tool: PdfAnnotationTool.none,
        onAdded: drawn.add,
      );

      // `warnIfMissed` off on purpose: the hit test missing the layer *is* the
      // assertion — with no tool in hand it is not there to be touched.
      await tester.drag(
        find.byType(PdfAnnotationLayer),
        const Offset(0, -120),
        warnIfMissed: false,
      );
      await tester.pump();

      expect(drawn, isEmpty);
    });
  });

  group('with the marker', () {
    testWidgets('a drag becomes one stroke on the page it started on',
        (tester) async {
      final drawn = <PdfHighlight>[];
      await pump(tester, tool: PdfAnnotationTool.marker, onAdded: drawn.add);

      await tester.dragFrom(const Offset(80, 280), const Offset(200, 0));
      await tester.pump();

      expect(drawn, hasLength(1));
      expect(drawn.single.page, 0);
      // Started a fifth of the way across the page, at its vertical middle.
      expect(drawn.single.points.first.dx, closeTo(0.2, 0.01));
      expect(drawn.single.points.first.dy, closeTo(0.5, 0.01));
      expect(drawn.single.points.last.dx, closeTo(0.7, 0.01));
    });

    testWidgets('the document does not scroll out from under the stroke',
        (tester) async {
      // The whole reason the layer takes the touches: a half-drawn highlight
      // on a moving page lands nowhere near where it was aimed.
      final controller = await pump(tester, tool: PdfAnnotationTool.marker);

      await tester.dragFrom(const Offset(200, 400), const Offset(0, -200));
      await tester.pump();

      expect(controller.offset, 0);
    });

    testWidgets('a tap leaves a dot', (tester) async {
      final drawn = <PdfHighlight>[];
      await pump(tester, tool: PdfAnnotationTool.marker, onAdded: drawn.add);

      await tester.tapAt(const Offset(200, 280));
      await tester.pump();

      expect(drawn, hasLength(1));
      expect(drawn.single.points, hasLength(1));
    });

    testWidgets('a drag starting off the document draws nothing',
        (tester) async {
      // Below the last page: there is no paper there to mark.
      final drawn = <PdfHighlight>[];
      await pump(
        tester,
        tool: PdfAnnotationTool.marker,
        onAdded: drawn.add,
        view: const PdfViewport(
          // Scrolled to the end of a five-page document.
          offset: Offset(0, -2700),
          scale: 1,
          pageHeight: 560,
          pageWidth: 400,
        ),
      );

      await tester.dragFrom(const Offset(200, 300), const Offset(100, 0));
      await tester.pump();

      expect(drawn, isEmpty);
    });

    testWidgets('nothing is drawn before the viewer has reported a position',
        (tester) async {
      final drawn = <PdfHighlight>[];
      await pump(
        tester,
        tool: PdfAnnotationTool.marker,
        onAdded: drawn.add,
        view: null,
      );

      await tester.dragFrom(const Offset(200, 280), const Offset(100, 0));
      await tester.pump();

      expect(drawn, isEmpty);
    });
  });

  group('with the eraser', () {
    testWidgets('a drag across a highlight removes it', (tester) async {
      final erased = <Set<String>>[];
      await pump(
        tester,
        tool: PdfAnnotationTool.eraser,
        highlights: [stroke('a')],
        onErased: erased.add,
      );

      await tester.dragFrom(const Offset(100, 280), const Offset(150, 0));
      await tester.pump();

      expect(erased, hasLength(1));
      expect(erased.single, {'a'});
    });

    testWidgets('one swipe across several takes them all together',
        (tester) async {
      // Reported as a set rather than one at a time, so the page loses them in
      // one rebuild instead of a stutter.
      final erased = <Set<String>>[];
      await pump(
        tester,
        tool: PdfAnnotationTool.eraser,
        highlights: [stroke('a'), stroke('b')],
        onErased: erased.add,
      );

      await tester.dragFrom(const Offset(100, 280), const Offset(150, 0));
      await tester.pump();

      expect(erased.single, {'a', 'b'});
    });

    testWidgets('a drag nowhere near a highlight removes nothing',
        (tester) async {
      final erased = <Set<String>>[];
      await pump(
        tester,
        tool: PdfAnnotationTool.eraser,
        highlights: [stroke('a')],
        onErased: erased.add,
      );

      // Well above the stroke, which sits at screen y 280.
      await tester.dragFrom(const Offset(100, 60), const Offset(150, 0));
      await tester.pump();

      expect(erased, isEmpty);
    });

    testWidgets('the eraser never draws', (tester) async {
      final drawn = <PdfHighlight>[];
      await pump(
        tester,
        tool: PdfAnnotationTool.eraser,
        highlights: [stroke('a')],
        onAdded: drawn.add,
      );

      await tester.dragFrom(const Offset(100, 280), const Offset(150, 0));
      await tester.pump();

      expect(drawn, isEmpty);
    });
  });
}
