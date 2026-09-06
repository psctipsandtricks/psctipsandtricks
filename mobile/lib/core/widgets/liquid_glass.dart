import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../router/app_router.dart';
import '../theme/app_colors.dart';
import '../theme/app_glass.dart';
import '../theme/app_theme.dart';

/// The single translucent pane every other glass component is built from.
///
/// A pane is four layers, painted bottom to top:
///
///  1. a saturating blur of whatever is behind it,
///  2. a vertical tint wash, so the pane has a light direction,
///  3. a specular sheen hugging the top edge,
///  4. a rim light — a gradient hairline that fakes the way a real bevel
///     catches light on one side and falls away on the other.
///
/// Blur is the expensive layer, so it is the one that gets switched off first:
/// [AppGlass.blurEnabled] / [AppGlass.cardBlurEnabled] and the platform's
/// reduce-animations setting all drop it while leaving the look intact.
class LiquidGlass extends StatelessWidget {
  const LiquidGlass({
    super.key,
    required this.child,
    this.borderRadius = const BorderRadius.all(
      Radius.circular(AppTheme.radiusLg),
    ),
    this.blurSigma = AppGlass.blurCard,
    this.intensity = 1.0,
    this.accent,
    this.borderColor,
    this.borderWidth = 1.0,
    this.padding = EdgeInsets.zero,
    this.margin,
    this.elevation = 1.0,
    this.sheen = true,
    this.isCardScale = true,
    this.tint,
  });

  final Widget child;
  final BorderRadius borderRadius;
  final double blurSigma;

  /// Opacity multiplier for the tint wash. Push above 1 behind long-form text.
  final double intensity;

  /// Optional coloured bloom in the pane — the selected / featured state.
  final Color? accent;

  /// Overrides the resolved rim light with a flat colour.
  final Color? borderColor;
  final double borderWidth;

  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;

  /// Drop-shadow multiplier; 0 removes the shadow entirely.
  final double elevation;

  final bool sheen;

  /// Whether this pane counts against the card blur budget. Bars, docks and
  /// sheets pass false so they keep their blur when cards give theirs up.
  final bool isCardScale;

  /// Pre-resolved colours; defaults to [GlassTint.of] for the active palette.
  final GlassTint? tint;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final t = tint ?? GlassTint.of(palette, intensity: intensity);
    final blurs = blurSigma > 0 && AppGlass.blursIn(context, card: isCardScale);

    Widget pane = Stack(
      fit: StackFit.passthrough,
      children: [
        // 1 — the refracted backdrop.
        if (blurs)
          Positioned.fill(
            child: BackdropFilter(
              filter: AppGlass.filter(blurSigma),
              child: const SizedBox.expand(),
            ),
          ),

        // 2 — the body wash.
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [t.fillTop, t.fillBottom],
              ),
            ),
          ),
        ),

        // 3 — accent bloom for the highlighted state.
        if (accent != null)
          Positioned.fill(
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(-0.6, -1.0),
                    radius: 1.5,
                    colors: [
                      accent!.withValues(alpha: palette.isDark ? 0.20 : 0.14),
                      accent!.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
          ),

        // 4 — specular sheen + rim light.
        Positioned.fill(
          child: IgnorePointer(
            child: CustomPaint(
              painter: _GlassEdgePainter(
                radius: borderRadius,
                bright: borderColor ?? t.edgeBright,
                dim: borderColor ?? t.edgeDim,
                sheen: sheen ? t.sheen : Colors.transparent,
                strokeWidth: borderWidth,
              ),
            ),
          ),
        ),

        Padding(padding: padding, child: child),
      ],
    );

    pane = ClipRRect(
      borderRadius: borderRadius,
      clipBehavior: Clip.antiAlias,
      child: pane,
    );

    if (elevation > 0) {
      pane = DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: borderRadius,
          boxShadow: [
            BoxShadow(
              color: t.shadow.withValues(
                alpha: (t.shadow.a * elevation).clamp(0.0, 1.0),
              ),
              blurRadius: 18 * elevation,
              offset: Offset(0, 6 * elevation),
            ),
            if (accent != null)
              BoxShadow(
                color: accent!.withValues(alpha: 0.16 * elevation),
                blurRadius: 22 * elevation,
                spreadRadius: 1,
              ),
          ],
        ),
        child: pane,
      );
    }

    if (margin != null) {
      pane = Padding(padding: margin!, child: pane);
    }
    return pane;
  }
}

