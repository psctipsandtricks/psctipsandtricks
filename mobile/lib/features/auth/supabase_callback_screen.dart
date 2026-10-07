import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/supabase_auth_service.dart';
import '../../core/config/app_config.dart';
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

      // 1. Direct extraction from URI (fastest and handles fragments without network call)
      token = SupabaseAuthService.extractAccessTokenFromUri(widget.uri);

      // 2. Check current session if Supabase SDK background listener already parsed it
      if (token == null || token.isEmpty) {
        token = SupabaseAuthService.currentAccessToken;
      }

      // 3. Try getSessionFromUrl
      if (token == null || token.isEmpty) {
        try {
          final targetUri = widget.uri.hasScheme
              ? widget.uri
              : Uri.parse(
                  '${AppConfig.supabaseAuthCallbackUrl}${widget.uri.toString().startsWith('/') ? widget.uri.toString() : '/${widget.uri.toString()}'}',
                );
          token = await SupabaseAuthService.getSessionFromUrl(targetUri);
        } catch (e) {
          debugPrint('SupabaseCallbackScreen getSessionFromUrl attempt: $e');
        }
      }

      // 4. Wait for Supabase SDK's background deep link listener if still resolving
      if (token == null || token.isEmpty) {
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
