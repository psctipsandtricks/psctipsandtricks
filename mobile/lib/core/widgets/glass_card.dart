import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// The app's primary surface — the native counterpart of the website's
/// `.glass-card`: a soft panel with a hairline border, smooth micro-animation
/// on press, and ambient glow.
class GlassCard extends StatefulWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.padding = const EdgeInsets.all(16),
    this.borderRadius = AppTheme.radiusLg,
    this.borderColor,
    this.color,
    this.highlighted = false,
    this.enablePressScale = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final Color? borderColor;
  final Color? color;

  /// Draws the cyan accent border used for the selected or featured state.
  final bool highlighted;

  /// Enables subtle spring scale effect when tapped.
  final bool enablePressScale;

  @override
  State<GlassCard> createState() => _GlassCardState();
}

class _GlassCardState extends State<GlassCard> {
  bool _isPressed = false;

  void _handleTapDown(TapDownDetails _) {
    if (widget.onTap != null && widget.enablePressScale) {
      setState(() => _isPressed = true);
    }
  }

  void _handleTapUp(TapUpDetails _) {
    if (widget.enablePressScale && _isPressed) {
      setState(() => _isPressed = false);
    }
  }

  void _handleTapCancel() {
    if (widget.enablePressScale && _isPressed) {
      setState(() => _isPressed = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final radius = BorderRadius.circular(widget.borderRadius);
    final border = widget.borderColor ??
        (widget.highlighted
            ? AppColors.cyan.withValues(alpha: 0.60)
            : palette.border);

    return AnimatedScale(
      duration: const Duration(milliseconds: 120),
      scale: _isPressed ? 0.985 : 1.0,
      curve: Curves.easeOutCubic,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: widget.color ?? palette.card,
          borderRadius: radius,
          border: Border.all(
            color: border,
            width: widget.highlighted ? 1.4 : 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: palette.isDark
                  ? Colors.black.withValues(alpha: widget.highlighted ? 0.45 : 0.28)
                  : const Color(0xFF0F172A).withValues(alpha: 0.05),
              blurRadius: palette.isDark ? 16 : 12,
              offset: const Offset(0, 4),
            ),
            if (widget.highlighted)
              BoxShadow(
                color: AppColors.cyan.withValues(alpha: 0.12),
                blurRadius: 18,
                spreadRadius: 1,
              ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: radius,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: widget.onTap != null
                ? () {
                    HapticFeedback.selectionClick();
                    widget.onTap!();
                  }
                : null,
            onLongPress: widget.onLongPress,
            onTapDown: _handleTapDown,
            onTapUp: _handleTapUp,
            onTapCancel: _handleTapCancel,
            splashColor: AppColors.cyan.withValues(alpha: 0.08),
            highlightColor: AppColors.cyan.withValues(alpha: 0.04),
            borderRadius: radius,
            child: Padding(
              padding: widget.padding,
              child: widget.child,
            ),
          ),
        ),
      ),
    );
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

/// Primary call to action, carrying the brand's cyan→indigo sweep.
class GradientButton extends StatefulWidget {
  const GradientButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.isLoading = false,
    this.gradient = AppColors.brandGradient,
    this.expand = true,
    this.compact = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final Gradient gradient;
  final bool expand;
  final bool compact;

  @override
  State<GradientButton> createState() => _GradientButtonState();
}

class _GradientButtonState extends State<GradientButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null && !widget.isLoading;
    final radius = BorderRadius.circular(AppTheme.radiusMd);

    return AnimatedScale(
      duration: const Duration(milliseconds: 100),
      scale: _isPressed && enabled ? 0.975 : 1.0,
      curve: Curves.easeOutCubic,
      child: Opacity(
        opacity: enabled ? 1.0 : 0.55,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: widget.gradient,
            borderRadius: radius,
            boxShadow: enabled
                ? [
                    BoxShadow(
                      color: AppColors.cyan.withValues(alpha: 0.28),
                      blurRadius: 14,
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
                  mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (widget.isLoading)
                      const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    else if (widget.icon != null)
                      Icon(widget.icon,
                          size: widget.compact ? 16 : 18, color: Colors.white),
                    if (widget.isLoading || widget.icon != null)
                      const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        widget.label,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: widget.compact ? 13 : 14.5,
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
