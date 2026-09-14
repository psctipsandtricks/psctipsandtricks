import 'dart:async';

import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/pdf_downloader.dart';
import '../../../core/utils/performance_band.dart';
import '../../../core/utils/quiz_pdf_generator.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/liquid_glass.dart';
import '../../../data/models/mock_test.dart';
import '../../../data/models/quiz.dart';
import '../../home/home_providers.dart';
import '../../mock_tests/mock_test_detail_screen.dart' show MockRankRow, MockStatTile;
import '../../mock_tests/mock_tests_providers.dart';

/// Presents the scored attempt, with the Live Rank List (for mock tests) or score dial,
/// along with an optional walk-through of every question and PDF download.
Future<void> showQuizResultSheet(
  BuildContext context, {
  required Quiz quiz,
  required QuizResult result,
  required List<Question> questions,
  required Map<String, int> answers,
  bool autoSubmitted = false,
  String? mockTestId,
}) {
  return showGlassSheet<void>(
    context: context,
    isDismissible: false,
    enableDrag: false,
    handle: false,
    builder: (_) => QuizResultSheet(
      quiz: quiz,
      result: result,
      questions: questions,
      answers: answers,
      autoSubmitted: autoSubmitted,
      mockTestId: mockTestId,
    ),
  );
}

class QuizResultSheet extends ConsumerStatefulWidget {
  const QuizResultSheet({
    super.key,
    required this.quiz,
    required this.result,
    required this.questions,
    required this.answers,
    this.autoSubmitted = false,
    this.mockTestId,
  });

  final Quiz quiz;
  final QuizResult result;
  final List<Question> questions;
  final Map<String, int> answers;
  final bool autoSubmitted;
  final String? mockTestId;

  @override
  ConsumerState<QuizResultSheet> createState() => _QuizResultSheetState();
}

class _QuizResultSheetState extends ConsumerState<QuizResultSheet> {
  Timer? _pollingTimer;
  bool _downloadingPdf = false;
  bool _showFullBoard = false;
  String? _activePollingId;

