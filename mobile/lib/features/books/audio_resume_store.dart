import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/providers/app_providers.dart';

/// Where a book's narration was left when the student closed the reader.
///
/// The reader stops its player on the way out — narration should not follow
/// anyone out of a book — so the position has to be written down for the detail
/// screen to be able to offer picking it back up.
class AudioResumePoint {
  const AudioResumePoint({
    required this.unitId,
    required this.audioUrl,
    required this.title,
    required this.position,
    this.duration,
  });

  /// The reading unit the clip belongs to, so the reader can page straight to
  /// it rather than reopening the book at the top.
  final String unitId;

  /// The remote url, which is the clip's identity: the reader plays a decrypted
  /// copy from the offline vault when there is one, and that path is a
  /// temporary working file.
  final String audioUrl;

  /// The topic title, for the card's second line.
  final String title;

  final Duration position;

  /// Null until the player has reported one — an unstarted clip has no length.
  final Duration? duration;

  Map<String, dynamic> toJson() => {
        'unitId': unitId,
        'audioUrl': audioUrl,
        'title': title,
        'positionMs': position.inMilliseconds,
        if (duration != null) 'durationMs': duration!.inMilliseconds,
      };

  static AudioResumePoint? fromJson(Map<String, dynamic> json) {
    final unitId = json['unitId'];
    final audioUrl = json['audioUrl'];
    final positionMs = json['positionMs'];
    if (unitId is! String || audioUrl is! String || positionMs is! int) {
      return null;
    }
    final durationMs = json['durationMs'];
    return AudioResumePoint(
      unitId: unitId,
      audioUrl: audioUrl,
      title: json['title'] is String ? json['title'] as String : 'Audio lesson',
      position: Duration(milliseconds: positionMs),
      duration: durationMs is int ? Duration(milliseconds: durationMs) : null,
    );
  }
}

/// A clip barely started is not somewhere worth being sent back to.
const _minimumResumePosition = Duration(seconds: 5);

/// How close to the end counts as finished. Resuming into the last few seconds
/// of a clip would play a moment of narration and stop.
const _endOfClipMargin = Duration(seconds: 10);

String _key(String bookId) => 'book-audio-resume-$bookId';

AudioResumePoint? readAudioResume(SharedPreferences prefs, String bookId) {
  final raw = prefs.getString(_key(bookId));
  if (raw == null) return null;
  try {
    final decoded = jsonDecode(raw);
    if (decoded is! Map) return null;
    return AudioResumePoint.fromJson(Map<String, dynamic>.from(decoded));
  } catch (_) {
    // A row written by an older shape is not worth crashing a book page over.
    return null;
  }
}

/// Records where narration stands, or drops the record when there is nothing
/// worth coming back to — a clip barely begun, or one played through to the end.
Future<void> saveAudioResume(
  SharedPreferences prefs,
  String bookId,
  AudioResumePoint point,
) {
  final total = point.duration;
  final tooEarly = point.position < _minimumResumePosition;
  final finished = total != null && point.position >= total - _endOfClipMargin;
  if (tooEarly || finished) return clearAudioResume(prefs, bookId);
  return prefs.setString(_key(bookId), jsonEncode(point.toJson()));
}

Future<void> clearAudioResume(SharedPreferences prefs, String bookId) =>
    prefs.remove(_key(bookId));

/// The resume point for one book, for the detail screen's "Continue with audio"
/// card. Invalidate it after the reader closes to pick up the new position.
final audioResumeProvider =
    Provider.family<AudioResumePoint?, String>((ref, bookId) {
  return readAudioResume(ref.watch(sharedPrefsProvider), bookId);
});