/// Paints the sheen band and the two-tone hairline that give a pane its bevel.
class _GlassEdgePainter extends CustomPainter {
  const _GlassEdgePainter({
    required this.radius,
    required this.bright,
    required this.dim,
    required this.sheen,
    required this.strokeWidth,
  });

  final BorderRadius radius;
  final Color bright;
  final Color dim;
  final Color sheen;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;

    // The sheen: a short wash off the top edge, strongest at the very top and
    // gone within the first fifth of the pane.
    if (sheen.a > 0) {
      final sheenRect = Rect.fromLTWH(
        0,
        0,
        size.width,
        (size.height * 0.42).clamp(0.0, 64.0),
      );
      canvas.drawRRect(
        radius.toRRect(rect),
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [sheen, sheen.withValues(alpha: 0)],
          ).createShader(sheenRect),
      );
    }

    // The rim: bright along the top-left arc, falling to the shadow side.
    final inset = strokeWidth / 2;
    final border = radius.toRRect(rect.deflate(inset));
    canvas.drawRRect(
      border,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [bright, dim, dim],
          stops: const [0.0, 0.55, 1.0],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(_GlassEdgePainter old) =>
      old.radius != radius ||
      old.bright != bright ||
      old.dim != dim ||
      old.sheen != sheen ||
      old.strokeWidth != strokeWidth;
}

