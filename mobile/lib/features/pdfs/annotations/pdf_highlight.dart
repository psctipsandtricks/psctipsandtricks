import 'dart:math' as math;
import 'dart:ui';

/// One marker stroke drawn over a PDF page.
///
/// Points are stored as **fractions of the page box** — `x` across, `y` down,
/// both in `[0, 1]` — the same convention `PdfSyncRegion` uses. A stroke is
/// therefore independent of the screen it was drawn on: it lands on the same
/// words at any zoom, in either orientation, on a phone or a tablet. Storing
/// screen pixels would pin a highlight to one device and one zoom level.
class PdfHighlight {
  const PdfHighlight({
    required this.id,
    required this.page,
    required this.points,
    required this.colorValue,
    required this.width,
    required this.createdAt,
  });

  /// Unique per stroke, so the eraser can remove exactly one.
  final String id;

  /// Zero-based, as the platform viewer counts.
  final int page;

  /// The path, in page fractions. Never empty; a single point is a dot.
  final List<Offset> points;

  final int colorValue;

  /// Stroke width as a fraction of the page's width, so a highlight drawn on a
  /// phone is the same thickness relative to the text on a tablet.
  final double width;

  final DateTime createdAt;

  Color get color => Color(colorValue);

  /// The stroke's bounding box in page fractions — what the eraser tests
  /// against before it bothers walking the points.
  Rect get bounds {
    var left = points.first.dx;
    var top = points.first.dy;
    var right = left;
    var bottom = top;
    for (final p in points) {
      if (p.dx < left) left = p.dx;
      if (p.dx > right) right = p.dx;
      if (p.dy < top) top = p.dy;
      if (p.dy > bottom) bottom = p.dy;
    }
    return Rect.fromLTRB(left, top, right, bottom);
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'page': page,
        // Flat pairs rather than a list of objects: a long stroke is hundreds
        // of points, and `{"x":..,"y":..}` per point triples the file for
        // nothing.
        'points': [for (final p in points) ...[p.dx, p.dy]],
        'color': colorValue,
        'width': width,
        'createdAt': createdAt.toUtc().toIso8601String(),
      };

  /// Null for anything unusable, so one bad stroke cannot cost a student the
  /// rest of their highlights on that page.
  static PdfHighlight? fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final page = json['page'];
    final raw = json['points'];
    if (id is! String || page is! int || raw is! List || raw.length < 2) {
      return null;
    }

    // Read rather than cast: a file that has been hand-edited or half-written
    // can hold anything at all, and a failed cast would take down the page
    // rather than the one bad stroke.
    double? number(dynamic v) {
      final n = v is num ? v.toDouble() : null;
      return (n == null || !n.isFinite) ? null : n;
    }

    final points = <Offset>[];
    for (var i = 0; i + 1 < raw.length; i += 2) {
      final x = number(raw[i]);
      final y = number(raw[i + 1]);
      if (x == null || y == null) return null;
      points.add(Offset(x.clamp(0.0, 1.0), y.clamp(0.0, 1.0)));
    }
    if (points.isEmpty) return null;

    return PdfHighlight(
      id: id,
      page: page,
      points: points,
      colorValue: number(json['color'])?.toInt() ?? kDefaultHighlightColor,
      width: number(json['width']) ?? kDefaultHighlightWidth,
      createdAt: DateTime.tryParse('${json['createdAt']}')?.toLocal() ??
          DateTime.now(),
    );
  }
}

/// Reads the API's shape, which differs from the on-disk one only in that the
/// server names the colour and width without abbreviation and always sends
/// them. Kept beside [PdfHighlight.fromJson] rather than merged with it: the
/// cache file is this app's own format and free to change, while this one is a
/// contract shared with the website.
PdfHighlight? pdfHighlightFromApi(Map<String, dynamic> json) {
  final id = json['id'];
  final page = json['page'];
  final raw = json['points'];
  if (id is! String || page is! num || raw is! List || raw.length < 2) return null;

  double? number(dynamic v) {
    final n = v is num ? v.toDouble() : null;
    return (n == null || !n.isFinite) ? null : n;
  }

  final points = <Offset>[];
  for (var i = 0; i + 1 < raw.length; i += 2) {
    final x = number(raw[i]);
    final y = number(raw[i + 1]);
    if (x == null || y == null) return null;
    points.add(Offset(x.clamp(0.0, 1.0), y.clamp(0.0, 1.0)));
  }
  if (points.isEmpty) return null;

  return PdfHighlight(
    id: id,
    page: page.toInt(),
    points: points,
    colorValue: number(json['color'])?.toInt() ?? kDefaultHighlightColor,
    width: number(json['width']) ?? kDefaultHighlightWidth,
    createdAt: DateTime.tryParse('${json['createdAt']}')?.toLocal() ?? DateTime.now(),
  );
}

/// Highlighter yellow, drawn translucent so the text stays readable underneath.
const int kDefaultHighlightColor = 0x66FFD54F;

/// A marker nib, as a fraction of the page width — about the height of a line
/// of body text on a typical study PDF.
const double kDefaultHighlightWidth = 0.035;

/// How close a touch has to come to a stroke to rub it out, as a fraction of
/// the page width. Generous on purpose: a fingertip is imprecise, and a student
/// aiming at a highlight means the one under their finger.
const double kEraserRadius = 0.03;

