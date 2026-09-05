import 'package:flutter/services.dart';

/// The app runs portrait-only (see `main.dart`): the quiz option cards, the
/// chapter rail and the chat composer are all laid out for a single column,
/// and a rotation mid-quiz would rebuild the timer's ancestors for nothing.
///
/// Reading a document is the exception. A PDF page is a fixed shape, and on a
/// landscape phone a whole page fits at a size that can actually be read, so
/// the reader and the document viewer opt back in while they are on screen and
/// hand the lock back on the way out.

const _portraitOnly = <DeviceOrientation>[
  DeviceOrientation.portraitUp,
  DeviceOrientation.portraitDown,
];

const _allOrientations = <DeviceOrientation>[
  DeviceOrientation.portraitUp,
  DeviceOrientation.portraitDown,
  DeviceOrientation.landscapeLeft,
  DeviceOrientation.landscapeRight,
];

/// How many screens currently on the stack want free rotation.
///
/// Counted rather than set outright because these screens nest: opening the
/// full-screen document viewer from the reader puts two of them up, and the
/// inner one popping must not re-lock the reader still sitting behind it.
int _relaxed = 0;

/// Lets the device rotate freely. Always pair with [restorePortraitOnly] in
/// the same widget's `dispose`, or the rest of the app inherits the rotation.
Future<void> allowAllOrientations() {
  _relaxed += 1;
  return SystemChrome.setPreferredOrientations(_allOrientations);
}

/// Gives up this screen's claim on rotation, and returns the device to the
/// app-wide portrait lock once nothing else is holding one.
Future<void> restorePortraitOnly() {
  if (_relaxed > 0) _relaxed -= 1;
  if (_relaxed > 0) return Future<void>.value();
  return SystemChrome.setPreferredOrientations(_portraitOnly);
}

/// How many screens currently want the system bars out of the way.
///
/// Counted for the same reason rotation is: the reader and the full-screen
/// document viewer can both be on the stack, and the inner one popping must
/// not hand the status bar back to the reader still sitting behind it.
int _immersed = 0;

/// Hides the status and navigation bars for a full-screen read.
///
/// Worth doing only sideways, and only there because of what it costs: a phone
/// in landscape has about 411dp of height, of which the two system bars take
/// some 70 — a sixth of the page, spent on a clock. `immersiveSticky` keeps
/// them one swipe away rather than gone.
///
/// Always pair with [exitImmersiveReading], or the rest of the app inherits a
/// window with no system bars.
Future<void> enterImmersiveReading() {
  _immersed += 1;
  if (_immersed > 1) return Future<void>.value();
  return SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
}

/// Gives up this screen's claim, and puts the system bars back once nothing
/// else is holding one.
Future<void> exitImmersiveReading() {
  if (_immersed > 0) _immersed -= 1;
  if (_immersed > 0) return Future<void>.value();
  return SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
}
