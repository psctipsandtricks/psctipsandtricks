import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

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

  /// True once something is loaded — the PDF viewer uses this to decide whether
  /// an auto page-turn control makes any sense.
  bool get hasAudio => _url != null && !failed.value;

  double _speed = 1;
  double get speed => _speed;

  /// Points the player at [url], which may be an http(s) address or a path to a
  /// decrypted file from the offline vault.
  ///
  /// Re-loading the same url is a no-op, so rebuilding the player widget cannot
  /// restart a clip the student is already listening to.
  Future<void> load(String url, {String? label, bool autoPlay = false}) async {
    if (_url == url) return;
    _url = url;
    title.value = label;
    failed.value = false;
    loading.value = true;
    fraction.value = 0;
    position.value = Duration.zero;
    duration.value = null;

    try {
      if (url.startsWith('http')) {
        await _player.setUrl(url);
      } else {
        await _player.setFilePath(url);
      }
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

  /// Releases the current clip. Called when the reader closes, so narration
  /// does not follow the student out of the book.
  Future<void> stop() async {
    _url = null;
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
class AutoScrollController extends StateNotifier<bool> {
  AutoScrollController(this._ref)
      : super(_ref.read(sharedPrefsProvider).getBool(_key) ?? true);

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
