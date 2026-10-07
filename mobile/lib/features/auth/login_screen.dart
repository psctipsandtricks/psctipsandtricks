import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/supabase_auth_service.dart';
import '../../core/providers/auth_controller.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import 'auth_scaffold.dart';

/// Whether a signed-out student chose to browse as a guest. Held in memory
/// only, so every fresh launch without a session opens on the sign-in screen.
final guestModeProvider = StateProvider<bool>((ref) => false);

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.redirect});

  /// Where to land after a successful sign-in, set by the router when a
  /// protected route bounced the student here.
  final String? redirect;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  bool _googleLoading = false;
  String? _error;

  void _openEmailLink() {
    final uri = Uri(
      path: AppRoutes.emailLink,
      queryParameters: widget.redirect == null || widget.redirect!.isEmpty
          ? null
          : {'redirect': widget.redirect!},
    );
    context.push(uri.toString());
  }

  Future<void> _signInWithGoogle() async {
    if (_googleLoading) return;
    setState(() {
      _googleLoading = true;
      _error = null;
    });

    try {
      final token = await SupabaseAuthService.signInWithGoogle();
      if (token != null && token.isNotEmpty) {
        await ref
            .read(authControllerProvider.notifier)
            .completeSupabaseLogin(token);
        if (mounted) goAfterAuth(context, widget.redirect);
      }
    } on SupabaseAuthFailure catch (e) {
      if (mounted) setState(() => _error = e.reason);
    } catch (e) {
      if (mounted) setState(() => _error = 'Google sign-in failed: $e');
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  void _continueAsGuest() {
    ref.read(guestModeProvider.notifier).state = true;
    context.go(AppRoutes.home);
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return AuthScaffold(
      title: 'Welcome',
      subtitle:
          'Sign in to pick up your books, quizzes and rank tracking where you left off.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.rose.withValues(alpha: 0.10),
                border: Border.all(color: AppColors.rose.withValues(alpha: 0.35)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                _error!,
                style: const TextStyle(color: AppColors.rose, fontSize: 13),
              ),
            ),
            const SizedBox(height: 16),
          ],
          EmailLinkAuthButton(onPressed: _openEmailLink),
          const SizedBox(height: 18),
          const AuthDivider(label: 'OR'),
          const SizedBox(height: 18),
          OutlinedButton(
            onPressed: _googleLoading ? null : _signInWithGoogle,
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: _googleLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const GoogleLogo(size: 20),
                      const SizedBox(width: 10),
                      Text(
                        'Continue with Google',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: palette.textPrimary,
                        ),
                      ),
                    ],
                  ),
          ),
          const SizedBox(height: 24),
          TextButton(
            onPressed: _continueAsGuest,
            child: Text(
              'Browse as a guest',
              style: TextStyle(color: palette.textMuted),
            ),
          ),
        ],
      ),
    );
  }
}
