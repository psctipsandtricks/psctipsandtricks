import '../../data/models/pdf_sync.dart';

/// The follow-the-audio scrolling rules, as pure arithmetic.
///
/// A deliberate mirror of the constants and functions in the website's
/// `pdf-audio-sync.ts`: the same book, synced once, has to behave the same on a
/// phone as it does in a browser, and the only way to be sure of that is for
/// both to run the same rules over the same numbers.
///
/// Everything here works in whatever unit the caller scrolls in — logical
/// pixels here, CSS pixels there — so nothing in this file knows or cares
/// about zoom level or screen size.

/// How much of a region has to be on screen before it counts as "already
/// there" and earns no scroll.
const double kMinVisibleFraction = 0.65;

/// A region taller than the viewport can never be mostly visible, so it settles
/// on filling this much of the screen instead — being *inside* a full-page
/// diagram is the same as having arrived at it.
const double kTallRegionFill = 0.8;

/// Where a region's top lands when we do scroll: this far down the viewport.
const double kRegionTopBias = 0.3;

/// A region taller than the screen aligns near the top instead, with a little air.
const double kTallRegionMargin = 0.06;

/// A vertical range — a region's extent, or the visible window.
class SyncSpan {
  const SyncSpan(this.top, this.bottom);

  final double top;
  final double bottom;

  double get height => bottom - top;
}

/// Fraction of [region] currently inside [viewport], 0–1.
double visibleFraction(SyncSpan region, SyncSpan viewport) {
  if (region.height <= 0) return 0;
  final overlap = (region.bottom < viewport.bottom ? region.bottom : viewport.bottom) -
      (region.top > viewport.top ? region.top : viewport.top);
  if (overlap <= 0) return 0;
  final fraction = overlap / region.height;
  return fraction > 1 ? 1 : fraction;
}

/// Whether the reader can already see this region well enough that moving the
/// page would be noise rather than help.
///
/// This is the check that keeps the document still: a paragraph two lines below
/// the last one does not earn a scroll, and neither does the figure the
/// narrator has been describing for the last thirty seconds.
bool isRegionSettled(SyncSpan region, SyncSpan viewport) {
  if (viewport.height <= 0) return false;

  final overlap = (region.bottom < viewport.bottom ? region.bottom : viewport.bottom) -
      (region.top > viewport.top ? region.top : viewport.top);
  if (overlap <= 0) return false;

  if (region.height > viewport.height) {
    return overlap >= viewport.height * kTallRegionFill;
  }
  return overlap / region.height >= kMinVisibleFraction;
}

/// Where the scroll view should land to put [region] in a comfortable reading
/// position, clamped to the document.
double scrollOffsetForRegion(
  SyncSpan region,
  double viewportHeight,
  double documentExtent,
) {
  final bias =
      region.height >= viewportHeight ? kTallRegionMargin : kRegionTopBias;
  final desired = region.top - viewportHeight * bias;
  final maxOffset = documentExtent - viewportHeight;
  final ceiling = maxOffset < 0 ? 0.0 : maxOffset;
  if (desired < 0) return 0;
  return desired > ceiling ? ceiling : desired;
}

/// Why [decideSyncScroll] answered the way it did — useful in tests, and in
/// the one debug line the viewer prints when sync misbehaves.
enum SyncScrollReason { noTarget, layoutPending, settled, scroll }

class SyncScrollDecision {
  const SyncScrollDecision({
    required this.scrollTo,
    required this.cueIndex,
    required this.reason,
  });

  /// Where to scroll, or null to stay put.
  final double? scrollTo;

  /// The cue now considered handled — record it even when nothing moved.
  final int? cueIndex;

  final SyncScrollReason reason;
}

/// The whole follow-the-audio rule in one place: move only when the target has
/// actually changed or drifted off screen, and never on the strength of the
/// clock alone.
///
/// A cue change alone is not enough — if the next region is already on screen
/// the answer is still "stay put", which is what carries the reader smoothly
/// through a figure sitting between two narrated paragraphs instead of snapping
/// to it and then snapping away.
///
/// [regionSpan] is null while the page it lives on has not been laid out or
/// measured yet; the caller should get that page on screen and ask again.
SyncScrollDecision decideSyncScroll({
  required ResolvedSyncTarget? target,
  required int? appliedCueIndex,
  required SyncSpan? regionSpan,
  required SyncSpan viewport,
  required double documentExtent,
}) {
  if (target == null) {
    return const SyncScrollDecision(
      scrollTo: null,
      cueIndex: null,
      reason: SyncScrollReason.noTarget,
    );
  }
  if (regionSpan == null) {
    return SyncScrollDecision(
      scrollTo: null,
      cueIndex: appliedCueIndex,
      reason: SyncScrollReason.layoutPending,
    );
  }
  if (isRegionSettled(regionSpan, viewport)) {
    // Handled without moving: the reader is already looking at it.
    return SyncScrollDecision(
      scrollTo: null,
      cueIndex: target.cueIndex,
      reason: SyncScrollReason.settled,
    );
  }
  return SyncScrollDecision(
    scrollTo: scrollOffsetForRegion(regionSpan, viewport.height, documentExtent),
    cueIndex: target.cueIndex,
    reason: SyncScrollReason.scroll,
  );
}
