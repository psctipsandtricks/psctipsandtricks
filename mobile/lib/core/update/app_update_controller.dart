import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_update/in_app_update.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../utils/semver.dart';
import '../../data/models/app_update_config.dart';
import '../providers/app_providers.dart';
import 'update_decision.dart';
import 'update_log.dart';

enum UpdateGateStatus {
  /// Nothing has run yet.
  idle,

  /// Fetching the backend config and/or asking Play what it can offer.
  checking,

  /// Nothing to do — up to date, or update checking is off.
  upToDate,

  /// Handing off to (or currently inside) Google Play's own full-screen
  /// immediate-update flow. Brief by design: Play Core owns the screen the
  /// moment it appears, this only covers the gap before it does.
  launchingImmediate,

  /// A mandatory update that could not be started automatically — the student
  /// cancelled a mandatory immediate flow, or Play has nothing to offer even
  /// though the backend says an update is required. Show the blocking
  /// fallback screen with a way to open Google Play directly.
  mandatoryBlocked,

  /// A flexible update finished downloading; ask the student to restart to
  /// install it. Non-blocking — shown as a banner over a fully usable app.
  flexibleReady,
}

class AppUpdateState {
  const AppUpdateState({
    this.status = UpdateGateStatus.idle,
    this.config,
    this.fallbackMessage,
  });

  final UpdateGateStatus status;
  final AppUpdateConfig? config;

  /// Set only for [UpdateGateStatus.mandatoryBlocked] when there was no live
  /// config to read a message from (offline, floor enforced from cache).
  final String? fallbackMessage;

  String get message =>
      config?.message ?? fallbackMessage ?? 'A new version of the app is available. Please update to continue.';

  AppUpdateState copyWith({
    UpdateGateStatus? status,
    AppUpdateConfig? config,
    String? fallbackMessage,
  }) =>
      AppUpdateState(
        status: status ?? this.status,
        config: config ?? this.config,
        fallbackMessage: fallbackMessage ?? this.fallbackMessage,
      );
}

/// Orchestrates the whole update flow: fetch config → installed version →
/// Play Store availability → admin-configured mode → act.
///
/// Android-only — every method below is a no-op on any other platform, so the
/// rest of the app (auth, push, deep links, downloads…) never has to check
/// the platform itself before touching this.
class AppUpdateController extends StateNotifier<AppUpdateState> {
  AppUpdateController(this._ref) : super(const AppUpdateState());

  final Ref _ref;

  static const _cacheKey = 'psc_app_update_floor';
  static const _checkTimeout = Duration(seconds: 6);

  bool _checking = false;
  StreamSubscription<InstallStatus>? _installSub;

  bool get _isAndroid => !kIsWeb && Platform.isAndroid;

  /// Runs the whole flow. Safe to call repeatedly — e.g. once at startup and
  /// again on every foreground resume — a check already in flight is skipped
  /// rather than doubled, and a student already looking at the blocking
  /// screen or the restart banner is left exactly where they are.
  Future<void> checkForUpdate() async {
    if (!_isAndroid || kDebugMode) {
      state = state.copyWith(status: UpdateGateStatus.upToDate);
      return;
    }
    if (_checking) return;
    if (state.status == UpdateGateStatus.launchingImmediate) return;

    _checking = true;
    state = state.copyWith(status: UpdateGateStatus.checking);
    updateLog('Update check started');

    try {
      final config = await _fetchConfigSafely();
      final installed = (await PackageInfo.fromPlatform()).version;
      updateLog('Installed version: $installed');

      if (config == null) {
        await _handleUnreachableBackend(installed);
        return;
      }

      updateLog(
        'Backend update configuration received — enabled=${config.enabled}, '
        'mode=${config.updateMode.name}, minimum=${config.minimumVersion}, '
        'latest=${config.latestVersion}, force=${config.forceUpdate}',
      );
      unawaited(_cacheFloor(config));

      if (!config.enabled) {
        state = state.copyWith(status: UpdateGateStatus.upToDate);
        return;
      }

      await _actOn(config: config, installed: installed);
    } finally {
      _checking = false;
    }
  }

