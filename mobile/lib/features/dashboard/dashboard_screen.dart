import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/responsive.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/dashboard.dart';
import 'dashboard_providers.dart';
import '../shell/shell_scaffold.dart';

/// The student's progress dashboard: streaks, score trend, subject strengths,
/// recent attempts and books in progress.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardAsync = ref.watch(dashboardProvider);

    return Scaffold(
      appBar: const GlassAppBar(title: Text('My progress')),
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

            return Responsive.centered(
              maxWidth: Responsive.maxContentWidth,
              child: ListView(
                padding: const EdgeInsets.only(
                    bottom: 28 + ShellScaffold.dockExtent),
                children: [
                  const SizedBox(height: 8),
                  _StatsGrid(stats: dashboard.stats),
                  const SizedBox(height: 10),
                  _OverallAccuracyCard(
                    stats: dashboard.stats,
                    subjects: dashboard.subjects,
                  ),
                  if (dashboard.trend.length > 1) ...[
                    const SizedBox(height: 26),
                    const SectionHeader(
                      title: 'Score trend',
                      subtitle: 'Your last few attempts',
                      icon: Icons.show_chart_rounded,
                    ),
                    _TrendChart(trend: dashboard.trend),
                  ],
                  if (dashboard.inProgressQuizzes.isNotEmpty) ...[
                    const SizedBox(height: 26),
                    SectionHeader(
                      title: 'Resume quiz',
                      icon: Icons.play_circle_outline_rounded,
                      actionLabel: 'All attempts',
                      onAction: () => context.push(AppRoutes.quizHistory),
                    ),
                    for (final quiz in dashboard.inProgressQuizzes)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                        child: _InProgressQuizCard(quiz: quiz),
                      ),
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
              ),
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

    final card1 = _StatCard(
      icon: Icons.percent_rounded,
      label: 'Average score',
      value: Fmt.percent(stats.averagePercent),
      color: AppColors.cyan,
      delta: delta.abs() >= 1 ? delta : null,
    );

    // Accuracy and the day streak used to sit here as two more tiles. They
    // read better as the ring and the flame on the Overall Accuracy card
    // below, and the same number twice on one screen is just noise.
    final card2 = _StatCard(
      icon: Icons.assignment_turned_in_rounded,
      label: 'Attempts',
      value: '${stats.totalAttempts}',
      color: AppColors.indigo,
    );

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: Responsive.horizontalPadding(context),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: card1),
              const SizedBox(width: 10),
              Expanded(child: card2),
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

/// The web dashboard's Overall Accuracy card, brought across: the accuracy
/// ring, the pass rate, the study streak, and the subjects the student is
/// strongest at.
///
/// Accuracy is correct-out-of-attempted, which is a different question from the
/// average score in the tiles above — the ring is here so the two are not read
/// as the same number.
class _OverallAccuracyCard extends StatelessWidget {
  const _OverallAccuracyCard({required this.stats, required this.subjects});

  final DashboardStats stats;
  final List<SubjectPerformance> subjects;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final passRate = stats.totalAttempts > 0
        ? (stats.passedCount / stats.totalAttempts) * 100
        : 0.0;
    final strongest = [...subjects]
      ..sort((a, b) => b.averagePercent.compareTo(a.averagePercent));

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: Responsive.horizontalPadding(context),
      ),
      child: GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Overall accuracy',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                _AccuracyRing(value: stats.accuracyPercent),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _CardStat(
                        label: 'Pass rate',
                        value: Fmt.percent(passRate),
                        suffix: '(${stats.passedCount}/${stats.totalAttempts})',
                        color: AppColors.emerald,
                      ),
                      const SizedBox(height: 14),
                      _CardStat(
                        label: 'Study streak',
                        value: Fmt.count(stats.streakDays, 'day'),
                        icon: Icons.local_fire_department_rounded,
                        color: AppColors.amber,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (strongest.isNotEmpty) ...[
              const SizedBox(height: 16),
              Divider(color: palette.border, height: 1),
              const SizedBox(height: 14),
              Text(
                'STRONGEST SUBJECTS',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.textMuted,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.6,
                      fontSize: 10.5,
                    ),
              ),
              for (final subject in strongest.take(4)) ...[
                const SizedBox(height: 10),
                _SubjectBar(subject: subject),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _CardStat extends StatelessWidget {
  const _CardStat({
    required this.label,
    required this.value,
    required this.color,
    this.suffix,
    this.icon,
  });

  final String label;
  final String value;
  final Color color;
  final String? suffix;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: palette.textMuted,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
                fontSize: 10.5,
              ),
        ),
        const SizedBox(height: 3),
        // Wrap, not Row: at the largest text size this app allows, the value
        // and its bracketed detail no longer fit side by side on a phone.
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 5,
          children: [
            if (icon != null) Icon(icon, size: 17, color: color),
            Text(
              value,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
            ),
            if (suffix != null)
              Text(
                suffix!,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.textMuted,
                    ),
              ),
          ],
        ),
      ],
    );
  }
}

