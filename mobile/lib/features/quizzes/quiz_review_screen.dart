import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/pdf_downloader.dart';
import '../../core/utils/performance_band.dart';
import '../../core/utils/quiz_pdf_generator.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/quiz.dart';
import 'quizzes_providers.dart';

/// The detailed result of one submitted attempt: the score summary followed by
/// every question in its original order, with the student's answer next to the
/// correct one. Scored entirely by the server, so this screen and the website's
/// result page always agree.
class QuizReviewScreen extends ConsumerStatefulWidget {
  const QuizReviewScreen({super.key, required this.attemptId});

  final String attemptId;

  @override
  ConsumerState<QuizReviewScreen> createState() => _QuizReviewScreenState();
}

class _QuizReviewScreenState extends ConsumerState<QuizReviewScreen> {
  /// null shows every question; otherwise only those with this outcome.
  AnswerStatus? _filter;

  @override
  Widget build(BuildContext context) {
    final reviewAsync = ref.watch(attemptReviewProvider(widget.attemptId));

    return Scaffold(
      appBar: const GlassAppBar(title: Text('Your result')),
      body: RefreshIndicator(
        onRefresh: () async =>
            ref.refresh(attemptReviewProvider(widget.attemptId).future),
        child: AsyncView(
          value: reviewAsync,
          onRetry: () =>
              ref.invalidate(attemptReviewProvider(widget.attemptId)),
          data: (review) {
            // Filtering never re-sorts: the list stays in the quiz's own order.
            final visible = _filter == null
                ? review.questions
                : review.questions.where((q) => q.status == _filter).toList();

            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              itemCount: visible.length + 2,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                if (index == 0) return _Summary(review: review);
                if (index == 1) {
                  return _Filters(
                    review: review,
                    active: _filter,
                    onChanged: (value) => setState(() => _filter = value),
                  );
                }
                return _QuestionCard(question: visible[index - 2]);
              },
            );
          },
        ),
      ),
    );
  }
}

class _Summary extends StatefulWidget {
  const _Summary({required this.review});

  final AttemptReview review;

  @override
  State<_Summary> createState() => _SummaryState();
}

class _SummaryState extends State<_Summary> {
  bool _downloadingPdf = false;

