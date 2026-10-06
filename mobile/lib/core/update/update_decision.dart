import '../utils/semver.dart';
import '../../data/models/app_update_config.dart';

/// What the update gate should do about the app right now.
enum UpdateAction {
  /// Up to date, or the admin has switched update checking off.
  none,

  /// Google Play has a newer build for this device — run its blocking
  /// immediate-update flow. The student cannot carry on until it is installed.
  immediateMandatory,

  /// Below [AppUpdateConfig.minimumVersion] with `forceUpdate` on, but Google
  /// Play's own answer says nothing is available to install — never assumed
  /// just because the backend's numbers are ahead. Show the fallback screen
  /// instead of pretending Play Core can do something it just said it cannot.
  mandatoryFallback,
}

class UpdateDecision {
  const UpdateDecision(this.action, {this.mandatory = false});

  final UpdateAction action;

  /// True for every blocking action — the caller uses this to decide whether
  /// a cancelled/failed attempt should re-block instead of letting the
  /// student through.
  final bool mandatory;
}

/// Pure decision logic — no plugin calls, no IO, so every branch below is unit
/// tested directly.
///
/// [playStoreUpdateAvailable] is Google Play's own answer from
/// `InAppUpdate.checkForUpdate()`. Whenever Play has a newer build for this
/// device, updating is mandatory — the backend's version numbers do not have
/// to be bumped for that. [config] is null when the backend could not be
/// reached; Play's answer still applies then.
UpdateDecision computeUpdateDecision({
  required bool checkEnabled,
  required String installedVersion,
  required AppUpdateConfig? config,
  required bool playStoreUpdateAvailable,
}) {
  if (!checkEnabled) return const UpdateDecision(UpdateAction.none);

  if (playStoreUpdateAvailable) {
    return const UpdateDecision(UpdateAction.immediateMandatory, mandatory: true);
  }

  // Play has nothing to offer, but the backend says this build is below the
  // enforced floor — block with the fallback screen.
  if (config != null &&
      config.forceUpdate &&
      SemVer.isBelow(installedVersion, config.minimumVersion)) {
    return const UpdateDecision(UpdateAction.mandatoryFallback, mandatory: true);
  }

  return const UpdateDecision(UpdateAction.none);
}