class _SubjectBar extends StatelessWidget {
  const _SubjectBar({required this.subject});

  final SubjectPerformance subject;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final percent = subject.averagePercent;
    final tone = percent >= 75
        ? AppColors.emerald
        : percent >= 40
            ? AppColors.amber
            : AppColors.rose;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                subject.category,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context)
                    .textTheme
                    .labelMedium
                    ?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              Fmt.percent(percent, decimals: percent % 1 == 0 ? 0 : 1),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: tone,
                  ),
            ),
            const SizedBox(width: 3),
            Text(
              '(${subject.attempts})',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: palette.textMuted,
                  ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            // A sliver of colour even at 0%, so an empty bar still reads as a
            // bar rather than as a missing one.
            value: (percent / 100).clamp(0.02, 1.0),
            minHeight: 6,
            backgroundColor: palette.elevated,
            valueColor: const AlwaysStoppedAnimation(AppColors.cyan),
          ),
        ),
      ],
    );
  }
}

/// Circular gauge for overall accuracy — reads faster than another number in a
/// column of numbers. Mirrors the ring on the website.
class _AccuracyRing extends StatelessWidget {
  const _AccuracyRing({required this.value});

  final double value;

  static const double _size = 108;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return SizedBox(
      width: _size,
      height: _size,
      child: CustomPaint(
        painter: _AccuracyRingPainter(
          value: value,
          track: palette.elevated,
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                Fmt.percent(value),
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                      height: 1.1,
                    ),
              ),
              Text(
                'ACCURACY',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.textMuted,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                      fontSize: 9.5,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AccuracyRingPainter extends CustomPainter {
  const _AccuracyRingPainter({required this.value, required this.track});

  final double value;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 9.0;
    final rect = Offset.zero & size;
    final arcRect = rect.deflate(stroke / 2);
    final clamped = (value / 100).clamp(0.0, 1.0);

    canvas.drawArc(
      arcRect,
      0,
      2 * math.pi,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = track,
    );

    if (clamped <= 0) return;

    canvas.drawArc(
      arcRect,
      // Twelve o'clock, clockwise, the way the website's ring runs.
      -math.pi / 2,
      2 * math.pi * clamped,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..shader = const LinearGradient(
          colors: [AppColors.cyan, AppColors.blue],
        ).createShader(arcRect),
    );
  }

  @override
  bool shouldRepaint(_AccuracyRingPainter old) =>
      old.value != value || old.track != track;
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
                            color: rising ? AppColors.emerald : AppColors.rose,
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
    final points = trend.length > 10 ? trend.sublist(trend.length - 10) : trend;

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

class _BookProgressCard extends StatelessWidget {
  const _BookProgressCard({required this.book});

  final BookProgress book;

  /// Portrait, because these are books. The 3:4 hero cover is the artwork the
  /// admin uploads for exactly this purpose; the 16:9 catalog banner that used
  /// to be shown here is a landscape thumbnail and read as a video, not a book.
  static const double _coverWidth = 56;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final accent = book.isCompleted ? AppColors.emerald : AppColors.cyan;
    final progress = (book.progressPercent / 100).clamp(0.0, 1.0);

    return GlassCard(
      // A finished book has no position worth resuming; it reopens from the
      // top, the way "Read again" does elsewhere.
      onTap: () => context.push(
        AppRoutes.bookReader(book.bookId, resume: !book.isCompleted),
      ),
      borderColor:
          book.isCompleted ? AppColors.emerald.withValues(alpha: 0.35) : null,
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Cover(book: book, width: _coverWidth, accent: accent),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        book.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              height: 1.25,
                            ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // The affordance the row was missing: something to say a
                    // tap carries on reading rather than opening a detail page.
                    Icon(
                      book.isCompleted
                          ? Icons.replay_rounded
                          : Icons.play_circle_fill_rounded,
                      size: 22,
                      color: accent,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      book.isCompleted
                          ? Icons.check_circle_rounded
                          : Icons.bookmark_rounded,
                      size: 12,
                      color: book.isCompleted ? AppColors.emerald : palette.textMuted,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        book.isCompleted
                            ? 'Finished — read it again'
                            : book.resumeLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: book.isCompleted
                                  ? AppColors.emerald
                                  : palette.textMuted,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: progress,
                          minHeight: 7,
                          backgroundColor: palette.elevated,
                          valueColor: AlwaysStoppedAnimation(accent),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '${book.progressPercent}%',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: accent,
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

/// The book's portrait cover, with the read-so-far painted down its spine.
///
/// A percentage is already printed beside the bar; this is the same fact where
/// the eye lands first, so a glance down the list shows how far along each book
/// is without reading a single number.
class _Cover extends StatelessWidget {
  const _Cover({required this.book, required this.width, required this.accent});

  final BookProgress book;
  final double width;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final height = width * 4 / 3;

    return SizedBox(
      width: width,
      height: height,
      child: Stack(
        children: [
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.10),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              // In the foreground, because the artwork fills the box — a
              // background border would be painted over by the image itself.
              foregroundDecoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                border: Border.all(color: palette.border),
              ),
              child: AppImage(
                url: book.effectiveHeroCoverUrl,
                width: width,
                height: height,
                radius: AppTheme.radiusMd,
                fallbackIcon: Icons.menu_book_rounded,
                // A landscape banner standing in for a missing hero cover keeps
                // its top half, which is where the title is printed.
                alignment: Alignment.topCenter,
              ),
            ),
          ),
          // The spine fill, drawn up from the bottom edge.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: ClipRRect(
              borderRadius: BorderRadius.vertical(
                bottom: Radius.circular(AppTheme.radiusMd),
              ),
              child: Container(
                height: 5,
                color: Colors.black.withValues(alpha: 0.35),
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: (book.progressPercent / 100).clamp(0.0, 1.0),
                  child: Container(color: accent),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InProgressQuizCard extends StatelessWidget {
  const _InProgressQuizCard({required this.quiz});

  final InProgressQuiz quiz;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: () => context.push(AppRoutes.quizAttempt(quiz.quizId)),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.cyan.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            ),
            child: const Icon(Icons.play_circle_fill_rounded,
                color: AppColors.cyan, size: 22),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  quiz.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                Text(
                  '${quiz.answeredCount}/${quiz.totalQuestions} answered'
                  '${quiz.remainingSeconds > 0 ? ' · ${Fmt.elapsed(quiz.remainingSeconds)} left' : ''}',
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
                          value: quiz.progressPercent / 100,
                          minHeight: 5,
                          backgroundColor: context.palette.elevated,
                          valueColor:
                              const AlwaysStoppedAnimation(AppColors.cyan),
                        ),
                      ),
                    ),
                    const SizedBox(width: 9),
                    Text(
                      '${quiz.progressPercent}%',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: AppColors.cyan,
                          ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            onPressed: () => context.push(AppRoutes.quizAttempt(quiz.quizId)),
            child: const Text('Resume'),
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
                    : Fmt.untilStart(
                            mock.scheduledAt.difference(DateTime.now()))
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
            Expanded(
                child: SkeletonBox(height: 108, radius: AppTheme.radiusLg)),
            SizedBox(width: 10),
            Expanded(
                child: SkeletonBox(height: 108, radius: AppTheme.radiusLg)),
          ],
        ),
        SizedBox(height: 10),
        Row(
          children: [
            Expanded(
                child: SkeletonBox(height: 108, radius: AppTheme.radiusLg)),
            SizedBox(width: 10),
            Expanded(
                child: SkeletonBox(height: 108, radius: AppTheme.radiusLg)),
          ],
        ),
        SizedBox(height: 26),
        SkeletonBox(height: 210, radius: AppTheme.radiusLg),
      ],
    );
  }
}
