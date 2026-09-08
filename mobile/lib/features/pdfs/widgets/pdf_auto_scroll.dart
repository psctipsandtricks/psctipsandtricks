import 'dart:math' as math;

import '../../../data/models/pdf_sync.dart';

/// A rough line of body text, in logical pixels. Only ever used as the unit the
/// auto-scroll step is expressed in, so it does not need to match any
/// particular document.
const double kPdfLineHeight = 24;

/// The furthest one auto-scroll step travels: about three lines.
///
/// This is what makes following the narration read as reading rather than as
/// being dragged — the page creeps down a couple of lines at a time instead of
/// snapping to wherever the audio has got to.
const double kPdfMaxStepPx = kPdfLineHeight * 3;

/// Below this the document is where it should be; moving again would only
/// jitter, and on a native view every move costs a platform round trip.
const double kPdfSettlePx = 6;

/// How often the document is nudged. Slow enough that each step is a visible,
/// comfortable movement rather than a per-frame crawl, and slow enough not to
/// flood the platform channel.
const Duration kPdfStepInterval = Duration(milliseconds: 600);

/// Where the narration wants the document: a page, and the point down that page
/// that is being talked about right now.
class PdfScrollTarget {
  const PdfScrollTarget({required this.page, required this.withinPage});

  /// Zero-based, as the platform viewer counts.
  final int page;

  /// 0 at the top of the page, 1 at the bottom — the point to bring to the
  /// middle of the screen.
  final double withinPage;

  @override
  String toString() => 'PdfScrollTarget(page: $page, withinPage: $withinPage)';
}

/// Resolves the narration position to the page and point that should be in the
/// middle of the screen.
///
/// With an authored [cues] map the point travels down the region a cue points
/// at across that cue's own span, so the page creeps while a paragraph is read
/// and settles while the narrator talks over a diagram. Without one the whole
/// document is paced evenly against the clip, which is the best that can be
/// done from a duration alone.
///
/// Null when there is nothing to work from — a single-page document, or a clip
/// whose length the player has not reported yet.
PdfScrollTarget? resolvePdfScrollTarget({
  required int positionMs,
  required int pageCount,
  Duration? clipDuration,
  PdfSyncMap? cues,
}) {
  if (pageCount <= 0) return null;

  if (cues != null && cues.isUsable) {
    final resolved = cues.targetAt(positionMs);
    if (resolved == null) return null;

    final region = resolved.region;
    final cue = cues.cues[resolved.cueIndex];
    final at = positionMs - cues.offsetMs;
    final span = cue.endMs - cue.startMs;

    // How far down the cue's own region the eye should be.
    //
    // `active` is false both before the first cue and in the gaps between
    // them, which want opposite answers: a lead-in of silence should be
    // looking at where narration is about to start, while a pause after a cue
    // should rest on what was just read.
    final double through;
    if (at < cue.startMs) {
      through = 0;
    } else if (!resolved.active) {
      through = 1;
    } else if (span <= 0) {
      through = 0;
    } else {
      through = ((at - cue.startMs) / span).clamp(0.0, 1.0);
    }

    return PdfScrollTarget(
      page: (resolved.page - 1).clamp(0, pageCount - 1),
      withinPage: (region.y + region.height * through).clamp(0.0, 1.0),
    );
  }

  final totalMs = clipDuration?.inMilliseconds ?? 0;
  if (totalMs <= 0) return null;

  // Paced evenly across the document. `pageCount` rather than `pageCount - 1`
  // so the last page is reached at the end of the clip rather than three
  // quarters of the way through it.
  final progress = (positionMs / totalMs).clamp(0.0, 1.0);
  final position = progress * pageCount;
  final page = position.floor().clamp(0, pageCount - 1);
  return PdfScrollTarget(
    page: page,
    withinPage: (position - page).clamp(0.0, 1.0),
  );
}

/// The document offset that puts [target] in the middle of the viewport.
///
/// Returned in the same units and sign as the platform viewer's own scroll
/// offset: zero at the top of the document and **negative** going down, which
/// is what both `getPosition` and `setPosition` speak on Android and iOS.
double pdfCenteringOffset({
  required PdfScrollTarget target,
  required double pageHeightPx,
  required double viewportHeightPx,
  required int pageCount,
}) {
  final pointY = (target.page + target.withinPage) * pageHeightPx;
  final documentHeight = pageCount * pageHeightPx;

  // Centred, then held inside the document: there is nothing above the first
  // page or below the last to scroll into.
  final maxTop = math.max(0.0, documentHeight - viewportHeightPx);
  final top = (pointY - viewportHeightPx / 2).clamp(0.0, maxTop);
  return -top;
}

/// One step of the chase: where to move the document to now, or null when it is
/// already close enough that moving would only jitter.
///
/// Capped at [maxStep] so the page creeps rather than jumps. A gap too large to
/// close at that rate is the caller's cue to turn the page outright instead.
double? pdfNextScrollOffset({
  required double current,
  required double target,
  double maxStep = kPdfMaxStepPx,
  double settle = kPdfSettlePx,
}) {
  final gap = target - current;
  if (gap.abs() < settle) return null;
  if (gap.abs() <= maxStep) return target;
  return current + maxStep * (gap.isNegative ? -1 : 1);
}

/// The height one page occupies on screen, in the viewer's own units.
///
/// Both platforms report page size in PDF points, and the reader renders with
/// `FitPolicy.WIDTH` and `fitEachPage`, so a page is drawn exactly as wide as
/// the viewport and as tall as its own aspect ratio makes it.
///
/// Null for anything that cannot be trusted to place a scroll offset — a page
/// size the platform could not report, or a result so far outside a plausible
/// page that acting on it would fling the document somewhere arbitrary. The
/// caller falls back to turning pages, which needs no geometry at all.
double? pdfPageHeightOnScreen({
  required double pageWidthPoints,
  required double pageHeightPoints,
  required double viewportWidthPx,
  double zoom = 1,
}) {
  if (pageWidthPoints <= 0 || pageHeightPoints <= 0) return null;
  if (viewportWidthPx <= 0 || zoom <= 0) return null;

  final height = viewportWidthPx * (pageHeightPoints / pageWidthPoints) * zoom;
  if (!height.isFinite || height <= 0 || height > 20000) return null;
  return height;
}
