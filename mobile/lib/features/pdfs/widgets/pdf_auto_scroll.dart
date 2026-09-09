import 'dart:math' as math;

import '../../../data/models/pdf_sync.dart';

/// How hard the document pulls towards where the narration has reached, per
/// 60fps frame. Roughly a 140ms time constant — the same figure the notes view
/// and the website's reader both use, so a book followed on a phone and on a
/// laptop travels at the same speed.
///
/// Applied frame-rate independently, so a 120Hz screen and a struggling phone
/// scroll at the same rate rather than the fast one moving twice as far.
const double kPdfFollowEasePerFrame = 0.12;

/// Below this the document is where it should be; moving again would only
/// jitter, and on a native view every move costs a platform round trip.
///
/// Sub-pixel rather than the several pixels a stepped scroll could afford: the
/// chase now runs every frame, and a threshold big enough to be seen would show
/// up as the stutter it is.
const double kPdfSettlePx = 0.4;

const double kPdfFrameMicros = 16667;

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

/// One frame of the chase: where to move the document to now, or null when it
/// is already close enough that moving would only jitter.
///
/// Closes a fraction of the remaining gap each frame rather than travelling a
/// fixed distance. That is what makes the page glide the way a web page does
/// under a scroll wheel — fastest when it has furthest to go, easing to a stop
/// as it arrives — instead of hopping a few lines at a time on a timer.
///
/// [elapsed] is the time since the previous frame, which is what keeps the
/// speed the same on every refresh rate.
double? pdfNextScrollOffset({
  required double current,
  required double target,
  required Duration elapsed,
  double easePerFrame = kPdfFollowEasePerFrame,
  double settle = kPdfSettlePx,
}) {
  final gap = target - current;
  if (gap.abs() < settle) return null;

  final frames = elapsed.inMicroseconds / kPdfFrameMicros;
  if (frames <= 0) return null;
  final ease = 1 - math.pow(1 - easePerFrame, frames);

  final next = current + gap * ease;
  // Within a whisker of the target, land on it exactly rather than creeping the
  // last fraction of a pixel over several more frames.
  return (target - next).abs() < settle ? target : next;
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
