import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/pdf_downloader.dart';
import '../../core/utils/quiz_pdf_generator.dart';
import '../../core/utils/responsive.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/pagination_bar.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/quiz.dart';
import 'quizzes_providers.dart';
import '../shell/shell_scaffold.dart';

/// Every attempt the student has completed or has in progress, with instant search,
/// multi-status filter chips, lifetime performance stats, and pagination.
class QuizHistoryScreen extends ConsumerStatefulWidget {
  const QuizHistoryScreen({super.key});

  @override
  ConsumerState<QuizHistoryScreen> createState() => _QuizHistoryScreenState();
}

class _QuizHistoryScreenState extends ConsumerState<QuizHistoryScreen> {
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _searchController.text = ref.read(quizHistorySearchProvider);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      ref.read(quizHistorySearchProvider.notifier).state = value.trim();
      ref.read(quizHistoryPageIndexProvider.notifier).state = 1;
    });
    setState(() {});
  }

  void _onFilterSelected(String filter) {
    ref.read(quizHistoryFilterProvider.notifier).state = filter;
    ref.read(quizHistoryPageIndexProvider.notifier).state = 1;
  }

  void _clearFilters() {
    _searchController.clear();
    ref.read(quizHistorySearchProvider.notifier).state = '';
    ref.read(quizHistoryFilterProvider.notifier).state = 'All';
    ref.read(quizHistoryPageIndexProvider.notifier).state = 1;
    setState(() {});
  }

  void _goToPage(int page) {
    ref.read(quizHistoryPageIndexProvider.notifier).state = page;
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final search = ref.watch(quizHistorySearchProvider);
    final filter = ref.watch(quizHistoryFilterProvider);
    final historyAsync = ref.watch(quizHistoryViewProvider);

    return Scaffold(
      appBar: GlassAppBar(
        title: const Text('My attempts'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(104),
          child: Responsive.centered(
            maxWidth: Responsive.maxContentWidth,
            child: Column(
              children: [
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    Responsive.horizontalPadding(context),
                    0,
                    Responsive.horizontalPadding(context),
                    12,
                  ),
                  child: AppSearchField(
                    controller: _searchController,
                    hintText: 'Search attempts by quiz title…',
                    onChanged: _onSearchChanged,
                    onClear: () {
                      ref.read(quizHistorySearchProvider.notifier).state = '';
                      ref.read(quizHistoryPageIndexProvider.notifier).state = 1;
                    },
                  ),
                ),
                FilterChipsRow(
                  options: quizHistoryFilterOptions,
                  selected: filter,
                  onSelected: _onFilterSelected,
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(allQuizAttemptsProvider.future),
        child: AsyncView(
          value: historyAsync,
          onRetry: () => ref.invalidate(allQuizAttemptsProvider),
          data: (view) {
            if (view.lifetimeAttempts == 0) {
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

            final isFiltered = search.isNotEmpty || filter != 'All';

            if (view.attempts.isEmpty && isFiltered) {
              return ListView(
                padding: const EdgeInsets.fromLTRB(
                    16, 12, 16, 24 + ShellScaffold.dockExtent),
                children: [
                  _Summary(
                    totalAttempts: view.lifetimeAttempts,
                    passed: view.lifetimePassed,
                    avgPercentage: view.lifetimeAvgPercentage,
                  ),
                  const SizedBox(height: 32),
                  EmptyView(
                    icon: Icons.search_off_rounded,
                    title: 'No matching attempts',
                    message: search.isNotEmpty
                        ? 'No attempts match "$search" with filter "$filter".'
                        : 'No attempts found under "$filter".',
                    action: OutlinedButton(
                      onPressed: _clearFilters,
                      child: const Text('Clear filters'),
                    ),
                  ),
                ],
              );
            }

            return ListView.separated(
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(
                  16, 12, 16, 24 + ShellScaffold.dockExtent),
              itemCount: view.attempts.length + 2,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                if (index == 0) {
                  return _Summary(
                    totalAttempts: view.lifetimeAttempts,
                    passed: view.lifetimePassed,
                    avgPercentage: view.lifetimeAvgPercentage,
                  );
                }
                if (index == view.attempts.length + 1) {
                  if (view.totalFiltered <= 10) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: PaginationBar(
                      currentPage: view.page,
                      totalPages: view.totalPages,
                      totalItems: view.totalFiltered,
                      itemNoun: 'attempts',
                      onPageChanged: _goToPage,
                    ),
                  );
                }
                return _AttemptCard(attempt: view.attempts[index - 1]);
              },
            );
          },
        ),
      ),
    );
  }
}


class _Summary extends StatelessWidget {
  const _Summary({
    required this.totalAttempts,
    required this.passed,
    required this.avgPercentage,
  });

  final int totalAttempts;
  final int passed;
  final double avgPercentage;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          Expanded(
            child: _SummaryStat(label: 'Attempts', value: '$totalAttempts'),
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
              value: Fmt.percent(avgPercentage),
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

class _AttemptCard extends ConsumerStatefulWidget {
  const _AttemptCard({required this.attempt});

  final QuizAttempt attempt;

  @override
  ConsumerState<_AttemptCard> createState() => _AttemptCardState();
}

class _AttemptCardState extends ConsumerState<_AttemptCard> {
  bool _downloadingPdf = false;

  /// Builds and saves the same "solutions PDF" the result screen offers —
  /// every question, its correct answer, what was picked, and any explanation.
  /// Premium-only: the history list carries no questions, so this fetches the
  /// full review on demand rather than keeping it loaded for every card.
  Future<void> _downloadSolutionsPdf() async {
    if (_downloadingPdf) return;
    final attempt = widget.attempt;
    setState(() => _downloadingPdf = true);
    try {
      final review =
          await ref.read(quizzesRepositoryProvider).fetchAttemptReview(attempt.id);
      final bytes = await QuizPdfGenerator.generate(
        quizTitle: review.quizTitle,
        score: review.score,
        totalMarks: review.totalMarks,
        questions: [
          for (final question in review.questions)
            QuizPdfQuestion(
              text: question.text,
              options: [
                for (final option in question.options)
                  QuizPdfOption(text: option.text, explanation: option.explanation),
              ],
              correctIndex: question.correctOptionIndex ?? -1,
              explanation: question.explanation,
              marks: question.marks,
              userSelection: question.selectedOptionIndex,
            ),
        ],
      );
      if (!mounted) return;
      await PdfDownloader.saveBytes(
        context,
        bytes: bytes,
        title: '${review.quizTitle} - Solutions',
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not generate the solutions PDF: $e'),
          backgroundColor: AppColors.rose,
          duration: const Duration(seconds: 4),
        ),
      );
    } finally {
      if (mounted) setState(() => _downloadingPdf = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final attempt = widget.attempt;
    final palette = context.palette;
    final inProgress = attempt.status == AttemptStatus.inProgress;
    final accent = inProgress
        ? AppColors.amber
        : (attempt.passed ? AppColors.emerald : AppColors.amber);

    return GlassCard(
      // Opens the in-progress attempt for resuming, or server-scored result for completed
      onTap: () {
        if (inProgress) {
          context.push(AppRoutes.quizAttempt(attempt.quizId));
        } else {
          context.push(AppRoutes.quizResult(attempt.id));
        }
      },
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
                    const SizedBox(height: 5),
                    _AccessChip(isPremium: attempt.quizIsPremium),
                    const SizedBox(height: 4),
                    Text(
                      inProgress
                          ? 'In progress · Attempt #${attempt.attemptNumber}'
                          : '${Fmt.relative(attempt.submittedAt)} · Attempt #${attempt.attemptNumber}',
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
                    if (inProgress) ...[
                      const Text(
                        'Resume',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          color: AppColors.amber,
                          fontSize: 13,
                        ),
                      ),
                      Text(
                        'In progress',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: palette.textMuted,
                              fontSize: 10,
                            ),
                      ),
                    ] else ...[
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
          // Premium-only, and only once the attempt is submitted — a live
          // attempt has no locked-in questions to build a solutions PDF from.
          if (attempt.quizIsPremium && !inProgress) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _downloadingPdf ? null : _downloadSolutionsPdf,
                icon: _downloadingPdf
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.download_rounded, size: 16),
                label: Text(
                  _downloadingPdf ? 'Preparing…' : 'Download Solutions PDF',
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.amber,
                  side: BorderSide(color: AppColors.amber.withValues(alpha: 0.4)),
                  padding: const EdgeInsets.symmetric(vertical: 9),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Marks the quiz behind an attempt as Free or Premium, so the two read
/// differently at a glance in the history list.
class _AccessChip extends StatelessWidget {
  const _AccessChip({required this.isPremium});

  final bool isPremium;

  @override
  Widget build(BuildContext context) {
    final color = isPremium ? AppColors.amber : AppColors.emerald;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.32)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isPremium ? Icons.workspace_premium_rounded : Icons.lock_open_rounded,
            size: 10,
            color: color,
          ),
          const SizedBox(width: 4),
          Text(
            isPremium ? 'PREMIUM' : 'FREE',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w900,
                  fontSize: 9.5,
                  letterSpacing: 0.4,
                ),
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
