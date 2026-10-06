import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/update/update_decision.dart';
import 'package:psc_tips_tricks_mobile/core/utils/semver.dart';
import 'package:psc_tips_tricks_mobile/data/models/app_update_config.dart';

void main() {
  group('SemVer', () {
    test('accepts a well-formed three-part version', () {
      expect(SemVer.isValid('2.5.0'), isTrue);
      expect(SemVer.isValid('0.0.1'), isTrue);
      expect(SemVer.isValid('10.20.30'), isTrue);
    });

    test('rejects anything else', () {
      for (final v in ['2.5', '2.5.0.1', '2.05.0', 'v2.5.0', '2.5.a', '']) {
        expect(SemVer.isValid(v), isFalse, reason: '$v should be rejected');
      }
    });

    test('compares numerically, not lexically', () {
      // The whole point of this feature: "2.10.0" is newer than "2.9.0",
      // even though it sorts earlier as a string.
      expect(SemVer.compare('2.10.0', '2.9.0'), greaterThan(0));
      expect(SemVer.compare('2.9.0', '2.10.0'), lessThan(0));
      expect(SemVer.compare('3.0.0', '2.99.99'), greaterThan(0));
      expect(SemVer.compare('2.6.0', '2.6.0'), 0);
    });

    test('isBelow / isAtLeast agree with compare', () {
      expect(SemVer.isBelow('2.4.0', '2.5.0'), isTrue);
      expect(SemVer.isBelow('2.5.0', '2.5.0'), isFalse);
      expect(SemVer.isAtLeast('2.5.0', '2.5.0'), isTrue);
      expect(SemVer.isAtLeast('2.4.9', '2.5.0'), isFalse);
    });
  });

  group('update decision', () {
    AppUpdateConfig config({
      bool enabled = true,
      String minimum = '2.5.0',
      String latest = '2.6.0',
      UpdateMode mode = UpdateMode.immediate,
      bool force = true,
    }) =>
        AppUpdateConfig(
          enabled: enabled,
          latestVersion: latest,
          minimumVersion: minimum,
          updateMode: mode,
          forceUpdate: force,
          message: 'Update please.',
        );

    UpdateDecision decide({
      required String installed,
      required AppUpdateConfig cfg,
      bool playAvailable = true,
    }) =>
        computeUpdateDecision(
          checkEnabled: cfg.enabled,
          installedVersion: installed,
          config: cfg,
          playStoreUpdateAvailable: playAvailable,
        );

    test('does nothing when update checking is off', () {
      final d = decide(installed: '2.4.0', cfg: config(enabled: false));
      expect(d.action, UpdateAction.none);
    });

    test('does nothing when Play has no update and the build is above the minimum', () {
      final d = decide(installed: '2.5.5', cfg: config(), playAvailable: false);
      expect(d.action, UpdateAction.none);
    });

    test('any update Google Play offers is mandatory, whatever the backend says', () {
      for (final cfg in [
        config(),
        config(force: false),
        config(mode: UpdateMode.flexible, force: false),
        // Backend not bumped yet: it still lists the installed build as latest.
        config(minimum: '1.0.0', latest: '2.6.0'),
      ]) {
        final d = decide(installed: '2.6.0', cfg: cfg);
        expect(d.action, UpdateAction.immediateMandatory);
        expect(d.mandatory, isTrue);
      }
    });

    test('Play is still obeyed when the backend could not be reached', () {
      final d = computeUpdateDecision(
        checkEnabled: true,
        installedVersion: '2.6.0',
        config: null,
        playStoreUpdateAvailable: true,
      );
      expect(d.action, UpdateAction.immediateMandatory);
    });

    test('below an enforced minimum with nothing on Play shows the fallback screen', () {
      final d = decide(installed: '2.4.0', cfg: config(), playAvailable: false);
      expect(d.action, UpdateAction.mandatoryFallback);
      expect(d.mandatory, isTrue);
    });

    test('below the minimum with force off and nothing on Play is not blocked', () {
      final d = decide(installed: '2.4.0', cfg: config(force: false), playAvailable: false);
      expect(d.action, UpdateAction.none);
    });
  });
}
