import '../../core/utils/json.dart';

enum UpdateMode { immediate, flexible }

UpdateMode _modeFrom(dynamic v) => J.str(v) == 'flexible' ? UpdateMode.flexible : UpdateMode.immediate;

/// The admin-configured update policy, as read from `GET /app/update-config`.
///
/// Public endpoint, no session required — the app can (and does) read this
/// before it has signed in, gone through Supabase, or reached the network for
/// anything else.
class AppUpdateConfig {
  const AppUpdateConfig({
    required this.enabled,
    required this.latestVersion,
    required this.minimumVersion,
    required this.updateMode,
    required this.forceUpdate,
    required this.message,
  });

  final bool enabled;
  final String latestVersion;
  final String minimumVersion;
  final UpdateMode updateMode;
  final bool forceUpdate;
  final String message;

  factory AppUpdateConfig.fromJson(Map<String, dynamic> json) => AppUpdateConfig(
        enabled: J.boolVal(json['enabled'], true),
        latestVersion: J.str(json['latestVersion'], '0.0.0'),
        minimumVersion: J.str(json['minimumVersion'], '0.0.0'),
        updateMode: _modeFrom(json['updateMode']),
        forceUpdate: J.boolVal(json['forceUpdate'], true),
        message: J.str(
          json['message'],
          'A new version of the app is available. Please update to continue.',
        ),
      );

  Map<String, dynamic> toJson() => {
        'enabled': enabled,
        'latestVersion': latestVersion,
        'minimumVersion': minimumVersion,
        'updateMode': updateMode == UpdateMode.flexible ? 'flexible' : 'immediate',
        'forceUpdate': forceUpdate,
        'message': message,
      };
}
