import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/providers/app_providers.dart';
import 'core/push/push_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Portrait-only: the reader, the quiz timer and the chat composer are all
  // laid out for a single column, and a landscape rotation mid-quiz would
  // rebuild the timer's ancestors for no benefit.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(statusBarColor: Colors.transparent),
  );

  await _configureAudioSession();

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
