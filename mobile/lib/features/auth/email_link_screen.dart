import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/email_link_sign_in.dart';
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
      _email.text = EmailLinkSignIn.pendingEmail(prefs) ?? '';
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
      await EmailLinkSignIn.sendLink(
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
    } on EmailLinkFailure catch (e) {
      debugPrint('EmailLinkFailure during send: $e');
      if (mounted) setState(() => _error = e.reason);
    } catch (e, stackTrace) {
      debugPrint('Email link send failed: $e\n$stackTrace');
      if (mounted) {
        setState(() => _error = 'Error: $e');
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _handleLink(String raw) async {
    if (kDebugMode) debugPrint('EmailLinkScreen: handling link: $raw');
    final link = EmailLinkSignIn.extractActionLink(raw);
    if (link == null) {
      if (kDebugMode) {
        debugPrint(
            'EmailLinkScreen: extractActionLink returned null for: $raw');
      }
      setState(() => _error =
          'That isn\'t a valid sign-in link. Please use the latest link we emailed you.');
      return;
    }
    if (kDebugMode) debugPrint('EmailLinkScreen: extracted action link: $link');

    var email = widget.email?.trim();
    if (email == null || email.isEmpty || !EmailValidator.isValid(email)) {
      email =
          EmailLinkSignIn.pendingEmail(ref.read(sharedPrefsProvider))?.trim();
    }
    if (email == null || email.isEmpty) {
      final current = _email.text.trim();
      if (current.isNotEmpty && EmailValidator.isValid(current)) {
        email = current;
      }
    }
    if (email == null || email.isEmpty) {
      // Opened on a different phone, or after the app's data was cleared:
      // Firebase needs the address again before it will accept the link.
      if (kDebugMode) {
        debugPrint(
            'EmailLinkScreen: pending email not found, requesting email confirmation');
      }
      setState(() {
        _pendingLink = link;
        _step = _Step.confirmEmail;
        _error = null;
      });
      return;
    }
    await _complete(email, link);
  }

  Future<void> _complete(String email, String link) async {
    if (kDebugMode) {
      debugPrint('EmailLinkScreen: completing sign-in for $email');
    }
    setState(() {
      _step = _Step.completing;
      _error = null;
    });
    try {
      final idToken = await EmailLinkSignIn.complete(
        email: email,
        link: link,
        prefs: ref.read(sharedPrefsProvider),
      );
      if (kDebugMode) {
        debugPrint(
            'EmailLinkScreen: Firebase ID token retrieved, exchanging with backend API');
      }
      await ref
          .read(authControllerProvider.notifier)
          .completeEmailLink(idToken);
      if (kDebugMode) {
        debugPrint(
            'EmailLinkScreen: backend authentication successful, redirecting');
      }
      if (mounted) goAfterAuth(context, widget.redirect);
      return;
    } on EmailLinkFailure catch (e) {
      debugPrint('EmailLinkFailure during complete: $e');
      _fail(e.reason, link);
    } on ApiException catch (e) {
      debugPrint('ApiException during email link exchange: $e');
      _fail(e.message, link);
    } catch (e, stackTrace) {
      debugPrint('Email link sign-in unexpected error: $e\n$stackTrace');
      _fail('Error: $e', link);
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
    await _complete(_email.text, link);
  }

  void _changeEmail() {
    _cooldownTimer?.cancel();
    unawaited(EmailLinkSignIn.clearPendingEmail(ref.read(sharedPrefsProvider)));
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
        // A mail app that opens links in its own browser never hands the link
        // to us; copying it from the email and pasting it here still works.
        Text(
          'Link opened in a browser instead? Copy it from the email and paste it here.',
          style: textTheme.bodySmall
              ?.copyWith(color: palette.textMuted, height: 1.45),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _pastedLink,
          keyboardType: TextInputType.url,
          textInputAction: TextInputAction.done,
          onSubmitted: (value) => _handleLink(value),
          decoration: InputDecoration(
            labelText: 'Paste sign-in link',
            prefixIcon: const Icon(Icons.link_rounded, size: 20),
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
