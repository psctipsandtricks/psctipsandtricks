import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/mock_test.dart';
import 'mock_tests_providers.dart';

/// Scheduled live mock tests, grouped by whether they are running, still to
/// come, or already finished.
class MockTestsScreen extends ConsumerWidget {
  const MockTestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mocksAsync = ref.watch(mockTestsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Mock tests')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(mockTestsProvider.future),
        child: AsyncView(
          value: mocksAsync,
          onRetry: () => ref.invalidate(mockTestsProvider),
          data: (mocks) {
            if (mocks.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 60),
                  EmptyView(
                    icon: Icons.emoji_events_rounded,
                    title: 'No mock tests scheduled',
                    message:
                        'Live mock tests are announced ahead of time — watch this space.',
                  ),
                ],
              );
            }

            final live =
                mocks.where((m) => m.status == MockTestStatus.live).toList();
            final upcoming =
                mocks.where((m) => m.status == MockTestStatus.upcoming).toList()
                  ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
            final completed = mocks
                .where((m) => m.status == MockTestStatus.completed)
                .toList()
              ..sort((a, b) => b.scheduledAt.compareTo(a.scheduledAt));

            return ListView(
              padding: const EdgeInsets.only(bottom: 28),
              children: [
                const SizedBox(height: 10),
                if (live.isNotEmpty) ...[
                  const SectionHeader(
                    title: 'Live now',
                    subtitle: 'Join before the window closes',
                    icon: Icons.bolt_rounded,
                  ),
                  for (final mock in live)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: _MockCard(mock: mock),
                    ),
                  const SizedBox(height: 14),
                ],
                if (upcoming.isNotEmpty) ...[
                  const SectionHeader(
                    title: 'Upcoming',
                    icon: Icons.schedule_rounded,
                  ),
                  for (final mock in upcoming)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: _MockCard(mock: mock),
                    ),
                  const SizedBox(height: 14),
                ],
                if (completed.isNotEmpty) ...[
                  const SectionHeader(
                    title: 'Completed',
                    subtitle: 'Check where you placed',
                    icon: Icons.leaderboard_rounded,
                  ),
                  for (final mock in completed)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: _MockCard(mock: mock),
                    ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _MockCard extends StatelessWidget {
  const _MockCard({required this.mock});

  final MockTest mock;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final (accent, label) = switch (mock.status) {
      MockTestStatus.live => (AppColors.emerald, 'LIVE NOW'),
      MockTestStatus.upcoming => (
          AppColors.amber,
          Fmt.untilStart(mock.startsIn).toUpperCase()
        ),
      MockTestStatus.completed => (AppColors.indigo, 'COMPLETED'),
    };

    return GlassCard(
      onTap: () => context.push(AppRoutes.mockTest(mock.id)),
      highlighted: mock.isLive,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                ),
                child: Icon(Icons.emoji_events_rounded, color: accent, size: 19),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  mock.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        height: 1.3,
                      ),
                ),
              ),
              const SizedBox(width: 8),
              AppBadge(label, color: accent),
            ],
          ),
          const SizedBox(height: 13),
          Row(
            children: [
              Icon(Icons.event_rounded, size: 13, color: palette.textMuted),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  Fmt.dateTime(mock.scheduledAt),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
              ),
              if (mock.quiz != null) ...[
                Icon(Icons.help_outline_rounded,
                    size: 13, color: palette.textMuted),
                const SizedBox(width: 4),
                Text(
                  '${mock.quiz!.totalQuestions} Qs',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
                const SizedBox(width: 10),
                Icon(Icons.timer_outlined, size: 13, color: palette.textMuted),
                const SizedBox(width: 4),
                Text(
                  '${mock.quiz!.durationMinutes}m',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
