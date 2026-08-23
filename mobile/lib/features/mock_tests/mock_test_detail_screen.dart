import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/mock_test.dart';
import '../../data/models/quiz.dart';
import 'mock_tests_providers.dart';

/// One scheduled mock test: the details, the join action while it is live, and
/// the rank list once it has finished.
class MockTestDetailScreen extends ConsumerStatefulWidget {
  const MockTestDetailScreen({super.key, required this.mockTestId});

  final String mockTestId;

  @override
  ConsumerState<MockTestDetailScreen> createState() =>
      _MockTestDetailScreenState();
}

class _MockTestDetailScreenState extends ConsumerState<MockTestDetailScreen> {
  bool _joining = false;

  Future<void> _join(MockTest mock) async {
    setState(() => _joining = true);
    try {
      await ref.read(mockTestsRepositoryProvider).join(mock.id);
      ref.invalidate(mockTestProvider(mock.id));
      ref.invalidate(mockTestsProvider);
      if (!mounted) return;

      // Joining only reserves a seat; the paper itself is the underlying quiz.
      context.push(AppRoutes.quizAttempt(mock.quizId));
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mockAsync = ref.watch(mockTestProvider(widget.mockTestId));

    return Scaffold(
      appBar: AppBar(title: const Text('Mock test')),
      body: AsyncView(
        value: mockAsync,
        onRetry: () => ref.invalidate(mockTestProvider(widget.mockTestId)),
        data: (mock) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(mockLeaderboardProvider(mock.id));
            await ref.read(mockTestProvider(mock.id).future);
          },
          child: ListView(
            padding: const EdgeInsets.only(bottom: 28),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                child: _Header(mock: mock),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _Action(
                  mock: mock,
                  busy: _joining,
                  onJoin: () => _join(mock),
                ),
              ),
              if (mock.status == MockTestStatus.completed) ...[
                const SizedBox(height: 26),
                const SectionHeader(
                  title: 'Rank list',
                  icon: Icons.leaderboard_rounded,
                ),
                _Leaderboard(mockTestId: mock.id),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.mock});

  final MockTest mock;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final quiz = mock.quiz;
    final (accent, label) = switch (mock.status) {
      MockTestStatus.live => (AppColors.emerald, 'LIVE NOW'),
      MockTestStatus.upcoming => (AppColors.amber, 'UPCOMING'),
      MockTestStatus.completed => (AppColors.indigo, 'COMPLETED'),
    };

    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppBadge(label, color: accent, filled: mock.isLive),
              const Spacer(),
              Icon(Icons.groups_rounded, size: 14, color: palette.textMuted),
              const SizedBox(width: 5),
              Text(
                Fmt.count(mock.participantCount, 'aspirant'),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.textMuted,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            mock.title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                  height: 1.25,
                ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.event_rounded, size: 14, color: palette.textMuted),
              const SizedBox(width: 6),
              Text(
                Fmt.dateTime(mock.scheduledAt),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                    ),
              ),
            ],
          ),
          if (quiz != null) ...[
            const SizedBox(height: 18),
            Divider(color: palette.border),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: _Fact(
                    icon: Icons.help_outline_rounded,
                    value: '${quiz.totalQuestions}',
                    label: 'Questions',
                  ),
                ),
                Expanded(
                  child: _Fact(
                    icon: Icons.timer_outlined,
                    value: '${quiz.durationMinutes}m',
                    label: 'Duration',
                  ),
                ),
                Expanded(
                  child: _Fact(
                    icon: Icons.military_tech_outlined,
                    value: Fmt.marks(quiz.totalMarks),
                    label: 'Marks',
                  ),
                ),
              ],
            ),
            if (quiz.negativeMarking.enabled) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(11),
                decoration: BoxDecoration(
                  color: AppColors.rose.withValues(alpha: 0.09),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  border:
                      Border.all(color: AppColors.rose.withValues(alpha: 0.28)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.remove_circle_outline_rounded,
                        size: 15, color: AppColors.rose),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Text(
                        'Negative marking: −${Fmt.marks(quiz.negativeMarking.deduct)} '
                        'for every ${quiz.negativeMarking.every} wrong answers.',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.rose,
                              height: 1.4,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.value, required this.label});

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, size: 16, color: AppColors.cyan),
        const SizedBox(height: 6),
        Text(
          value,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w900,
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

class _Action extends ConsumerWidget {
  const _Action({required this.mock, required this.busy, required this.onJoin});

  final MockTest mock;
  final bool busy;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (mock.submitted) {
      return const LockedNotice(
        message: 'You have already submitted this mock test. '
            'Your rank appears in the list below once results are published.',
      );
    }

    switch (mock.status) {
      case MockTestStatus.live:
        return GradientButton(
          label: mock.joined ? 'Continue the test' : 'Join and start',
          icon: Icons.play_arrow_rounded,
          gradient: AppColors.goldGradient,
          isLoading: busy,
          onPressed: busy ? null : onJoin,
        );
      case MockTestStatus.upcoming:
        return GlassCard(
          borderColor: AppColors.amber.withValues(alpha: 0.35),
          child: Row(
            children: [
              const Icon(Icons.schedule_rounded,
                  color: AppColors.amber, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Starts ${Fmt.untilStart(mock.startsIn)}',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    Text(
                      'Come back at ${Fmt.timeOfDay(mock.scheduledAt)} to take the test.',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: context.palette.textMuted,
                            height: 1.4,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      case MockTestStatus.completed:
        return OutlinedButton.icon(
          onPressed: () => context.push(AppRoutes.quizAttempt(mock.quizId)),
          icon: const Icon(Icons.replay_rounded, size: 18),
          label: const Text('Practise this paper'),
        );
    }
  }
}

class _Leaderboard extends ConsumerWidget {
  const _Leaderboard({required this.mockTestId});

  final String mockTestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leaderboardAsync = ref.watch(mockLeaderboardProvider(mockTestId));
    final me = ref.watch(currentUserProvider);

    return leaderboardAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(horizontal: 16),
        child: Column(
          children: [
            SkeletonBox(height: 56, radius: AppTheme.radiusMd),
            SizedBox(height: 10),
            SkeletonBox(height: 56, radius: AppTheme.radiusMd),
            SizedBox(height: 10),
            SkeletonBox(height: 56, radius: AppTheme.radiusMd),
          ],
        ),
      ),
      error: (error, _) => ErrorView(
        error: error,
        compact: true,
        onRetry: () => ref.invalidate(mockLeaderboardProvider(mockTestId)),
      ),
      data: (entries) {
        if (entries.isEmpty) {
          return const EmptyView(
            icon: Icons.leaderboard_rounded,
            title: 'Rank list not published yet',
            message: 'Results appear here once the test window closes.',
          );
        }

        return Column(
          children: [
            for (final entry in entries)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 9),
                child: _RankRow(
                  entry: entry,
                  isMe: entry.userId == me?.id,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _RankRow extends StatelessWidget {
  const _RankRow({required this.entry, required this.isMe});

  final LeaderboardEntry entry;
  final bool isMe;

  /// Gold, silver and bronze for the podium; the brand cyan for everyone else.
  Color get _rankColor => switch (entry.rank) {
        1 => AppColors.gold,
        2 => const Color(0xFFC0C7D0),
        3 => const Color(0xFFCD7F32),
        _ => AppColors.cyan,
      };

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return GlassCard(
      highlighted: isMe,
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      child: Row(
        children: [
          SizedBox(
            width: 34,
            child: entry.rank <= 3
                ? Icon(Icons.emoji_events_rounded, color: _rankColor, size: 21)
                : Text(
                    '#${entry.rank}',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: palette.textMuted,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
          ),
          AppAvatar(
            imageUrl: entry.avatarUrl,
            name: entry.userName,
            size: 34,
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isMe ? '${entry.userName} (you)' : entry.userName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: isMe ? FontWeight.w800 : FontWeight.w600,
                      ),
                ),
                if (entry.timeTakenSeconds != null)
                  Text(
                    Fmt.elapsed(entry.timeTakenSeconds!),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: palette.textMuted,
                        ),
                  ),
              ],
            ),
          ),
          Text(
            entry.totalMarks == null
                ? Fmt.marks(entry.score)
                : '${Fmt.marks(entry.score)}/${Fmt.marks(entry.totalMarks!)}',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: isMe ? AppColors.cyan : null,
                ),
          ),
        ],
      ),
    );
  }
}
