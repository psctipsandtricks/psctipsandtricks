import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/features/home/widgets/live_mock_banner.dart';

void main() {
  group('mock test countdown', () {
    test('ticks in mm:ss inside the last hour', () {
      expect(
        mockCountdownLabel(
          isLive: false,
          startsIn: const Duration(minutes: 4, seconds: 58),
        ),
        '04:58',
      );
      expect(
        mockCountdownLabel(isLive: false, startsIn: const Duration(seconds: 9)),
        '00:09',
      );
    });

    test('leaves anything an hour or more out to the coarse label', () {
      // A second hand on a test three days away is noise, so the card falls
      // back to "in 3d 2h" rather than a clock.
      expect(
        mockCountdownLabel(isLive: false, startsIn: const Duration(hours: 1)),
        isNull,
      );
      expect(
        mockCountdownLabel(isLive: false, startsIn: const Duration(days: 3)),
        isNull,
      );
    });

    test('says so once the start time has passed', () {
      expect(
        mockCountdownLabel(
          isLive: false,
          startsIn: const Duration(seconds: -2),
        ),
        'starting now',
      );
    });

    test('a running test has no countdown at all', () {
      expect(
        mockCountdownLabel(isLive: true, startsIn: const Duration(minutes: -5)),
        isNull,
      );
    });
  });
}