  void _startPolling(String mockId) {
    if (_activePollingId == mockId && _pollingTimer != null) return;
    _pollingTimer?.cancel();
    _activePollingId = mockId;
    _pollingTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted) return;
      ref.invalidate(mockLeaderboardProvider(mockId));
      ref.invalidate(mockTestProvider(mockId));
    });
  }

  @override
  void initState() {
    super.initState();
    final mockId = widget.mockTestId ?? widget.quiz.mockTestId;
    if (mockId != null && mockId.isNotEmpty) {
      _startPolling(mockId);
    } else if (widget.quiz.isLiveMock) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final live = ref.read(liveMockTestsProvider).valueOrNull;
        final match =
            live?.firstWhereOrNull((m) => m.quizId == widget.quiz.id)?.id;
        final id = match ??
            ref
                .read(allMockTestsProvider)
                .valueOrNull
                ?.firstWhereOrNull((m) => m.quizId == widget.quiz.id)
                ?.id;
        if (id != null) _startPolling(id);
      });
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  Future<void> _downloadSolutionsPdf(String quizTitle) async {
    if (_downloadingPdf) return;
    setState(() => _downloadingPdf = true);
    try {
      final bytes = await QuizPdfGenerator.generate(
        quizTitle: quizTitle,
        score: widget.result.score,
        totalMarks: widget.result.totalMarks,
        questions: [
          for (final question in widget.questions)
            QuizPdfQuestion(
              text: question.text,
              options: [
                for (final option in question.options)
                  QuizPdfOption(
                    text: option.text,
                    explanation: option.explanation,
                  ),
              ],
              correctIndex: question.correctOptionIndex,
              explanation: question.explanation,
              marks: question.marks,
              userSelection: widget.answers[question.id],
            ),
        ],
      );
      if (!mounted) return;
      await PdfDownloader.saveBytes(
        context,
        bytes: bytes,
        title: '$quizTitle - Solutions',
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not generate the solutions PDF: $e'),
          backgroundColor: AppColors.rose,
        ),
      );
    } finally {
      if (mounted) setState(() => _downloadingPdf = false);
    }
  }

  void _showReview(BuildContext context, String quizTitle, bool isPremium) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _ReviewScreen(
          quizTitle: quizTitle,
          isPremium: isPremium,
          questions: widget.questions,
          answers: widget.answers,
        ),
      ),
    );
  }

  Widget _buildMockHero({
    required BuildContext context,
    required MockTest? mock,
    required int? rank,
    required double? score,
    required double? totalMarks,
    required bool isFinal,
    required List<LeaderboardEntry>? board,
  }) {
    final palette = context.palette;
    final me = ref.watch(currentUserProvider);
    final mine = board?.where((e) => e.userId == me?.id).firstOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Trophy icon in cyber glass container
        Center(
          child: Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              color: AppColors.cyan.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              border: Border.all(color: AppColors.cyan.withValues(alpha: 0.35)),
            ),
            child: const Icon(
              Icons.emoji_events_rounded,
              size: 30,
              color: AppColors.cyan,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: Text(
            mock?.title ?? widget.quiz.title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                  height: 1.25,
                ),
          ),
        ),
        const SizedBox(height: 8),
        Center(
          child: AppBadge(
            isFinal ? 'FINAL RANK LIST' : 'LIVE RANK LIST — UPDATING…',
            color: isFinal ? AppColors.emerald : AppColors.rose,
            filled: !isFinal,
            icon: isFinal ? Icons.check_circle_rounded : Icons.sync_rounded,
          ),
        ),
        const SizedBox(height: 20),

        // Stat tiles: Your Score & Your Rank
        Row(
          children: [
            Expanded(
              child: MockStatTile(
                icon: Icons.military_tech_outlined,
                label: 'Your score',
                value: score == null ? '—' : Fmt.marks(score),
                accent: AppColors.cyan,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: MockStatTile(
                icon: Icons.emoji_events_rounded,
                label: 'Your rank',
                value: rank == null ? 'Pending' : '#$rank',
                accent: AppColors.emerald,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Live rank row showing ONLY the current user, matching web
        if (rank != null)
          MockRankRow(
            entry: LeaderboardEntry(
              rank: rank,
              userId: me?.id ?? '',
              userName: mine?.userName ?? me?.name ?? 'You',
              score: score ?? widget.result.score,
              avatarUrl: mine?.avatarUrl ?? me?.avatarUrl,
              totalMarks: totalMarks,
              timeTakenSeconds:
                  mine?.timeTakenSeconds ?? widget.result.timeTakenSeconds,
            ),
            isMe: true,
          )
        else
          GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.cyan,
                  ),
                ),
                const SizedBox(width: 13),
                Expanded(
                  child: Text(
                    'Your answers are in. Your place on the rank list is being worked out.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                          height: 1.35,
                        ),
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 10),
        Text(
          isFinal
              ? 'This is where you finished. Only your own row is shown.'
              : 'Your rank moves as other aspirants submit. Only your own row is shown.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: palette.textMuted,
                height: 1.4,
              ),
        ),

        // Full leaderboard toggle
        if (board != null && board.length > 1) ...[
          const SizedBox(height: 12),
          Center(
            child: InkWell(
              onTap: () => setState(() => _showFullBoard = !_showFullBoard),
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _showFullBoard
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      size: 20,
                      color: AppColors.cyan,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _showFullBoard
                          ? 'Hide live rank list'
                          : 'View live rank list (${board.length} aspirants)',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: AppColors.cyan,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_showFullBoard) ...[
            const SizedBox(height: 10),
            ...board.map((e) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: MockRankRow(
                    entry: e,
                    isMe: e.userId == me?.id,
                  ),
                )),
          ],
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final passed = widget.result.passed;
    final accent = passed ? AppColors.emerald : AppColors.amber;
    final band = performanceBandFor(widget.result.percentage);

    final liveMocks = ref.watch(liveMockTestsProvider).valueOrNull;
    final allMocks = ref.watch(allMockTestsProvider).valueOrNull;
    final resolvedMockId = (widget.mockTestId != null && widget.mockTestId!.isNotEmpty)
        ? widget.mockTestId
        : (widget.quiz.mockTestId != null && widget.quiz.mockTestId!.isNotEmpty)
            ? widget.quiz.mockTestId
            : liveMocks?.firstWhereOrNull((m) => m.quizId == widget.quiz.id)?.id ??
                allMocks?.firstWhereOrNull((m) => m.quizId == widget.quiz.id)?.id;
    final isMock = (resolvedMockId != null && resolvedMockId.isNotEmpty) ||
        widget.quiz.isLiveMock;

    MockTest? mock;
    List<LeaderboardEntry>? board;
    int? myRank;
    double? myScore;
    double? totalMarks;
    bool isCompleted = false;

    if (isMock) {
      if (resolvedMockId != null && resolvedMockId.isNotEmpty) {
        if (_activePollingId == null) {
          _startPolling(resolvedMockId);
        }
        mock = ref.watch(mockTestProvider(resolvedMockId)).valueOrNull;
        board = ref.watch(mockLeaderboardProvider(resolvedMockId)).valueOrNull;
      }
      mock ??= liveMocks?.firstWhereOrNull(
            (m) =>
                m.quizId == widget.quiz.id ||
                (resolvedMockId != null && m.id == resolvedMockId),
          ) ??
          allMocks?.firstWhereOrNull(
            (m) =>
                m.quizId == widget.quiz.id ||
                (resolvedMockId != null && m.id == resolvedMockId),
          );
      final me = ref.watch(currentUserProvider);
      final mine = board?.where((e) => e.userId == me?.id).firstOrNull;

      isCompleted = mock?.status == MockTestStatus.completed;
      myRank = mine?.rank ?? mock?.myRank;
      myScore = mine?.score ?? mock?.myScore ?? widget.result.score;
      totalMarks = mine?.totalMarks ??
          mock?.quiz?.totalMarks ??
          widget.result.totalMarks;
    }

    final quizTitle = mock?.title ?? widget.quiz.title;
    final isPremium = mock?.isPaid ?? widget.quiz.isPaid;

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
                if (widget.autoSubmitted)
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

                if (isMock)
                  _buildMockHero(
                    context: context,
                    mock: mock,
                    rank: myRank,
                    score: myScore,
                    totalMarks: totalMarks,
                    isFinal: isCompleted,
                    board: board,
                  )
                else ...[
                  // Score dial for normal practice quiz
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
                              value: (widget.result.percentage / 100).clamp(0.0, 1.0),
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
                                Fmt.marks(widget.result.score),
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
                                'of ${Fmt.marks(widget.result.totalMarks)}',
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
                    child: Wrap(
                      alignment: WrapAlignment.center,
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        AppBadge(
                          passed ? 'PASSED' : 'KEEP PRACTISING',
                          color: accent,
                          icon: passed
                              ? Icons.emoji_events_rounded
                              : Icons.trending_up_rounded,
                          filled: true,
                        ),
                        AppBadge(band.label.toUpperCase(), color: band.color),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Center(
                    child: Text(
                      widget.quiz.title,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            height: 1.3,
                          ),
                    ),
                  ),
                ],

                const SizedBox(height: 22),

                Row(
                  children: [
                    Expanded(
                      child: _Stat(
                        label: 'Correct',
                        value: '${widget.result.correct}',
                        color: AppColors.emerald,
                        icon: Icons.check_circle_rounded,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _Stat(
                        label: 'Wrong',
                        value: '${widget.result.wrong}',
                        color: AppColors.rose,
                        icon: Icons.cancel_rounded,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _Stat(
                        label: 'Skipped',
                        value: '${widget.result.unattempted}',
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
                        value: Fmt.percent(widget.result.accuracy, decimals: 1),
                      ),
                      _Line(
                        label: 'Time taken',
                        value: Fmt.elapsed(widget.result.timeTakenSeconds),
                      ),
                      if (!isMock)
                        _Line(
                          label: 'Attempt',
                          value: '#${widget.result.attemptNumber}',
                        ),
                      if (widget.result.negativeMarking.enabled) ...[
                        _Line(
                          label: 'Marks earned',
                          value: Fmt.marks(widget.result.positiveMarks),
                        ),
                        _Line(
                          label:
                              'Negative marking (−${Fmt.marks(widget.result.negativeMarking.deduct)} per ${widget.result.negativeMarking.every} wrong)',
                          value: '− ${Fmt.marks(widget.result.negativeMarks)}',
                          valueColor: AppColors.rose,
                        ),
                      ],
                      if (!isMock)
                        _Line(
                          label: 'Passing marks',
                          value: Fmt.marks(widget.quiz.passingMarks),
                          isLast: true,
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                if (isMock) ...[
                  OutlinedButton.icon(
                    onPressed: _downloadingPdf
                        ? null
                        : () => _downloadSolutionsPdf(quizTitle),
                    icon: _downloadingPdf
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.download_rounded, size: 18),
                    label: Text(
                      _downloadingPdf
                          ? 'Generating PDF…'
                          : 'Download Solutions PDF',
                    ),
                  ),
                  const SizedBox(height: 10),
                ],

                OutlinedButton.icon(
                  onPressed: () => _showReview(context, quizTitle, isPremium),
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

enum _ReviewFilter { all, correct, wrong, skipped }

/// Question-by-question walk-through after submitting.
class _ReviewScreen extends StatefulWidget {
  const _ReviewScreen({
    required this.quizTitle,
    required this.isPremium,
    required this.questions,
    required this.answers,
  });

  final String quizTitle;
  final bool isPremium;
  final List<Question> questions;
  final Map<String, int> answers;

  @override
  State<_ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<_ReviewScreen> {
  _ReviewFilter _filter = _ReviewFilter.all;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final questions = widget.questions;
    final answers = widget.answers;

    var correctCount = 0;
    var wrongCount = 0;
    var skippedCount = 0;
    for (final q in questions) {
      final sel = answers[q.id];
      if (sel == null) {
        skippedCount++;
      } else if (sel == q.correctOptionIndex) {
        correctCount++;
      } else {
        wrongCount++;
      }
    }

    final indexed = questions.asMap().entries.toList();
    final visible = indexed.where((entry) {
      final q = entry.value;
      final sel = answers[q.id];
      return switch (_filter) {
        _ReviewFilter.all => true,
        _ReviewFilter.correct => sel == q.correctOptionIndex,
        _ReviewFilter.wrong => sel != null && sel != q.correctOptionIndex,
        _ReviewFilter.skipped => sel == null,
      };
    }).toList();

    return Scaffold(
      appBar: GlassAppBar(
        title: const Text('Answer review'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(66),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  widget.quizTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 32,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: [
                    _filterChip(
                      label: 'All (${questions.length})',
                      active: _filter == _ReviewFilter.all,
                      onTap: () => setState(() => _filter = _ReviewFilter.all),
                    ),
                    const SizedBox(width: 8),
                    _filterChip(
                      label: 'Correct ($correctCount)',
                      active: _filter == _ReviewFilter.correct,
                      color: AppColors.emerald,
                      onTap: () => setState(() => _filter = _ReviewFilter.correct),
                    ),
                    const SizedBox(width: 8),
                    _filterChip(
                      label: 'Wrong ($wrongCount)',
                      active: _filter == _ReviewFilter.wrong,
                      color: AppColors.rose,
                      onTap: () => setState(() => _filter = _ReviewFilter.wrong),
                    ),
                    const SizedBox(width: 8),
                    _filterChip(
                      label: 'Skipped ($skippedCount)',
                      active: _filter == _ReviewFilter.skipped,
                      color: AppColors.amber,
                      onTap: () => setState(() => _filter = _ReviewFilter.skipped),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
      body: visible.isEmpty
          ? Center(
              child: Text(
                'No questions in this filter.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: palette.textMuted,
                    ),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              itemCount: visible.length,
              separatorBuilder: (_, __) => const SizedBox(height: 14),
              itemBuilder: (context, index) {
                final entry = visible[index];
                final originalIndex = entry.key;
                final question = entry.value;
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
                          AppBadge('Q${originalIndex + 1}'),
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
                      if (widget.isPremium &&
                          (question.explanation ?? '').isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: palette.elevated,
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusSm),
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

  Widget _filterChip({
    required String label,
    required bool active,
    required VoidCallback onTap,
    Color? color,
  }) {
    final chipColor = color ?? AppColors.cyan;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active
              ? chipColor.withValues(alpha: 0.22)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active ? chipColor : Colors.white.withValues(alpha: 0.15),
            width: active ? 1.5 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: active ? FontWeight.bold : FontWeight.w500,
            color: active ? chipColor : Colors.white70,
          ),
        ),
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
