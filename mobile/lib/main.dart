import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/providers/app_providers.dart';
import 'core/push/push_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Support both portrait and landscape across tablets and phones
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(statusBarColor: Colors.transparent),
  );

  await _configureAudioSession();
  await _startBackgroundAudio();

  // Before runApp: a background message handler registered after the first
  // frame misses a cold start opened from the notification tray. No-ops until
  // `flutterfire configure` has been run.
  await initialiseFirebase();

  final prefs = await SharedPreferences.getInstance();

  runApp(
    ProviderScope(
      overrides: [sharedPrefsProvider.overrideWithValue(prefs)],
      child: const PscStudentApp(),
    ),
  );
}

/// Hands playback to a media service, so a lesson keeps playing with the phone
/// locked and turns up on the lock screen with working controls.
///
/// Must run before the first clip is loaded: `just_audio` routes through this
/// once it exists, and a player built earlier would keep the old behaviour of
/// stopping when the app goes to the background.
Future<void> _startBackgroundAudio() async {
  try {
    await JustAudioBackground.init(
      androidNotificationChannelId: 'com.psctipsandtricks.student.audio',
      androidNotificationChannelName: 'Audio lessons',
      // The notification stays while a lesson is paused, so picking it back up
      // does not mean finding the app again.
      androidNotificationOngoing: false,
      androidStopForegroundOnPause: true,
    );
  } catch (e) {
    // A device that refuses the service still gets in-app playback.
    if (kDebugMode) debugPrint('Background audio unavailable: $e');
  }
}

/// Declares how the reader's narration behaves alongside other audio.
///
/// Without this Android never grants audio focus, which is why narration could
/// play silently or die the moment another app made a sound. `speech` ducks
/// notifications rather than being interrupted by them, and pausing on a
/// transient loss is what a listener expects from a spoken lesson.
Future<void> _configureAudioSession() async {
  try {
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.speech());
  } catch (e) {
    // A device that refuses the session should still render the reader; the
    // player will simply behave as it did before.
    if (kDebugMode) debugPrint('Audio session unavailable: $e');
  }
}