  /// Builds and saves the same "solutions PDF" the website offers on a
  /// premium quiz — every question, its correct answer, what was picked, and
  /// any explanation. Only reachable from here, a submitted attempt's own
  /// result, so it can never be pulled before the attempt is locked in.
  Future<void> _downloadSolutionsPdf() async {
    if (_downloadingPdf) return;
    final review = widget.review;
    setState(() => _downloadingPdf = true);
    try {
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
              // An edited quiz can leave a review question with no correct
              // index that still lines up with its (now different) options —
              // -1 simply marks nothing as correct rather than the wrong one.
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
    final review = widget.review;
    final palette = context.palette;
    final accent = review.passed ? AppColors.emerald : AppColors.amber;
    final band = performanceBandFor(review.percentage);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GlassCard(
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
                          review.quizTitle,
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    height: 1.3,
                                  ),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            AppBadge(
                              review.passed ? 'PASSED' : 'NOT PASSED',
                              color: accent,
                              filled: true,
                            ),
                            AppBadge(
                              band.label.toUpperCase(),
                              color: band.color,
                            ),
                            AppBadge('ATTEMPT #${review.attemptNumber}'),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 13, vertical: 9),
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      border: Border.all(color: accent.withValues(alpha: 0.32)),
                    ),
                    child: Column(
                      children: [
                        Text(
                          '${Fmt.marks(review.score)}/${Fmt.marks(review.totalMarks)}',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w900,
                                color: accent,
                              ),
                        ),
                        Text(
                          Fmt.percent(review.percentage, decimals: 1),
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: palette.textMuted,
                                  ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _Stat(
                      label: 'Correct',
                      value: '${review.correctAnswers}',
                      color: AppColors.emerald,
                      icon: Icons.check_circle_rounded,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _Stat(
                      label: 'Wrong',
                      value: '${review.wrongAnswers}',
                      color: AppColors.rose,
                      icon: Icons.cancel_rounded,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _Stat(
                      label: 'Skipped',
                      value: '${review.unattempted}',
                      color: AppColors.amber,
                      icon: Icons.remove_circle_rounded,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _Line(
                label: 'Accuracy',
                value: Fmt.percent(review.accuracy, decimals: 1),
              ),
              _Line(
                label: 'Time taken',
                value: Fmt.elapsed(review.timeTakenSeconds),
              ),
              if (review.negativeMarking.enabled)
                _Line(
                  label:
                      'Negative marking (−${Fmt.marks(review.negativeMarking.deduct)} per ${review.negativeMarking.every} wrong)',
                  value: '− ${Fmt.marks(review.negativeMarks)}',
                  valueColor: AppColors.rose,
                ),
              _Line(
                label: 'Passing marks',
                value: Fmt.marks(review.passingMarks),
              ),
              _Line(
                label: 'Submitted',
                value: Fmt.dateTime(review.submittedAt),
                isLast: true,
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  // Premium-only, and only offered once the attempt is
                  // submitted — this screen is the one place that is true.
                  if (review.isPremium) ...[
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _downloadingPdf ? null : _downloadSolutionsPdf,
                        icon: _downloadingPdf
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.download_rounded, size: 18),
                        label: Text(
                          _downloadingPdf ? 'Preparing…' : 'Solutions PDF',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () =>
                          context.push(AppRoutes.quizAttempt(review.quizId)),
                      icon: const Icon(Icons.refresh_rounded, size: 18),
                      label: const Text('Retake this quiz'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (review.answersStale) ...[
          const SizedBox(height: 12),
          GlassCard(
            borderColor: AppColors.amber.withValues(alpha: 0.4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.warning_amber_rounded,
                    color: AppColors.amber, size: 19),
                const SizedBox(width: 11),
                Expanded(
                  child: Text(
                    'This quiz was edited after you attempted it, so your saved '
                    'answers no longer line up with the questions below. Your '
                    'score above is the one you earned on the original questions.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.amber,
                          height: 1.45,
                        ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// Jump straight to the questions that went wrong, without losing their order.
class _Filters extends StatelessWidget {
  const _Filters({
    required this.review,
    required this.active,
    required this.onChanged,
  });

  final AttemptReview review;
  final AnswerStatus? active;
  final ValueChanged<AnswerStatus?> onChanged;

  @override
  Widget build(BuildContext context) {
    final counts = <AnswerStatus, int>{
      for (final status in AnswerStatus.values)
        status: review.questions.where((q) => q.status == status).length,
    };

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _Chip(
            label: 'All (${review.questions.length})',
            selected: active == null,
            color: AppColors.cyan,
            onTap: () => onChanged(null),
          ),
          const SizedBox(width: 8),
          _Chip(
            label: 'Correct (${counts[AnswerStatus.correct]})',
            selected: active == AnswerStatus.correct,
            color: AppColors.emerald,
            onTap: () => onChanged(AnswerStatus.correct),
          ),
          const SizedBox(width: 8),
          _Chip(
            label: 'Incorrect (${counts[AnswerStatus.incorrect]})',
            selected: active == AnswerStatus.incorrect,
            color: AppColors.rose,
            onTap: () => onChanged(AnswerStatus.incorrect),
          ),
          const SizedBox(width: 8),
          _Chip(
            label: 'Skipped (${counts[AnswerStatus.unattempted]})',
            selected: active == AnswerStatus.unattempted,
            color: AppColors.amber,
            onTap: () => onChanged(AnswerStatus.unattempted),
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.color,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.16) : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? color.withValues(alpha: 0.55) : palette.border,
          ),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: selected ? color : palette.textSecondary,
                fontWeight: FontWeight.w800,
              ),
        ),
      ),
    );
  }
}

/// The colour and wording each outcome is rendered with.
({Color color, String label}) _theme(AnswerStatus status) => switch (status) {
      AnswerStatus.correct => (color: AppColors.emerald, label: 'CORRECT'),
      AnswerStatus.incorrect => (color: AppColors.rose, label: 'INCORRECT'),
      AnswerStatus.unattempted => (
          color: AppColors.amber,
          label: 'NOT ANSWERED'
        ),
    };

String _letter(int index) => String.fromCharCode(65 + index);

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({required this.question});

  final ReviewQuestion question;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final theme = _theme(question.status);

    return GlassCard(
      borderColor: theme.color.withValues(alpha: 0.32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppBadge('Q${question.number}'),
              const SizedBox(width: 8),
              AppBadge(theme.label, color: theme.color),
              const Spacer(),
              Text(
                Fmt.count(question.marks.round(), 'mark'),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.textMuted,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            question.text,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  height: 1.45,
                ),
          ),
          const SizedBox(height: 14),
          for (var i = 0; i < question.options.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _OptionRow(
                index: i,
                option: question.options[i],
                isCorrect: i == question.correctOptionIndex,
                isChosen: i == question.selectedOptionIndex,
              ),
            ),


          if ((question.explanation ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.amber.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                border:
                    Border.all(color: AppColors.amber.withValues(alpha: 0.28)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'EXPLANATION',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.amber,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.6,
                        ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    question.explanation!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                          height: 1.55,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _OptionRow extends StatelessWidget {
  const _OptionRow({
    required this.index,
    required this.option,
    required this.isCorrect,
    required this.isChosen,
  });

  final int index;
  final QuestionOption option;
  final bool isCorrect;
  final bool isChosen;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final accent = isCorrect
        ? AppColors.emerald
        : isChosen
            ? AppColors.rose
            : null;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
      decoration: BoxDecoration(
        color: accent?.withValues(alpha: 0.10) ?? palette.elevated,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border.all(
          color: accent?.withValues(alpha: 0.40) ?? palette.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                isCorrect
                    ? Icons.check_circle_rounded
                    : isChosen
                        ? Icons.cancel_rounded
                        : Icons.radio_button_unchecked_rounded,
                size: 16,
                color: accent ?? palette.textMuted,
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  '${_letter(index)}.  ${option.text}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: accent ?? palette.textSecondary,
                        fontWeight:
                            accent != null ? FontWeight.w700 : FontWeight.w500,
                        height: 1.45,
                      ),
                ),
              ),
            ],
          ),
          if (isChosen || isCorrect) ...[
            const SizedBox(height: 7),
            Padding(
              padding: const EdgeInsets.only(left: 25),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  if (isChosen)
                    AppBadge(
                      'YOUR ANSWER',
                      color: isCorrect ? AppColors.emerald : AppColors.rose,
                    ),
                  if (isCorrect)
                    const AppBadge(
                      'CORRECT ANSWER',
                      color: AppColors.emerald,
                    ),
                ],
              ),
            ),
          ],
          if ((option.explanation ?? '').isNotEmpty && (isChosen || isCorrect))
            Padding(
              padding: const EdgeInsets.only(left: 25, top: 7),
              child: Text(
                option.explanation!,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.textMuted,
                      fontStyle: FontStyle.italic,
                      height: 1.45,
                    ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  final String label;
  final String value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(height: 5),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
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
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({
    required this.label,
    required this.value,
    this.valueColor,
    this.isLast = false,
  });

  final String label;
  final String value;
  final Color? valueColor;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                      height: 1.4,
                    ),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: valueColor,
                  ),
            ),
          ],
        ),
        if (!isLast)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 9),
            child: Divider(color: palette.border, height: 1),
          ),
      ],
    );
  }
}
