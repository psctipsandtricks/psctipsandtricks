import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/glass_card.dart';
import '../reader_audio_controller.dart';

/// Teacher narration for the current topic.
///
/// A thin view over [ReaderAudioController]; the player itself lives in a
/// provider so playback carries on when the student opens the topic's notes.
class ReaderAudioPlayer extends ConsumerStatefulWidget {
  const ReaderAudioPlayer({
    super.key,
    required this.url,
    required this.title,
    this.autoPlay = false,
    this.autoLoad = true,
  });

  /// Either an http(s) URL or an absolute path to a decrypted local file, so
  /// the same widget serves the streaming and offline cases.
  final String url;
  final String title;
  final bool autoPlay;

  /// Whether this widget points the shared player at [url] itself.
  ///
  /// False in the book reader, which loads the clip for the open topic no
  /// matter which view is showing — the document view has no big player, and
  /// two owners of the source would race over autoplay.
  final bool autoLoad;

  @override
  ConsumerState<ReaderAudioPlayer> createState() => _ReaderAudioPlayerState();
}

class _ReaderAudioPlayerState extends ConsumerState<ReaderAudioPlayer> {
  ReaderAudioController get _audio => ref.read(readerAudioProvider);

  /// Set while the student drags the scrubber, so the ticking position does not
  /// yank the thumb out from under their finger.
  Duration? _scrubbing;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void didUpdateWidget(covariant ReaderAudioPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) _load();
  }

  void _load() {
    if (!widget.autoLoad) return;
    _audio.load(widget.url, label: widget.title, autoPlay: widget.autoPlay);
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return d.inHours > 0 ? '${d.inHours}:$m:$s' : '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final audio = _audio;
    final collapsed = ref.watch(audioBarCollapsedProvider);

    return ValueListenableBuilder<bool>(
      valueListenable: audio.failed,
      builder: (context, failed, _) {
        if (failed) {
          return GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                const Icon(Icons.volume_off_rounded,
                    size: 18, color: AppColors.rose),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Audio for this topic could not be loaded.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                        ),
                  ),
                ),
                TextButton(
                  onPressed: () => audio.reload(autoPlay: true),
                  child: const Text('Retry'),
                ),
              ],
            ),
          );
        }

        return GlassCard(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
          borderColor: AppColors.cyan.withValues(alpha: 0.28),
          child: Column(
            children: [
              Row(
                children: [
                  // The audio icon and label double as the toggle for the
                  // progress bar: tap to fold it away, tap again to bring it
                  // back. Title and transport are left where they are.
                  Tooltip(
                    message:
                        collapsed ? 'Show progress bar' : 'Hide progress bar',
                    child: InkWell(
                      onTap: () =>
                          ref.read(audioBarCollapsedProvider.notifier).toggle(),
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 4, vertical: 3),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.graphic_eq_rounded,
                                size: 13, color: AppColors.cyan),
                            const SizedBox(width: 5),
                            Text(
                              'AUDIO LESSON',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    color: AppColors.cyan,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.7,
                                    fontSize: 10,
                                  ),
                            ),
                            const SizedBox(width: 3),
                            Icon(
                              collapsed
                                  ? Icons.keyboard_arrow_down_rounded
                                  : Icons.keyboard_arrow_up_rounded,
                              size: 15,
                              color: AppColors.cyan,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => setState(audio.cycleSpeed),
                    style: TextButton.styleFrom(
                      minimumSize: Size.zero,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text('${audio.speed}x'),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                widget.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              // Folds the scrubber and its time row away on demand; the
              // transport below stays reachable either way.
              AnimatedSize(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeInOut,
                alignment: Alignment.topCenter,
                child: collapsed
                    ? const SizedBox(width: double.infinity, height: 10)
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SizedBox(height: 6),
                          _progressBar(context, audio, palette),
                          const SizedBox(height: 6),
                        ],
                      ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _RoundAction(
                    icon: Icons.replay_10_rounded,
                    tooltip: 'Back 10 seconds',
                    onTap: () => audio.seekBy(const Duration(seconds: -10)),
                  ),
                  const SizedBox(width: 20),
                  ValueListenableBuilder<bool>(
                    valueListenable: audio.loading,
                    builder: (context, loading, _) =>
                        ValueListenableBuilder<bool>(
                      valueListenable: audio.playing,
                      builder: (context, playing, _) => _CircleButton(
                        size: 52,
                        filled: true,
                        busy: loading,
                        icon: playing
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded,
                        onTap: loading ? null : audio.togglePlay,
                      ),
                    ),
                  ),
                  const SizedBox(width: 20),
                  _RoundAction(
                    icon: Icons.forward_10_rounded,
                    tooltip: 'Forward 10 seconds',
                    onTap: () => audio.seekBy(const Duration(seconds: 10)),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  /// The draggable scrubber and its `00:41 / 07:45` line — the part the audio
  /// icon folds away.
  Widget _progressBar(
    BuildContext context,
    ReaderAudioController audio,
    dynamic palette,
  ) {
    return ValueListenableBuilder<Duration?>(
      valueListenable: audio.duration,
      builder: (context, total, _) {
        final hasDuration = total != null && total > Duration.zero;
        final maxMs = hasDuration ? total.inMilliseconds.toDouble() : 1.0;

        return ValueListenableBuilder<Duration>(
          valueListenable: audio.position,
          builder: (context, position, _) {
            final shown = _scrubbing ?? position;
            final valueMs =
                shown.inMilliseconds.clamp(0, maxMs.toInt()).toDouble();

            return Column(
              children: [
                SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 3,
                    thumbShape:
                        const RoundSliderThumbShape(enabledThumbRadius: 6),
                    overlayShape:
                        const RoundSliderOverlayShape(overlayRadius: 14),
                    activeTrackColor: AppColors.cyan,
                    inactiveTrackColor: palette.elevated,
                    thumbColor: AppColors.cyan,
                  ),
                  child: Slider(
                    value: valueMs,
                    max: maxMs,
                    onChanged: hasDuration
                        ? (v) => setState(
                              () => _scrubbing =
                                  Duration(milliseconds: v.round()),
                            )
                        : null,
                    onChangeEnd: hasDuration
                        ? (v) {
                            audio.seek(Duration(milliseconds: v.round()));
                            setState(() => _scrubbing = null);
                          }
                        : null,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _fmt(shown),
                        style: Theme.of(context)
                            .textTheme
                            .labelSmall
                            ?.copyWith(color: palette.textMuted),
                      ),
                      Text(
                        hasDuration ? _fmt(total) : '--:--',
                        style: Theme.of(context)
                            .textTheme
                            .labelSmall
                            ?.copyWith(color: palette.textMuted),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

/// Secondary transport control — quieter than the play button so the primary
/// action stays obvious.
class _RoundAction extends StatelessWidget {
  const _RoundAction({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.iconSize = 26,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  /// Trimmed by the sideways transport, where the whole row has to fit in the
  /// height of one line of text.
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Padding(
          padding: EdgeInsets.all(iconSize >= 24 ? 9 : 7),
          child: Icon(icon, size: iconSize, color: context.palette.textSecondary),
        ),
      ),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({
    required this.size,
    required this.onTap,
    this.icon,
    this.filled = false,
    this.busy = false,
  });

  final double size;
  final VoidCallback? onTap;
  final IconData? icon;
  final bool filled;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          gradient: filled ? AppColors.brandGradient : null,
          color: filled ? null : context.palette.elevated,
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: busy
            ? const SizedBox(
                width: 17,
                height: 17,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : Icon(icon, color: Colors.white, size: size * 0.55),
      ),
    );
  }
}

/// The narration transport in one row, docked under a document.
///
/// The reader's [ReaderAudioPlayer] is left behind the moment a topic's notes
/// open full-screen, and narration that cannot be paused from the screen the
/// student is actually looking at reads as a bug. This is the same shared
/// controller in a bar-sized form, so play, skip, scrub and speed stay within
/// reach while reading the PDF.
///
/// Renders nothing when there is no clip loaded, so a PDF opened without any
/// narration keeps the whole screen.
/// Under this much viewport height the transport folds into a single row.
/// A phone sideways is around 411dp; anything taller has room for the full
/// two-row player.
const _compactHeight = 520.0;

class ReaderMiniPlayer extends ConsumerStatefulWidget {
  const ReaderMiniPlayer({super.key});

  @override
  ConsumerState<ReaderMiniPlayer> createState() => _ReaderMiniPlayerState();
}

class _ReaderMiniPlayerState extends ConsumerState<ReaderMiniPlayer> {
  ReaderAudioController get _audio => ref.read(readerAudioProvider);

  /// Set while the student drags the scrubber, so the ticking position does
  /// not yank the thumb out from under their finger.
  Duration? _scrubbing;

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return d.inHours > 0 ? '${d.inHours}:$m:$s' : '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final audio = _audio;

    // A phone lying on its side has roughly 411dp of height. The full
    // transport — a 48dp slider row, a 52dp control row and the gesture
    // inset — took a quarter of that away from the page it sits under, so
    // sideways it folds into a single row with the scrubber as a hairline.
    final compact = MediaQuery.sizeOf(context).height < _compactHeight;
    final collapsed = ref.watch(audioBarCollapsedProvider);

    return ValueListenableBuilder<String?>(
      valueListenable: audio.title,
      builder: (context, title, _) {
        if (title == null) return const SizedBox.shrink();

        // Folded to a single audio icon by default — it gives the page back
        // the strip the transport was taking. Tapping it opens the player;
        // the × on the open player folds it away again.
        if (collapsed) {
          return SafeArea(
            top: false,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
                child: _CollapsedAudioButton(
                  audio: audio,
                  onOpen: () =>
                      ref.read(audioBarCollapsedProvider.notifier).set(false),
                ),
              ),
            ),
          );
        }

        return ValueListenableBuilder<bool>(
          valueListenable: audio.failed,
          builder: (context, failed, _) => DecoratedBox(
            decoration: BoxDecoration(
              color: palette.card,
              border: Border(top: BorderSide(color: palette.border)),
            ),
            child: SafeArea(
              top: false,
              child: failed
                  ? _failedRow(context, audio)
                  : _transport(context, audio, title, compact),
            ),
          ),
        );
      },
    );
  }

  Widget _failedRow(BuildContext context, ReaderAudioController audio) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
      child: Row(
        children: [
          const Icon(Icons.volume_off_rounded, size: 18, color: AppColors.rose),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Narration could not be loaded.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.palette.textSecondary,
                  ),
            ),
          ),
          TextButton(
            onPressed: () => audio.reload(autoPlay: true),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _transport(
    BuildContext context,
    ReaderAudioController audio,
    String title,
    bool compact,
  ) {
    final palette = context.palette;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Draggable, not just an indicator: skimming a lesson means jumping to
        // a point, and ±10s is a poor way to cross ten minutes. The track is
        // kept thin so the document still owns the screen.
        ValueListenableBuilder<Duration?>(
          valueListenable: audio.duration,
          builder: (context, total, _) {
            final hasDuration = total != null && total > Duration.zero;
            final maxMs = hasDuration ? total.inMilliseconds.toDouble() : 1.0;

            return ValueListenableBuilder<Duration>(
              valueListenable: audio.position,
              builder: (context, position, _) {
                final shown = _scrubbing ?? position;
                final value =
                    shown.inMilliseconds.clamp(0, maxMs.toInt()).toDouble();

                final slider = SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: compact ? 2 : 3,
                    thumbShape: RoundSliderThumbShape(
                      enabledThumbRadius: compact ? 5 : 6,
                    ),
                    // Sideways the 13dp halo would be the tallest thing in the
                    // row and would set its height on its own.
                    overlayShape: compact
                        ? SliderComponentShape.noOverlay
                        : const RoundSliderOverlayShape(overlayRadius: 13),
                    activeTrackColor: AppColors.cyan,
                    inactiveTrackColor: palette.elevated,
                    thumbColor: AppColors.cyan,
                  ),
                  child: Slider(
                    value: value,
                    max: maxMs,
                    // While dragging, the thumb follows the finger and the
                    // page does not move — the jump happens once, on release,
                    // rather than flicking through every page on the way.
                    onChanged: hasDuration
                        ? (v) => setState(
                              () => _scrubbing =
                                  Duration(milliseconds: v.round()),
                            )
                        : null,
                    onChangeEnd: hasDuration
                        ? (v) {
                            audio.seek(Duration(milliseconds: v.round()));
                            setState(() => _scrubbing = null);
                          }
                        : null,
                  ),
                );

                // A bare Slider insists on 48dp of height for its touch
                // target. Sideways that is more than the row below it, so it
                // is boxed down to a hairline — still draggable, just no
                // longer the tallest thing on the screen.
                return compact
                    ? SizedBox(height: 16, child: slider)
                    : slider;
              },
            );
          },
        ),
        Padding(
          padding: compact
              ? const EdgeInsets.fromLTRB(8, 0, 4, 2)
              : const EdgeInsets.fromLTRB(10, 6, 6, 6),
          child: Row(
            children: [
              ValueListenableBuilder<bool>(
                valueListenable: audio.loading,
                builder: (context, loading, _) => ValueListenableBuilder<bool>(
                  valueListenable: audio.playing,
                  builder: (context, playing, _) => _CircleButton(
                    size: compact ? 32 : 40,
                    filled: true,
                    busy: loading,
                    icon: playing
                        ? Icons.pause_rounded
                        : Icons.play_arrow_rounded,
                    onTap: loading ? null : audio.togglePlay,
                  ),
                ),
              ),
              SizedBox(width: compact ? 9 : 11),
              // Sideways the title and the clock sit on one line rather than
              // stacked, which is the other half of the height saving.
              Expanded(
                child: compact
                    ? Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      fontWeight: FontWeight.w700,
                                    ),
                          ),
                          _clock(context, audio),
                        ],
                      ),
              ),
              if (compact) ...[
                const SizedBox(width: 8),
                _clock(context, audio),
                const SizedBox(width: 4),
              ],
              _RoundAction(
                icon: Icons.replay_10_rounded,
                tooltip: 'Back 10 seconds',
                iconSize: compact ? 21 : 26,
                onTap: () => audio.seekBy(const Duration(seconds: -10)),
              ),
              _RoundAction(
                icon: Icons.forward_10_rounded,
                tooltip: 'Forward 10 seconds',
                iconSize: compact ? 21 : 26,
                onTap: () => audio.seekBy(const Duration(seconds: 10)),
              ),
              TextButton(
                onPressed: () => setState(audio.cycleSpeed),
                style: TextButton.styleFrom(
                  minimumSize: Size.zero,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text('${audio.speed}x'),
              ),
              // Folds the whole transport back down to the audio icon.
              _RoundAction(
                icon: Icons.close_rounded,
                tooltip: 'Hide the player',
                iconSize: compact ? 19 : 22,
                onTap: () =>
                    ref.read(audioBarCollapsedProvider.notifier).set(true),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// `00:41 / 07:45`, shared by both layouts — under the title when there is
  /// room for two lines, beside it when there is not.
  Widget _clock(BuildContext context, ReaderAudioController audio) {
    return ValueListenableBuilder<Duration>(
      valueListenable: audio.position,
      builder: (context, position, _) => ValueListenableBuilder<Duration?>(
        valueListenable: audio.duration,
        builder: (context, total, _) => Text(
          '${_fmt(position)} / ${total == null ? '--:--' : _fmt(total)}',
          style: Theme.of(context)
              .textTheme
              .labelSmall
              ?.copyWith(color: context.palette.textMuted),
        ),
      ),
    );
  }
}

/// The folded-away narration player: a single audio icon that opens the full
/// transport on tap. The dot pulses while a clip is playing, so the student can
/// tell narration is running without unfolding it.
class _CollapsedAudioButton extends StatelessWidget {
  const _CollapsedAudioButton({required this.audio, required this.onOpen});

  final ReaderAudioController audio;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Show the audio player',
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(
            color: context.palette.card,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.cyan.withValues(alpha: 0.4)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              ValueListenableBuilder<bool>(
                valueListenable: audio.playing,
                builder: (context, playing, _) => Icon(
                  playing
                      ? Icons.graphic_eq_rounded
                      : Icons.headphones_rounded,
                  size: 18,
                  color: AppColors.cyan,
                ),
              ),
              const SizedBox(width: 7),
              Icon(Icons.keyboard_arrow_up_rounded,
                  size: 16, color: context.palette.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

/// A floating, tablet-style audio player card that sits with proper margins
/// over the document.
class ReaderTabletAudioPlayer extends ConsumerStatefulWidget {
  const ReaderTabletAudioPlayer({
    super.key,
    this.onClose,
    this.onExpand,
  });

  final VoidCallback? onClose;
  final VoidCallback? onExpand;

  @override
  ConsumerState<ReaderTabletAudioPlayer> createState() =>
      _ReaderTabletAudioPlayerState();
}

class _ReaderTabletAudioPlayerState
    extends ConsumerState<ReaderTabletAudioPlayer> {
  ReaderAudioController get _audio => ref.read(readerAudioProvider);

  Duration? _scrubbing;

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return d.inHours > 0 ? '${d.inHours}:$m:$s' : '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final audio = _audio;

    return ValueListenableBuilder<String?>(
      valueListenable: audio.title,
      builder: (context, title, _) {
        final displayTitle = title ?? 'Audio Lesson';

        return ValueListenableBuilder<bool>(
          valueListenable: audio.failed,
          builder: (context, failed, _) => Container(
            decoration: BoxDecoration(
              color: palette.card,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: palette.border.withValues(alpha: 0.8),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.14),
                  blurRadius: 16,
                  offset: const Offset(0, 5),
                ),
                BoxShadow(
                  color: AppColors.cyan.withValues(alpha: 0.08),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: failed
                ? _failedRow(context, audio)
                : _content(context, audio, displayTitle),
          ),
        );
      },
    );
  }

  Widget _failedRow(BuildContext context, ReaderAudioController audio) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
      child: Row(
        children: [
          const Icon(Icons.volume_off_rounded, size: 18, color: AppColors.rose),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Narration could not be loaded.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.palette.textSecondary,
                  ),
            ),
          ),
          TextButton(
            onPressed: () => audio.reload(autoPlay: true),
            child: const Text('Retry'),
          ),
          if (widget.onClose != null)
            IconButton(
              icon: const Icon(Icons.close_rounded, size: 18),
              onPressed: widget.onClose,
            ),
        ],
      ),
    );
  }

  Widget _content(
    BuildContext context,
    ReaderAudioController audio,
    String title,
  ) {
    final palette = context.palette;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Thin progress slider across the top
        ValueListenableBuilder<Duration?>(
          valueListenable: audio.duration,
          builder: (context, total, _) {
            final hasDuration = total != null && total > Duration.zero;
            final maxMs = hasDuration ? total.inMilliseconds.toDouble() : 1.0;

            return ValueListenableBuilder<Duration>(
              valueListenable: audio.position,
              builder: (context, position, _) {
                final shown = _scrubbing ?? position;
                final value =
                    shown.inMilliseconds.clamp(0, maxMs.toInt()).toDouble();

                final slider = SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 3,
                    thumbShape:
                        const RoundSliderThumbShape(enabledThumbRadius: 5),
                    overlayShape:
                        const RoundSliderOverlayShape(overlayRadius: 11),
                    activeTrackColor: AppColors.cyan,
                    inactiveTrackColor: palette.elevated,
                    thumbColor: AppColors.cyan,
                  ),
                  child: Slider(
                    value: value,
                    max: maxMs,
                    onChanged: hasDuration
                        ? (v) => setState(
                              () => _scrubbing =
                                  Duration(milliseconds: v.round()),
                            )
                        : null,
                    onChangeEnd: hasDuration
                        ? (v) {
                            audio.seek(Duration(milliseconds: v.round()));
                            setState(() => _scrubbing = null);
                          }
                        : null,
                  ),
                );

                return SizedBox(height: 14, child: slider);
              },
            );
          },
        ),

        // Controls row
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 0, 8, 8),
          child: Row(
            children: [
              ValueListenableBuilder<bool>(
                valueListenable: audio.loading,
                builder: (context, loading, _) => ValueListenableBuilder<bool>(
                  valueListenable: audio.playing,
                  builder: (context, playing, _) => _CircleButton(
                    size: 36,
                    filled: true,
                    busy: loading,
                    icon: playing
                        ? Icons.pause_rounded
                        : Icons.play_arrow_rounded,
                    onTap: loading ? null : audio.togglePlay,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: InkWell(
                  onTap: widget.onExpand,
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                              ),
                        ),
                        _clock(context, audio),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 4),
              _RoundAction(
                icon: Icons.replay_10_rounded,
                tooltip: 'Back 10 seconds',
                iconSize: 22,
                onTap: () => audio.seekBy(const Duration(seconds: -10)),
              ),
              _RoundAction(
                icon: Icons.forward_10_rounded,
                tooltip: 'Forward 10 seconds',
                iconSize: 22,
                onTap: () => audio.seekBy(const Duration(seconds: 10)),
              ),
              TextButton(
                onPressed: () => setState(audio.cycleSpeed),
                style: TextButton.styleFrom(
                  minimumSize: Size.zero,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  '${audio.speed}x',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
              if (widget.onExpand != null)
                _RoundAction(
                  icon: Icons.open_in_full_rounded,
                  tooltip: 'Expand full-page player',
                  iconSize: 18,
                  onTap: () {
                    debugPrint('===> Expand button tapped in ReaderTabletAudioPlayer!');
                    widget.onExpand?.call();
                  },
                ),
              if (widget.onClose != null)
                _RoundAction(
                  icon: Icons.close_rounded,
                  tooltip: 'Hide audio player',
                  iconSize: 20,
                  onTap: widget.onClose!,
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _clock(BuildContext context, ReaderAudioController audio) {
    return ValueListenableBuilder<Duration>(
      valueListenable: audio.position,
      builder: (context, position, _) => ValueListenableBuilder<Duration?>(
        valueListenable: audio.duration,
        builder: (context, total, _) => Text(
          '${_fmt(position)} / ${total == null ? '--:--' : _fmt(total)}',
          style: Theme.of(context)
              .textTheme
              .labelSmall
              ?.copyWith(color: context.palette.textMuted, fontSize: 11),
        ),
      ),
    );
  }
}


/// YouTube class video shown as a tappable thumbnail — the player opens on
/// demand rather than mounting a WebView inside a scrolling reader.
class ReaderVideoCard extends StatelessWidget {
  const ReaderVideoCard({
    super.key,
    required this.youtubeUrl,
    required this.onPlay,
  });

  final String youtubeUrl;
  final VoidCallback onPlay;

  /// Extracts the 11-character id from any of YouTube's URL shapes.
  static String? videoId(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) return null;
    if (uri.host.contains('youtu.be')) {
      return uri.pathSegments.isEmpty ? null : uri.pathSegments.first;
    }
    final v = uri.queryParameters['v'];
    if (v != null && v.isNotEmpty) return v;
    final segments = uri.pathSegments;
    final marker = segments.indexWhere(
      (s) => s == 'embed' || s == 'shorts' || s == 'v',
    );
    if (marker >= 0 && marker + 1 < segments.length) return segments[marker + 1];
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final id = videoId(youtubeUrl);

    return InkWell(
      onTap: onPlay,
      borderRadius: BorderRadius.circular(AppTheme.radiusLg),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (id != null)
                Image.network(
                  'https://img.youtube.com/vi/$id/hqdefault.jpg',
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) =>
                      ColoredBox(color: context.palette.elevated),
                )
              else
                ColoredBox(color: context.palette.elevated),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.35),
                ),
              ),
              Center(
                child: Container(
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    color: AppColors.red,
                    borderRadius: BorderRadius.circular(28),
                  ),
                  child: const Icon(Icons.play_arrow_rounded,
                      color: Colors.white, size: 30),
                ),
              ),
              Positioned(
                left: 12,
                bottom: 12,
                child: Row(
                  children: [
                    const Icon(Icons.smart_display_rounded,
                        size: 15, color: Colors.white),
                    const SizedBox(width: 6),
                    Text(
                      'Video class',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
