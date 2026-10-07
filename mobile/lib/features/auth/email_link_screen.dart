import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/email_link_sign_in.dart';
import '../../core/auth/supabase_auth_service.dart';
import '../../core/network/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/email_validator.dart';
import '../../core/utils/mail_app.dart';
import '../../core/widgets/glass_card.dart';
import 'auth_scaffold.dart';

enum _Step { email, sent, confirmEmail, completing }

/// Passwordless sign-in: the student asks for a link, opens it from their
/// inbox, and the app signs them in to the account registered under that
/// email — the same account whichever way they first signed up.
///
/// Reached two ways: from the login screen to request a link, and from the
/// emailed link itself (the router passes [link]) to finish signing in.
class EmailLinkScreen extends ConsumerStatefulWidget {
  const EmailLinkScreen({super.key, this.link, this.email, this.redirect});

  /// The emailed sign-in link, when the screen was opened by tapping it.
  final String? link;
  final String? email;
  final String? redirect;

  @override
  ConsumerState<EmailLinkScreen> createState() => _EmailLinkScreenState();
}

class _EmailLinkScreenState extends ConsumerState<EmailLinkScreen> {
  final _emailFormKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _pastedLink = TextEditingController();

  _Step _step = _Step.email;
  bool _sending = false;
  int _resendCooldown = 0;
  Timer? _cooldownTimer;
  String? _error;

  /// The link waiting to be completed once the student confirms their email.
  String? _pendingLink;

