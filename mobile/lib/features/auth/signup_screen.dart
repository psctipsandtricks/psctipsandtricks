import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/google_native_sign_in.dart';
import '../../core/network/api_exception.dart';
import '../../core/providers/auth_controller.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/glass_card.dart';
import 'auth_scaffold.dart';
import 'oauth_webview_screen.dart';

class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key, this.redirect});

  final String? redirect;

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();

  bool _obscure = true;
  bool _submitting = false;
  String? _busyProvider;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _goOnwards() {
    if (!mounted) return;
    goAfterAuth(context, widget.redirect);
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).register(
            name: _name.text,
            email: _email.text,
            password: _password.text,
          );
      _goOnwards();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not create the account. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _social(String provider) async {
    setState(() {
      _busyProvider = provider;
      _error = null;
    });
    try {
      if (provider == 'google') {
        await _googleNative();
        return;
      }
      if (!mounted) return;

      final tokens = await Navigator.of(context).push<OAuthTokens>(
        MaterialPageRoute(
          builder: (_) => OAuthWebViewScreen(provider: provider),
          fullscreenDialog: true,
        ),
      );
      if (tokens == null) return;
      await ref.read(authControllerProvider.notifier).completeOAuth(
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          );
      _goOnwards();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busyProvider = null);
    }
  }

  /// Runs the native Google account picker flow exclusively.
  Future<void> _googleNative() async {
    final GoogleNativeTokens? tokens;
    try {
      tokens = await GoogleNativeSignIn.tokens();
    } on GoogleNativeUnavailable catch (e) {
      if (kDebugMode) debugPrint('Native Google sign-in error: $e');
      if (mounted) setState(() => _error = e.reason);
      return;
    } catch (e) {
      if (kDebugMode) debugPrint('Native Google sign-in exception: $e');
      if (mounted) setState(() => _error = 'Google sign-in failed. Please try again.');
      return;
    }

    if (tokens == null || !tokens.isValid) {
      // Student dismissed the picker dialog
      return;
    }

    try {
      await ref.read(authControllerProvider.notifier).completeGoogleNative(
            idToken: tokens.idToken,
          );
      _goOnwards();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return AuthScaffold(
      title: 'Create your account',
      subtitle:
          'Free to join. Track every attempt, save your reading progress and climb the rank list.',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: AppColors.rose.withValues(alpha: 0.10),
                  border: Border.all(color: AppColors.rose.withValues(alpha: 0.35)),
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.error_outline_rounded,
                        color: AppColors.rose, size: 19),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _error!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.rose,
                              height: 1.4,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.name],
              decoration: const InputDecoration(
                labelText: 'Full name',
                prefixIcon: Icon(Icons.person_outline_rounded, size: 20),
              ),
              validator: (value) {
                final v = value?.trim() ?? '';
                if (v.isEmpty) return 'Enter your name';
                if (v.length < 2) return 'That name looks too short';
                return null;
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(
                labelText: 'Email',
                hintText: 'you@example.com',
                prefixIcon: Icon(Icons.alternate_email_rounded, size: 20),
              ),
              validator: (value) {
                final v = value?.trim() ?? '';
                if (v.isEmpty) return 'Enter your email';
                if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v)) {
                  return 'Enter a valid email address';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _password,
              obscureText: _obscure,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.newPassword],
              onFieldSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: 'Password',
                helperText: 'At least 6 characters',
                prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscure
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    size: 20,
                  ),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
              validator: (value) {
                final v = value ?? '';
                if (v.isEmpty) return 'Choose a password';
                if (v.length < 6) return 'Use at least 6 characters';
                return null;
              },
            ),
            const SizedBox(height: 22),
            GradientButton(
              label: 'Create account',
              icon: Icons.arrow_forward_rounded,
              isLoading: _submitting,
              onPressed: _submitting ? null : _submit,
            ),
            const SizedBox(height: 22),
            const AuthDivider(),
            const SizedBox(height: 16),
            SocialSignInRow(
              busyProvider: _busyProvider,
              onGoogle: () => _social('google'),
              onApple: () => _social('apple'),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Already registered?',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                ),
                TextButton(
                  onPressed: () => context.pop(),
                  child: const Text('Sign in'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
