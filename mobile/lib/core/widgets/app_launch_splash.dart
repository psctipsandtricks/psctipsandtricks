import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// A modern, smooth logo launch animation that displays on initial app start.
///
/// Animation Sequence (~1.6s total):
/// 1. 0%–45%: App logo fades in smoothly while scaling from 0.82 to 1.0 (easeOutCubic).
/// 2. 30%–65%: Brand title & subtitle slide up with gentle fade-in.
/// 3. 65%–80%: Brief polished hold.
/// 4. 80%–100%: Smooth crossfade out with subtle forward zoom into the main app.
/// 5. Complete: Unmounts itself completely, ensuring 0 ongoing overhead.
class AppLaunchSplashHost extends StatefulWidget {
  const AppLaunchSplashHost({super.key, required this.child});

  final Widget child;

  @override
  State<AppLaunchSplashHost> createState() => _AppLaunchSplashHostState();
}

class _AppLaunchSplashHostState extends State<AppLaunchSplashHost>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _logoOpacity;
  late final Animation<double> _logoScale;
  late final Animation<double> _textOpacity;
  late final Animation<Offset> _textSlide;
  late final Animation<double> _splashFadeOut;
  late final Animation<double> _splashScaleOut;

  bool _isFinished = false;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1650),
    );

    // 1. Logo Reveal (0% - 45%)
    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.45, curve: Curves.easeOutCubic),
      ),
    );

    _logoScale = Tween<double>(begin: 0.82, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.50, curve: Curves.easeOutCubic),
      ),
    );

    // 2. Text Reveal (30% - 65%)
    _textOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.30, 0.65, curve: Curves.easeOut),
      ),
    );

    _textSlide = Tween<Offset>(
      begin: const Offset(0.0, 0.25),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.30, 0.65, curve: Curves.easeOutCubic),
      ),
    );

    // 3. Smooth Outro Transition into Main App (80% - 100%)
    _splashFadeOut = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.80, 1.0, curve: Curves.easeInOutCubic),
      ),
    );

    _splashScaleOut = Tween<double>(begin: 1.0, end: 1.04).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.80, 1.0, curve: Curves.easeInOutCubic),
      ),
    );

    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        if (mounted) {
          setState(() {
            _isFinished = true;
          });
        }
      }
    });

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isFinished) {
      return widget.child;
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Stack(
      fit: StackFit.expand,
      children: [
        // Main App Screen (pre-warmed underneath)
        widget.child,

        // Launch Splash Overlay
        AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final splashOpacity = _splashFadeOut.value;
            if (splashOpacity <= 0.0) {
              return const SizedBox.shrink();
            }

            return IgnorePointer(
              ignoring: _splashFadeOut.value < 0.5,
              child: Opacity(
                opacity: splashOpacity,
                child: Transform.scale(
                  scale: _splashScaleOut.value,
                  child: Material(
                    type: MaterialType.transparency,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          center: const Alignment(0, -0.1),
                          radius: 1.3,
                          colors: isDark
                              ? const [
                                  Color(0xFF0C1938),
                                  Color(0xFF070E22),
                                  Color(0xFF040816),
                                ]
                              : const [
                                  Color(0xFFFFFFFF),
                                  Color(0xFFF8FAFC),
                                  Color(0xFFF1F5F9),
                                ],
                        ),
                      ),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          // Ambient central glow
                          Container(
                            width: 240,
                            height: 240,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: RadialGradient(
                                colors: [
                                  AppColors.cyan.withValues(
                                    alpha: isDark ? 0.22 : 0.14,
                                  ),
                                  Colors.transparent,
                                ],
                              ),
                            ),
                          ),

                          // Centered Animated Logo and Brand Title
                          Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // Animated Circular App Logo Emblem
                                Opacity(
                                  opacity: _logoOpacity.value,
                                  child: Transform.scale(
                                    scale: _logoScale.value,
                                    child: Container(
                                      width: 172,
                                      height: 172,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        boxShadow: [
                                          BoxShadow(
                                            color: const Color(0xFF0284C7).withValues(
                                              alpha: isDark ? 0.35 : 0.18,
                                            ),
                                            blurRadius: 36,
                                            spreadRadius: 2,
                                            offset: const Offset(0, 6),
                                          ),
                                        ],
                                      ),
                                      child: Image.asset(
                                        'assets/icon/app_logo.png',
                                        width: 172,
                                        height: 172,
                                        fit: BoxFit.contain,
                                        filterQuality: FilterQuality.high,
                                      ),
                                    ),
                                  ),
                                ),

                                const SizedBox(height: 24),

                                // Animated App Name & Subtitle
                                SlideTransition(
                                  position: _textSlide,
                                  child: Opacity(
                                    opacity: _textOpacity.value,
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          'PSC TIPS & TRICKS',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            fontSize: 20,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 1.8,
                                            decoration: TextDecoration.none,
                                            color: isDark
                                                ? Colors.white
                                                : const Color(0xFF0F172A),
                                            fontFamily: 'Inter',
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          'Kerala PSC · SSC · UPSC Preparation',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            letterSpacing: 0.8,
                                            decoration: TextDecoration.none,
                                            color: isDark
                                                ? AppColors.darkTextMuted
                                                : AppColors.lightTextMuted,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
