import '../utils/semver.dart';
import '../../data/models/app_update_config.dart';

/// What the update gate should do about the app right now.
enum UpdateAction {
  /// Up to date, or the admin has switched update checking off.
  none,

  /// Below [AppUpdateConfig.minimumVersion], or behind the latest with
  /// `updateMode: immediate` and `forceUpdate` on — Google Play does have the
  /// update, so run its blocking flow.
  immediateMandatory,

  /// Behind the latest with `updateMode: immediate` but `forceUpdate` off —
  /// Play's own flow still runs (Play Core's immediate UI has no partial/skip
  /// mode), but a cancel is respected rather than re-forced.
  immediateOptional,

  /// A mandatory update, but Google Play's own answer says nothing is
  /// available to install — never assumed just because the backend's
  /// `latestVersion` is ahead. Show the fallback screen instead of pretending
  /// Play Core can do something it just said it cannot.
  mandatoryFallback,

  /// Behind the latest with `updateMode: flexible` and Play has it — download
  /// in the background; the student keeps using the app meanwhile.
  flexibleOffer,
}

class UpdateDecision {
  const UpdateDecision(this.action, {this.mandatory = false});

  final UpdateAction action;

  /// True for [UpdateAction.immediateMandatory] and
  /// [UpdateAction.mandatoryFallback] — the caller uses this to decide
  /// whether a cancelled/failed attempt should re-block instead of letting
  /// the student through.
  final bool mandatory;
}

/// Pure decision logic — no plugin calls, no IO, so every branch below is unit
/// tested directly.
///
/// [playStoreUpdateAvailable] is Google Play's own answer from
/// `InAppUpdate.checkForUpdate()`, never assumed from the backend config
/// alone: the backend can only say a newer version *exists*, not that this
/// device's Play Store is currently offering it (staged rollout, no Play
/// Services, a sideloaded build, …).
UpdateDecision computeUpdateDecision({
  required bool checkEnabled,
  required String installedVersion,
  required AppUpdateConfig config,
  required bool playStoreUpdateAvailable,
}) {
  if (!checkEnabled) return const UpdateDecision(UpdateAction.none);

  final belowMinimum = SemVer.isBelow(installedVersion, config.minimumVersion);
  final behindLatest = SemVer.isBelow(installedVersion, config.latestVersion);
  if (!behindLatest && !belowMinimum) return const UpdateDecision(UpdateAction.none);

  // Below the floor is always mandatory when the admin allows force at all —
  // independent of the configured mode, since a device under the safety
  // minimum has no business quietly downloading a "flexible" update in the
  // background while it keeps running the unsupported build.
  final mandatory = config.forceUpdate && (belowMinimum || (behindLatest && config.updateMode == UpdateMode.immediate));

  if (mandatory) {
    return UpdateDecision(
      playStoreUpdateAvailable ? UpdateAction.immediateMandatory : UpdateAction.mandatoryFallback,
      mandatory: true,
    );
  }

  if (!behindLatest) return const UpdateDecision(UpdateAction.none);

  if (config.updateMode == UpdateMode.flexible) {
    return UpdateDecision(playStoreUpdateAvailable ? UpdateAction.flexibleOffer : UpdateAction.none);
  }

  // Immediate mode, but forceUpdate is off: still worth offering through
  // Play's own flow, just not worth re-forcing if the student backs out.
  return UpdateDecision(playStoreUpdateAvailable ? UpdateAction.immediateOptional : UpdateAction.none);
}
