import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/supabase_auth_service.dart';
import '../../core/providers/auth_controller.dart';
import '../../core/router/app_router.dart';
import 'auth_scaffold.dart';

/// Handles incoming Supabase redirect URIs (Magic Link or Google OAuth callbacks)
/// and finishes authentication with the PSC backend.
class SupabaseCallbackScreen extends ConsumerStatefulWidget {
  const SupabaseCallbackScreen({
    super.key,
    required this.uri,
    this.redirect,
  });

  final Uri uri;
  final String? redirect;

  @override
  ConsumerState<SupabaseCallbackScreen> createState() =>
      _SupabaseCallbackScreenState();
}

class _SupabaseCallbackScreenState
    extends ConsumerState<SupabaseCallbackScreen> {
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _complete());
  }

  Future<void> _complete() async {
    try {
      String? token;
      try {
        token = await SupabaseAuthService.getSessionFromUrl(widget.uri);
      } catch (_) {
        token = SupabaseAuthService.currentAccessToken;
      }

      if (token == null || token.isEmpty) {
        setState(() => _error = 'Sign-in failed — no session credentials returned.');
        return;
      }

      await ref
          .read(authControllerProvider.notifier)
          .completeSupabaseLogin(token);
      if (mounted) goAfterAuth(context, widget.redirect);
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Could not complete sign-in: $e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: _error == null
            ? const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 18),
                  Text('Finishing sign-in…'),
                ],
              )
            : Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 18),
                    FilledButton(
                      onPressed: () => context.go(AppRoutes.login),
                      child: const Text('Back to sign in'),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
