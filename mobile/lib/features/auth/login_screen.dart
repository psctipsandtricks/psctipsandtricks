import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import 'auth_scaffold.dart';

/// Whether a signed-out student chose to browse as a guest. Held in memory
/// only, so every fresh launch without a session opens on the sign-in screen.
final guestModeProvider = StateProvider<bool>((ref) => false);

class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key, this.redirect});

  /// Where to land after a successful sign-in, set by the router when a
  /// protected route bounced the student here.
  final String? redirect;

  void _openEmailLink(BuildContext context) {
    final uri = Uri(
      path: AppRoutes.emailLink,
      queryParameters: redirect == null || redirect!.isEmpty
          ? null
          : {'redirect': redirect!},
    );
    context.push(uri.toString());
  }

  void _continueAsGuest(BuildContext context, WidgetRef ref) {
    ref.read(guestModeProvider.notifier).state = true;
    context.go(AppRoutes.home);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;

    return AuthScaffold(
      title: 'Welcome',
      subtitle:
          'Sign in to pick up your books, quizzes and rank tracking where you left off.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EmailLinkAuthButton(onPressed: () => _openEmailLink(context)),
          const SizedBox(height: 26),
          TextButton(
            onPressed: () => _continueAsGuest(context, ref),
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
