import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/email_validator.dart';
import '../../core/widgets/glass_card.dart';
import 'auth_scaffold.dart';

enum _Step { email, verifyOtp, createPassword, success }

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _emailFormKey = GlobalKey<FormState>();
  final _otpFormKey = GlobalKey<FormState>();
  final _passwordFormKey = GlobalKey<FormState>();

  final _email = TextEditingController();
  final _otp = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();

  _Step _step = _Step.email;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _submitting = false;
  int _resendCooldown = 0;
  Timer? _cooldownTimer;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _email.dispose();
    _otp.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  void _startCooldown([int seconds = 30]) {
    _cooldownTimer?.cancel();
    if (!mounted) return;
    setState(() => _resendCooldown = seconds);
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

  // Step 1: Send OTP to email
  Future<void> _sendOtp() async {
    if (!(_emailFormKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
      _info = null;
    });

    try {
      final res = await ref
          .read(authRepositoryProvider)
          .forgotPassword(_email.text.trim());

      if (mounted) {
        setState(() {
          _step = _Step.verifyOtp;
          _info = res['message']?.toString() ??
              'A 6-digit verification code has been sent to ${_email.text.trim()}';
        });
        _startCooldown(30);
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not send reset code. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  // Step 2: Verify the OTP code
  Future<void> _verifyOtp() async {
    if (!(_otpFormKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final res = await ref.read(authRepositoryProvider).verifyOtp(
            email: _email.text.trim(),
            otp: _otp.text.trim(),
          );

      if (mounted) {
        setState(() {
          _step = _Step.createPassword;
          _info = res['message']?.toString() ?? 'OTP verified successfully.';
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Invalid OTP code. Please check your email and try again.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  // Step 3: Create & Submit New Password
  Future<void> _resetPassword() async {
    if (!(_passwordFormKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final res = await ref.read(authRepositoryProvider).resetPassword(
            email: _email.text.trim(),
            otp: _otp.text.trim(),
            newPassword: _newPassword.text,
          );

      if (mounted) {
        setState(() {
          _step = _Step.success;
          _info = res['message']?.toString() ?? 'Password reset successfully!';
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Failed to reset password. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    String title;
    String subtitle;

    switch (_step) {
      case _Step.email:
        title = 'Forgot Password';
        subtitle = 'Enter your registered email address to receive a 6-digit recovery code.';
        break;
      case _Step.verifyOtp:
        title = 'Verify OTP Code';
        subtitle = 'Enter the 6-digit code sent to ${_email.text.trim()} to verify your identity.';
        break;
      case _Step.createPassword:
        title = 'Create New Password';
        subtitle = 'OTP verified! Enter and confirm your new account password below.';
        break;
      case _Step.success:
        title = 'Password Updated!';
        subtitle = 'Your password has been reset successfully. You can now sign in.';
        break;
    }

    return AuthScaffold(
      title: title,
      subtitle: subtitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) ...[
            _Banner(
              message: _error!,
              color: AppColors.rose,
              icon: Icons.error_outline_rounded,
            ),
            const SizedBox(height: 16),
          ],
          if (_info != null && _step != _Step.success) ...[
            _Banner(
              message: _info!,
              color: AppColors.cyan,
              icon: Icons.info_outline_rounded,
            ),
            const SizedBox(height: 16),
          ],

          if (_step == _Step.email) _buildEmailForm(palette),
          if (_step == _Step.verifyOtp) _buildOtpForm(palette),
          if (_step == _Step.createPassword) _buildPasswordForm(palette),
          if (_step == _Step.success) _buildSuccessState(palette),
        ],
      ),
    );
  }

  // Form 1: Email Input
  Widget _buildEmailForm(AppPalette palette) {
    return Form(
      key: _emailFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.email],
            onFieldSubmitted: (_) => _sendOtp(),
            decoration: const InputDecoration(
              labelText: 'Email Address',
              hintText: 'aspirant@example.com',
              prefixIcon: Icon(Icons.alternate_email_rounded, size: 20),
            ),
            validator: (value) => EmailValidator.validate(value, emptyMessage: 'Enter your email address'),
          ),
          const SizedBox(height: 22),
          GradientButton(
            label: 'Send Recovery Code',
            icon: Icons.send_rounded,
            isLoading: _submitting,
            onPressed: _submitting ? null : _sendOtp,
          ),
          const SizedBox(height: 20),
          Center(
            child: TextButton.icon(
              onPressed: () => context.pop(),
              icon: const Icon(Icons.arrow_back_rounded, size: 18),
              label: const Text('Back to Sign in'),
            ),
          ),
        ],
      ),
    );
  }

  // Form 2: OTP Verification
  Widget _buildOtpForm(AppPalette palette) {
    return Form(
      key: _otpFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _otp,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.done,
            maxLength: 6,
            onFieldSubmitted: (_) => _verifyOtp(),
            decoration: const InputDecoration(
              labelText: '6-Digit OTP Code',
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
            label: 'Verify Code',
            icon: Icons.check_rounded,
            isLoading: _submitting,
            onPressed: _submitting ? null : _verifyOtp,
          ),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton.icon(
                onPressed: () => setState(() {
                  _error = null;
                  _info = null;
                  _step = _Step.email;
                }),
                icon: const Icon(Icons.arrow_back_rounded, size: 16),
                label: const Text('Change email'),
              ),
              TextButton(
                onPressed: (_submitting || _resendCooldown > 0) ? null : _sendOtp,
                child: Text(
                  _resendCooldown > 0 ? 'Resend in ${_resendCooldown}s' : 'Resend code',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // Form 3: Password Creation
  Widget _buildPasswordForm(AppPalette palette) {
    return Form(
      key: _passwordFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _newPassword,
            obscureText: _obscureNew,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.newPassword],
            decoration: InputDecoration(
              labelText: 'New Password',
              helperText: 'At least 6 characters',
              prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
              suffixIcon: IconButton(
                tooltip: _obscureNew ? 'Show password' : 'Hide password',
                icon: Icon(
                  _obscureNew
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  size: 20,
                  color: palette.textSecondary,
                ),
                onPressed: () => setState(() => _obscureNew = !_obscureNew),
              ),
            ),
            validator: (value) {
              final v = value ?? '';
              if (v.isEmpty) return 'Enter a new password';
              if (v.length < 6) return 'Use at least 6 characters';
              return null;
            },
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _confirmPassword,
            obscureText: _obscureConfirm,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _resetPassword(),
            decoration: InputDecoration(
              labelText: 'Confirm New Password',
              prefixIcon: const Icon(Icons.lock_reset_rounded, size: 20),
              suffixIcon: IconButton(
                tooltip: _obscureConfirm ? 'Show password' : 'Hide password',
                icon: Icon(
                  _obscureConfirm
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  size: 20,
                  color: palette.textSecondary,
                ),
                onPressed: () =>
                    setState(() => _obscureConfirm = !_obscureConfirm),
              ),
            ),
            validator: (value) {
              final v = value ?? '';
              if (v.isEmpty) return 'Confirm your new password';
              if (v != _newPassword.text) return 'Passwords do not match';
              return null;
            },
          ),
          const SizedBox(height: 22),
          GradientButton(
            label: 'Set New Password',
            icon: Icons.check_circle_outline_rounded,
            isLoading: _submitting,
            onPressed: _submitting ? null : _resetPassword,
          ),
        ],
      ),
    );
  }

  // Success State
  Widget _buildSuccessState(AppPalette palette) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 12),
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: AppColors.emerald.withValues(alpha: 0.15),
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.emerald.withValues(alpha: 0.4)),
          ),
          child: const Icon(
            Icons.check_rounded,
            color: AppColors.emerald,
            size: 40,
          ),
        ),
        const SizedBox(height: 24),
        GradientButton(
          label: 'Sign in with New Password',
          icon: Icons.login_rounded,
          onPressed: () => context.pop(),
        ),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({
    required this.message,
    required this.color,
    required this.icon,
  });

  final String message;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        border: Border.all(color: color.withValues(alpha: 0.35)),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 18),
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
