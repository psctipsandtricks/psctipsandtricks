import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/auth_controller.dart';
import '../../core/router/app_router.dart';
import 'auth_scaffold.dart';

/// Handles an OAuth result that arrives as a route rather than through the
/// in-app browser — a deep link back into the app. The common path is
/// [OAuthWebViewScreen], which never reaches here.
class OAuthCallbackScreen extends ConsumerStatefulWidget {
  const OAuthCallbackScreen({
    super.key,
    this.accessToken,
    this.refreshToken,
    this.redirect,
  });

  final String? accessToken;
  final String? refreshToken;
  final String? redirect;

  @override
  ConsumerState<OAuthCallbackScreen> createState() =>
      _OAuthCallbackScreenState();
}

class _OAuthCallbackScreenState extends ConsumerState<OAuthCallbackScreen> {
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _complete());
  }

  Future<void> _complete() async {
    final access = widget.accessToken;
    final refresh = widget.refreshToken;
    if (access == null || refresh == null) {
      setState(() => _error = 'Sign-in failed — no session credentials returned.');
      return;
    }
    try {
      await ref.read(authControllerProvider.notifier).completeOAuth(
            accessToken: access,
            refreshToken: refresh,
          );
      if (mounted) goAfterAuth(context, widget.redirect);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not complete sign-in. Please try again.');
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