  /// The backend could not be reached (offline, timed out, 5xx). Per the
  /// offline-behaviour requirement: the app stays fully usable *unless* this
  /// device is already known — from the last time it *did* hear from the
  /// server — to be below a minimum that was being enforced. That check needs
  /// no Play Store call: there is nothing to launch without a live
  /// [AppUpdateConfig] to read a message and mode from, only the fallback
  /// screen with whatever we last knew.
  Future<void> _handleUnreachableBackend(String installed) async {
    updateLog('Backend unreachable — falling back to the last known floor, if any');
    final cached = await _readCachedFloor();
    if (cached == null || !cached.forceUpdate || !SemVer.isBelow(installed, cached.minimumVersion)) {
      state = state.copyWith(status: UpdateGateStatus.upToDate);
      return;
    }

    updateLog('Installed version is below a previously enforced minimum — blocking');
    state = state.copyWith(
      status: UpdateGateStatus.mandatoryBlocked,
      fallbackMessage:
          'This version of the app is no longer supported. Connect to the internet and update to continue.',
    );
  }

  Future<void> _actOn({required AppUpdateConfig config, required String installed}) async {
    AppUpdateInfo? info;
    try {
      info = await InAppUpdate.checkForUpdate();
      updateLog('Google Play update available: ${info.updateAvailability == UpdateAvailability.updateAvailable}');

      // A flexible download that finished while the app was closed/backgrounded
      // surfaces here on the very next check, cold start included — Play Core
      // is the source of truth for this, not anything we stored ourselves.
      if (info.updateAvailability == UpdateAvailability.developerTriggeredUpdateInProgress &&
          info.installStatus == InstallStatus.downloaded) {
        state = state.copyWith(status: UpdateGateStatus.flexibleReady, config: config);
        return;
      }
    } catch (e) {
      // No Play Store on this device/build, no Play Services, or a transient
      // Play failure — never let this crash or hang the app.
      updateLog('Google Play unavailable: $e');
      info = null;
    }

    final playAvailable = info?.updateAvailability == UpdateAvailability.updateAvailable;
    final decision = computeUpdateDecision(
      checkEnabled: config.enabled,
      installedVersion: installed,
      config: config,
      playStoreUpdateAvailable: playAvailable,
    );
    updateLog('Update mode: ${config.updateMode.name} — decision: ${decision.action.name}');

    switch (decision.action) {
      case UpdateAction.none:
        state = state.copyWith(status: UpdateGateStatus.upToDate, config: config);
        return;
      case UpdateAction.mandatoryFallback:
        state = state.copyWith(status: UpdateGateStatus.mandatoryBlocked, config: config);
        return;
      case UpdateAction.flexibleOffer:
        state = state.copyWith(status: UpdateGateStatus.upToDate, config: config);
        await _startFlexible(config);
        return;
      case UpdateAction.immediateMandatory:
      case UpdateAction.immediateOptional:
        await _launchImmediate(config: config, mandatory: decision.mandatory);
        return;
    }
  }

  Future<void> _launchImmediate({required AppUpdateConfig config, required bool mandatory}) async {
    state = state.copyWith(status: UpdateGateStatus.launchingImmediate, config: config);
    updateLog('Update started (immediate, mandatory=$mandatory)');
    try {
      final result = await InAppUpdate.performImmediateUpdate();
      // A genuine success normally never gets here — Play restarts the app
      // into the new build itself — but handle it in case the platform ever
      // returns control first.
      if (result == AppUpdateResult.success) {
        updateLog('Update completed');
        state = state.copyWith(status: UpdateGateStatus.upToDate);
        return;
      }
      updateLog('Update cancelled');
      state = state.copyWith(
        status: mandatory ? UpdateGateStatus.mandatoryBlocked : UpdateGateStatus.upToDate,
      );
    } catch (e) {
      updateLog('Update failed: $e');
      state = state.copyWith(
        status: mandatory ? UpdateGateStatus.mandatoryBlocked : UpdateGateStatus.upToDate,
      );
    }
  }

