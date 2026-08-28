import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/dashboard.dart';
import 'dashboard_providers.dart';

/// The student's progress dashboard: streaks, score trend, subject strengths,
/// recent attempts and books in progress.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardAsync = ref.watch(dashboardProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My progress')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(dashboardProvider.future),
        child: AsyncView(
          value: dashboardAsync,
          onRetry: () => ref.invalidate(dashboardProvider),
          loading: const _DashboardSkeleton(),
          data: (dashboard) {
            if (dashboard.isEmpty) {
              return ListView(
                children: [
                  const SizedBox(height: 50),
                  EmptyView(
                    icon: Icons.insights_rounded,
                    title: 'Nothing to chart yet',
                    message:
                        'Attempt a quiz or open a book and your progress will appear here.',
                    action: FilledButton(
                      onPressed: () => context.go(AppRoutes.quizzes),
                      child: const Text('Take your first quiz'),
                    ),
                  ),
                ],
              );
            }

            return ListView(
              padding: const EdgeInsets.only(bottom: 28),
              children: [
                const SizedBox(height: 8),
                _StatsGrid(stats: dashboard.stats),

                if (dashboard.trend.length > 1) ...[
                  const SizedBox(height: 26),
                  const SectionHeader(
                    title: 'Score trend',
                    subtitle: 'Your last few attempts',
                    icon: Icons.show_chart_rounded,
                  ),
                  _TrendChart(trend: dashboard.trend),
                ],

                if (dashboard.subjects.isNotEmpty) ...[
                  const SizedBox(height: 26),
                  const SectionHeader(
                    title: 'Subject strengths',
                    subtitle: 'Average score by category',
                    icon: Icons.category_rounded,
                  ),
                  _Subjects(subjects: dashboard.subjects),
                ],

                if (dashboard.booksInProgress.isNotEmpty) ...[
                  const SizedBox(height: 26),
                  SectionHeader(
                    title: 'Books in progress',
                    icon: Icons.auto_stories_rounded,
                    actionLabel: 'All books',
                    onAction: () => context.go(AppRoutes.books),
                  ),
                  for (final book in dashboard.booksInProgress)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                      child: _BookProgressCard(book: book),
                    ),
                ],

                if (dashboard.upcomingMockTests.isNotEmpty) ...[
                  const SizedBox(height: 26),
                  SectionHeader(
                    title: 'Upcoming mock tests',
                    icon: Icons.emoji_events_rounded,
                    actionLabel: 'All',
                    onAction: () => context.push(AppRoutes.mockTests),
                  ),
                  for (final mock in dashboard.upcomingMockTests)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                      child: _MockTestRow(mock: mock),
                    ),
                ],

                if (dashboard.recentAttempts.isNotEmpty) ...[
                  const SizedBox(height: 26),
                  SectionHeader(
                    title: 'Recent attempts',
                    icon: Icons.history_rounded,
                    actionLabel: 'Full history',
                    onAction: () => context.push(AppRoutes.quizHistory),
                  ),
                  for (final attempt in dashboard.recentAttempts.take(5))
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                      child: _AttemptRow(attempt: attempt),
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

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});

  final DashboardStats stats;

  @override
  Widget build(BuildContext context) {
    final delta = stats.weeklyDelta;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.percent_rounded,
                  label: 'Average score',
                  value: Fmt.percent(stats.averagePercent),
                  color: AppColors.cyan,
                  // Only surface the week-over-week move once it is meaningful;
                  // a 0.2-point wobble is noise, not a trend.
                  delta: delta.abs() >= 1 ? delta : null,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _StatCard(
                  icon: Icons.my_location_rounded,
                  label: 'Accuracy',
                  value: Fmt.percent(stats.accuracyPercent),
                  color: AppColors.emerald,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.local_fire_department_rounded,
                  label: 'Day streak',
                  value: '${stats.streakDays}',
                  color: AppColors.amber,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _StatCard(
                  icon: Icons.assignment_turned_in_rounded,
                  label: 'Attempts',
                  value: '${stats.totalAttempts}',
                  color: AppColors.indigo,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          GlassCard(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Row(
              children: [
                Expanded(
                  child: _MiniStat(
                    label: 'Study hours',
                    value: stats.studyHours.toStringAsFixed(1),
                  ),
                ),
                _VDivider(),
                Expanded(
                  child: _MiniStat(
                    label: 'Passed',
                    value: '${stats.passedCount}',
                  ),
                ),
                _VDivider(),
                Expanded(
                  child: _MiniStat(
                    label: 'Best rank',
                    value: stats.bestRank == null ? '—' : '#${stats.bestRank}',
                  ),
                ),
                _VDivider(),
                Expanded(
                  child: _MiniStat(
                    label: 'Mock tests',
                    value: '${stats.mockTestsTaken}',
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

class _VDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 28,
        child: VerticalDivider(color: context.palette.border, width: 1),
      );
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w900,
              ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: context.palette.textMuted,
                fontSize: 10.5,
              ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    this.delta,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final double? delta;

  @override
  Widget build(BuildContext context) {
    final rising = (delta ?? 0) >= 0;

    return GlassCard(
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 15, color: color),
              ),
              const Spacer(),
              if (delta != null)
                Row(
                  children: [
                    Icon(
                      rising
                          ? Icons.trending_up_rounded
                          : Icons.trending_down_rounded,
                      size: 13,
                      color: rising ? AppColors.emerald : AppColors.rose,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      '${delta!.abs().toStringAsFixed(0)}%',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color:
                                rising ? AppColors.emerald : AppColors.rose,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
          ),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: context.palette.textMuted,
                ),
          ),
        ],
      ),
    );
  }
}

class _TrendChart extends StatelessWidget {
  const _TrendChart({required this.trend});

  final List<TrendPoint> trend;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    // Cap the series so a long history stays readable on a phone.
    final points = trend.length > 10
        ? trend.sublist(trend.length - 10)
        : trend;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GlassCard(
        padding: const EdgeInsets.fromLTRB(6, 20, 16, 10),
        child: SizedBox(
          height: 190,
          child: LineChart(
            LineChartData(
              minY: 0,
              maxY: 100,
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                horizontalInterval: 25,
                getDrawingHorizontalLine: (_) => FlLine(
                  color: palette.border,
                  strokeWidth: 1,
                  dashArray: const [4, 4],
                ),
              ),
              borderData: FlBorderData(show: false),
              titlesData: FlTitlesData(
                topTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    interval: 25,
                    reservedSize: 34,
                    getTitlesWidget: (value, _) => Text(
                      '${value.toInt()}%',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                            fontSize: 10,
                          ),
                    ),
                  ),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 26,
                    interval: 1,
                    getTitlesWidget: (value, _) {
                      final index = value.toInt();
                      if (index < 0 || index >= points.length) {
                        return const SizedBox.shrink();
                      }
                      // Thin the labels so they never overlap.
                      final step = (points.length / 4).ceil();
                      if (index % step != 0) return const SizedBox.shrink();
                      return Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          points[index].label,
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: palette.textMuted,
                                    fontSize: 10,
                                  ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              lineTouchData: LineTouchData(
                touchTooltipData: LineTouchTooltipData(
                  getTooltipColor: (_) => palette.elevated,
                  getTooltipItems: (spots) => spots
                      .map(
                        (spot) => LineTooltipItem(
                          '${spot.y.toStringAsFixed(0)}%',
                          TextStyle(
                            color: palette.textPrimary,
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
              lineBarsData: [
                LineChartBarData(
                  spots: [
                    for (var i = 0; i < points.length; i++)
                      FlSpot(i.toDouble(), points[i].percentage),
                  ],
                  isCurved: true,
                  curveSmoothness: 0.28,
                  barWidth: 3,
                  gradient: AppColors.brandGradient,
                  dotData: FlDotData(
                    show: points.length <= 8,
                    getDotPainter: (_, __, ___, ____) => FlDotCirclePainter(
                      radius: 3.5,
                      color: AppColors.cyan,
                      strokeWidth: 2,
                      strokeColor: palette.card,
                    ),
                  ),
                  belowBarData: BarAreaData(
                    show: true,
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        AppColors.cyan.withValues(alpha: 0.26),
                        AppColors.cyan.withValues(alpha: 0),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Subjects extends StatelessWidget {
  const _Subjects({required this.subjects});

  final List<SubjectPerformance> subjects;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final ranked = [...subjects]
      ..sort((a, b) => b.averagePercent.compareTo(a.averagePercent));

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GlassCard(
        child: Column(
          children: [
            for (var i = 0; i < ranked.length; i++) ...[
              if (i > 0) const SizedBox(height: 15),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          ranked[i].category,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      Text(
                        '${Fmt.percent(ranked[i].averagePercent)} · ${Fmt.count(ranked[i].attempts, 'attempt')}',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: palette.textMuted,
                            ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 7),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: (ranked[i].averagePercent / 100).clamp(0.0, 1.0),
                      minHeight: 6,
                      backgroundColor: palette.elevated,
                      valueColor: AlwaysStoppedAnimation(
                        ranked[i].averagePercent >= 60
                            ? AppColors.emerald
                            : ranked[i].averagePercent >= 40
                                ? AppColors.amber
                                : AppColors.rose,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _BookProgressCard extends StatelessWidget {
  const _BookProgressCard({required this.book});

  final BookProgress book;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: () => context.push(AppRoutes.bookReader(book.bookId, resume: true)),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          BookCover(
            url: book.heroCoverUrl ?? book.coverUrl,
            width: 48,
            aspectRatio: book.heroCoverUrl != null ? (4 / 3) : (9 / 16),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  book.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                Text(
                  book.resumeLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: context.palette.textMuted,
                      ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(3),
                        child: LinearProgressIndicator(
                          value: book.progressPercent / 100,
                          minHeight: 5,
                          backgroundColor: context.palette.elevated,
                          valueColor: AlwaysStoppedAnimation(
                            book.isCompleted
                                ? AppColors.emerald
                                : AppColors.cyan,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 9),
                    Text(
                      '${book.progressPercent}%',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: book.isCompleted
                                ? AppColors.emerald
                                : AppColors.cyan,
                          ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MockTestRow extends StatelessWidget {
  const _MockTestRow({required this.mock});

  final UpcomingMockTest mock;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return GlassCard(
      onTap: () => context.push(AppRoutes.mockTest(mock.id)),
      padding: const EdgeInsets.all(13),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: AppColors.amber.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            ),
            child: const Icon(Icons.emoji_events_rounded,
                color: AppColors.amber, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  mock.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                Text(
                  '${Fmt.dateTime(mock.scheduledAt)} · ${Fmt.count(mock.participantCount, 'aspirant')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          AppBadge(
            mock.submitted
                ? 'DONE'
                : mock.joined
                    ? 'JOINED'
                    : Fmt.untilStart(mock.scheduledAt.difference(DateTime.now()))
                        .toUpperCase(),
            color: mock.submitted ? AppColors.emerald : AppColors.amber,
          ),
        ],
      ),
    );
  }
}

class _AttemptRow extends StatelessWidget {
  const _AttemptRow({required this.attempt});

  final DashboardAttempt attempt;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final accent = attempt.passed ? AppColors.emerald : AppColors.amber;

    return GlassCard(
      padding: const EdgeInsets.all(13),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  attempt.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                Text(
                  '${attempt.category} · ${Fmt.relative(attempt.submittedAt)}'
                  '${attempt.rank != null ? ' · Rank #${attempt.rank}' : ''}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            Fmt.percent(attempt.percentage),
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: accent,
                ),
          ),
        ],
      ),
    );
  }
}

class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        Row(
          children: [
            Expanded(child: SkeletonBox(height: 108, radius: AppTheme.radiusLg)),
            SizedBox(width: 10),
            Expanded(child: SkeletonBox(height: 108, radius: AppTheme.radiusLg)),
          ],
        ),
        SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: SkeletonBox(height: 108, radius: AppTheme.radiusLg)),
            SizedBox(width: 10),
            Expanded(child: SkeletonBox(height: 108, radius: AppTheme.radiusLg)),
          ],
        ),
        SizedBox(height: 26),
        SkeletonBox(height: 210, radius: AppTheme.radiusLg),
      ],
    );
  }
}
