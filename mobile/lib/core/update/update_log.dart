import 'package:flutter/foundation.dart';

/// Debug-only, single-line logs for the update flow — see the feature spec's
/// own checklist (update check started, versions compared, Play availability,
/// mode, started/completed/cancelled/failed). Never carries a token, a user
/// id, or anything else worth keeping out of a shared logcat.
void updateLog(String message) {
  if (kDebugMode) debugPrint('[AppUpdate] $message');
}