  Future<void> _startFlexible(AppUpdateConfig config) async {
    updateLog('Update started (flexible)');
    try {
      final result = await InAppUpdate.startFlexibleUpdate();
      if (result != AppUpdateResult.success) {
        updateLog('Update cancelled');
        return;
      }
      _installSub?.cancel();
      _installSub = InAppUpdate.installUpdateListener.listen((status) {
        updateLog('Flexible install status: ${status.name}');
        if (status == InstallStatus.downloaded) {
          state = state.copyWith(status: UpdateGateStatus.flexibleReady, config: config);
        } else if (status == InstallStatus.installed) {
          updateLog('Update completed');
        }
      });
    } catch (e) {
      updateLog('Update failed: $e');
    }
  }

  /// Retries whatever the blocking screen is waiting on — a mandatory
  /// immediate flow the student backed out of, or Play having nothing to
  /// offer a moment ago. Cheap to call again: [checkForUpdate] itself decides
  /// whether there is anything left to do.
  Future<void> retry() => checkForUpdate();

  /// Installs a downloaded flexible update — the only action on the "restart
  /// to update" banner. Play kills and relaunches the app itself.
  Future<void> completeFlexibleInstall() async {
    updateLog('Update started (installing downloaded flexible update)');
    try {
      await InAppUpdate.completeFlexibleUpdate();
    } catch (e) {
      updateLog('Update failed: $e');
    }
  }

  /// Opens this build's Play Store listing — the fallback when Play Core has
  /// no update to launch itself (not installed from Play, an old Play Store,
  /// a device with no Play Services at all).
  Future<void> openPlayStore() async {
    try {
      final packageName = (await PackageInfo.fromPlatform()).packageName;
      final marketUri = Uri.parse('market://details?id=$packageName');
      if (await canLaunchUrl(marketUri)) {
        await launchUrl(marketUri);
        return;
      }
      final webUri = Uri.parse('https://play.google.com/store/apps/details?id=$packageName');
      await launchUrl(webUri, mode: LaunchMode.externalApplication);
    } catch (e) {
      updateLog('Could not open the Play Store listing: $e');
    }
  }

  Future<AppUpdateConfig?> _fetchConfigSafely() async {
    try {
      return await _ref.read(appUpdateRepositoryProvider).fetchConfig().timeout(_checkTimeout);
    } catch (e) {
      updateLog('Could not reach the backend: $e');
      return null;
    }
  }

  Future<void> _cacheFloor(AppUpdateConfig config) async {
    final prefs = _ref.read(sharedPrefsProvider);
    await prefs.setString(
      _cacheKey,
      jsonEncode({
        'minimumVersion': config.minimumVersion,
        'forceUpdate': config.forceUpdate,
      }),
    );
  }

  Future<_CachedFloor?> _readCachedFloor() async {
    final raw = _ref.read(sharedPrefsProvider).getString(_cacheKey);
    if (raw == null) return null;
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final minimum = json['minimumVersion'] as String?;
      if (minimum == null) return null;
      return _CachedFloor(minimumVersion: minimum, forceUpdate: json['forceUpdate'] == true);
    } catch (_) {
      return null;
    }
  }

  @override
  void dispose() {
    _installSub?.cancel();
    super.dispose();
  }
}

class _CachedFloor {
  const _CachedFloor({required this.minimumVersion, required this.forceUpdate});
  final String minimumVersion;
  final bool forceUpdate;
}

final appUpdateControllerProvider = StateNotifierProvider<AppUpdateController, AppUpdateState>(
  (ref) => AppUpdateController(ref),
);
