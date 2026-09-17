import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/liquid_glass.dart';
import '../../../data/models/book.dart' show AccessState;
import '../../checkout/purchase_sheet.dart';
import '../../dashboard/dashboard_providers.dart';
import '../quizzes_providers.dart';

/// Shown in place of a premium quiz — or of a premium live mock test, which is
/// sold as the quiz behind it — until the student has paid for it.
///
/// The server withholds the questions entirely in this state, so there is
/// nothing to leak here — this screen only explains the price and takes payment.
class QuizPaywall extends ConsumerWidget {
  const QuizPaywall({
    super.key,
    required this.quizId,
    required this.title,
    required this.access,
    required this.onUnlocked,
    this.appBarTitle,
    this.subtitle,
    this.loginRedirect,
    this.perks,
  });

  /// The quiz that carries the entitlement. For a mock test this is the paper
  /// behind it, not the mock test id — orders are placed against the quiz.
  final String quizId;
  final String title;
  final AccessState access;
  final Future<void> Function() onUnlocked;

  /// Overrides for the mock-test framing; the quiz wording is the default.
  final String? appBarTitle;
  final String? subtitle;

  /// Where to return after signing in. Defaults to the quiz attempt screen.
  final String? loginRedirect;

  /// What the purchase includes. Defaults to [quizPerks].
  final List<(IconData, String)>? perks;

  static const quizPerks = <(IconData, String)>[
    (Icons.all_inclusive_rounded, 'Unlimited re-attempts, forever'),
    (Icons.insights_rounded, 'Detailed accuracy and rank analytics'),
    (Icons.lightbulb_outline_rounded, 'Explanations for every question'),
    (Icons.leaderboard_rounded, 'Compete on the live rank list'),
  ];

  /// What buying a live mock test actually gets you, which is not the same
  /// list — the draw is the timed sitting and the rank against everyone else.
  static const mockTestPerks = <(IconData, String)>[
    (Icons.bolt_rounded, 'Take the paper live, at the scheduled hour'),
    (Icons.leaderboard_rounded, 'Your rank against every other aspirant'),
    (Icons.insights_rounded, 'Full score and accuracy breakdown'),
    (Icons.replay_rounded, 'Keep the paper afterwards for practice'),
  ];

  String _buildSubtitle(bool needsLogin) {
    if (subtitle != null) return subtitle!;
    if (needsLogin) {
      return 'Sign in to check whether you already own this question bank.';
    }
    if (access.isSubscriptionExpired) {
      return 'Your subscription validity period has expired. Purchase again to regain access.';
    }
    if (access.isAttemptsExhausted) {
      return 'You have exhausted all ${access.maxAttempts ?? 5} attempts for this quiz. Purchase again to unlock fresh attempts.';
    }
    return 'This question bank is premium. Complete the payment to unlock the questions and attempt it.';
  }

  String _accessModelLabel() {
    if (access.subscriptionType == 'SUBSCRIPTION') {
      final dur = access.subscriptionDuration != null
          ? access.subscriptionDuration!.replaceAll('_', ' ')
          : 'Subscription';
      return '$dur validity · ${access.maxAttempts ?? 5} attempts';
    }
    return 'One-time payment · lifetime access · Unlimited attempts';
  }

  List<(IconData, String)> _resolvePerks() {
    if (perks != null) return perks!;
    if (access.subscriptionType == 'SUBSCRIPTION') {
      return <(IconData, String)>[
        (Icons.replay_rounded, '${access.maxAttempts ?? 5} exam attempts included'),
        (Icons.insights_rounded, 'Detailed accuracy and rank analytics'),
        (Icons.lightbulb_outline_rounded, 'Explanations for every question'),
        (Icons.leaderboard_rounded, 'Compete on the live rank list'),
      ];
    }
    return quizPerks;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final needsLogin = access.needsLogin;

    return Scaffold(
      appBar: GlassAppBar(title: Text(appBarTitle ?? (access.canRepurchase ? 'Renew access' : 'Premium question bank'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          GlassCard(
            borderColor: AppColors.amber.withValues(alpha: 0.38),
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.amber.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      access.canRepurchase ? Icons.replay_rounded : Icons.lock_rounded,
                      color: AppColors.amber,
                      size: 30,
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  title.isEmpty ? (appBarTitle ?? 'Premium question bank') : title,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                        height: 1.25,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  _buildSubtitle(needsLogin),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: access.canRepurchase ? AppColors.amber : palette.textSecondary,
                        fontWeight: access.canRepurchase ? FontWeight.w600 : FontWeight.normal,
                        height: 1.55,
                      ),
                ),
                const SizedBox(height: 22),
                if (!needsLogin) ...[
                  Center(
                    child: Text(
                      Fmt.price(access.price),
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: AppColors.amber,
                          ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Center(
                    child: Text(
                      _accessModelLabel(),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                GradientButton(
                  label: needsLogin
                      ? 'Sign in to continue'
                      : access.canRepurchase
                          ? 'Repurchase / Buy Again'
                          : 'Unlock now',
                  icon: needsLogin
                      ? Icons.login_rounded
                      : access.canRepurchase
                          ? Icons.refresh_rounded
                          : Icons.lock_open_rounded,
                  gradient: AppColors.goldGradient,
                  onPressed: () async {
                    if (needsLogin) {
                      final redirect =
                          loginRedirect ?? AppRoutes.quizAttempt(quizId);
                      context.push(
                        '${AppRoutes.login}?redirect=${Uri.encodeComponent(redirect)}',
                      );
                      return;
                    }
                    final bought = await showPurchaseSheet(
                      context,
                      target: PurchaseTarget.quiz(
                        id: quizId,
                        title: title,
                        price: access.price,
                      ),
                    );
                    if (bought) {
                      ref.invalidate(premiumCarouselQuizzesProvider);
                      ref.invalidate(quizzesProvider);
                      ref.invalidate(quizAttemptSummaryProvider);
                      ref.invalidate(allQuizAttemptsProvider);
                      ref.invalidate(dashboardProvider);
                      await onUnlocked();
                    }
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _Perks(items: _resolvePerks()),
        ],
      ),
    );
  }
}

class _Perks extends StatelessWidget {
  const _Perks({required this.items});

  final List<(IconData, String)> items;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "What's included",
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 14),
          for (final item in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 11),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppColors.emerald.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(7),
                    ),
                    child: Icon(item.$1, size: 14, color: AppColors.emerald),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Text(
                      item.$2,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: context.palette.textSecondary,
                            height: 1.4,
                          ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
