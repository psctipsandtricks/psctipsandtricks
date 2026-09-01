import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/quiz.dart';
import 'quizzes_providers.dart';

/// Every attempt the student has completed, newest first.
class QuizHistoryScreen extends ConsumerWidget {
  const QuizHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(quizHistoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My attempts')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(quizHistoryProvider.future),
        child: AsyncView(
          value: historyAsync,
          onRetry: () => ref.invalidate(quizHistoryProvider),
          data: (attempts) {
            final completed = attempts
                .where((a) => a.status == AttemptStatus.completed)
                .toList()
              ..sort((a, b) => (b.submittedAt ?? DateTime(0))
                  .compareTo(a.submittedAt ?? DateTime(0)));

            if (completed.isEmpty) {
              return ListView(
                children: [
                  const SizedBox(height: 60),
                  EmptyView(
                    icon: Icons.history_rounded,
                    title: 'No attempts yet',
                    message:
                        'Finish a quiz and your score, accuracy and rank will show up here.',
                    action: FilledButton(
                      onPressed: () => context.go(AppRoutes.quizzes),
                      child: const Text('Browse the Quiz Hub'),
                    ),
                  ),
                ],
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: completed.length + 1,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                if (index == 0) return _Summary(attempts: completed);
                return _AttemptCard(attempt: completed[index - 1]);
              },
            );
          },
        ),
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.attempts});

  final List<QuizAttempt> attempts;

  @override
  Widget build(BuildContext context) {
    final total = attempts.length;
    final passed = attempts.where((a) => a.passed).length;
    final avg = total == 0
        ? 0.0
        : attempts.fold<double>(0, (sum, a) => sum + a.percentage) / total;

    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          Expanded(
            child: _SummaryStat(label: 'Attempts', value: '$total'),
          ),
          _Divider(),
          Expanded(
            child: _SummaryStat(
              label: 'Passed',
              value: '$passed',
              color: AppColors.emerald,
            ),
          ),
          _Divider(),
          Expanded(
            child: _SummaryStat(
              label: 'Avg. score',
              value: Fmt.percent(avg),
              color: AppColors.cyan,
            ),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 30,
        child: VerticalDivider(color: context.palette.border, width: 1),
      );
}

class _SummaryStat extends StatelessWidget {
  const _SummaryStat({required this.label, required this.value, this.color});

  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w900,
                color: color,
              ),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: context.palette.textMuted,
              ),
        ),
      ],
    );
  }
}

class _AttemptCard extends StatelessWidget {
  const _AttemptCard({required this.attempt});

  final QuizAttempt attempt;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final accent = attempt.passed ? AppColors.emerald : AppColors.amber;

    return GlassCard(
      // Opens the same server-scored result the student saw on submitting;
      // retaking is the deliberate second step inside it.
      onTap: () => context.push(AppRoutes.quizResult(attempt.id)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      attempt.quizTitle ?? 'Quiz attempt',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            height: 1.3,
                          ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${Fmt.relative(attempt.submittedAt)} · Attempt #${attempt.attemptNumber}',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  border: Border.all(color: accent.withValues(alpha: 0.32)),
                ),
                child: Column(
                  children: [
                    Text(
                      Fmt.percent(attempt.percentage),
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: accent,
                          ),
                    ),
                    Text(
                      '${Fmt.marks(attempt.score)}/${Fmt.marks(attempt.totalMarks)}',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                            fontSize: 10,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 13),
          Row(
            children: [
              _Pill(
                icon: Icons.check_circle_rounded,
                label: '${attempt.correctAnswers}',
                color: AppColors.emerald,
              ),
              const SizedBox(width: 8),
              _Pill(
                icon: Icons.cancel_rounded,
                label: '${attempt.wrongAnswers}',
                color: AppColors.rose,
              ),
              const SizedBox(width: 8),
              _Pill(
                icon: Icons.remove_circle_rounded,
                label: '${attempt.unattempted}',
                color: AppColors.amber,
              ),
              const Spacer(),
              Icon(Icons.timer_outlined, size: 13, color: palette.textMuted),
              const SizedBox(width: 4),
              Text(
                Fmt.elapsed(attempt.timeTakenSeconds),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.textMuted,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.fact_check_outlined,
                  size: 14, color: AppColors.cyan),
              const SizedBox(width: 6),
              Text(
                'Review answers',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.cyan,
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const Spacer(),
              Icon(Icons.chevron_right_rounded,
                  size: 16, color: palette.textMuted),
            ],
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.icon, required this.label, required this.color});

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.11),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      ),
    );
  }
}
