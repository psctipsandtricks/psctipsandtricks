import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/glass_card.dart';

/// Teacher narration for the current topic.
///
/// One player instance is owned per reader screen and re-pointed as the student
/// moves between topics — allocating a decoder per unit would leak audio
/// sessions on a long book.
class ReaderAudioPlayer extends StatefulWidget {
  const ReaderAudioPlayer({
    super.key,
    required this.url,
    required this.title,
    this.autoPlay = false,
  });

  /// Either an http(s) URL or an absolute path to a decrypted local file, so
  /// the same widget serves the streaming and offline cases.
  final String url;
  final String title;
  final bool autoPlay;

  @override
  State<ReaderAudioPlayer> createState() => _ReaderAudioPlayerState();
}

class _ReaderAudioPlayerState extends State<ReaderAudioPlayer> {
  final _player = AudioPlayer();
  StreamSubscription<PlayerState>? _stateSub;

  bool _loading = true;
  bool _failed = false;
  double _speed = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant ReaderAudioPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      if (widget.url.startsWith('http')) {
        await _player.setUrl(widget.url);
      } else {
        await _player.setFilePath(widget.url);
      }
      if (!mounted) return;
      setState(() => _loading = false);
      if (widget.autoPlay) unawaited(_player.play());
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _failed = true;
        });
      }
    }
  }

  @override
  void dispose() {
    _stateSub?.cancel();
    _player.dispose();
    super.dispose();
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return d.inHours > 0 ? '${d.inHours}:$m:$s' : '$m:$s';
  }

  void _cycleSpeed() {
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    final next = speeds[(speeds.indexOf(_speed) + 1) % speeds.length];
    setState(() => _speed = next);
    _player.setSpeed(next);
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    if (_failed) {
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
            TextButton(onPressed: _load, child: const Text('Retry')),
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
              StreamBuilder<PlayerState>(
                stream: _player.playerStateStream,
                builder: (context, snapshot) {
                  final state = snapshot.data;
                  final playing = state?.playing ?? false;
                  final buffering = _loading ||
                      state?.processingState == ProcessingState.loading ||
                      state?.processingState == ProcessingState.buffering;

                  return _CircleButton(
                    size: 42,
                    filled: true,
                    icon: buffering
                        ? null
                        : (playing
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded),
                    busy: buffering,
                    onTap: buffering
                        ? null
                        : () {
                            if (playing) {
                              _player.pause();
                            } else {
                              // Replay from the top once the clip has ended.
                              if (state?.processingState ==
                                  ProcessingState.completed) {
                                _player.seek(Duration.zero);
                              }
                              _player.play();
                            }
                          },
                  );
                },
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.graphic_eq_rounded,
                            size: 13, color: AppColors.cyan),
                        const SizedBox(width: 5),
                        Text(
                          'AUDIO LESSON',
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: AppColors.cyan,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.7,
                                    fontSize: 10,
                                  ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      widget.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: _cycleSpeed,
                style: TextButton.styleFrom(
                  minimumSize: Size.zero,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text('${_speed}x'),
              ),
            ],
          ),
          StreamBuilder<Duration>(
            stream: _player.positionStream,
            builder: (context, snapshot) {
              final position = snapshot.data ?? Duration.zero;
              final total = _player.duration ?? Duration.zero;
              final max = total.inMilliseconds.toDouble();
              final value = position.inMilliseconds
                  .clamp(0, max <= 0 ? 0 : max.toInt())
                  .toDouble();

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
                      value: value,
                      max: max <= 0 ? 1 : max,
                      onChanged: max <= 0
                          ? null
                          : (v) => _player.seek(
                                Duration(milliseconds: v.round()),
                              ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _fmt(position),
                          style: Theme.of(context)
                              .textTheme
                              .labelSmall
                              ?.copyWith(color: palette.textMuted),
                        ),
                        Text(
                          _fmt(total),
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
          ),
        ],
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
