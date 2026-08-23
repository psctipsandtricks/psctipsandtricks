import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../data/models/quiz.dart';

/// Presents the scored attempt, with an optional walk-through of every question.
Future<void> showQuizResultSheet(
  BuildContext context, {
  required Quiz quiz,
  required QuizResult result,
  required List<Question> questions,
  required Map<String, int> answers,
  bool autoSubmitted = false,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    useSafeArea: true,
    builder: (_) => QuizResultSheet(
      quiz: quiz,
      result: result,
      questions: questions,
      answers: answers,
      autoSubmitted: autoSubmitted,
    ),
  );
}

class QuizResultSheet extends StatelessWidget {
  const QuizResultSheet({
    super.key,
    required this.quiz,
    required this.result,
    required this.questions,
    required this.answers,
    this.autoSubmitted = false,
  });

  final Quiz quiz;
  final QuizResult result;
  final List<Question> questions;
  final Map<String, int> answers;
  final bool autoSubmitted;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final passed = result.passed;
    final accent = passed ? AppColors.emerald : AppColors.amber;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.9,
      maxChildSize: 0.96,
      builder: (context, scrollController) => Column(
        children: [
          Container(
            width: 42,
            height: 4,
            margin: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: palette.border,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          Expanded(
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
              children: [
                if (autoSubmitted)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.amber.withValues(alpha: 0.11),
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      border: Border.all(
                          color: AppColors.amber.withValues(alpha: 0.32)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.timer_off_rounded,
                            size: 17, color: AppColors.amber),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Time ran out — your attempt was submitted automatically.',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: AppColors.amber, height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Score dial
                Center(
                  child: SizedBox(
                    width: 148,
                    height: 148,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox(
                          width: 148,
                          height: 148,
                          child: CircularProgressIndicator(
                            value: (result.percentage / 100).clamp(0.0, 1.0),
                            strokeWidth: 11,
                            strokeCap: StrokeCap.round,
                            backgroundColor: palette.elevated,
                            valueColor: AlwaysStoppedAnimation(accent),
                          ),
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              Fmt.marks(result.score),
                              style: Theme.of(context)
                                  .textTheme
                                  .displaySmall
                                  ?.copyWith(
                                    fontWeight: FontWeight.w900,
                                    color: accent,
                                    height: 1,
                                  ),
                            ),
                            Text(
                              'of ${Fmt.marks(result.totalMarks)}',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: palette.textMuted),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Center(
                  child: AppBadge(
                    passed ? 'PASSED' : 'KEEP PRACTISING',
                    color: accent,
                    icon: passed
                        ? Icons.emoji_events_rounded
                        : Icons.trending_up_rounded,
                    filled: true,
                  ),
                ),
                const SizedBox(height: 10),
                Center(
                  child: Text(
                    quiz.title,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          height: 1.3,
                        ),
                  ),
                ),
                const SizedBox(height: 22),

                Row(
                  children: [
                    Expanded(
                      child: _Stat(
                        label: 'Correct',
                        value: '${result.correct}',
                        color: AppColors.emerald,
                        icon: Icons.check_circle_rounded,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _Stat(
                        label: 'Wrong',
                        value: '${result.wrong}',
                        color: AppColors.rose,
                        icon: Icons.cancel_rounded,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _Stat(
                        label: 'Skipped',
                        value: '${result.unattempted}',
                        color: AppColors.amber,
                        icon: Icons.remove_circle_rounded,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                GlassCard(
                  child: Column(
                    children: [
                      _Line(
                        label: 'Accuracy',
                        value: Fmt.percent(result.accuracy, decimals: 1),
                      ),
                      _Line(
                        label: 'Time taken',
                        value: Fmt.elapsed(result.timeTakenSeconds),
                      ),
                      _Line(label: 'Attempt', value: '#${result.attemptNumber}'),
                      if (result.negativeMarking.enabled) ...[
                        _Line(
                          label: 'Marks earned',
                          value: Fmt.marks(result.positiveMarks),
                        ),
                        _Line(
                          label:
                              'Negative marking (−${Fmt.marks(result.negativeMarking.deduct)} per ${result.negativeMarking.every} wrong)',
                          value: '− ${Fmt.marks(result.negativeMarks)}',
                          valueColor: AppColors.rose,
                        ),
                      ],
                      _Line(
                        label: 'Passing marks',
                        value: Fmt.marks(quiz.passingMarks),
                        isLast: true,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                OutlinedButton.icon(
                  onPressed: () => _showReview(context),
                  icon: const Icon(Icons.fact_check_outlined, size: 18),
                  label: const Text('Review all answers'),
                ),
                const SizedBox(height: 10),
                GradientButton(
                  label: 'Done',
                  icon: Icons.check_rounded,
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showReview(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _ReviewScreen(
          quizTitle: quiz.title,
          questions: questions,
          answers: answers,
        ),
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
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 19),
          const SizedBox(height: 6),
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
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Divider(color: palette.border, height: 1),
          ),
      ],
    );
  }
}

/// Question-by-question walk-through after submitting.
class _ReviewScreen extends StatelessWidget {
  const _ReviewScreen({
    required this.quizTitle,
    required this.questions,
    required this.answers,
  });

  final String quizTitle;
  final List<Question> questions;
  final Map<String, int> answers;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Answer review'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(28),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                quizTitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: palette.textMuted,
                    ),
              ),
            ),
          ),
        ),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        itemCount: questions.length,
        separatorBuilder: (_, __) => const SizedBox(height: 14),
        itemBuilder: (context, index) {
          final question = questions[index];
          final selected = answers[question.id];
          final isCorrect = selected == question.correctOptionIndex;
          final status = selected == null
              ? (AppColors.amber, 'SKIPPED')
              : isCorrect
                  ? (AppColors.emerald, 'CORRECT')
                  : (AppColors.rose, 'WRONG');

          return GlassCard(
            borderColor: status.$1.withValues(alpha: 0.32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    AppBadge('Q${index + 1}'),
                    const SizedBox(width: 8),
                    AppBadge(status.$2, color: status.$1),
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
                    padding: const EdgeInsets.only(bottom: 7),
                    child: _ReviewOption(
                      index: i,
                      text: question.options[i].text,
                      isCorrect: i == question.correctOptionIndex,
                      isChosen: selected == i,
                    ),
                  ),
                if ((question.explanation ?? '').isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: palette.elevated,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    ),
                    child: Text(
                      question.explanation!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: palette.textSecondary,
                            height: 1.55,
                          ),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ReviewOption extends StatelessWidget {
  const _ReviewOption({
    required this.index,
    required this.text,
    required this.isCorrect,
    required this.isChosen,
  });

  final int index;
  final String text;
  final bool isCorrect;
  final bool isChosen;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final color = isCorrect
        ? AppColors.emerald
        : isChosen
            ? AppColors.rose
            : null;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          isCorrect
              ? Icons.check_circle_rounded
              : isChosen
                  ? Icons.cancel_rounded
                  : Icons.radio_button_unchecked_rounded,
          size: 15,
          color: color ?? palette.textMuted,
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Text(
            '${String.fromCharCode(65 + index)}.  $text',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: color ?? palette.textSecondary,
                  fontWeight: color != null ? FontWeight.w700 : FontWeight.w500,
                  height: 1.45,
                ),
          ),
        ),
      ],
    );
  }
}
