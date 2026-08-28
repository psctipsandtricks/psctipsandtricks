import '../../core/utils/json.dart';

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
  });

  /// Inclusive segment start, in ms from the beginning of the audio.
  final int startMs;

  /// Exclusive segment end, in ms.
  final int endMs;

  /// 1-based page, as the admin panel writes it.
  final int page;

  factory PdfSyncCue.fromJson(Map<String, dynamic> json) => PdfSyncCue(
        startMs: J.intVal(json['startMs']),
        endMs: J.intVal(json['endMs']),
        page: J.intVal(json['page']),
      );
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
}
