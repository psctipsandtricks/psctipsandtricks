import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Design tokens for the app's Liquid Glass language.
///
/// Every translucent surface — bars, docks, cards, sheets, pills — resolves its
/// blur, tint, edge light and shadow from here, so a change made once lands on
/// every screen at the same time.
class AppGlass {
  const AppGlass._();

  // ── Blur ramp ──────────────────────────────────────────────────────────
  // Sigmas climb with how much the surface is meant to detach from what sits
  // behind it. Cards stay cheap because a list can hold many of them at once;
  // bars and sheets can afford more because there is only ever one on screen.
  static const double blurCard = 9;
  static const double blurRaised = 14;
  static const double blurBar = 22;
  static const double blurSheet = 30;

  /// Master switch. Turning this off drops every `BackdropFilter` in the app
  /// and leaves the tint, edge light and shadow in place, which keeps the look
  /// recognisable on hardware that cannot afford the sampling cost.
  static bool blurEnabled = true;

  /// The same, scoped to list-scale surfaces (cards, tiles, chips). Bars and
  /// sheets keep their blur even when this is off.
  static bool cardBlurEnabled = true;

  /// Glass reads as glass partly because it pushes colour, not only because it
  /// is soft — the backdrop is saturated to 1.28 before it is blurred.

  /// A plain blur, with none of the colour work. Used by the layers of a
  /// graded surface: saturation applied once is glass, applied four times over
  /// is a poster paint effect.
  static ui.ImageFilter blurOnly(double sigma) => ui.ImageFilter.blur(
        sigmaX: sigma,
        sigmaY: sigma,
        tileMode: TileMode.decal,
      );

  /// Backdrop filter for a surface at [sigma]: saturate, then blur.
  static ui.ImageFilter filter(double sigma) {
    return ui.ImageFilter.compose(
      outer: const ColorFilter.matrix(_saturationMatrix),
      inner: ui.ImageFilter.blur(
        sigmaX: sigma,
        sigmaY: sigma,
        tileMode: TileMode.decal,
      ),
    );
  }

  // The saturation matrix, expanded so it stays a compile-time
  // constant (luminance weights 0.2126 / 0.7152 / 0.0722).
  static const List<double> _saturationMatrix = <double>[
    1.22036, -0.20020, -0.02016, 0, 0, //
    -0.05964, 1.07980, -0.02016, 0, 0, //
    -0.05964, -0.20020, 1.25984, 0, 0, //
    0, 0, 0, 1, 0, //
  ];

  /// Whether this context should paint real blur: honours the master switch and
  /// steps aside for anyone who has asked the system to reduce motion/effects.
  static bool blursIn(BuildContext context, {bool card = false}) {
    if (!blurEnabled) return false;
    if (card && !cardBlurEnabled) return false;
    return !MediaQuery.disableAnimationsOf(context);
  }
}

/// The resolved colours of one glass surface for the active theme.
@immutable
class GlassTint {
  const GlassTint({
    required this.fillTop,
    required this.fillBottom,
    required this.edgeBright,
    required this.edgeDim,
    required this.sheen,
    required this.shadow,
  });

  /// Body of the pane — a vertical wash rather than a flat fill, so the surface
  /// has a direction the light can come from.
  final Color fillTop;
  final Color fillBottom;

  /// Rim light: bright where the light lands, dim on the shadow side.
  final Color edgeBright;
  final Color edgeDim;

  /// Specular highlight laid over the top edge.
  final Color sheen;

  final Color shadow;

  /// Resolves the tint for [palette], scaled by [intensity] (1.0 = standard
  /// pane, >1 pushes the glass more opaque for text-heavy surfaces).
  static GlassTint of(AppPalette palette, {double intensity = 1.0}) {
    final i = intensity.clamp(0.0, 2.0);
    if (palette.isDark) {
      return GlassTint(
        fillTop: Color.lerp(
          AppColors.darkElevated.withValues(alpha: 0.62 * i),
          Colors.white.withValues(alpha: 0.10 * i),
          0.22,
        )!,
        fillBottom: AppColors.darkCard.withValues(alpha: (0.58 * i).clamp(0, 1)),
        edgeBright: Colors.white.withValues(alpha: (0.22 * i).clamp(0, 1)),
        edgeDim: Colors.white.withValues(alpha: (0.05 * i).clamp(0, 1)),
        sheen: Colors.white.withValues(alpha: (0.10 * i).clamp(0, 1)),
        shadow: Colors.black.withValues(alpha: 0.42),
      );
    }
    return GlassTint(
      fillTop: Colors.white.withValues(alpha: (0.78 * i).clamp(0, 1)),
      fillBottom: Colors.white.withValues(alpha: (0.60 * i).clamp(0, 1)),
      edgeBright: Colors.white.withValues(alpha: (0.95 * i).clamp(0, 1)),
      edgeDim: const Color(0xFF0F172A).withValues(alpha: (0.10 * i).clamp(0, 1)),
      sheen: Colors.white.withValues(alpha: (0.55 * i).clamp(0, 1)),
      shadow: const Color(0xFF0F172A).withValues(alpha: 0.10),
    );
  }
}
