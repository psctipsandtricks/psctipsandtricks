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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final needsLogin = access.needsLogin;

    return Scaffold(
      appBar: GlassAppBar(title: Text(appBarTitle ?? 'Premium question bank')),
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
                    child: const Icon(Icons.lock_rounded,
                        color: AppColors.amber, size: 30),
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
                  subtitle ??
                      (needsLogin
                          ? 'Sign in to check whether you already own this question bank.'
                          : 'This question bank is premium. Complete the payment to '
                              'unlock the questions and attempt it.'),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: palette.textSecondary,
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
                      'One-time payment · lifetime access',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                          ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                GradientButton(
                  label: needsLogin ? 'Sign in to continue' : 'Unlock now',
                  icon: needsLogin ? Icons.login_rounded : Icons.lock_open_rounded,
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
                    if (bought) await onUnlocked();
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _Perks(items: perks ?? quizPerks),
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
