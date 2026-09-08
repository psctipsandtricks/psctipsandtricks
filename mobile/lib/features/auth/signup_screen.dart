import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/google_native_sign_in.dart';
import '../../core/network/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/email_validator.dart';
import '../../core/widgets/glass_card.dart';
import 'auth_scaffold.dart';
import 'oauth_webview_screen.dart';

enum _Step { form, verifyOtp }

/// Matches the website's registration flow exactly: the form only queues a
/// 6-digit email verification code, and the account is created — then signed
/// into — once that code is confirmed.
class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key, this.redirect});

  final String? redirect;

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpFormKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _otp = TextEditingController();

  _Step _step = _Step.form;
  bool _obscure = true;
  bool _submitting = false;
  String? _busyProvider;
  String? _error;
  String? _info;
  int _resendCooldown = 0;
  Timer? _cooldownTimer;
  bool get _isProcessing => _submitting || _busyProvider != null;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _otp.dispose();
    _cooldownTimer?.cancel();
    super.dispose();
  }

  void _goOnwards() {
    if (!mounted) return;
    goAfterAuth(context, widget.redirect);
  }

  void _startCooldown() {
    _cooldownTimer?.cancel();
    setState(() => _resendCooldown = 30);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_resendCooldown <= 1) {
        timer.cancel();
        setState(() => _resendCooldown = 0);
      } else {
        setState(() => _resendCooldown -= 1);
      }
    });
  }

  // Step 1: send the verification code to the entered email.
  Future<void> _sendOtp() async {
    if (_isProcessing) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
      _info = null;
    });
    try {
      final res = await ref.read(authRepositoryProvider).sendRegisterOtp(
            name: _name.text,
            email: _email.text,
            password: _password.text,
          );
      if (!mounted) return;
      setState(() {
        _step = _Step.verifyOtp;
        _info = res['message']?.toString() ??
            'A 6-digit verification code has been sent to ${_email.text.trim()}';
      });
      _startCooldown();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not verify email address. Please check and try again.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  // Step 2: confirm the code, which creates the account and signs in.
  Future<void> _verifyOtp() async {
    if (_isProcessing) return;
    if (!(_otpFormKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).verifyRegisterOtp(
            email: _email.text,
            otp: _otp.text,
          );
      if (mounted) setState(() => _info = 'OTP verified successfully.');
      _goOnwards();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Invalid or expired verification code. Please check your email.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _resendOtp() async {
    if (_resendCooldown > 0 || _isProcessing) return;
    setState(() {
      _error = null;
      _info = null;
    });
    try {
      final res = await ref.read(authRepositoryProvider).sendRegisterOtp(
            name: _name.text,
            email: _email.text,
            password: _password.text,
          );
      if (!mounted) return;
      setState(() {
        _info = res['message']?.toString() ?? 'New verification code sent to ${_email.text.trim()}';
      });
      _startCooldown();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Failed to resend the verification code. Please try again.');
    }
  }

  Future<void> _social(String provider) async {
    if (_isProcessing) return;
    FocusScope.of(context).unfocus();
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
    } catch (_) {
      if (mounted) setState(() => _error = 'Sign in failed. Please try again.');
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
    final isOtpStep = _step == _Step.verifyOtp;

    return AuthScaffold(
      title: isOtpStep ? 'Verify your email' : 'Create your account',
      subtitle: isOtpStep
          ? 'We sent a 6-digit code to ${_email.text.trim()}. Enter it below to activate your account.'
          : 'Free to join. Track every attempt, save your reading progress and climb the rank list.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) ...[
            _Banner(message: _error!, color: AppColors.rose, icon: Icons.error_outline_rounded),
            const SizedBox(height: 16),
          ],
          if (_info != null && isOtpStep) ...[
            _Banner(message: _info!, color: AppColors.cyan, icon: Icons.info_outline_rounded),
            const SizedBox(height: 16),
          ],
          if (isOtpStep) _buildOtpForm(palette) else _buildDetailsForm(palette),
        ],
      ),
    );
  }

  Widget _buildDetailsForm(AppPalette palette) {
    final isProcessing = _isProcessing;

    return AbsorbPointer(
      absorbing: isProcessing,
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: _name,
              enabled: !isProcessing,
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
              enabled: !isProcessing,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(
                labelText: 'Email',
                hintText: 'you@example.com',
                prefixIcon: Icon(Icons.alternate_email_rounded, size: 20),
              ),
              validator: (value) => EmailValidator.validate(value, emptyMessage: 'Enter your email'),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _password,
              enabled: !isProcessing,
              obscureText: _obscure,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.newPassword],
              onFieldSubmitted: (_) => _sendOtp(),
              decoration: InputDecoration(
                labelText: 'Password',
                helperText: 'At least 6 characters',
                prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                suffixIcon: IconButton(
                  tooltip: _obscure ? 'Show password' : 'Hide password',
                  icon: Icon(
                    _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                    size: 20,
                    color: palette.textSecondary,
                  ),
                  onPressed: isProcessing ? null : () => setState(() => _obscure = !_obscure),
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
              onPressed: isProcessing ? null : _sendOtp,
            ),
            const SizedBox(height: 22),
            const AuthDivider(),
            const SizedBox(height: 16),
            SocialSignInRow(
              busyProvider: _busyProvider,
              disabled: isProcessing,
              onGoogle: isProcessing ? null : () => _social('google'),
              onApple: isProcessing ? null : () => _social('apple'),
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
                  onPressed: isProcessing ? null : () => context.pop(),
                  child: const Text('Sign in'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOtpForm(AppPalette palette) {
    final isProcessing = _isProcessing;

    return AbsorbPointer(
      absorbing: isProcessing,
      child: Form(
        key: _otpFormKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: _otp,
              enabled: !isProcessing,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              maxLength: 6,
              autofocus: true,
              onFieldSubmitted: (_) => _verifyOtp(),
              decoration: const InputDecoration(
                labelText: '6-Digit Verification Code',
                hintText: '123456',
                counterText: '',
                prefixIcon: Icon(Icons.pin_rounded, size: 20),
              ),
              validator: (value) {
                final v = value?.trim() ?? '';
                if (v.isEmpty) return 'Enter the 6-digit code';
                if (v.length != 6) return 'Code must be exactly 6 digits';
                return null;
              },
            ),
            const SizedBox(height: 22),
            GradientButton(
              label: 'Verify & create account',
              icon: Icons.check_rounded,
              isLoading: _submitting,
              onPressed: isProcessing ? null : _verifyOtp,
            ),
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                TextButton.icon(
                  onPressed: isProcessing
                      ? null
                      : () => setState(() {
                            _error = null;
                            _info = null;
                            _step = _Step.form;
                          }),
                  icon: const Icon(Icons.arrow_back_rounded, size: 16),
                  label: const Text('Edit details'),
                ),
                TextButton(
                  onPressed: _resendCooldown > 0 || isProcessing ? null : _resendOtp,
                  child: Text(
                    _resendCooldown > 0 ? 'Resend in ${_resendCooldown}s' : 'Resend code',
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.message, required this.color, required this.icon});

  final String message;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        border: Border.all(color: color.withValues(alpha: 0.35)),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 19),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: color,
                    height: 1.4,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