/// Where the document currently sits behind the overlay.
///
/// `flutter_pdfview` reports this through `onDraw` on every scroll and zoom,
/// in logical pixels, with the offsets **negative going down** — a document
/// point at `documentY` is drawn at `documentY + offset.dy` on screen. Both the
/// Android and iOS implementations agree on that convention.
class PdfViewport {
  const PdfViewport({
    required this.offset,
    required this.scale,
    required this.pageHeight,
    required this.pageWidth,
  });

  final Offset offset;
  final double scale;

  /// One page's drawn height and width, in logical pixels at the current zoom.
  final double pageHeight;
  final double pageWidth;

  bool get isUsable =>
      pageHeight > 0 && pageWidth > 0 && scale > 0 && offset.dx.isFinite && offset.dy.isFinite;
}

/// A point on the screen, resolved to a page and a position on it.
class PdfPagePoint {
  const PdfPagePoint({required this.page, required this.position});

  final int page;

  /// Fractions of the page box.
  final Offset position;
}

/// Turns a touch into a page and a point on it, or null when the touch lands
/// outside the document (past the last page, or in the margin beside a zoomed
/// page).
PdfPagePoint? pdfPointFromScreen(
  Offset local,
  PdfViewport viewport, {
  required int pageCount,
}) {
  if (!viewport.isUsable || pageCount <= 0) return null;

  final documentY = local.dy - viewport.offset.dy;
  final documentX = local.dx - viewport.offset.dx;

  final page = (documentY / viewport.pageHeight).floor();
  if (page < 0 || page >= pageCount) return null;

  final x = documentX / viewport.pageWidth;
  final y = (documentY - page * viewport.pageHeight) / viewport.pageHeight;
  if (x < 0 || x > 1) return null;

  return PdfPagePoint(page: page, position: Offset(x, y.clamp(0.0, 1.0)));
}

/// The inverse: where a point on a page is drawn right now.
Offset pdfPointToScreen(int page, Offset position, PdfViewport viewport) {
  return Offset(
    position.dx * viewport.pageWidth + viewport.offset.dx,
    (page + position.dy) * viewport.pageHeight + viewport.offset.dy,
  );
}

/// Whether the eraser at [at] on [page] should rub out [highlight].
///
/// Whole strokes are erased rather than parts of them: that is what makes a
/// highlight a single thing a student can remove and a single row to delete,
/// and it is how every annotation tool worth using behaves.
bool eraserHitsHighlight(
  PdfHighlight highlight,
  int page,
  Offset at, {
  double radius = kEraserRadius,
}) {
  if (highlight.page != page) return false;

  // Cheap rejection first: most strokes on a page are nowhere near the finger.
  if (!highlight.bounds.inflate(radius).contains(at)) return false;

  final points = highlight.points;
  if (points.length == 1) {
    return (points.first - at).distance <= radius;
  }

  for (var i = 0; i + 1 < points.length; i++) {
    if (_distanceToSegment(at, points[i], points[i + 1]) <= radius) return true;
  }
  return false;
}

double _distanceToSegment(Offset p, Offset a, Offset b) {
  final dx = b.dx - a.dx;
  final dy = b.dy - a.dy;
  final lengthSquared = dx * dx + dy * dy;
  if (lengthSquared == 0) return (p - a).distance;

  // How far along AB the closest point lies, clamped to the segment itself.
  final t = (((p.dx - a.dx) * dx + (p.dy - a.dy) * dy) / lengthSquared)
      .clamp(0.0, 1.0);
  return (p - Offset(a.dx + t * dx, a.dy + t * dy)).distance;
}

/// Drops points that are too close together to be worth keeping.
///
/// A finger drag produces a point every frame; at speed that is hundreds of
/// points for one swipe of a marker, all but a handful of which move the line
/// by less than it is thick. Thinning them keeps the stored file small and the
/// repaint cheap without any visible change to the stroke.
List<Offset> thinStrokePoints(
  List<Offset> points, {
  double minSpacing = 0.004,
}) {
  if (points.length <= 2) return List.of(points);

  final kept = <Offset>[points.first];
  for (var i = 1; i < points.length - 1; i++) {
    if ((points[i] - kept.last).distance >= minSpacing) kept.add(points[i]);
  }
  // The last point always survives: it is where the student lifted their
  // finger, and dropping it visibly shortens the stroke.
  if (points.last != kept.last) kept.add(points.last);
  return kept;
}

/// A stable, filesystem-safe key for one document's highlights.
///
/// Keyed by the document's url rather than the book or topic, matching how the
/// viewer already remembers a reading position — one topic's PDF is one
/// document, and the same file reused across topics carries its highlights with
/// it.
String pdfHighlightKey(String url) {
  var hash = 0;
  for (final unit in url.codeUnits) {
    hash = (hash * 31 + unit) & 0x7fffffff;
  }
  final tail = url.length > 24 ? url.substring(url.length - 24) : url;
  final safe = tail.replaceAll(RegExp(r'[^A-Za-z0-9]'), '_');
  return '${hash.toRadixString(16)}_$safe';
}

/// Clamps a stroke to the page it was drawn on.
List<Offset> clampToPage(List<Offset> points) => [
      for (final p in points)
        Offset(p.dx.clamp(0.0, 1.0), p.dy.clamp(0.0, 1.0)),
    ];

/// The largest page index any of [highlights] touches — used to size a cache.
int highestPage(Iterable<PdfHighlight> highlights) =>
    highlights.fold<int>(0, (max, h) => math.max(max, h.page));