  @override
  void initState() {
    super.initState();
    final prefs = ref.read(sharedPrefsProvider);
    final initialEmail = widget.email?.trim();
    if (initialEmail != null && initialEmail.isNotEmpty) {
      _email.text = initialEmail;
    } else if (widget.link != null && widget.link!.isNotEmpty) {
      _email.text = SupabaseAuthService.pendingEmail(prefs) ??
          EmailLinkSignIn.pendingEmail(prefs) ??
          '';
    }
    final link = widget.link;
    if (link != null && link.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _handleLink(link));
    }
  }

  @override
  void didUpdateWidget(EmailLinkScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.email != null &&
        widget.email != oldWidget.email &&
        _email.text.trim().isEmpty) {
      _email.text = widget.email!.trim();
    }
    if (widget.link != null &&
        widget.link != oldWidget.link &&
        widget.link!.isNotEmpty) {
      _handleLink(widget.link!);
    }
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _email.dispose();
    _pastedLink.dispose();
    super.dispose();
  }

  void _startCooldown([int seconds = 60]) {
    _cooldownTimer?.cancel();
    setState(() => _resendCooldown = seconds);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _resendCooldown <= 1) {
        timer.cancel();
        if (mounted) setState(() => _resendCooldown = 0);
        return;
      }
      setState(() => _resendCooldown -= 1);
    });
  }

  /// [validate] is off for a resend: the address was already checked, and the
  /// form is not on screen to validate.
  Future<void> _send({bool validate = true}) async {
    if (_sending) return;
    if (!validate && _resendCooldown > 0) return;
    if (validate && !(_emailFormKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await SupabaseAuthService.sendOtp(
          _email.text, ref.read(sharedPrefsProvider));
      if (!mounted) return;
      // 3-second buffer with active loader so the email arrives in the user's inbox
      // before opening the mail app.
      await Future.delayed(const Duration(seconds: 3));
      if (!mounted) return;
      setState(() => _step = _Step.sent);
      _startCooldown();
      // Straight to the inbox, where the sign-in link is waiting.
      unawaited(MailApp.openInbox());
    } on SupabaseAuthFailure catch (e) {
      debugPrint('SupabaseAuthFailure during sendOtp: $e');
      if (mounted) setState(() => _error = e.reason);
    } catch (e, stackTrace) {
      debugPrint('Supabase sendOtp failed: $e\n$stackTrace');
      if (mounted) {
        setState(() => _error = 'Could not send verification email. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _handleLink(String raw) async {
    final input = raw.trim();
    if (input.isEmpty) return;
    if (kDebugMode) debugPrint('EmailLinkScreen: handling input: $input');

    final prefs = ref.read(sharedPrefsProvider);
    var email = widget.email?.trim();
    if (email == null || email.isEmpty || !EmailValidator.isValid(email)) {
      email = SupabaseAuthService.pendingEmail(prefs)?.trim() ??
          EmailLinkSignIn.pendingEmail(prefs)?.trim();
    }
    if (email == null || email.isEmpty) {
      final current = _email.text.trim();
      if (current.isNotEmpty && EmailValidator.isValid(current)) {
        email = current;
      }
    }

    // Check if it's a 6-digit OTP code
    if (RegExp(r'^\d{6}$').hasMatch(input)) {
      if (email == null || email.isEmpty) {
        setState(() {
          _pendingLink = input;
          _step = _Step.confirmEmail;
          _error = null;
        });
        return;
      }
      await _verifyCode(email, input);
      return;
    }

    // Otherwise treat as a link / callback URL
    if (email == null || email.isEmpty) {
      setState(() {
        _pendingLink = input;
        _step = _Step.confirmEmail;
        _error = null;
      });
      return;
    }
    await _complete(email, input);
  }

  Future<void> _verifyCode(String email, String code) async {
    setState(() {
      _step = _Step.completing;
      _error = null;
    });
    try {
      final token = await SupabaseAuthService.verifyOtpCode(
        email: email,
        token: code,
        prefs: ref.read(sharedPrefsProvider),
      );
      await ref
          .read(authControllerProvider.notifier)
          .completeSupabaseLogin(token);
      if (mounted) goAfterAuth(context, widget.redirect);
    } on SupabaseAuthFailure catch (e) {
      _fail(e.reason, code);
    } on ApiException catch (e) {
      _fail(e.message, code);
    } catch (e) {
      _fail('Verification failed. Please check the code and try again.', code);
    }
  }

  Future<void> _complete(String email, String rawLink) async {
    if (kDebugMode) {
      debugPrint('EmailLinkScreen: completing sign-in for $email');
    }
    setState(() {
      _step = _Step.completing;
      _error = null;
    });
    try {
      // 1. Try Supabase token extraction / URL parsing
      final uri = Uri.tryParse(rawLink);
      String? supaToken;
      if (uri != null) {
        supaToken = SupabaseAuthService.extractAccessTokenFromUri(uri);
        if (supaToken == null || supaToken.isEmpty) {
          try {
            supaToken = await SupabaseAuthService.getSessionFromUrl(uri);
          } catch (_) {
            supaToken = SupabaseAuthService.currentAccessToken;
          }
        }
      }
      if (supaToken != null && supaToken.isNotEmpty) {
        await ref
            .read(authControllerProvider.notifier)
            .completeSupabaseLogin(supaToken);
        if (mounted) goAfterAuth(context, widget.redirect);
        return;
      }

      // 2. Legacy Firebase action link fallback
      final fbLink = EmailLinkSignIn.extractActionLink(rawLink);
      if (fbLink != null) {
        final idToken = await EmailLinkSignIn.complete(
          email: email,
          link: fbLink,
          prefs: ref.read(sharedPrefsProvider),
        );
        await ref
            .read(authControllerProvider.notifier)
            .completeEmailLink(idToken);
        if (mounted) goAfterAuth(context, widget.redirect);
        return;
      }

      _fail('Invalid sign-in link. Please use the latest link emailed to you.', rawLink);
    } on SupabaseAuthFailure catch (e) {
      _fail(e.reason, rawLink);
    } on EmailLinkFailure catch (e) {
      _fail(e.reason, rawLink);
    } on ApiException catch (e) {
      _fail(e.message, rawLink);
    } catch (e, stackTrace) {
      debugPrint('Email link sign-in unexpected error: $e\n$stackTrace');
      _fail('Error: $e', rawLink);
    }
  }

  void _fail(String message, String link) {
    if (!mounted) return;
    setState(() {
      _error = message;
      _pendingLink = link;
      _step = _Step.confirmEmail;
    });
  }

  Future<void> _confirmAndComplete() async {
    if (!(_emailFormKey.currentState?.validate() ?? false)) return;
    final link = _pendingLink;
    if (link == null) return;
    FocusScope.of(context).unfocus();
    await _handleLink(link);
  }

  void _changeEmail() {
    _cooldownTimer?.cancel();
    final prefs = ref.read(sharedPrefsProvider);
    unawaited(SupabaseAuthService.clearPendingEmail(prefs));
    unawaited(EmailLinkSignIn.clearPendingEmail(prefs));
    setState(() {
      _error = null;
      _resendCooldown = 0;
      _step = _Step.email;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _email.selection = TextSelection(
        baseOffset: 0,
        extentOffset: _email.text.length,
      );
    });
  }

  void _back() {
    if (_step == _Step.sent || _step == _Step.confirmEmail) {
      _changeEmail();
      return;
    }
    if (context.canPop()) {
      context.pop();
      return;
    }
    context.go(
      widget.redirect == null
          ? AppRoutes.login
          : '${AppRoutes.login}?redirect=${Uri.encodeComponent(widget.redirect!)}',
    );
  }

  @override
  Widget build(BuildContext context) {
    final (title, subtitle) = switch (_step) {
      _Step.email => (
          'Sign in with Email',
          'No password needed. We\'ll email you a secure link that signs you straight in.',
        ),
      _Step.sent => (
          'Check your inbox',
          'We sent a sign-in link to ${_email.text.trim()}. Open it on this phone to continue.',
        ),
      _Step.confirmEmail => (
          'Confirm your email',
          'Enter the email address the sign-in link was sent to.',
        ),
      _Step.completing => ('Signing you in…', 'Verifying your sign-in link.'),
    };

    return AuthScaffold(
      title: title,
      subtitle: subtitle,
      onBack: _step == _Step.completing ? null : _back,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) ...[
            _Banner(message: _error!),
            const SizedBox(height: 16),
          ],
          switch (_step) {
            _Step.email => _buildEmailForm(
                buttonLabel: 'Submit',
                icon: Icons.mark_email_read_outlined,
                onSubmit: _send,
                isLoading: _sending,
              ),
            _Step.sent => _buildSent(),
            _Step.confirmEmail => _buildEmailForm(
                buttonLabel: 'Continue',
                icon: Icons.login_rounded,
                onSubmit: _confirmAndComplete,
                isLoading: false,
              ),
            _Step.completing => const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator()),
              ),
          },
        ],
      ),
    );
  }

  Widget _buildEmailForm({
    required String buttonLabel,
    required IconData icon,
    required VoidCallback onSubmit,
    required bool isLoading,
  }) {
    return Form(
      key: _emailFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _email,
            enabled: !isLoading,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.email],
            onChanged: (_) => setState(() {}),
            onFieldSubmitted: (_) => onSubmit(),
            decoration: InputDecoration(
              labelText: 'Email',
              hintText: 'you@example.com',
              prefixIcon: const Icon(Icons.alternate_email_rounded, size: 20),
              suffixIcon: _email.text.isNotEmpty && !isLoading
                  ? IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18),
                      tooltip: 'Clear email',
                      onPressed: () {
                        _email.clear();
                        unawaited(EmailLinkSignIn.clearPendingEmail(
                            ref.read(sharedPrefsProvider)));
                        setState(() {});
                      },
                    )
                  : null,
            ),
            validator: (value) => EmailValidator.validate(value,
                emptyMessage: 'Enter your email'),
          ),
          const SizedBox(height: 22),
          GradientButton(
            label: isLoading ? 'Opening Gmail…' : buttonLabel,
            icon: icon,
            isLoading: isLoading,
            onPressed: isLoading ? null : onSubmit,
          ),
          if (isLoading) ...[
            const SizedBox(height: 14),
            Text(
              'Opening Gmail in 3 seconds…',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.palette.textSecondary,
                  ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSent() {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Didn\'t get it? Check your spam folder. The link works once and expires after a while.',
          style: textTheme.bodySmall
              ?.copyWith(color: palette.textSecondary, height: 1.45),
        ),
        const SizedBox(height: 14),
        OutlinedButton.icon(
          onPressed: MailApp.openInbox,
          icon: const Icon(Icons.mail_outline_rounded, size: 18),
          label: const Text('Open Gmail'),
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton.icon(
              onPressed: _changeEmail,
              icon: const Icon(Icons.arrow_back_rounded, size: 16),
              label: const Text('Change email'),
            ),
            TextButton(
              onPressed: (_sending || _resendCooldown > 0)
                  ? null
                  : () => _send(validate: false),
              child: Text(_resendCooldown > 0
                  ? 'Resend in ${_resendCooldown}s'
                  : (_sending ? 'Sending…' : 'Resend link')),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Text(
          'Tapping the link in your email will sign you straight in. Alternatively, enter the 6-digit code or paste the link below:',
          style: textTheme.bodySmall
              ?.copyWith(color: palette.textMuted, height: 1.45),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _pastedLink,
          keyboardType: TextInputType.text,
          textInputAction: TextInputAction.done,
          onSubmitted: (value) => _handleLink(value),
          decoration: InputDecoration(
            labelText: 'Enter 6-digit code or paste link',
            hintText: 'e.g. 123456',
            prefixIcon: const Icon(Icons.password_rounded, size: 20),
            suffixIcon: IconButton(
              tooltip: 'Sign in',
              icon: const Icon(Icons.arrow_forward_rounded, size: 20),
              onPressed: () => _handleLink(_pastedLink.text),
            ),
          ),
        ),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
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
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.rose,
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
