import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/core/utils/pdf_sync_scroll.dart';
import 'package:psc_tips_tricks_mobile/data/models/pdf_sync.dart';

/// The same fixtures and the same expected numbers as the website's check of
/// `pdf-audio-sync.ts`. One book, synced once, has to behave the same on both
/// surfaces — these are the numbers that hold the two implementations together,
/// so a change here should be made on the web side too.
void main() {
  final map = PdfSyncMap.fromJson({
    'offsetMs': 0,
    'cues': [
      {
        'startMs': 0,
        'endMs': 12500,
        'page': 1,
        'target': {'x': 0, 'y': 0.1, 'width': 1, 'height': 0.15},
        'type': 'text',
      },
      {
        'startMs': 12500,
        'endMs': 30000,
        'page': 1,
        'target': {'x': 0, 'y': 0.45, 'width': 1, 'height': 0.3},
        'type': 'image',
      },
      // Authored before regions existed: page only.
      {'startMs': 30000, 'endMs': 45000, 'page': 2},
      // Degenerate rect — thinner than a rounding artefact.
      {
        'startMs': 45000,
        'endMs': 50000,
        'page': 2,
        'target': {'x': 0, 'y': 0, 'width': 1, 'height': 0.0001},
      },
      // Runs off the page, and claims a type that does not exist.
      {
        'startMs': 50000,
        'endMs': 55000,
        'page': 3,
        'target': {'x': -0.2, 'y': 0.9, 'width': 2, 'height': 0.5},
        'type': 'bogus',
      },
    ],
  });

  group('reading a map off the wire', () {
    test('regions are kept', () {
      expect(map.cues.length, 5);
      final region = map.cues[1].target!;
      expect(region.y, closeTo(0.45, 1e-9));
      expect(region.height, closeTo(0.3, 1e-9));
      expect(map.cues[1].type, PdfSyncRegionKind.image);
    });

    test('a page-only cue is about its whole page', () {
      expect(map.cues[2].target, isNull);
      expect(map.cues[2].region.height, 1);
      expect(map.cues[2].type, PdfSyncRegionKind.text);
    });

    test('a degenerate region is dropped, not obeyed', () {
      expect(map.cues[3].target, isNull);
    });

    test('a region running off the page is clipped to it', () {
      final region = map.cues[4].target!;
      expect(region.x, 0);
      expect(region.width, 1);
      expect(region.y, closeTo(0.9, 1e-9));
      expect(region.height, closeTo(0.1, 1e-9));
    });

    test('an unknown type reads as text rather than failing the map', () {
      expect(map.cues[4].type, PdfSyncRegionKind.text);
    });
  });

  group('resolving a target at an instant', () {
    test('before the first cue, its target is held', () {
      expect(map.targetAt(-5000)!.cueIndex, 0);
    });

    test('inside a cue it is active, with that cue\'s region', () {
      final target = map.targetAt(20000)!;
      expect(target.active, isTrue);
      expect(target.type, PdfSyncRegionKind.image);
      expect(target.region.y, closeTo(0.45, 1e-9));
      expect(target.page, 1);
    });

    test('a gap holds the previous cue, but is not active', () {
      final target = map.targetAt(999000)!;
      expect(target.cueIndex, 4);
      expect(target.active, isFalse);
    });

    test('the global offset shifts the lookup', () {
      final shifted = PdfSyncMap(cues: map.cues, offsetMs: 20000);
      expect(shifted.targetAt(20000)!.cueIndex, 0);
    });

    test('an empty map has nothing to say', () {
      expect(const PdfSyncMap(cues: []).targetAt(1000), isNull);
    });
  });

  group('is the region already on screen', () {
    const view = SyncSpan(1000, 1800); // 800 tall

    test('fully, half, not at all', () {
      expect(visibleFraction(const SyncSpan(1100, 1300), view), 1);
      expect(visibleFraction(const SyncSpan(1700, 1900), view), 0.5);
      expect(visibleFraction(const SyncSpan(2000, 2100), view), 0);
    });

    test('mostly visible is settled; barely peeking is not', () {
      expect(isRegionSettled(const SyncSpan(1100, 1300), view), isTrue);
      expect(isRegionSettled(const SyncSpan(1750, 1950), view), isFalse);
    });

    test('a page-tall diagram settles on filling the screen', () {
      // It can never be "mostly visible" — being inside it is arriving at it.
      expect(isRegionSettled(const SyncSpan(900, 2600), view), isTrue);
      expect(isRegionSettled(const SyncSpan(1700, 3400), view), isFalse);
    });
  });

  group('where to scroll', () {
    test('a short region sits 30% down the viewport', () {
      expect(scrollOffsetForRegion(const SyncSpan(5000, 5200), 800, 20000),
          5000 - 240);
    });

    test('a region taller than the screen aligns near the top', () {
      expect(scrollOffsetForRegion(const SyncSpan(5000, 6000), 800, 20000),
          5000 - 48);
    });

    test('clamped to the document at both ends', () {
      expect(scrollOffsetForRegion(const SyncSpan(10, 60), 800, 20000), 0);
      expect(scrollOffsetForRegion(const SyncSpan(19900, 19950), 800, 20000),
          19200);
    });
  });

  group('the decision to move at all', () {
    const view = SyncSpan(1000, 1800);
    const target = ResolvedSyncTarget(
      cueIndex: 3,
      page: 2,
      region: PdfSyncRegion.whole,
      type: PdfSyncRegionKind.text,
      active: true,
    );

    test('nothing to follow', () {
      final decision = decideSyncScroll(
        target: null,
        appliedCueIndex: 1,
        regionSpan: null,
        viewport: view,
        documentExtent: 9000,
      );
      expect(decision.reason, SyncScrollReason.noTarget);
      expect(decision.scrollTo, isNull);
    });

    test('an unmeasured page waits rather than guessing', () {
      final decision = decideSyncScroll(
        target: target,
        appliedCueIndex: 1,
        regionSpan: null,
        viewport: view,
        documentExtent: 9000,
      );
      expect(decision.reason, SyncScrollReason.layoutPending);
      expect(decision.cueIndex, 1, reason: 'the old cue stays the applied one');
    });

    test('a new cue already on screen does not move the page', () {
      // The case that carries a reader through a figure between two narrated
      // paragraphs: the cue changed, but there is nothing to do about it.
      final decision = decideSyncScroll(
        target: target,
        appliedCueIndex: 1,
        regionSpan: const SyncSpan(1100, 1300),
        viewport: view,
        documentExtent: 9000,
      );
      expect(decision.reason, SyncScrollReason.settled);
      expect(decision.scrollTo, isNull);
      expect(decision.cueIndex, 3, reason: 'handled, just without scrolling');
    });

    test('an off-screen cue scrolls to it', () {
      final decision = decideSyncScroll(
        target: target,
        appliedCueIndex: 1,
        regionSpan: const SyncSpan(5000, 5200),
        viewport: view,
        documentExtent: 20000,
      );
      expect(decision.reason, SyncScrollReason.scroll);
      expect(decision.scrollTo, 4760);
    });

    test('the same cue drifted off screen is chased back', () {
      final decision = decideSyncScroll(
        target: target,
        appliedCueIndex: 3,
        regionSpan: const SyncSpan(5000, 5200),
        viewport: view,
        documentExtent: 20000,
      );
      expect(decision.reason, SyncScrollReason.scroll);
    });
  });
}
