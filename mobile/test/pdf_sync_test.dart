import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/data/models/pdf_sync.dart';

void main() {
  PdfSyncMap parse(Object json) =>
      PdfSyncMap.fromJson(Map<String, dynamic>.from(json as Map));

  group('pdf sync map', () {
    final map = parse({
      'offsetMs': 0,
      'cues': [
        {'startMs': 0, 'endMs': 5000, 'page': 1},
        {'startMs': 5000, 'endMs': 9000, 'page': 2},
        // Deliberate gap: nothing is mapped between 9s and 20s.
        {'startMs': 20000, 'endMs': 30000, 'page': 7},
      ],
    });

    test('returns the page for the cue the audio is inside, zero-based', () {
      expect(map.pageAt(0), 0);
      expect(map.pageAt(4999), 0);
      expect(map.pageAt(5000), 1);
      expect(map.pageAt(25000), 6);
    });

    test('holds the previous page across a gap', () {
      // The narrator is still talking over page 2 at 12s; the document must
      // not wander off just because no cue covers that moment.
      expect(map.pageAt(12000), 1);
      expect(map.pageAt(19999), 1);
    });

    test('holds the first cue page before that cue begins', () {
      // Matches the website: a lead-in of silence or an intro jingle should
      // still have the deck showing page one rather than nothing.
      final startsLate = parse({
        'cues': [
          {'startMs': 4000, 'endMs': 8000, 'page': 3},
        ],
      });
      expect(startsLate.pageAt(0), 2);
      expect(startsLate.pageAt(3999), 2);
      expect(startsLate.pageAt(4000), 2);
    });

    test('applies the global offset', () {
      final shifted = parse({
        'offsetMs': 2000,
        'cues': [
          {'startMs': 0, 'endMs': 5000, 'page': 1},
          {'startMs': 5000, 'endMs': 9000, 'page': 2},
        ],
      });
      // A +2s correction turns each page 2s later than the raw cue says.
      expect(shifted.pageAt(6000), 0);
      expect(shifted.pageAt(7000), 1);
    });

    test('sorts cues that arrive out of order', () {
      final jumbled = parse({
        'cues': [
          {'startMs': 8000, 'endMs': 9000, 'page': 3},
          {'startMs': 0, 'endMs': 1000, 'page': 1},
        ],
      });
      expect(jumbled.pageAt(500), 0);
      expect(jumbled.pageAt(8500), 2);
    });

    test('drops cues that could only mislead', () {
      final messy = parse({
        'cues': [
          {'startMs': 5000, 'endMs': 1000, 'page': 2}, // ends before it starts
          {'startMs': 0, 'endMs': 1000, 'page': 0}, // pages are 1-based
          {'startMs': 2000, 'endMs': 3000, 'page': 4},
        ],
      });
      expect(messy.cues.length, 1);
      expect(messy.pageAt(2500), 3);
    });

    test('an empty or malformed blob is simply "no map"', () {
      expect(PdfSyncMap.fromDynamic(null), isNull);
      expect(PdfSyncMap.fromDynamic('nonsense'), isNull);
      expect(PdfSyncMap.fromDynamic({'cues': []}), isNull);
      expect(PdfSyncMap.fromDynamic({'cues': <dynamic>[]}), isNull);
    });
  });
}
