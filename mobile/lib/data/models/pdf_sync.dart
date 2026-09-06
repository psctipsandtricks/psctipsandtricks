import '../../core/utils/json.dart';

/// What kind of thing a cue points at, so a viewer can treat a diagram
/// differently from a line of prose.
///
/// Mirrors `PdfSyncRegionKind` in `packages/shared-types` — an unknown value
/// off the wire reads as [text] rather than failing the whole map.
enum PdfSyncRegionKind {
  text,
  heading,
  image,
  table,
  diagram,
  other;

  static PdfSyncRegionKind from(dynamic value) {
    for (final kind in PdfSyncRegionKind.values) {
      if (kind.name == value) return kind;
    }
    return PdfSyncRegionKind.text;
  }
}

/// A rectangle on a PDF page, as a **fraction of the page box** — `x`/`width`
/// across, `y`/`height` down, origin top-left, every value in `[0, 1]`.
///
/// Normalized rather than pixels because the same map drives a phone, a
/// desktop browser and every zoom level in between: a pixel rect is only true
/// for the viewport it was measured in.
class PdfSyncRegion {
  const PdfSyncRegion({
    required this.x,
    required this.y,
    required this.width,
    required this.height,
  });

  final double x;
  final double y;
  final double width;
  final double height;

  /// What a cue with no region of its own points at.
  static const whole =
      PdfSyncRegion(x: 0, y: 0, width: 1, height: 1);

  double get bottom => y + height;
  double get right => x + width;

  /// Null for anything unusable, which the cue reads as "the whole page".
  /// A rect running off the page is clipped rather than rejected: an extractor
  /// reporting a figure a few thousandths over the edge still points at the
  /// right figure.
  static PdfSyncRegion? fromDynamic(dynamic value) {
    if (value is! Map) return null;
    final json = Map<String, dynamic>.from(value);

    double? at(String key) {
      final raw = json[key];
      final n = raw is num ? raw.toDouble() : double.tryParse('$raw');
      return (n == null || !n.isFinite) ? null : n;
    }

    final rawX = at('x');
    final rawY = at('y');
    final rawW = at('width');
    final rawH = at('height');
    if (rawX == null || rawY == null || rawW == null || rawH == null) return null;

    final left = rawX.clamp(0.0, 1.0);
    final top = rawY.clamp(0.0, 1.0);
    final right = (left + rawW.abs()).clamp(0.0, 1.0);
    final bottom = (top + rawH.abs()).clamp(0.0, 1.0);

    final w = right - left;
    final h = bottom - top;
    // Matches MIN_REGION_SIZE on the web: anything thinner is a rounding
    // artefact, not something worth scrolling to.
    if (w < 0.002 || h < 0.002) return null;

    return PdfSyncRegion(x: left, y: top, width: w, height: h);
  }

  @override
  String toString() =>
      'PdfSyncRegion($x, $y, $width × $height)';
}

/// One subtitle-style segment of an audio track, mapped to the PDF page that
/// should be on screen while it plays.
///
/// Timestamps are milliseconds from the start of the audio: page turns in a
/// lecture land between words, and whole seconds are too coarse to place them.
class PdfSyncCue {
  const PdfSyncCue({
    required this.startMs,
    required this.endMs,
    required this.page,
    this.target,
    this.type = PdfSyncRegionKind.text,
  });

  /// Inclusive segment start, in ms from the beginning of the audio.
  final int startMs;

  /// Exclusive segment end, in ms.
  final int endMs;

  /// 1-based page, as the admin panel writes it.
  final int page;

  /// The region of [page] this segment is about. Null means the whole page,
  /// which is what every cue authored before regions existed means — those
  /// maps keep working, they just turn pages instead of scrolling within one.
  final PdfSyncRegion? target;

  final PdfSyncRegionKind type;

  /// Never null: a cue without a region of its own is about its whole page.
  PdfSyncRegion get region => target ?? PdfSyncRegion.whole;

  factory PdfSyncCue.fromJson(Map<String, dynamic> json) => PdfSyncCue(
        startMs: J.intVal(json['startMs']),
        endMs: J.intVal(json['endMs']),
        page: J.intVal(json['page']),
        target: PdfSyncRegion.fromDynamic(json['target']),
        type: PdfSyncRegionKind.from(json['type']),
      );
}

