import 'package:flutter/material.dart';
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
/// ambient glow, matching the website's auth pages.
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

    return Scaffold(
      body: Stack(
        children: [
          // Ambient mesh glow — the native stand-in for the site's layered
          // radial gradients.
          const Positioned(
            top: -140,
            left: -90,
            child: _Glow(color: AppColors.cyan, size: 320),
          ),
          const Positioned(
            top: 40,
            right: -120,
            child: _Glow(color: AppColors.indigo, size: 280),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(22, 28, 22, 32),
                child: Responsive.centered(
                  maxWidth: Responsive.maxFormWidth,
                  alignment: Alignment.center,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _BrandMark(),
                      const SizedBox(height: 30),
                      Text(
                        title,
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.6,
                            ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: palette.textSecondary,
                              height: 1.5,
                            ),
                      ),
                      const SizedBox(height: 26),
                      child,
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 50,
          height: 50,
          padding: const EdgeInsets.all(1.5),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: const Color(0xFF38BDF8).withValues(alpha: 0.40),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.cyan.withValues(alpha: 0.32),
                blurRadius: 16,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: ClipOval(
            child: Image.asset(
              'assets/icon/app_logo.png',
              width: 48,
              height: 48,
              fit: BoxFit.contain,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'PSC Tips And Tricks',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.4,
                    ),
              ),
              Text(
                'Kerala PSC · SSC · UPSC',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: context.palette.textMuted,
                      letterSpacing: 0.6,
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
  const _Glow({required this.color, required this.size});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [color.withValues(alpha: 0.20), color.withValues(alpha: 0)],
          ),
        ),
      ),
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
  });

  final VoidCallback onGoogle;
  final VoidCallback onApple;
  final String? busyProvider;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _SocialButton(
            label: 'Google',
            icon: Icons.g_mobiledata_rounded,
            iconSize: 30,
            onTap: onGoogle,
            busy: busyProvider == 'google',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _SocialButton(
            label: 'Apple',
            icon: Icons.apple_rounded,
            onTap: onApple,
            busy: busyProvider == 'apple',
          ),
        ),
      ],
    );
  }
}

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.label,
    required this.icon,
    required this.onTap,
    required this.busy,
    this.iconSize = 20,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool busy;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: busy ? null : onTap,
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 13),
      ),
      child: busy
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: iconSize),
                const SizedBox(width: 7),
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
