import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/router/app_router.dart';
import 'package:psc_tips_tricks_mobile/features/offline/offline_gate.dart';

void main() {
  group('launching with no connection', () {
    // Deliberately independent of what is in the vault: an empty downloads
    // screen at least explains being offline, which the home screen cannot.
    test('opens the downloads instead of a home screen that cannot load', () {
      expect(
        offlineLaunchDestination(signedIn: true, location: AppRoutes.home),
        AppRoutes.downloads,
      );
    });

    test('leaves a guest alone', () {
      expect(
        offlineLaunchDestination(signedIn: false, location: AppRoutes.home),
        isNull,
      );
    });

    test('does not override a launch that was routed somewhere', () {
      // A notification tap or deep link is the student's own destination.
      for (final location in [
        '/books/b1/read',
        '/mock-tests/m1',
        '/notifications',
        AppRoutes.downloads,
      ]) {
        expect(
          offlineLaunchDestination(signedIn: true, location: location),
          isNull,
          reason: '$location should be left as it is',
        );
      }
    });
  });

  group('losing the connection mid-session', () {
    bool steer(String location, {bool signedIn = true, bool has = true}) =>
        shouldSteerToDownloads(
          signedIn: signedIn,
          hasDownloads: has,
          location: location,
        );

    test('moves a student off a screen that needs the network', () {
      expect(steer(AppRoutes.home), isTrue);
      expect(steer('/books'), isTrue);
      expect(steer('/library?tab=videos'), isTrue);
    });

    test('never interrupts a full-screen task', () {
      // Being pulled out of a paper mid-question is worse than the outage.
      expect(steer('/attempt/q1'), isFalse);
      expect(steer('/books/b1/read'), isFalse);
      expect(steer('/books/b1/read?resume=1'), isFalse);
      expect(steer('/library/pdfs/p1'), isFalse);
    });

    test('stays put when the downloads are already open', () {
      expect(steer(AppRoutes.downloads), isFalse);
    });

    test('does nothing without a session', () {
      expect(steer(AppRoutes.home, signedIn: false), isFalse);
    });

  });
}
