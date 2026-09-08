import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_glass.dart';
import '../../core/widgets/liquid_glass.dart';
import 'reader_audio_controller.dart';

/// Next-generation Liquid Glass full-page audio player screen.
/// Features an Apple Music / Spotify style glassmorphism atmosphere,
/// live animated soundwave visualizer, rotating vinyl disc presentation,
/// glowing scrubber bar, radiant gradient controls, and quick speed chips.
class FullPageAudioPlayerScreen extends ConsumerStatefulWidget {
  const FullPageAudioPlayerScreen({
    super.key,
    this.bookTitle,
    this.onNext,
    this.onPrevious,
    this.hasNext,
    this.hasPrevious,
  });

  final String? bookTitle;
  final VoidCallback? onNext;
  final VoidCallback? onPrevious;
  final bool Function()? hasNext;
  final bool Function()? hasPrevious;

  @override
  ConsumerState<FullPageAudioPlayerScreen> createState() =>
      _FullPageAudioPlayerScreenState();
}

class _FullPageAudioPlayerScreenState
    extends ConsumerState<FullPageAudioPlayerScreen>
    with TickerProviderStateMixin {
  ReaderAudioController get _audio => ref.read(readerAudioProvider);

  Duration? _scrubbing;

  late final AnimationController _waveController;
  late final AnimationController _spinController;

  @override
  void initState() {
    super.initState();
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _spinController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 16),
    )..repeat();
  }

  @override
  void dispose() {
    _waveController.dispose();
    _spinController.dispose();
    super.dispose();
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return d.inHours > 0 ? '${d.inHours}:$m:$s' : '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final audio = _audio;

    return Scaffold(
      backgroundColor: const Color(0xFF070B18),
      body: Stack(
        children: [
          // Ambient multi-point glow background mesh
          Positioned.fill(
            child: _buildAmbientMesh(),
          ),

          // Main interactive player content
          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: ConstrainedBox(
                    constraints:
                        BoxConstraints(minHeight: constraints.maxHeight),
                    child: IntrinsicHeight(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            const SizedBox(height: 6),

                            // Top Bar with Minimize Chevron & Lesson Badge
                            _buildTopBar(context, audio),

                            const Spacer(flex: 1),

                            // Centerpiece Vinyl / Soundwave Visualizer Card
                            _buildHeroCard(context, audio),

                            const SizedBox(height: 32),

                            // Chapter Title & Book Subtitle
                            _buildMetadataSection(audio),

                            const Spacer(flex: 1),

                            // Scrubber Progress Bar & Time Stamps
                            _buildScrubber(context, audio),

                            const SizedBox(height: 20),

                            // Primary Radiant Transport Controls
                            _buildTransportControls(context, audio),

                            const SizedBox(height: 28),

                            // Quick Speed Selector Chips
                            _buildSpeedChips(context, audio),

                            const Spacer(flex: 2),
                            const SizedBox(height: 12),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAmbientMesh() {
    return AnimatedBuilder(
      animation: _waveController,
      builder: (context, child) {
        final t = _waveController.value;
        return Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF060B18),
                Color(0xFF0B142D),
                Color(0xFF070C1A),
              ],
            ),
          ),
          child: Stack(
            children: [
              // Top Cyan Orb
              Positioned(
                top: -60 + (t * 20),
                right: -40,
                child: Container(
                  width: 320,
                  height: 320,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        AppColors.cyan.withValues(alpha: 0.22 + (t * 0.08)),
                        AppColors.cyan.withValues(alpha: 0.0),
                      ],
                    ),
                  ),
                ),
              ),
              // Center Indigo Orb
              Positioned(
                top: 200 - (t * 30),
                left: -60,
                child: Container(
                  width: 340,
                  height: 340,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        AppColors.indigo.withValues(alpha: 0.24 + (t * 0.06)),
                        AppColors.indigo.withValues(alpha: 0.0),
                      ],
                    ),
                  ),
                ),
              ),
              // Bottom Blue Orb
              Positioned(
                bottom: -40 + (t * 20),
                right: 20,
                child: Container(
                  width: 300,
                  height: 300,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        AppColors.blue.withValues(alpha: 0.18 + (t * 0.06)),
                        AppColors.blue.withValues(alpha: 0.0),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildTopBar(BuildContext context, ReaderAudioController audio) {
    return Row(
      children: [
        // Minimize Button
        LiquidGlassTappable(
          onTap: () {
            HapticFeedback.lightImpact();
            Navigator.of(context).pop();
          },
          borderRadius: BorderRadius.circular(999),
          blurSigma: AppGlass.blurRaised,
          intensity: 0.9,
          elevation: 0.8,
          isCardScale: false,
          padding: const EdgeInsets.all(10),
          child: const Icon(
            Icons.keyboard_arrow_down_rounded,
            color: Colors.white,
            size: 26,
          ),
        ),
        const Spacer(),

        // Audio Lesson Pill Badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: AppColors.cyan.withValues(alpha: 0.35),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.cyan.withValues(alpha: 0.12),
                blurRadius: 10,
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Pulsing live wave dot
              AnimatedBuilder(
                animation: _waveController,
                builder: (context, _) => Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: AppColors.cyan,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.cyan,
                        blurRadius: 4 + (_waveController.value * 4),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 7),
              const Text(
                'AUDIO LESSON',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                ),
              ),
            ],
          ),
        ),
        const Spacer(),

        // Placeholder balance icon
        const SizedBox(width: 46),
      ],
    );
  }

  Widget _buildHeroCard(BuildContext context, ReaderAudioController audio) {
    final size = math.min(MediaQuery.of(context).size.width - 64, 260.0);

    return ValueListenableBuilder<bool>(
      valueListenable: audio.playing,
      builder: (context, isPlaying, _) {
        return Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(36),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.cyan.withValues(alpha: 0.22),
                AppColors.indigo.withValues(alpha: 0.15),
                const Color(0xFF0C152E).withValues(alpha: 0.70),
              ],
            ),
            border: Border.all(
              color: isPlaying
                  ? AppColors.cyan.withValues(alpha: 0.50)
                  : Colors.white.withValues(alpha: 0.20),
              width: 1.4,
            ),
            boxShadow: [
              BoxShadow(
                color: isPlaying
                    ? AppColors.cyan.withValues(alpha: 0.32)
                    : Colors.black.withValues(alpha: 0.40),
                blurRadius: 36,
                spreadRadius: -4,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Vinyl Groove Rings
              AnimatedBuilder(
                animation: _spinController,
                builder: (context, child) {
                  return Transform.rotate(
                    angle: isPlaying
                        ? _spinController.value * 2 * math.pi
                        : 0.0,
                    child: Container(
                      width: size * 0.76,
                      height: size * 0.76,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            const Color(0xFF060B18),
                            const Color(0xFF131D38),
                            const Color(0xFF060B18),
                            AppColors.cyan.withValues(alpha: 0.25),
                            const Color(0xFF060B18),
                          ],
                          stops: const [0.0, 0.4, 0.7, 0.85, 1.0],
                        ),
                        border: Border.all(
                          color: AppColors.cyan.withValues(alpha: 0.35),
                          width: 1.5,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.5),
                            blurRadius: 20,
                          ),
                        ],
                      ),
                      child: Center(
                        child: Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: AppColors.brandGradient,
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.cyan.withValues(alpha: 0.45),
                                blurRadius: 14,
                              ),
                            ],
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.headphones_rounded,
                              color: Colors.white,
                              size: 28,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),

              // Live Equalizer Visualizer Bars at the bottom
              Positioned(
                bottom: 20,
                child: _AnimatedEqualizer(isPlaying: isPlaying),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMetadataSection(ReaderAudioController audio) {
    return ValueListenableBuilder<String?>(
      valueListenable: audio.title,
      builder: (context, title, _) {
        return Column(
          children: [
            Text(
              title ?? 'Audio Lesson',
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.4,
                height: 1.3,
                shadows: [
                  Shadow(
                    color: Colors.black54,
                    blurRadius: 10,
                    offset: Offset(0, 3),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.menu_book_rounded,
                  size: 14,
                  color: AppColors.cyan,
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    widget.bookTitle ?? 'PSC Tips And Tricks',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.cyan.withValues(alpha: 0.90),
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }

  Widget _buildScrubber(BuildContext context, ReaderAudioController audio) {
    return ValueListenableBuilder<Duration?>(
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

            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 4.5,
                    thumbShape: const RoundSliderThumbShape(
                      enabledThumbRadius: 7.5,
                      elevation: 4,
                    ),
                    overlayShape:
                        const RoundSliderOverlayShape(overlayRadius: 16),
                    activeTrackColor: AppColors.cyan,
                    inactiveTrackColor: Colors.white.withValues(alpha: 0.16),
                    thumbColor: Colors.white,
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
                            HapticFeedback.selectionClick();
                            audio.seek(Duration(milliseconds: v.round()));
                            setState(() => _scrubbing = null);
                          }
                        : null,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _fmt(shown),
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.85),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                      Text(
                        hasDuration ? _fmt(total) : '--:--',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.65),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
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

  Widget _buildTransportControls(
      BuildContext context, ReaderAudioController audio) {
    // Rebuilt whenever the player is pointed at a different clip. Whether there
    // is a topic either side is a question about the book's position, and a
    // clip playing out moves that position without anything on this screen
    // being touched — so read once, these buttons went on describing the topic
    // the student had already left.
    return ValueListenableBuilder<String?>(
      valueListenable: audio.source,
      builder: (context, _, __) => _transportRow(context, audio),
    );
  }

  Widget _transportRow(BuildContext context, ReaderAudioController audio) {
    final hasPrev = widget.hasPrevious?.call() ?? (widget.onPrevious != null);
    final hasNext = widget.hasNext?.call() ?? (widget.onNext != null);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Replay 10s
        _GlassCircleButton(
          icon: Icons.replay_10_rounded,
          size: 26,
          tooltip: 'Back 10 seconds',
          onTap: () {
            HapticFeedback.lightImpact();
            audio.seekBy(const Duration(seconds: -10));
          },
        ),

        // Previous Chapter Track
        _GlassCircleButton(
          icon: Icons.skip_previous_rounded,
          size: 32,
          tooltip: 'Previous chapter',
          enabled: hasPrev,
          onTap: hasPrev
              ? () {
                  HapticFeedback.lightImpact();
                  widget.onPrevious?.call();
                  setState(() {});
                }
              : null,
        ),

        // Primary Center Play / Pause Radiant Orb
        ValueListenableBuilder<bool>(
          valueListenable: audio.loading,
          builder: (context, loading, _) => ValueListenableBuilder<bool>(
            valueListenable: audio.playing,
            builder: (context, playing, _) => _PrimaryPlayButton(
              loading: loading,
              playing: playing,
              onTap: () {
                HapticFeedback.mediumImpact();
                if (!loading) audio.togglePlay();
              },
            ),
          ),
        ),

        // Next Chapter Track
        _GlassCircleButton(
          icon: Icons.skip_next_rounded,
          size: 32,
          tooltip: 'Next chapter',
          enabled: hasNext,
          onTap: hasNext
              ? () {
                  HapticFeedback.lightImpact();
                  widget.onNext?.call();
                  setState(() {});
                }
              : null,
        ),

        // Forward 10s
        _GlassCircleButton(
          icon: Icons.forward_10_rounded,
          size: 26,
          tooltip: 'Forward 10 seconds',
          onTap: () {
            HapticFeedback.lightImpact();
            audio.seekBy(const Duration(seconds: 10));
          },
        ),
      ],
    );
  }

  Widget _buildSpeedChips(
      BuildContext context, ReaderAudioController audio) {
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.14),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: speeds.map((s) {
          final isSelected = (audio.speed - s).abs() < 0.05;
          return GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              audio.setSpeed(s);
              setState(() {});
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                gradient: isSelected ? AppColors.brandGradient : null,
                borderRadius: BorderRadius.circular(18),
                boxShadow: isSelected
                    ? [
                        BoxShadow(
                          color: AppColors.cyan.withValues(alpha: 0.40),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
              ),
              child: Text(
                '${s.toStringAsFixed(s == s.roundToDouble() ? 0 : 2)}x',
                style: TextStyle(
                  color: isSelected
                      ? Colors.white
                      : Colors.white.withValues(alpha: 0.65),
                  fontWeight:
                      isSelected ? FontWeight.w900 : FontWeight.w600,
                  fontSize: 12.5,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

/// Radiant primary play / pause orb with tactile spring feedback.
class _PrimaryPlayButton extends StatefulWidget {
  const _PrimaryPlayButton({
    required this.loading,
    required this.playing,
    required this.onTap,
  });

  final bool loading;
  final bool playing;
  final VoidCallback onTap;

  @override
  State<_PrimaryPlayButton> createState() => _PrimaryPlayButtonState();
}

class _PrimaryPlayButtonState extends State<_PrimaryPlayButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) {
        setState(() => _isPressed = false);
        widget.onTap();
      },
      onTapCancel: () => setState(() => _isPressed = false),
      child: AnimatedScale(
        scale: _isPressed ? 0.90 : 1.0,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOutBack,
        child: Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: AppColors.brandGradient,
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.35),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.cyan.withValues(alpha: 0.45),
                blurRadius: 24,
                spreadRadius: 2,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: widget.loading
              ? const Center(
                  child: SizedBox(
                    width: 26,
                    height: 26,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.8,
                      color: Colors.white,
                    ),
                  ),
                )
              : Center(
                  child: Icon(
                    widget.playing
                        ? Icons.pause_rounded
                        : Icons.play_arrow_rounded,
                    size: 42,
                    color: Colors.white,
                  ),
                ),
        ),
      ),
    );
  }
}

/// Circular frosted glass control button.
class _GlassCircleButton extends StatefulWidget {
  const _GlassCircleButton({
    required this.icon,
    required this.size,
    required this.tooltip,
    this.onTap,
    this.enabled = true,
  });

  final IconData icon;
  final double size;
  final String tooltip;
  final VoidCallback? onTap;
  final bool enabled;

  @override
  State<_GlassCircleButton> createState() => _GlassCircleButtonState();
}

class _GlassCircleButtonState extends State<_GlassCircleButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final active = widget.enabled && widget.onTap != null;

    return Tooltip(
      message: widget.tooltip,
      child: GestureDetector(
        onTapDown: active ? (_) => setState(() => _isPressed = true) : null,
        onTapUp: active
            ? (_) {
                setState(() => _isPressed = false);
                widget.onTap?.call();
              }
            : null,
        onTapCancel: active ? () => setState(() => _isPressed = false) : null,
        child: AnimatedScale(
          scale: _isPressed ? 0.88 : 1.0,
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOutBack,
          child: Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: active ? 0.08 : 0.03),
              border: Border.all(
                color: Colors.white.withValues(alpha: active ? 0.18 : 0.08),
                width: 1,
              ),
            ),
            child: Center(
              child: Icon(
                widget.icon,
                size: widget.size,
                color: active
                    ? Colors.white
                    : Colors.white.withValues(alpha: 0.30),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 5 animated glowing visualizer bars that pulse when playing.
class _AnimatedEqualizer extends StatefulWidget {
  const _AnimatedEqualizer({required this.isPlaying});

  final bool isPlaying;

  @override
  State<_AnimatedEqualizer> createState() => _AnimatedEqualizerState();
}

class _AnimatedEqualizerState extends State<_AnimatedEqualizer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    if (widget.isPlaying) _controller.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(covariant _AnimatedEqualizer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isPlaying != oldWidget.isPlaying) {
      if (widget.isPlaying) {
        _controller.repeat(reverse: true);
      } else {
        _controller.stop();
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = widget.isPlaying ? _controller.value : 0.2;
        return Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            _bar(6 + (t * 14)),
            const SizedBox(width: 4),
            _bar(10 + ((1 - t) * 16)),
            const SizedBox(width: 4),
            _bar(8 + (math.sin(t * math.pi) * 18)),
            const SizedBox(width: 4),
            _bar(12 + (t * 12)),
            const SizedBox(width: 4),
            _bar(6 + ((1 - t) * 10)),
          ],
        );
      },
    );
  }

  Widget _bar(double height) {
    return Container(
      width: 4,
      height: height.clamp(4.0, 24.0),
      decoration: BoxDecoration(
        color: AppColors.cyan,
        borderRadius: BorderRadius.circular(3),
        boxShadow: [
          BoxShadow(
            color: AppColors.cyan.withValues(alpha: 0.7),
            blurRadius: 6,
          ),
        ],
      ),
    );
  }
}
