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
