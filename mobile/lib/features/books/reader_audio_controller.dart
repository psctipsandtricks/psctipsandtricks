import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';

import '../../core/providers/app_providers.dart';

/// The single narration player, shared by the reader and the PDF viewer.
///
/// It lives in a provider rather than inside the player widget so playback
/// survives navigation: opening a topic's notes pushes the PDF viewer over the
/// reader, and a widget-owned player would keep playing but be unreachable from
/// the new route. Holding it here lets the PDF follow the audio.
///
/// State is exposed as [ValueNotifier]s rather than provider state because the
/// position ticks several times a second; rebuilding every listener of a
/// Riverpod provider at that rate would cost far more than the two widgets that
/// actually paint it.
class ReaderAudioController {
  ReaderAudioController() {
    _positionSub = _player.positionStream.listen((value) {
      position.value = value;
      final total = _player.duration;
      fraction.value = (total == null || total.inMilliseconds <= 0)
          ? 0
          : (value.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0);
    });

    _durationSub = _player.durationStream.listen((value) {
      duration.value = value;
    });

    _stateSub = _player.playerStateStream.listen((state) {
      playing.value = state.playing &&
          state.processingState != ProcessingState.completed;

      // The end of a clip is the cue to move on. Reported once per clip: the
      // state stream repeats `completed` as the player settles, and a listener
      // that acted on each one would skip several topics at a time.
      if (state.processingState == ProcessingState.completed) {
        final finished = _url;
        if (finished != null && finished != _announcedComplete) {
          _announcedComplete = finished;
          onClipFinished?.call();
        }
      }
    });

    // A decode or network failure part-way through surfaces here, not from
    // setUrl — without this the player just stops and looks stuck.
    _eventSub = _player.playbackEventStream.listen(
      (_) {},
      onError: (Object error, StackTrace _) {
        if (kDebugMode) debugPrint('Narration failed: $error');
        failed.value = true;
        loading.value = false;
      },
    );
  }

  final AudioPlayer _player = AudioPlayer();
  AudioPlayer get player => _player;

  final position = ValueNotifier<Duration>(Duration.zero);
  final duration = ValueNotifier<Duration?>(null);
  final playing = ValueNotifier<bool>(false);
  final failed = ValueNotifier<bool>(false);
  final loading = ValueNotifier<bool>(false);

  /// How far through the current clip, 0–1. What auto-scroll and auto page-turn
  /// both key off.
  final fraction = ValueNotifier<double>(0);

  /// Title of whatever is loaded, for the PDF viewer's now-playing line.
  final title = ValueNotifier<String?>(null);

  late final StreamSubscription<Duration> _positionSub;
  late final StreamSubscription<Duration?> _durationSub;
  late final StreamSubscription<PlayerState> _stateSub;
  late final StreamSubscription<PlaybackEvent> _eventSub;

  String? _url;

  /// The clip whose ending has already been announced, so it is announced once.
  String? _announcedComplete;

  /// Called when the loaded clip plays out. The reader uses it to walk on to
  /// the next topic — and, at the end of a chapter, into the next one.
  VoidCallback? onClipFinished;

  /// True once something is loaded — the PDF viewer uses this to decide whether
  /// an auto page-turn control makes any sense.
  bool get hasAudio => _url != null && !failed.value;

  double _speed = 1;
  double get speed => _speed;

  /// Points the player at [url], which may be an http(s) address or a path to a
  /// decrypted file from the offline vault.
  ///
  /// Re-loading the same url is a no-op, so rebuilding the player widget cannot
  /// restart a clip the student is already listening to. [initialPosition]
  /// opens the clip part-way through — what "continue with audio" resumes to,
  /// set on the source itself so the first frame of playback is already at the
  /// right place rather than starting at zero and seeking after.
  Future<void> load(
    String url, {
    String? label,
    String? album,
    bool autoPlay = false,
    Duration? initialPosition,
  }) async {
    if (_url == url) {
      if (initialPosition != null) seek(initialPosition);
      if (autoPlay && !_player.playing) unawaited(_player.play());
      return;
    }
    _url = url;
    _announcedComplete = null;
    title.value = label;
    failed.value = false;
    loading.value = true;
    fraction.value = 0;
    position.value = initialPosition ?? Duration.zero;
    duration.value = null;

    try {
      // Every source carries a `MediaItem`: it is what the lock screen and the
      // notification read, and `just_audio_background` refuses a source without
      // one. The url doubles as the id — it is already unique per topic.
      await _player.setAudioSource(
        AudioSource.uri(
          url.startsWith('http') ? Uri.parse(url) : Uri.file(url),
          tag: MediaItem(
            id: url,
            title: label ?? 'Audio lesson',
            album: album ?? 'PSC Tips And Tricks',
          ),
        ),
        initialPosition: initialPosition,
      );
      loading.value = false;
      if (autoPlay) unawaited(_player.play());
    } catch (e) {
      if (kDebugMode) debugPrint('Could not load narration: $e');
      failed.value = true;
      loading.value = false;
    }
  }

