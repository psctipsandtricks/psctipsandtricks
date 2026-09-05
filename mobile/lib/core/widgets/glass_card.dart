import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_colors.dart';
import '../theme/app_glass.dart';
import '../theme/app_theme.dart';
import 'liquid_glass.dart';

/// The app's primary surface — a Liquid Glass pane with a rim light, a short
/// spring under the finger, and an optional accent bloom for the featured
/// state. The name is kept from the first version of the app because it is
/// used on every screen; the rendering now comes from [LiquidGlass].
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.padding = const EdgeInsets.all(16),
    this.borderRadius = AppTheme.radiusLg,
    this.borderColor,
    this.accentColor,
    this.highlighted = false,
    this.enablePressScale = true,
    this.blurSigma = AppGlass.blurCard,
    this.intensity = 1.15,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final Color? borderColor;

  /// Washes the pane with a colour of the caller's choosing — how a card says
  /// which category, tier or state it belongs to without a second badge.
  /// [highlighted] is the cyan shorthand for the same thing.
  final Color? accentColor;

  /// Draws the cyan accent rim and bloom used for the selected or featured
  /// state.
  final bool highlighted;

  /// Enables the subtle spring scale effect when tapped.
  final bool enablePressScale;

  /// Backdrop blur for this pane; 0 keeps the tint and rim without the cost.
  final double blurSigma;

  /// Opacity multiplier for the glass wash. The default already leans dense,
  /// because a card is usually the thing being read rather than the thing
  /// being looked through.
  final double intensity;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(borderRadius);
    final accent = accentColor ?? (highlighted ? AppColors.cyan : null);
    final border = borderColor ??
        (highlighted ? AppColors.cyan.withValues(alpha: 0.60) : null);

    final pane = onTap == null && onLongPress == null
        ? LiquidGlass(
            borderRadius: radius,
            blurSigma: blurSigma,
            intensity: intensity,
            accent: accent,
            borderColor: border,
            borderWidth: highlighted ? 1.4 : 1.0,
            padding: padding,
            child: child,
          )
        : LiquidGlassTappable(
            onTap: onTap,
            onLongPress: onLongPress,
            borderRadius: radius,
            blurSigma: blurSigma,
            intensity: intensity,
            accent: accent,
            borderColor: border,
            borderWidth: highlighted ? 1.4 : 1.0,
            padding: padding,
            pressScale: enablePressScale ? 0.985 : 1.0,
            child: child,
          );

    return pane;
  }

}

/// A short, uppercase eyebrow label — the site's `Badge` component.
class AppBadge extends StatelessWidget {
  const AppBadge(
    this.label, {
    super.key,
    this.color = AppColors.cyan,
    this.icon,
    this.filled = false,
    this.compact = false,
  });

  final String label;
  final Color color;
  final IconData? icon;
  final bool filled;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final fg = filled ? Colors.white : color;
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? (icon == null ? 7 : 6) : (icon == null ? 9 : 8),
        vertical: compact ? 2.5 : 4,
      ),
      decoration: BoxDecoration(
        color: filled ? color : color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border.all(
          color: color.withValues(alpha: filled ? 1.0 : 0.32),
          width: 0.9,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: compact ? 10.5 : 12, color: fg),
            SizedBox(width: compact ? 3 : 4.5),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: fg,
                    fontWeight: FontWeight.w800,
                    fontSize: compact ? 9.5 : 11,
                    letterSpacing: 0.3,
                    height: 1.1,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Primary call to action, carrying the brand's cyan→indigo sweep or gold sweep.
class GradientButton extends StatefulWidget {
  const GradientButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.isLoading = false,
    this.gradient = AppColors.brandGradient,
    this.textColor,
    this.iconColor,
    this.shadowColor,
    this.expand = true,
    this.compact = false,
    this.height,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final Gradient gradient;
  final Color? textColor;
  final Color? iconColor;
  final Color? shadowColor;
  final bool expand;
  final bool compact;
  final double? height;

  @override
  State<GradientButton> createState() => _GradientButtonState();
}

class _GradientButtonState extends State<GradientButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null && !widget.isLoading;
    final radius = BorderRadius.circular(AppTheme.radiusMd);
    final isGold = widget.gradient == AppColors.goldGradient;

    final resolvedTextColor = widget.textColor ??
        (isGold ? const Color(0xFF090D16) : Colors.white);
    final resolvedIconColor = widget.iconColor ??
        (isGold ? const Color(0xFF090D16) : Colors.white);
    final resolvedShadowColor = widget.shadowColor ??
        (isGold
            ? const Color(0xFFF59E0B).withValues(alpha: 0.40)
            : AppColors.cyan.withValues(alpha: 0.28));

    return AnimatedScale(
      duration: const Duration(milliseconds: 100),
      scale: _isPressed && enabled ? 0.975 : 1.0,
      curve: Curves.easeOutCubic,
      child: Opacity(
        opacity: enabled ? 1.0 : 0.55,
        child: Container(
          height: widget.height,
          decoration: BoxDecoration(
            gradient: widget.gradient,
            borderRadius: radius,
            border: Border.all(
              color: Colors.white.withValues(alpha: isGold ? 0.35 : 0.22),
              width: 1,
            ),
            boxShadow: enabled
                ? [
                    BoxShadow(
                      color: resolvedShadowColor,
                      blurRadius: 16,
                      offset: const Offset(0, 5),
                    ),
                  ]
                : null,
          ),
          child: Material(
            color: Colors.transparent,
            borderRadius: radius,
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: enabled
                  ? () {
                      HapticFeedback.lightImpact();
                      widget.onPressed!();
                    }
                  : null,
              onTapDown: (_) {
                if (enabled) setState(() => _isPressed = true);
              },
              onTapUp: (_) {
                if (enabled) setState(() => _isPressed = false);
              },
              onTapCancel: () {
                if (enabled) setState(() => _isPressed = false);
              },
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: widget.compact ? 16 : 22,
                  vertical: widget.compact ? 10 : 14,
                ),
                child: Row(
                  mainAxisSize:
                      widget.expand ? MainAxisSize.max : MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (widget.isLoading)
                      SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.2,
                          color: resolvedTextColor,
                        ),
                      )
                    else if (widget.icon != null)
                      Icon(
                        widget.icon,
                        size: widget.compact ? 16 : 19,
                        color: resolvedIconColor,
                      ),
                    if (widget.isLoading || widget.icon != null)
                      const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        widget.label,
                        overflow: TextOverflow.ellipsis,
                        style:
                            Theme.of(context).textTheme.labelLarge?.copyWith(
                                  color: resolvedTextColor,
                                  fontWeight: FontWeight.w900,
                                  fontSize: widget.compact ? 13 : 15,
                                  letterSpacing: -0.2,
                                ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

