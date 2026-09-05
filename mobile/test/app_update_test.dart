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

    test('does nothing when already on the latest version', () {
      final d = decide(installed: '2.6.0', cfg: config());
      expect(d.action, UpdateAction.none);
    });

    test('below the minimum is always mandatory, regardless of mode', () {
      final immediate = decide(installed: '2.4.0', cfg: config(mode: UpdateMode.immediate));
      final flexible = decide(installed: '2.4.0', cfg: config(mode: UpdateMode.flexible));
      expect(immediate.action, UpdateAction.immediateMandatory);
      expect(immediate.mandatory, isTrue);
      expect(flexible.action, UpdateAction.immediateMandatory);
      expect(flexible.mandatory, isTrue);
    });

    test('exactly on the minimum is not mandatory by itself', () {
      final d = decide(installed: '2.5.0', cfg: config(mode: UpdateMode.flexible));
      expect(d.action, UpdateAction.flexibleOffer);
    });

    test('immediate mode + force update behind latest is mandatory', () {
      final d = decide(installed: '2.5.5', cfg: config(mode: UpdateMode.immediate, force: true));
      expect(d.action, UpdateAction.immediateMandatory);
      expect(d.mandatory, isTrue);
    });

    test('immediate mode without force update is offered, not forced', () {
      final d = decide(installed: '2.5.5', cfg: config(mode: UpdateMode.immediate, force: false));
      expect(d.action, UpdateAction.immediateOptional);
      expect(d.mandatory, isFalse);
    });

    test('flexible mode offers a background download', () {
      final d = decide(installed: '2.5.5', cfg: config(mode: UpdateMode.flexible, force: false));
      expect(d.action, UpdateAction.flexibleOffer);
    });

    test('never assumes Play has the update just because the backend does', () {
      final mandatory = decide(installed: '2.4.0', cfg: config(), playAvailable: false);
      expect(mandatory.action, UpdateAction.mandatoryFallback);
      expect(mandatory.mandatory, isTrue);

      final optionalFlexible = decide(
        installed: '2.5.5',
        cfg: config(mode: UpdateMode.flexible, force: false),
        playAvailable: false,
      );
      expect(optionalFlexible.action, UpdateAction.none);

      final optionalImmediate = decide(
        installed: '2.5.5',
        cfg: config(mode: UpdateMode.immediate, force: false),
        playAvailable: false,
      );
      expect(optionalImmediate.action, UpdateAction.none);
    });

    test('below minimum with force off is left to the app to decide, not forced', () {
      final d = decide(installed: '2.4.0', cfg: config(force: false));
      // Still behind latest, mode is immediate, but force is off — offered,
      // not forced.
      expect(d.action, UpdateAction.immediateOptional);
      expect(d.mandatory, isFalse);
    });
  });
}