  /// Forces a reload of the current source, for the retry affordance.
  Future<void> reload({bool autoPlay = false}) async {
    final url = _url;
    if (url == null) return;
    _url = null;
    await load(url, label: title.value, autoPlay: autoPlay);
  }

  void togglePlay() {
    if (_player.playing) {
      _player.pause();
      return;
    }
    if (_player.processingState == ProcessingState.completed) {
      _player.seek(Duration.zero);
    }
    _player.play();
  }

  void seek(Duration to) {
    final total = duration.value;
    var target = to;
    if (target < Duration.zero) target = Duration.zero;
    if (total != null && target > total) target = total;
    _player.seek(target);
  }

  void seekBy(Duration delta) => seek(position.value + delta);

  void cycleSpeed() {
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    _speed = speeds[(speeds.indexOf(_speed) + 1) % speeds.length];
    _player.setSpeed(_speed);
  }

  void setSpeed(double speed) {
    _speed = speed;
    _player.setSpeed(_speed);
  }

  /// Releases the current clip. Called when the reader closes, so narration
  /// does not follow the student out of the book.
  Future<void> stop() async {
    _url = null;
    _announcedComplete = null;
    title.value = null;
    fraction.value = 0;
    position.value = Duration.zero;
    duration.value = null;
    await _player.stop();
  }

  void dispose() {
    _positionSub.cancel();
    _durationSub.cancel();
    _stateSub.cancel();
    _eventSub.cancel();
    _player.dispose();
    position.dispose();
    duration.dispose();
    playing.dispose();
    failed.dispose();
    loading.dispose();
    fraction.dispose();
    title.dispose();
  }
}

final readerAudioProvider = Provider<ReaderAudioController>((ref) {
  final controller = ReaderAudioController();
  ref.onDispose(controller.dispose);
  return controller;
});

/// Whether content should follow the narration. One preference governs both the
/// reader page and the PDF viewer — a student who turned it off in one place
/// means it off everywhere.
///
/// Off until asked for: a page that starts moving on its own the moment
/// narration begins takes the reading position away from the student before
/// they have decided they want that. Only [set] ever writes the key, so a
/// stored value is always a deliberate choice and is honoured over this.
class AutoScrollController extends StateNotifier<bool> {
  AutoScrollController(this._ref)
      : super(_ref.read(sharedPrefsProvider).getBool(_key) ?? false);

  final Ref _ref;
  static const _key = 'reader_auto_scroll';

  void set(bool enabled) {
    state = enabled;
    _ref.read(sharedPrefsProvider).setBool(_key, enabled);
  }

  void toggle() => set(!state);
}

final autoScrollProvider =
    StateNotifierProvider<AutoScrollController, bool>(AutoScrollController.new);

/// Whether the reader's audio UI is folded away — the docked transport shrinks
/// to a single audio icon and the inline player drops its progress bar. Starts
/// folded so narration never takes the strip until the student asks for it;
/// toggled from the audio icon and the player's × button.
class AudioBarCollapsedController extends StateNotifier<bool> {
  AudioBarCollapsedController(this._ref)
      : super(_ref.read(sharedPrefsProvider).getBool(_key) ?? true);

  final Ref _ref;
  static const _key = 'reader_audio_bar_collapsed';

  void set(bool collapsed) {
    state = collapsed;
    _ref.read(sharedPrefsProvider).setBool(_key, collapsed);
  }

  void toggle() => set(!state);
}

final audioBarCollapsedProvider =
    StateNotifierProvider<AudioBarCollapsedController, bool>(
        AudioBarCollapsedController.new);
