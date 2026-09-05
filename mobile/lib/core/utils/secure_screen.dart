import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Screen-capture protection for the pages that show paid book content.
///
/// Android's `FLAG_SECURE` is the only thing that actually stops a capture: it
/// blocks the screenshot gesture, screen recorders, casting and third-party
/// capture services, and blanks the app's thumbnail in the recents switcher.
/// It is a window flag with no Dart API, so it goes through a method channel to
/// `MainActivity`.
///
/// iOS has no equivalent — the platform deliberately offers no way to block a
/// screenshot — so every call here is a no-op there rather than a half-measure
/// that would suggest more protection than exists.

/// Must match `SECURE_SCREEN_CHANNEL` in `MainActivity.kt`.
const _channel = MethodChannel('psc/secure_screen');

/// How many screens currently on the stack want capture blocked.
///
/// Counted rather than set outright because these screens nest, exactly as the
/// orientation lock does: opening the full-screen document viewer from the
/// reader puts two of them up, and the inner one popping must not unprotect the
/// reader still sitting behind it.
int _holders = 0;

/// Blocks screenshots and screen recording. Always pair with
/// [releaseSecureScreen] in the same widget's `dispose`, or the flag outlives
/// the screen that asked for it.
Future<void> requestSecureScreen() async {
  if (!Platform.isAndroid || kDebugMode) {
    if (kDebugMode) await _invoke('disable');
    return;
  }
  _holders += 1;
  if (_holders > 1) return;
  await _invoke('enable');
}

/// Gives up this screen's claim, and lets capture work again once nothing else
/// is holding one.
Future<void> releaseSecureScreen() async {
  if (!Platform.isAndroid) return;
  if (_holders > 0) _holders -= 1;
  if (_holders > 0) return;
  await _invoke('disable');
}

/// Failing to set the flag must never take the reader down with it: the student
/// would lose the page they paid for over a protection they cannot see.
Future<void> _invoke(String method) async {
  try {
    await _channel.invokeMethod<void>(method);
  } on PlatformException {
    // Nothing to recover: the window is simply unprotected.
  } on MissingPluginException {
    // Host without the channel — tests, or an older build of the shell.
  }
}