/// A glass pane that answers the touch: it dips under the finger and lifts back
/// with a short spring, the way a physical button would.
class LiquidGlassTappable extends StatefulWidget {
  const LiquidGlassTappable({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.borderRadius = const BorderRadius.all(
      Radius.circular(AppTheme.radiusLg),
    ),
    this.blurSigma = AppGlass.blurCard,
    this.intensity = 1.0,
    this.accent,
    this.borderColor,
    this.borderWidth = 1.0,
    this.padding = EdgeInsets.zero,
    this.elevation = 1.0,
    this.pressScale = 0.985,
    this.isCardScale = true,
    this.haptics = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final BorderRadius borderRadius;
  final double blurSigma;
  final double intensity;
  final Color? accent;
  final Color? borderColor;
  final double borderWidth;
  final EdgeInsetsGeometry padding;
  final double elevation;
  final double pressScale;
  final bool isCardScale;
  final bool haptics;

  @override
  State<LiquidGlassTappable> createState() => _LiquidGlassTappableState();
}

class _LiquidGlassTappableState extends State<LiquidGlassTappable> {
  bool _pressed = false;

  void _set(bool value) {
    if (widget.onTap == null || _pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.disableAnimationsOf(context);
    final down = _pressed && !still;

    return AnimatedScale(
      duration: const Duration(milliseconds: 140),
      curve: Curves.easeOutCubic,
      scale: down ? widget.pressScale : 1.0,
      child: LiquidGlass(
        borderRadius: widget.borderRadius,
        blurSigma: widget.blurSigma,
        // Pressing brightens the pane a touch — glass catching more light as it
        // tilts toward you.
        intensity: down ? widget.intensity * 1.12 : widget.intensity,
        accent: widget.accent,
        borderColor: widget.borderColor,
        borderWidth: widget.borderWidth,
        elevation: down ? widget.elevation * 0.6 : widget.elevation,
        isCardScale: widget.isCardScale,
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: widget.onTap == null
                ? null
                : () {
                    if (widget.haptics) HapticFeedback.selectionClick();
                    widget.onTap!();
                  },
            onLongPress: widget.onLongPress,
            onTapDown: (_) => _set(true),
            onTapUp: (_) => _set(false),
            onTapCancel: () => _set(false),
            splashColor: AppColors.cyan.withValues(alpha: 0.08),
            highlightColor: AppColors.cyan.withValues(alpha: 0.04),
            borderRadius: widget.borderRadius,
            child: Padding(padding: widget.padding, child: widget.child),
          ),
        ),
      ),
    );
  }
}

/// Circular glass control for bar actions — the top bar's search, inbox and
/// avatar buttons, and the reader's floating controls.
class GlassIconButton extends StatelessWidget {
  const GlassIconButton({
    super.key,
    required this.icon,
    required this.onTap,
    this.tooltip,
    this.size = 38,
    this.iconSize = 20,
    this.color,
    this.badgeCount = 0,
    this.accent,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String? tooltip;
  final double size;
  final double iconSize;
  final Color? color;
  final int badgeCount;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    Widget button = LiquidGlassTappable(
      onTap: onTap,
      borderRadius: BorderRadius.circular(size),
      blurSigma: AppGlass.blurRaised,
      intensity: 0.85,
      elevation: 0.5,
      accent: accent,
      isCardScale: false,
      pressScale: 0.9,
      child: SizedBox(
        width: size,
        height: size,
        child: Center(
          child: Icon(
            icon,
            size: iconSize,
            color: color ?? palette.textPrimary,
          ),
        ),
      ),
    );

    if (badgeCount > 0) {
      // The badge has to sit OUTSIDE the glass pane: LiquidGlassTappable clips
      // its child to a circle, so a badge nested within it gets sliced off.
      // Overlay it here with an unclipped Stack so the pill can overhang the rim.
      button = Stack(
        clipBehavior: Clip.none,
        children: [
          button,
          Positioned(
            top: -4,
            right: -4,
            child: _CountBadge(count: badgeCount),
          ),
        ],
      );
    }

    if (tooltip != null) {
      button = Tooltip(message: tooltip!, child: button);
    }
    return button;
  }
}

/// The rose count pill that overhangs a [GlassIconButton]. Kept as a pill (not a
/// bare dot) so the number stays readable; caps at "99+" so it never grows wide
/// enough to unbalance the bar.
class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final label = count > 99 ? '99+' : '$count';
    return Container(
      constraints: const BoxConstraints(minWidth: 18),
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 5),
      decoration: BoxDecoration(
        color: AppColors.rose,
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: context.palette.card, width: 2),
        boxShadow: [
          BoxShadow(
            color: AppColors.rose.withValues(alpha: 0.35),
            blurRadius: 6,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          height: 1.0,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

/// Small glass capsule — labels, counts, and the low-emphasis actions that sit
/// on top of artwork.
class GlassPill extends StatelessWidget {
  const GlassPill({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
    this.accent,
    this.blurSigma = AppGlass.blurRaised,
    this.intensity = 0.9,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color? accent;
  final double blurSigma;
  final double intensity;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(999);
    if (onTap == null) {
      return LiquidGlass(
        borderRadius: radius,
        blurSigma: blurSigma,
        intensity: intensity,
        accent: accent,
        elevation: 0.4,
        isCardScale: false,
        padding: padding,
        child: child,
      );
    }
    return LiquidGlassTappable(
      onTap: onTap,
      borderRadius: radius,
      blurSigma: blurSigma,
      intensity: intensity,
      accent: accent,
      elevation: 0.4,
      isCardScale: false,
      pressScale: 0.94,
      padding: padding,
      child: child,
    );
  }
}

/// The app-wide top bar: an ordinary [AppBar] with the chrome replaced by a
/// glass pane, so page content refracts through it as it scrolls past.
class GlassAppBar extends StatelessWidget implements PreferredSizeWidget {
  const GlassAppBar({
    super.key,
    this.title,
    this.actions,
    this.leading,
    this.bottom,
    this.titleSpacing,
    this.centerTitle,
    this.automaticallyImplyLeading = true,
    this.toolbarHeight = kToolbarHeight,
    this.foregroundColor,
    this.bottomRadius = 24,
    this.fallbackRoute,
    this.onBackPressed,
  });

  final Widget? title;
  final List<Widget>? actions;
  final Widget? leading;
  final PreferredSizeWidget? bottom;
  final double? titleSpacing;
  final bool? centerTitle;
  final bool automaticallyImplyLeading;
  final double toolbarHeight;
  final Color? foregroundColor;
  final double bottomRadius;
  final String? fallbackRoute;
  final VoidCallback? onBackPressed;

  String _defaultFallback(BuildContext context) {
    try {
      final location = GoRouterState.of(context).uri.path;
      if (location.startsWith('/books')) return AppRoutes.books;
      if (location.startsWith('/attempt') || location.startsWith('/quizzes')) return AppRoutes.quizzes;
      if (location.startsWith('/mock-tests')) return AppRoutes.mockTests;
      if (location.startsWith('/library')) return AppRoutes.library;
      if (location.startsWith('/community')) return AppRoutes.community;
      if (location.startsWith('/orders') || location.startsWith('/profile') || location.startsWith('/dashboard')) return AppRoutes.account;
      if (location.startsWith('/notifications')) return AppRoutes.home;
    } catch (_) {}
    return AppRoutes.home;
  }

  @override
  Size get preferredSize => Size.fromHeight(
        toolbarHeight + (bottom?.preferredSize.height ?? 0),
      );

  @override
  Widget build(BuildContext context) {
    final ModalRoute<dynamic>? parentRoute = ModalRoute.of(context);
    final bool canPop = parentRoute?.canPop ?? false;
    final bool hasDrawer = Scaffold.maybeOf(context)?.hasDrawer ?? false;

    bool isRootTab = false;
    try {
      final path = GoRouterState.of(context).uri.path;
      isRootTab = path == AppRoutes.home ||
          path == AppRoutes.books ||
          path == AppRoutes.quizzes ||
          path == AppRoutes.library ||
          path == AppRoutes.account;
    } catch (_) {}

    void handleBack() {
      if (onBackPressed != null) {
        onBackPressed!();
        return;
      }
      try {
        if (Navigator.of(context).canPop()) {
          Navigator.of(context).pop();
          return;
        }
      } catch (_) {}
      try {
        context.go(fallbackRoute ?? _defaultFallback(context));
      } catch (_) {
        try {
          Navigator.of(context).maybePop();
        } catch (_) {}
      }
    }

    Widget? effectiveLeading = leading;

    if (effectiveLeading == null && automaticallyImplyLeading) {
      if (!hasDrawer) {
        if (canPop || !isRootTab) {
          effectiveLeading = IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            tooltip: MaterialLocalizations.of(context).backButtonTooltip,
            onPressed: handleBack,
          );
        }
      }
    }

    final appBar = AppBar(
      title: title,
      actions: actions,
      leading: effectiveLeading,
      bottom: bottom,
      titleSpacing: titleSpacing,
      centerTitle: centerTitle,
      automaticallyImplyLeading: false,
      toolbarHeight: toolbarHeight,
      foregroundColor: foregroundColor,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      flexibleSpace: GlassBarSurface(bottomRadius: bottomRadius),
    );

    if (!isRootTab) {
      return PopScope(
        canPop: canPop,
        onPopInvokedWithResult: (didPop, _) {
          if (didPop) return;
          handleBack();
        },
        child: appBar,
      );
    }

    return appBar;
  }
}

/// The pane behind a top bar: square-cut sides, softened bottom corners, and a
/// hairline that reads as the edge of the glass rather than a divider.
class GlassBarSurface extends StatelessWidget {
  const GlassBarSurface({super.key, this.bottomRadius = 24});

  final double bottomRadius;

  @override
  Widget build(BuildContext context) {
    return LiquidGlass(
      borderRadius: BorderRadius.vertical(
        bottom: Radius.circular(bottomRadius),
      ),
      blurSigma: AppGlass.blurBar,
      intensity: 1.25,
      elevation: 0.5,
      isCardScale: false,
      child: const SizedBox.expand(),
    );
  }
}

/// The bar that floats on top of the home hero.
///
/// Unlike [GlassBarSurface] this pane has no edges — no bottom radius, no rim
/// light, no shadow. The whole glass layer, blur and tint together, is masked
/// by a vertical gradient so it thins to nothing before the artwork continues.
/// That is what stops the bar reading as a separate panel laid over the image:
/// there is no line, no corner and no colour step for the eye to catch on.
/// The bar that floats on top of the home hero.
///
/// Unlike [GlassBarSurface] it is a shape rather than a full-width band: the
/// bottom corners are curved, so it reads as a pane of glass resting on the
/// artwork with the cover continuing out from under it, instead of a strip cut
/// across the top of the page.
///
/// The wash still eases off towards that bottom edge — enough that the edge is
/// soft rather than a printed line, not so much that the curve disappears.
class GlassHeroBarSurface extends StatelessWidget {
  const GlassHeroBarSurface({super.key, this.contentFraction = 0.75});

  /// Where the bar's own rows end and the tail begins, as a fraction of the
  /// surface's height. Above it the glass has to hold text; below it it has
  /// only to disappear.
  final double contentFraction;

  /// The blur, in layers: each covers the top [coverage] of the surface at
  /// [sigma], so the sigmas compound upwards and thin out downwards.
  ///
  /// A single `BackdropFilter` cannot vary its blur across its own height, and
  /// one applied evenly would stop dead at the bottom edge — a seam straight
  /// across the artwork, which is the thing this surface exists to avoid.
  /// Stacking gets a gradient instead: about sigma 11 at the top of the bar,
  /// falling to 1.5 by the last row, which is too little to leave a mark on the
  /// cover it hands off to.
  static const List<(double coverage, double sigma)> _layers = [
    (1.00, 1.5),
    (0.82, 3.5),
    (0.62, 6.0),
    (0.42, 9.0),
  ];

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final blurs = AppGlass.blursIn(context);

    // The wash is the page's own colour rather than anything sampled from the
    // artwork: covers in this catalog are bright and wildly different from one
    // another, and only a consistent wash keeps the greeting and the shortcut
    // labels legible across all of them.
    final scrim = palette.isDark ? AppColors.darkBg : Colors.white;
    final dark = palette.isDark;

    return IgnorePointer(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final height = constraints.maxHeight;
          return Stack(
            fit: StackFit.expand,
            children: [
              if (blurs)
                for (final (coverage, sigma) in _layers)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: height * coverage,
                    // A `BackdropFilter` filters everything inside the clip it
                    // finds, not everything inside its own box — without one
                    // of its own, every layer here would blur the whole page.
                    child: ClipRect(
                      child: BackdropFilter(
                        // Only the layer spanning the whole surface carries the
                        // colour work; the rest are blur alone.
                        filter: coverage == 1.0
                            ? AppGlass.filter(sigma)
                            : AppGlass.blurOnly(sigma),
                        child: const SizedBox.expand(),
                      ),
                    ),
                  ),

              // Densest under the status bar and the greeting, thinning through
              // the shortcut strip, and gone by the bottom edge — so there is
              // no line for the artwork to run into, and no corner to catch.
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      scrim.withValues(alpha: dark ? 0.88 : 0.90),
                      scrim.withValues(alpha: dark ? 0.80 : 0.83),
                      scrim.withValues(alpha: dark ? 0.52 : 0.56),
                      scrim.withValues(alpha: 0.0),
                    ],
                    stops: [
                      0.0,
                      contentFraction * 0.62,
                      contentFraction,
                      1.0,
                    ],
                  ),
                ),
                child: const SizedBox.expand(),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// The pane a modal sheet rides on: square at the bottom of the screen, rounded
/// where it meets the page, and blurred hard enough that the screen behind it
/// reads as depth rather than clutter.
class GlassSheetSurface extends StatelessWidget {
  const GlassSheetSurface({super.key, required this.child, this.handle = true});

  final Widget child;

  /// Draws the drag handle. Sheets that already draw their own pass false.
  final bool handle;

  @override
  Widget build(BuildContext context) {
    return LiquidGlass(
      borderRadius: const BorderRadius.vertical(
        top: Radius.circular(AppTheme.radiusXl),
      ),
      blurSigma: AppGlass.blurSheet,
      // Sheets carry prices, answers and settings; the wash is pushed up so
      // none of that competes with whatever is behind the sheet.
      intensity: 1.45,
      elevation: 1.4,
      isCardScale: false,
      child: handle
          ? Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 10, bottom: 2),
                  child: Container(
                    width: 38,
                    height: 4,
                    decoration: BoxDecoration(
                      color: context.palette.textMuted.withValues(alpha: 0.45),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Flexible(child: child),
              ],
            )
          : child,
    );
  }
}

/// [showModalBottomSheet] on a [GlassSheetSurface]. Every sheet in the app goes
/// through here so they share one surface, one radius and one blur.
Future<T?> showGlassSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool isScrollControlled = true,
  bool isDismissible = true,
  bool enableDrag = true,
  bool useSafeArea = true,
  bool handle = true,
  bool useRootNavigator = true,
}) {
  return showModalBottomSheet<T>(
    context: context,
    useRootNavigator: useRootNavigator,
    isScrollControlled: isScrollControlled,
    isDismissible: isDismissible,
    enableDrag: enableDrag,
    useSafeArea: useSafeArea,
    backgroundColor: Colors.transparent,
    elevation: 0,
    builder: (context) => GlassSheetSurface(
      handle: handle,
      child: builder(context),
    ),
  );
}

/// The app's confirm dialog, on a glass pane: one question, one way back, one
/// way forward. Resolves true only when the confirming action is taken.
///
/// The whole screen frosts behind the pane while it is open, the icon sits in
/// its own glass medallion, and both actions are glass — a plain one back, a
/// gradient one forward. [icon] overrides the medallion glyph; without it a
/// warning glyph is used for [destructive] prompts and a question glyph
/// otherwise.
Future<bool> showGlassConfirm(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  String cancelLabel = 'Cancel',
  bool destructive = false,
  IconData? icon,
}) async {
  final accent = destructive ? AppColors.rose : AppColors.cyan;
  final glyph = icon ??
      (destructive ? Icons.warning_amber_rounded : Icons.help_outline_rounded);

  final result = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    // Lighter than a normal scrim: the backdrop blur below is doing most of the
    // work of setting the pane apart, so the tint only has to cool the screen.
    barrierColor: const Color(0xFF0B1220).withValues(alpha: 0.34),
    transitionDuration: const Duration(milliseconds: 220),
    transitionBuilder: (context, anim, _, child) {
      final t = CurvedAnimation(parent: anim, curve: Curves.easeOutCubic).value;
      return FadeTransition(
        opacity: anim,
        // A short rise from 0.92, no overshoot so nothing clips the rim glow.
        child: Transform.scale(scale: 0.92 + 0.08 * t, child: child),
      );
    },
    pageBuilder: (context, anim, __) {
      final palette = context.palette;
      final theme = Theme.of(context);
      final frosts = AppGlass.blursIn(context);
      return Stack(
        children: [
          // The whole screen frosts while the pane is open — the signature that
          // says a glass surface has come forward, not just a card.
          if (frosts)
            Positioned.fill(
              child: IgnorePointer(
                child: BackdropFilter(
                  filter: AppGlass.blurOnly(6),
                  child: const SizedBox.expand(),
                ),
              ),
            ),
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: LiquidGlass(
                  borderRadius: BorderRadius.circular(AppTheme.radiusXl),
                  blurSigma: AppGlass.blurSheet,
                  // Below 1.0 so the frosted screen still reads through the
                  // pane; the dark text stays legible on it regardless.
                  intensity: 0.92,
                  elevation: 2.6,
                  isCardScale: false,
                  // The rim carries the warning, not a pane-wide bloom: a wash
                  // across a surface this large tints the words being read.
                  borderColor: destructive
                      ? AppColors.rose.withValues(alpha: 0.42)
                      : null,
                  padding: const EdgeInsets.fromLTRB(22, 22, 22, 18),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // The glyph gets its own glass chip, accent-bloomed, so it
                      // reads as part of the same material as the pane.
                      LiquidGlass(
                        borderRadius: BorderRadius.circular(999),
                        blurSigma: AppGlass.blurRaised,
                        intensity: 0.85,
                        elevation: 0,
                        isCardScale: false,
                        accent: accent,
                        borderColor: accent.withValues(alpha: 0.35),
                        padding: const EdgeInsets.all(11),
                        child: Icon(glyph, color: accent, size: 24),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        title,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        message,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: palette.textSecondary,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Expanded(
                            child: LiquidGlassTappable(
                              onTap: () => Navigator.of(context).pop(false),
                              borderRadius:
                                  BorderRadius.circular(AppTheme.radiusLg),
                              blurSigma: AppGlass.blurRaised,
                              intensity: 0.9,
                              elevation: 0,
                              isCardScale: false,
                              pressScale: 0.97,
                              padding:
                                  const EdgeInsets.symmetric(vertical: 15),
                              child: Center(
                                child: Text(
                                  cancelLabel,
                                  style: theme.textTheme.labelLarge?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: palette.textPrimary,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _ConfirmActionButton(
                              label: confirmLabel,
                              destructive: destructive,
                              onTap: () => Navigator.of(context).pop(true),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      );
    },
  );
  return result ?? false;
}

/// The solid, forward action in [showGlassConfirm]: a gradient pill with a
/// coloured lift and a top sheen, so it reads as the committed choice and still
/// belongs to the same glassy material as the pane behind it.
class _ConfirmActionButton extends StatelessWidget {
  const _ConfirmActionButton({
    required this.label,
    required this.onTap,
    required this.destructive,
  });

  final String label;
  final VoidCallback onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(AppTheme.radiusLg);
    final glow = destructive ? AppColors.rose : AppColors.blue;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: [
          BoxShadow(
            color: glow.withValues(alpha: 0.34),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: radius,
          onTap: () {
            HapticFeedback.selectionClick();
            onTap();
          },
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: radius,
              gradient: destructive
                  ? const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFFFB5871), AppColors.rose],
                    )
                  : AppColors.brandGradient,
              border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
            ),
            child: Stack(
              children: [
                // A specular wash off the top edge — the same trick the glass
                // pane uses, so a solid button still catches light like glass.
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: radius,
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.white.withValues(alpha: 0.22),
                          Colors.white.withValues(alpha: 0.0),
                        ],
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  child: Center(
                    child: Text(
                      label,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: 0.1,
                          ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
