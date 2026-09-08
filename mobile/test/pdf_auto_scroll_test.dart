import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/data/models/pdf_sync.dart';
import 'package:psc_tips_tricks_mobile/features/pdfs/widgets/pdf_auto_scroll.dart';

void main() {
  group('where the narration wants the document', () {
    test('with no map the document is paced evenly across the clip', () {
      PdfScrollTarget at(int ms) => resolvePdfScrollTarget(
            positionMs: ms,
            pageCount: 4,
            clipDuration: const Duration(minutes: 4),
          )!;

      expect(at(0).page, 0);
      expect(at(0).withinPage, closeTo(0, 0.001));

      // Half way through the clip is half way through the document.
      expect(at(120000).page, 2);
      expect(at(120000).withinPage, closeTo(0, 0.001));

      // Half way down page one.
      expect(at(45000).page, 0);
      expect(at(45000).withinPage, closeTo(0.75, 0.001));

      // The end of the clip is the last page, not three quarters of the way in.
      expect(at(240000).page, 3);
    });

    test('a point between pages moves gradually, not in page-sized steps', () {
      final a = resolvePdfScrollTarget(
        positionMs: 10000,
        pageCount: 10,
        clipDuration: const Duration(minutes: 10),
      )!;
      final b = resolvePdfScrollTarget(
        positionMs: 11000,
        pageCount: 10,
        clipDuration: const Duration(minutes: 10),
      )!;

      expect(a.page, b.page, reason: 'a second of audio is not a page turn');
      expect(b.withinPage, greaterThan(a.withinPage));
    });

    test('nothing to work from reads as no target', () {
      expect(
        resolvePdfScrollTarget(positionMs: 0, pageCount: 0),
        isNull,
      );
      // A clip whose length the player has not reported yet.
      expect(
        resolvePdfScrollTarget(positionMs: 0, pageCount: 5),
        isNull,
      );
    });
  });

  group('an authored sync map', () {
    const map = PdfSyncMap(cues: [
      PdfSyncCue(
        startMs: 0,
        endMs: 10000,
        page: 1,
        target: PdfSyncRegion(x: 0, y: 0.1, width: 1, height: 0.4),
      ),
      PdfSyncCue(
        startMs: 20000,
        endMs: 30000,
        page: 2,
        target: PdfSyncRegion(x: 0, y: 0.5, width: 1, height: 0.2),
      ),
    ]);

    PdfScrollTarget at(int ms) => resolvePdfScrollTarget(
          positionMs: ms,
          pageCount: 5,
          clipDuration: const Duration(minutes: 1),
          cues: map,
        )!;

    test('the eye travels down the region as the cue is read', () {
      // Cue one covers y 0.1 → 0.5 of page one over ten seconds.
      expect(at(0).page, 0);
      expect(at(0).withinPage, closeTo(0.1, 0.001));
      expect(at(5000).withinPage, closeTo(0.3, 0.001));
      expect(at(9999).withinPage, closeTo(0.5, 0.01));
    });

    test('a gap after a cue rests on what was just read', () {
      // Between the two cues the narrator is talking over page one still.
      expect(at(15000).page, 0);
      expect(at(15000).withinPage, closeTo(0.5, 0.001));
    });

    test('the next cue moves the page and the point together', () {
      expect(at(20000).page, 1);
      expect(at(20000).withinPage, closeTo(0.5, 0.001));
      expect(at(25000).withinPage, closeTo(0.6, 0.001));
    });

    test('a lead-in before the first cue looks where it is about to start', () {
      final offset = PdfSyncMap(cues: map.cues, offsetMs: 5000);
      final target = resolvePdfScrollTarget(
        positionMs: 0,
        pageCount: 5,
        cues: offset,
      )!;

      // Not the bottom of the region, which is where a gap would rest.
      expect(target.withinPage, closeTo(0.1, 0.001));
    });

    test('a page past the end of the document is held inside it', () {
      const beyond = PdfSyncMap(cues: [
        PdfSyncCue(startMs: 0, endMs: 1000, page: 99),
      ]);
      final target = resolvePdfScrollTarget(
        positionMs: 500,
        pageCount: 3,
        cues: beyond,
      )!;

      expect(target.page, 2);
    });
  });

  group('turning a target into a scroll offset', () {
    test('the narrated point lands in the middle of the screen', () {
      // Page two, half way down, on 1000pt pages in an 800pt viewport.
      final offset = pdfCenteringOffset(
        target: const PdfScrollTarget(page: 1, withinPage: 0.5),
        pageHeightPx: 1000,
        viewportHeightPx: 800,
        pageCount: 5,
      );

      // The point is 1500 down the document; centring it puts the top of the
      // viewport at 1100, and the offset is negative going down.
      expect(offset, closeTo(-1100, 0.001));
    });

    test('there is nothing above the first page to scroll into', () {
      final offset = pdfCenteringOffset(
        target: const PdfScrollTarget(page: 0, withinPage: 0),
        pageHeightPx: 1000,
        viewportHeightPx: 800,
        pageCount: 5,
      );

      expect(offset, 0);
    });

    test('nor anything below the last', () {
      final offset = pdfCenteringOffset(
        target: const PdfScrollTarget(page: 2, withinPage: 1),
        pageHeightPx: 1000,
        viewportHeightPx: 800,
        pageCount: 3,
      );

      // The document is 3000 tall in an 800 viewport: 2200 is as far as it goes.
      expect(offset, closeTo(-2200, 0.001));
    });
  });

  group('one step of the chase', () {
    test('a small gap is closed outright', () {
      expect(
        pdfNextScrollOffset(current: -100, target: -140),
        closeTo(-140, 0.001),
      );
    });

    test('a large gap moves a few lines and no more', () {
      final next = pdfNextScrollOffset(current: -100, target: -5000)!;

      expect(next, closeTo(-100 - kPdfMaxStepPx, 0.001));
      expect(
        (next + 100).abs(),
        lessThanOrEqualTo(kPdfLineHeight * 3),
        reason: 'a step should read as two or three lines of reading',
      );
    });

    test('backwards is capped the same way', () {
      expect(
        pdfNextScrollOffset(current: -5000, target: -100),
        closeTo(-5000 + kPdfMaxStepPx, 0.001),
      );
    });

    test('already there means do not move at all', () {
      // Every move costs a platform round trip, and a document nudged a pixel
      // at a time is exactly the flicker this is meant to avoid.
      expect(pdfNextScrollOffset(current: -100, target: -101), isNull);
      expect(pdfNextScrollOffset(current: -100, target: -100), isNull);
    });
  });

  group('measuring how tall a page is drawn', () {
    test('a page is fitted to the width, so its aspect gives the height', () {
      // A4-ish in a 400 wide viewport.
      expect(
        pdfPageHeightOnScreen(
          pageWidthPoints: 595,
          pageHeightPoints: 842,
          viewportWidthPx: 400,
        ),
        closeTo(400 * 842 / 595, 0.001),
      );
    });

    test('zoom scales it', () {
      final plain = pdfPageHeightOnScreen(
        pageWidthPoints: 600,
        pageHeightPoints: 900,
        viewportWidthPx: 400,
      )!;
      final zoomed = pdfPageHeightOnScreen(
        pageWidthPoints: 600,
        pageHeightPoints: 900,
        viewportWidthPx: 400,
        zoom: 2,
      )!;

      expect(zoomed, closeTo(plain * 2, 0.001));
    });

    test('anything unusable reads as unknown, so the caller turns pages', () {
      // A viewer that has not laid out yet, or reported nonsense — acting on
      // either would fling the document somewhere arbitrary.
      expect(
        pdfPageHeightOnScreen(
          pageWidthPoints: 0,
          pageHeightPoints: 900,
          viewportWidthPx: 400,
        ),
        isNull,
      );
      expect(
        pdfPageHeightOnScreen(
          pageWidthPoints: 600,
          pageHeightPoints: 900,
          viewportWidthPx: 0,
        ),
        isNull,
      );
      expect(
        pdfPageHeightOnScreen(
          pageWidthPoints: 1,
          pageHeightPoints: 100000,
          viewportWidthPx: 400,
        ),
        isNull,
      );
    });
  });
}