/// What the sync map wants on screen at some instant.
class ResolvedSyncTarget {
  const ResolvedSyncTarget({
    required this.cueIndex,
    required this.page,
    required this.region,
    required this.type,
    required this.active,
  });

  /// Index into [PdfSyncMap.cues] — lets a caller tell "still this cue" from
  /// "next cue", which is what stops the viewer scrolling on the clock alone.
  final int cueIndex;

  /// 1-based, as authored.
  final int page;

  final PdfSyncRegion region;
  final PdfSyncRegionKind type;

  /// True while the instant is inside the cue's own span. False in the gap
  /// after it, where the cue is still what should be on screen but the
  /// narrator has moved past what it points at.
  final bool active;
}

/// The saved PDF↔audio mapping for one reading unit.
///
/// Cues are sparse by design: a gap between them holds the previous page rather
/// than guessing from the clip's duration, which is what lets a page of dense
/// diagrams stay put while the narrator talks over it.
class PdfSyncMap {
  const PdfSyncMap({required this.cues, this.offsetMs = 0});

  /// Sorted by [PdfSyncCue.startMs], so a lookup can walk them in order.
  final List<PdfSyncCue> cues;

  /// Global correction applied to every cue. Positive values turn pages later.
  final int offsetMs;

  bool get isUsable => cues.isNotEmpty;

  factory PdfSyncMap.fromJson(Map<String, dynamic> json) {
    final cues = (json['cues'] as List?)
            ?.whereType<Map>()
            .map((e) => PdfSyncCue.fromJson(Map<String, dynamic>.from(e)))
            // A cue that ends before it starts cannot match anything, and a
            // page of zero is not a page — drop both rather than letting them
            // pin the viewer to a nonsense position.
            .where((c) => c.endMs > c.startMs && c.page > 0)
            .toList() ??
        <PdfSyncCue>[];
    cues.sort((a, b) => a.startMs.compareTo(b.startMs));
    return PdfSyncMap(cues: cues, offsetMs: J.intVal(json['offsetMs']));
  }

  /// Parses the `syncCues` blob as it arrives on a topic or subtopic. Null and
  /// malformed values are simply "no map", which the reader treats as "no
  /// syncing" rather than an error.
  static PdfSyncMap? fromDynamic(dynamic value) {
    if (value is! Map) return null;
    final map = PdfSyncMap.fromJson(Map<String, dynamic>.from(value));
    return map.isUsable ? map : null;
  }

  /// The 0-based page that should be on screen at [positionMs].
  ///
  /// Matches the website's `resolvePageAtTime` so a book behaves the same on
  /// both surfaces: before the first cue the first page is held, so a lead-in
  /// of silence or an intro jingle still has the deck on page one, and inside a
  /// gap past a cue's end that cue's page keeps being returned rather than the
  /// document wandering off.
  int? pageAt(int positionMs) {
    if (cues.isEmpty) return null;

    final at = positionMs - offsetMs;
    var page = cues.first.page;
    for (final cue in cues) {
      if (cue.startMs > at) break;
      page = cue.page;
    }
    // Stored 1-based; the platform viewer counts from zero.
    return page - 1;
  }

  /// Index of the cue covering [at], or the most recent one that started
  /// before it when the instant falls in a gap. -1 only before the first cue.
  int _indexAt(int at) {
    var lo = 0;
    var hi = cues.length - 1;
    var found = -1;
    while (lo <= hi) {
      final mid = (lo + hi) >> 1;
      if (cues[mid].startMs <= at) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return found;
  }

  /// The page **and region** that should be on screen at [positionMs].
  ///
  /// Mirrors the website's `resolveTargetAtTime` so a book behaves the same on
  /// both surfaces: before the first cue its target is held, so a lead-in of
  /// silence still has the reader looking at where narration is about to
  /// start, and inside a gap past a cue's end that cue keeps being returned
  /// rather than the document wandering off.
  ResolvedSyncTarget? targetAt(int positionMs) {
    if (cues.isEmpty) return null;

    final at = positionMs - offsetMs;
    final idx = _indexAt(at);
    final cueIndex = idx < 0 ? 0 : idx;
    final cue = cues[cueIndex];

    return ResolvedSyncTarget(
      cueIndex: cueIndex,
      page: cue.page,
      region: cue.region,
      type: cue.type,
      active: idx >= 0 && at < cue.endMs,
    );
  }
}
