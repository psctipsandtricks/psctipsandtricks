import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/responsive.dart';

/// Navigates to wherever the student should land after signing in.
///
/// `redirect` comes from a protected route's query string (`_protectedPrefixes`
/// in app_router.dart) — a plain `context.go(redirect)` would make that page
/// the new stack root, leaving it with no Back and no Home underneath, so its
/// app bar's automatic back button silently disappears. Re-establishing Home
/// first, then pushing the actual destination on top, keeps Back working
/// exactly as if the student had reached it by tapping through from Home.
void goAfterAuth(BuildContext context, String? redirect) {
  context.go(AppRoutes.home);
  if (redirect != null && redirect != AppRoutes.home) {
    context.push(redirect);
  }
}

/// Shared chrome for the sign-in and sign-up screens: the brand mark over an
/// ambient glow and frosted glass container, matching the website's cyber-glass design.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;

    // Adaptive theme colors
    final bgGradient = isDark
        ? const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF050A18),
              Color(0xFF081026),
              Color(0xFF040814),
            ],
          )
        : const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFF8FAFC),
              Color(0xFFEFF6FF),
              Color(0xFFF1F5F9),
            ],
          );

    final cardBg = isDark
        ? const Color(0xFF0C1630).withValues(alpha: 0.72)
        : Colors.white.withValues(alpha: 0.84);

    final cardBorder = isDark
        ? Border.all(
            color: const Color(0xFF38BDF8).withValues(alpha: 0.22),
            width: 1.2,
          )
        : Border.all(
            color: Colors.white.withValues(alpha: 0.95),
            width: 1.5,
          );

    final cardShadow = isDark
        ? [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.45),
              blurRadius: 36,
              offset: const Offset(0, 16),
            ),
            BoxShadow(
              color: AppColors.cyan.withValues(alpha: 0.08),
              blurRadius: 28,
              offset: const Offset(0, 4),
            ),
          ]
        : [
            BoxShadow(
              color: const Color(0xFF0F172A).withValues(alpha: 0.07),
              blurRadius: 32,
              offset: const Offset(0, 12),
            ),
            BoxShadow(
              color: const Color(0xFF38BDF8).withValues(alpha: 0.08),
              blurRadius: 20,
              offset: const Offset(0, 4),
            ),
          ];

    return Scaffold(
      backgroundColor: palette.background,
      body: DecoratedBox(
        decoration: BoxDecoration(gradient: bgGradient),
        child: Stack(
          children: [
            // ── Luminous Ambient Orbs (Adaptive for Light & Dark) ───────
            Positioned(
              top: -120,
              left: -80,
              child: _Glow(
                color: isDark ? AppColors.cyan : const Color(0xFF38BDF8),
                size: 340,
                opacity: isDark ? 0.32 : 0.28,
              ),
            ),
            Positioned(
              top: 140,
              right: -100,
              child: _Glow(
                color: isDark ? AppColors.indigo : const Color(0xFF818CF8),
                size: 300,
                opacity: isDark ? 0.26 : 0.22,
              ),
            ),
            Positioned(
              bottom: -60,
              left: 40,
              child: _Glow(
                color: isDark ? AppColors.sky : const Color(0xFF06B6D4),
                size: 260,
                opacity: isDark ? 0.20 : 0.16,
              ),
            ),

            // ── Main Centered Frosted Glass Content ─────────────────────
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                  child: Responsive.centered(
                    maxWidth: Responsive.maxFormWidth,
                    alignment: Alignment.center,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(26),
                      child: BackdropFilter(
                        filter: ui.ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                        child: Container(
                          padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
                          decoration: BoxDecoration(
                            color: cardBg,
                            borderRadius: BorderRadius.circular(26),
                            border: cardBorder,
                            boxShadow: cardShadow,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const _BrandMark(),
                              const SizedBox(height: 24),
                              Text(
                                title,
                                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: -0.6,
                                      color: palette.textPrimary,
                                    ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                subtitle,
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                      color: palette.textSecondary,
                                      height: 1.45,
                                    ),
                              ),
                              const SizedBox(height: 24),
                              child,
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;

    return Row(
      children: [
        Container(
          width: 52,
          height: 52,
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF38BDF8), Color(0xFF6366F1)],
            ),
            boxShadow: [
              BoxShadow(
                color: (isDark ? AppColors.cyan : const Color(0xFF38BDF8))
                    .withValues(alpha: isDark ? 0.38 : 0.25),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDark ? const Color(0xFF0B1428) : Colors.white,
            ),
            padding: const EdgeInsets.all(2),
            child: ClipOval(
              child: Image.asset(
                'assets/icon/app_logo.png',
                width: 44,
                height: 44,
                fit: BoxFit.contain,
              ),
            ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'PSC Tips And Tricks',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.4,
                      color: palette.textPrimary,
                    ),
              ),
              const SizedBox(height: 3),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: (isDark ? AppColors.cyan : AppColors.blue)
                      .withValues(alpha: isDark ? 0.12 : 0.08),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'KERALA PSC · SSC · UPSC',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: isDark ? AppColors.cyan : const Color(0xFF0284C7),
                        fontWeight: FontWeight.w700,
                        fontSize: 10,
                        letterSpacing: 0.6,
                      ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Glow extends StatelessWidget {
  const _Glow({
    required this.color,
    required this.size,
    this.opacity = 0.24,
  });

  final Color color;
  final double size;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color.withValues(alpha: opacity),
              color.withValues(alpha: 0),
            ],
          ),
        ),
      ),
    );
  }
}

/// Google 4-color authentic logo icon.
class GoogleLogo extends StatelessWidget {
  const GoogleLogo({super.key, this.size = 20});

  final double size;

  static const String _svg = '''
<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
</svg>
''';

  @override
  Widget build(BuildContext context) {
    return SvgPicture.string(
      _svg,
      width: size,
      height: size,
    );
  }
}

/// Google / Apple buttons, shown only while the corresponding provider is
/// configured on the backend. A provider that is not set up returns 404 from
/// `/auth/:provider`, which surfaces as an in-sheet error rather than a crash.
class SocialSignInRow extends StatelessWidget {
  const SocialSignInRow({
    super.key,
    required this.onGoogle,
    required this.onApple,
    this.busyProvider,
    this.disabled = false,
  });

  final VoidCallback? onGoogle;
  final VoidCallback? onApple;
  final String? busyProvider;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final isGoogleBusy = busyProvider == 'google';
    final isAppleBusy = busyProvider == 'apple';
    final anyBusy = busyProvider != null;

    return Row(
      children: [
        Expanded(
          child: _SocialButton(
            label: 'Google',
            customIcon: const GoogleLogo(size: 19),
            onTap: onGoogle,
            busy: isGoogleBusy,
            disabled: disabled || anyBusy,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _SocialButton(
            label: 'Apple',
            icon: Icons.apple_rounded,
            iconSize: 22,
            onTap: onApple,
            busy: isAppleBusy,
            disabled: disabled || anyBusy,
          ),
        ),
      ],
    );
  }
}

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.label,
    this.icon,
    this.customIcon,
    required this.onTap,
    required this.busy,
    this.disabled = false,
    this.iconSize = 20,
  });

  final String label;
  final IconData? icon;
  final Widget? customIcon;
  final VoidCallback? onTap;
  final bool busy;
  final bool disabled;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;
    final effectiveDisabled = busy || disabled || onTap == null;

    return OutlinedButton(
      onPressed: effectiveDisabled ? null : onTap,
      style: OutlinedButton.styleFrom(
        backgroundColor: isDark
            ? const Color(0xFF111D38).withValues(alpha: 0.65)
            : Colors.white.withValues(alpha: 0.88),
        foregroundColor: palette.textPrimary,
        side: BorderSide(
          color: isDark
              ? const Color(0xFF38BDF8).withValues(alpha: 0.22)
              : const Color(0xFFCBD5E1),
          width: 1.1,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        elevation: isDark ? 0 : 1,
        shadowColor: Colors.black.withValues(alpha: 0.05),
        padding: const EdgeInsets.symmetric(vertical: 13),
      ),
      child: busy
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (customIcon != null)
                  customIcon!
                else if (icon != null)
                  Icon(icon, size: iconSize),
                const SizedBox(width: 8),
                Text(label),
              ],
            ),
    );
  }
}

/// "or" rule between the credential form and the social buttons.
class AuthDivider extends StatelessWidget {
  const AuthDivider({super.key});

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Row(
      children: [
        Expanded(child: Divider(color: palette.border)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            'or continue with',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: palette.textMuted,
                ),
          ),
        ),
        Expanded(child: Divider(color: palette.border)),
      ],
    );
  }
}
