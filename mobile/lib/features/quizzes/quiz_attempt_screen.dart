import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/responsive.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/book.dart' show AccessState, AccessReason;
import '../../data/models/quiz.dart';
import 'quizzes_providers.dart';
import 'widgets/quiz_paywall.dart';
import 'widgets/quiz_result_sheet.dart';

/// Locally saved position within an attempt.
///
/// The backend only persists answers on final submit, so where the student had
/// got to is tracked here — and only trusted for the attempt it was saved
/// against, so a completed attempt followed by a fresh one cannot inherit it.
class _SavedProgress {
  const _SavedProgress({
    required this.attemptId,
    required this.currentIndex,
    required this.answers,
    required this.elapsedSeconds,
  });

  final String attemptId;
  final int currentIndex;
  final Map<String, int> answers;
  final int elapsedSeconds;

  Map<String, dynamic> toJson() => {
        'attemptId': attemptId,
        'currentIndex': currentIndex,
        'answers': answers,
        'elapsedSeconds': elapsedSeconds,
      };

  static _SavedProgress? parse(String raw, String attemptId) {
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      if (map['attemptId'] != attemptId) return null;
      final answers = <String, int>{};
      (map['answers'] as Map?)?.forEach((key, value) {
        final index = value is int ? value : int.tryParse('$value');
        if (index != null) answers['$key'] = index;
      });
      return _SavedProgress(
        attemptId: attemptId,
        currentIndex: (map['currentIndex'] as num?)?.toInt() ?? 0,
        answers: answers,
        elapsedSeconds: (map['elapsedSeconds'] as num?)?.toInt() ?? 0,
      );
    } catch (_) {
      return null;
    }
  }
}

class QuizAttemptScreen extends ConsumerStatefulWidget {
  const QuizAttemptScreen({super.key, required this.quizId, this.mockTestId});

  final String quizId;

  /// Set when this attempt is a scheduled mock test rather than a private
  /// practice run — submitting then scores against the mock test's own rank
  /// list instead of just recording a personal quiz attempt.
  final String? mockTestId;

  @override
  ConsumerState<QuizAttemptScreen> createState() => _QuizAttemptScreenState();
}

class _QuizAttemptScreenState extends ConsumerState<QuizAttemptScreen> {
  Quiz? _quiz;
  QuizAttempt? _activeAttempt;
  Object? _error;
  bool _loading = true;

  String? _attemptId;
  int _attemptNumber = 1;

  int _currentIndex = 0;
  final Map<String, int> _answers = {};

  Timer? _ticker;
  int _elapsedSeconds = 0;
  bool _submitted = false;
  bool _submitting = false;

  /// Wall-clock moment `_elapsedSeconds` last changed — the ticker only moves
  /// in whole seconds, so the gap between this and "now" is the sub-second
  /// remainder that gives the submitted duration millisecond precision. Reset
  /// on every tick (and on resume) rather than kept from the very first start,
  /// so a resumed attempt's already-elapsed time is still counted correctly.
  DateTime? _tickStartedAt;

  /// The attempt duration to millisecond precision, for mock test rank ties.
  int get _elapsedMs {
    final tickStart = _tickStartedAt;
    final withinTick = tickStart == null
        ? 0
        : DateTime.now().difference(tickStart).inMilliseconds.clamp(0, 1999);
    return _elapsedSeconds * 1000 + withinTick;
  }

  // The attempt and its clock only begin once the student presses Start on the
  // intro screen — a just-purchased quiz must never open straight into a
  // running timer.
  bool _started = false;
  bool _starting = false;
  Object? _startError;

  String get _storageKey => 'quiz-progress-${widget.quizId}';

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
      _started = false;
      _starting = false;
      _startError = null;
    });

    try {
      final repo = ref.read(quizzesRepositoryProvider);
      final quiz = await repo.fetchQuiz(widget.quizId);
      QuizAttempt? activeAttempt;
      try {
        activeAttempt = await repo.fetchActiveAttempt(widget.quizId);
      } catch (_) {}
      if (!mounted) return;

      // A locked premium quiz arrives with no questions; the paywall renders
      // and no attempt is started. Otherwise the intro screen shows and the
      // attempt only begins when the student presses Start.
      setState(() {
        _quiz = quiz;
        _activeAttempt = activeAttempt;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e;
          _loading = false;
        });
      }
    }
  }

  /// Called from the intro screen. Creates (or resumes) the attempt on the
  /// server, restores any local progress, then reveals the questions and starts
  /// the clock. A refusal here (an unpaid premium quiz) drops back to the
  /// paywall rather than erroring.
  Future<void> _startAttempt() async {
    final quiz = _quiz;
    if (quiz == null || _starting || _started) return;

    setState(() {
      _starting = true;
      _startError = null;
    });

    try {
      final repo = ref.read(quizzesRepositoryProvider);
      final attempt = await repo.startAttempt(widget.quizId);
      if (!mounted) return;

      _restoreProgress(attempt, quiz);
      setState(() {
        _attemptId = attempt?.id;
        _attemptNumber = attempt?.attemptNumber ?? 1;
        _started = true;
        _starting = false;
      });
      _startTicker(quiz);
    } catch (err) {
      if (!mounted) return;
      final msg = err.toString().toLowerCase();
      final refused = msg.contains('403') ||
          msg.contains('forbidden') ||
          msg.contains('purchase') ||
          msg.contains('premium') ||
          msg.contains('payment');
      if (refused) {
        // The server will not let this attempt start — treat it as locked and
        // let the paywall take over.
        setState(() {
          _starting = false;
          _quiz = Quiz(
            id: quiz.id,
            title: quiz.title,
            category: quiz.category,
            topic: quiz.topic,
            folderName: quiz.folderName,
            accessType: quiz.accessType,
            imageUrl: quiz.imageUrl,
            totalQuestions: quiz.totalQuestions,
            durationMinutes: quiz.durationMinutes,
            isLiveMock: quiz.isLiveMock,
            isPremium: quiz.isPremium,
            price: quiz.price,
            passingMarks: quiz.passingMarks,
            totalMarks: quiz.totalMarks,
            negativeMarking: quiz.negativeMarking,
            showCorrectAnswerAfterSelection: quiz.showCorrectAnswerAfterSelection,
            access: quiz.access ??
                AccessState(
                  isPaid: true,
                  hasAccess: false,
                  price: quiz.effectivePrice,
                  reason: AccessReason.paymentRequired,
                ),
            questions: const [],
            createdAt: quiz.createdAt,
            releaseDate: quiz.releaseDate,
            isActive: quiz.isActive,
          );
        });
        return;
      }
      setState(() {
        _startError = err;
        _starting = false;
      });
    }
  }

  void _restoreProgress(QuizAttempt? attempt, Quiz quiz) {
    if (attempt == null) return;
    final raw = ref.read(sharedPrefsProvider).getString(_storageKey);
    final saved = raw != null ? _SavedProgress.parse(raw, attempt.id) : null;

    if (saved != null) {
      _answers
        ..clear()
        ..addAll(saved.answers);
      _currentIndex =
          saved.currentIndex.clamp(0, (quiz.questions.length - 1).clamp(0, 9999));
      _elapsedSeconds = saved.elapsedSeconds;
    } else {
      _answers.clear();
      for (final ans in attempt.answers) {
        if (ans.selectedOptionIndex != null) {
          _answers[ans.questionId] = ans.selectedOptionIndex!;
        }
      }
      final firstUnanswered =
          quiz.questions.indexWhere((q) => !_answers.containsKey(q.id));
      _currentIndex = firstUnanswered >= 0 ? firstUnanswered : 0;
      _elapsedSeconds = attempt.timeTakenSeconds;
    }
  }

  void _persistProgress() {
    final attemptId = _attemptId;
    if (attemptId == null || _submitted) return;
    ref.read(sharedPrefsProvider).setString(
          _storageKey,
          jsonEncode(
            _SavedProgress(
              attemptId: attemptId,
              currentIndex: _currentIndex,
              answers: _answers,
              elapsedSeconds: _elapsedSeconds,
            ).toJson(),
          ),
        );
  }

  Future<void> _pauseAndExit(Quiz quiz) async {
    _persistProgress();
    final payload = <QuizAnswer>[];
    for (final q in quiz.questions) {
      final sel = _answers[q.id];
      if (sel != null) {
        payload.add(QuizAnswer(questionId: q.id, selectedOptionIndex: sel));
      }
    }
    unawaited(
      ref.read(quizzesRepositoryProvider).pauseAttempt(
        widget.quizId,
        timeTakenSeconds: _elapsedSeconds,
        answers: payload,
        attemptId: _attemptId,
        currentIndex: _currentIndex,
      ),
    );
  }

  void _startTicker(Quiz quiz) {
    _ticker?.cancel();
    _tickStartedAt = DateTime.now();
    final total = quiz.durationMinutes * 60;
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _submitted) return;
      setState(() => _elapsedSeconds++);
      _tickStartedAt = DateTime.now();
      // Persist about every 5s rather than every tick — a write per second on
      // a 60-minute paper is thousands of needless disk hits.
      if (_elapsedSeconds % 5 == 0) _persistProgress();
      if (_elapsedSeconds >= total) unawaited(_submit(auto: true));
    });
  }

  int get _remainingSeconds {
    final quiz = _quiz;
    if (quiz == null) return 0;
    final left = quiz.durationMinutes * 60 - _elapsedSeconds;
    return left < 0 ? 0 : left;
  }

  void _select(Question question, int optionIndex) {
    final quiz = _quiz;
    if (quiz == null || _submitted) return;
    // When the quiz reveals the answer on selection, the first tap is final.
    if (quiz.showCorrectAnswerAfterSelection &&
        _answers.containsKey(question.id)) {
      return;
    }
    setState(() => _answers[question.id] = optionIndex);
    _persistProgress();
  }

  void _goTo(int index) {
    final quiz = _quiz;
    if (quiz == null) return;
    if (index < 0 || index >= quiz.questions.length) return;
    setState(() => _currentIndex = index);
    _persistProgress();
  }

  Future<void> _confirmSubmit() async {
    final quiz = _quiz!;
    final unanswered = quiz.questions.length - _answers.length;

    final ok = await showGlassConfirm(
      context,
      title: 'Are you sure you want to submit?',
      message: unanswered > 0
          ? 'You have $unanswered unanswered '
              '${unanswered == 1 ? 'question' : 'questions'}. '
              'Unanswered questions score zero, and you cannot change your '
              'answers after submitting.'
          : "You won't be able to change your answers after this.",
      cancelLabel: 'Keep going',
      confirmLabel: 'Submit',
      icon: Icons.assignment_turned_in_rounded,
    );
    if (ok) unawaited(_submit());
  }

  /// Persists the attempt, then hands the student to the server-scored result
  /// screen — the same payload the website's result page renders, so the two
  /// never disagree about an answer. Should the network fail, the locally
  /// scored sheet stands in so the attempt is never lost without a result.
  Future<void> _submit({bool auto = false}) async {
    final quiz = _quiz;
    if (quiz == null || _submitted) return;

    // Captured now, before any of the scoring or network work below runs —
    // this is the actual moment Submit was pressed (or the timer ran out),
    // to millisecond precision.
    final timeTakenMs = _elapsedMs;
    _ticker?.cancel();
    setState(() {
      _submitted = true;
      _submitting = true;
    });

    var positiveMarks = 0.0;
    var correct = 0;
    var wrong = 0;
    var unattempted = 0;
    final payload = <QuizAnswer>[];

    for (final question in quiz.questions) {
      final selected = _answers[question.id];
      if (selected == null) {
        unattempted++;
        payload.add(QuizAnswer(questionId: question.id));
      } else if (selected == question.correctOptionIndex) {
        positiveMarks += question.marks;
        correct++;
        payload.add(
          QuizAnswer(questionId: question.id, selectedOptionIndex: selected),
        );
      } else {
        wrong++;
        payload.add(
          QuizAnswer(questionId: question.id, selectedOptionIndex: selected),
        );
      }
    }

    final rules = quiz.negativeMarking;
    final negativeMarks = rules.penaltyFor(wrong);
    final net = positiveMarks - negativeMarks;
    final score = rules.allowNegativeScore ? net : (net < 0 ? 0.0 : net);
    final totalMarks = quiz.questions.fold<double>(0, (sum, q) => sum + q.marks);

    final result = QuizResult(
      score: (score * 100).roundToDouble() / 100,
      positiveMarks: positiveMarks,
      negativeMarks: (negativeMarks * 100).roundToDouble() / 100,
      totalMarks: totalMarks,
      correct: correct,
      wrong: wrong,
      unattempted: unattempted,
      timeTakenSeconds: _elapsedSeconds,
      attemptNumber: _attemptNumber,
      negativeMarking: rules,
      passingMarks: quiz.passingMarks,
    );

    ref.read(sharedPrefsProvider).remove(_storageKey);

    final mockTestId = widget.mockTestId;
    final submission = QuizSubmission(
      quizId: widget.quizId,
      answers: payload,
      timeTakenSeconds: _elapsedSeconds,
      timeTakenMs: timeTakenMs,
    );

    if (mockTestId != null) {
      // A scheduled mock test scores against its own rank list rather than a
      // personal attempt record — there is no per-attempt review screen to
      // hand off to here, so the locally scored sheet is the result, and it
      // leads back to the test's own page where the live rank list lives.
      var mockSubmitOk = false;
      try {
        await ref
            .read(mockTestsRepositoryProvider)
            .submit(mockTestId, submission);
        mockSubmitOk = true;
      } catch (_) {
        mockSubmitOk = false;
      }

      if (!mounted) return;
      setState(() => _submitting = false);

      if (auto) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Time ran out — your attempt was submitted.'),
          ),
        );
      } else if (!mockSubmitOk) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              "Your score is shown below, but it could not be saved to the "
              "test's rank list. Pull to refresh there once you're back "
              'online.',
            ),
          ),
        );
      }

      await showQuizResultSheet(
        context,
        quiz: quiz,
        result: result,
        autoSubmitted: auto,
        questions: quiz.questions,
        answers: Map.of(_answers),
      );
      if (mounted) {
        // `replace`, so Back from the mock test page lands on its hub rather
        // than re-opening the attempt just finished.
        context.replace(AppRoutes.mockTest(mockTestId));
      }
      return;
    }

    QuizAttempt? saved;
    try {
      saved = await ref.read(quizzesRepositoryProvider).submitAttempt(
            widget.quizId,
            submission,
            attemptId: _attemptId,
          );
      // History and the dashboard both change once this lands.
      ref.invalidate(quizHistoryPageProvider);
    } catch (_) {
      saved = null;
    }

    if (!mounted) return;
    setState(() => _submitting = false);

    if (saved != null && saved.id.isNotEmpty) {
      if (auto) {
        // The result screen has no timer context of its own, so say why the
        // attempt ended before handing over to it.
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Time ran out — your attempt was submitted.'),
          ),
        );
      }
      // `replace`, so Back from the result lands on the quiz hub rather than
      // re-opening the attempt the student just finished.
      context.replace(AppRoutes.quizResult(saved.id));
      return;
    }

    // The attempt could not be persisted — the locally scored sheet still
    // tells the student how they did, using the same rules the server applies.
    showQuizResultSheet(
      context,
      quiz: quiz,
      result: result,
      autoSubmitted: auto,
      questions: quiz.questions,
      answers: Map.of(_answers),
    ).then((_) {
      if (mounted) context.pop();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const _AttemptSkeleton();

    if (_error != null) {
      return Scaffold(
        appBar: const GlassAppBar(),
        body: ErrorView(error: _error!, onRetry: _bootstrap),
      );
    }

    final quiz = _quiz!;

    if (quiz.isLocked) {
      final access = quiz.access ??
          AccessState(
            isPaid: true,
            hasAccess: false,
            price: quiz.effectivePrice,
            reason: AccessReason.paymentRequired,
          );
      return QuizPaywall(
        quizId: widget.quizId,
        title: quiz.title,
        access: access,
        onUnlocked: _bootstrap,
      );
    }

    if (quiz.questions.isEmpty) {
      return Scaffold(
        appBar: GlassAppBar(title: Text(quiz.title)),
        body: EmptyView(
          icon: Icons.help_outline_rounded,
          title: 'No questions yet',
          message: 'This question bank has no published questions right now.',
          action: OutlinedButton(
            onPressed: () => context.pop(),
            child: const Text('Back to Quiz Hub'),
          ),
        ),
      );
    }

    // Access is confirmed but the attempt has not begun — the intro screen
    // holds here until the student presses Start. Nothing above has started a
    // timer.
    if (!_started) {
      final rawSaved = ref.read(sharedPrefsProvider).getString(_storageKey);
      final localSaved = rawSaved != null ? _SavedProgress.parse(rawSaved, _activeAttempt?.id ?? '') : null;
      final hasProgress = (_activeAttempt?.status == AttemptStatus.inProgress) || (rawSaved != null);
      final elapsed = _activeAttempt?.timeTakenSeconds ?? localSaved?.elapsedSeconds ?? 0;

      return _QuizIntroScreen(
        quiz: quiz,
        starting: _starting,
        error: _startError,
        hasSavedProgress: hasProgress,
        savedElapsedSeconds: elapsed,
        onStart: _startAttempt,
      );
    }

    final question = quiz.questions[_currentIndex];
    final selected = _answers[question.id];
    final reveal = quiz.showCorrectAnswerAfterSelection && selected != null;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final leave = await showGlassConfirm(
          context,
          title: 'Are you sure you want to exit this quiz?',
          message: 'Your current progress and remaining time will be saved, so you can resume this quiz later.',
          cancelLabel: 'Cancel',
          confirmLabel: 'Exit',
          icon: Icons.exit_to_app_rounded,
        );
        if (leave && context.mounted) {
          await _pauseAndExit(quiz);
          if (context.mounted) context.pop();
        }
      },
      child: Scaffold(
        // A blocking overlay while the attempt is being persisted — the
        // result screen is server-scored, so there is nothing to show until
        // the submit lands.
        body: Stack(
          children: [
            SafeArea(
              child: Responsive.centered(
                maxWidth: Responsive.maxReadingWidth,
                child: Column(
                  children: [
                    _AttemptHeader(
                      quiz: quiz,
                      position: _currentIndex + 1,
                      total: quiz.questions.length,
                      remaining: _remainingSeconds,
                      answered: _answers.length,
                      onSubmit: _confirmSubmit,
                      onGrid: () => _showQuestionGrid(quiz),
                      onExit: () => Navigator.of(context).maybePop(),
                    ),
                    Expanded(
                      child: ListView(
                        padding: EdgeInsets.fromLTRB(
                          Responsive.horizontalPadding(context),
                          18,
                          Responsive.horizontalPadding(context),
                          24,
                        ),
                        children: [
                          Row(
                            children: [
                              AppBadge('QUESTION ${_currentIndex + 1}'),
                              const SizedBox(width: 8),
                              AppBadge(
                                'ATTEMPT #$_attemptNumber',
                                color: AppColors.amber,
                              ),
                              const Spacer(),
                              Text(
                                '${Fmt.marks(question.marks)} ${question.marks == 1 ? 'mark' : 'marks'}',
                                style:
                                    Theme.of(context).textTheme.labelSmall?.copyWith(
                                          color: context.palette.textMuted,
                                          fontWeight: FontWeight.w700,
                                        ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Text(
                            question.text,
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  height: 1.5,
                                  fontSize: 17,
                                ),
                          ),
                          const SizedBox(height: 20),
                          for (var i = 0; i < question.options.length; i++)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 11),
                              child: _OptionTile(
                                index: i,
                                option: question.options[i],
                                isSelected: selected == i,
                                isCorrect: i == question.correctOptionIndex,
                                reveal: reveal,
                                onTap: () => _select(question, i),
                              ),
                            ),
                          if (reveal && (question.explanation ?? '').isNotEmpty) ...[
                            const SizedBox(height: 8),
                            _Explanation(text: question.explanation!),
                          ],
                        ],
                      ),
                    ),
                    _AttemptFooter(
                      canPrev: _currentIndex > 0,
                      isLast: _currentIndex == quiz.questions.length - 1,
                      onPrev: () => _goTo(_currentIndex - 1),
                      onNext: () => _goTo(_currentIndex + 1),
                      onSubmit: _confirmSubmit,
                    ),
                  ],
                ),
              ),
            ),
            if (_submitting)
              const Positioned.fill(child: _SubmittingOverlay()),
          ],
        ),
      ),
    );
  }

  void _showQuestionGrid(Quiz quiz) {
    showGlassSheet<void>(
      context: context,
      isScrollControlled: false,
      builder: (context) => _QuestionGrid(
        quiz: quiz,
        answers: _answers,
        currentIndex: _currentIndex,
        onSelect: (index) {
          Navigator.of(context).pop();
          _goTo(index);
        },
      ),
    );
  }
}

class _AttemptHeader extends StatelessWidget {
  const _AttemptHeader({
    required this.quiz,
    required this.position,
    required this.total,
    required this.remaining,
    required this.answered,
    required this.onSubmit,
    required this.onGrid,
    required this.onExit,
  });

  final Quiz quiz;
  final int position;
  final int total;
  final int remaining;
  final int answered;
  final VoidCallback onSubmit;
  final VoidCallback onGrid;
  final VoidCallback onExit;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    // Under two minutes the clock turns red — the one moment the timer should
    // pull attention away from the question.
    final urgent = remaining <= 120;

    return Material(
      color: palette.card,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 10, 12, 10),
            child: Row(
              children: [
                IconButton(
                  tooltip: 'Exit Quiz',
                  icon: const Icon(Icons.close_rounded, size: 20),
                  onPressed: onExit,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        quiz.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style:
                            Theme.of(context).textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                      ),
                      Text(
                        '$position of $total · $answered answered',
                        style:
                            Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: palette.textMuted,
                                ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                  decoration: BoxDecoration(
                    color: (urgent ? AppColors.rose : AppColors.cyan)
                        .withValues(alpha: 0.13),
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    border: Border.all(
                      color: (urgent ? AppColors.rose : AppColors.cyan)
                          .withValues(alpha: 0.35),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.timer_outlined,
                        size: 14,
                        color: urgent ? AppColors.rose : AppColors.cyan,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        Fmt.clock(Duration(seconds: remaining)),
                        style: TextStyle(
                          fontFeatures: const [FontFeature.tabularFigures()],
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                          color: urgent ? AppColors.rose : AppColors.cyan,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'All questions',
                  icon: const Icon(Icons.grid_view_rounded, size: 20),
                  onPressed: onGrid,
                ),
              ],
            ),
          ),
          SizedBox(
            height: 3,
            child: LinearProgressIndicator(
              value: total == 0 ? 0 : position / total,
              backgroundColor: palette.elevated,
              valueColor: const AlwaysStoppedAnimation(AppColors.cyan),
            ),
          ),
        ],
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.index,
    required this.option,
    required this.isSelected,
    required this.isCorrect,
    required this.reveal,
    required this.onTap,
  });

  final int index;
  final QuestionOption option;
  final bool isSelected;
  final bool isCorrect;
  final bool reveal;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    Color border = palette.border;
    Color background = palette.card;
    Color badgeColor = palette.elevated;
    Color badgeText = palette.textSecondary;
    Widget? trailing;

    if (reveal && isCorrect) {
      border = AppColors.emerald;
      background = AppColors.emerald.withValues(alpha: 0.10);
      badgeColor = AppColors.emerald;
      badgeText = Colors.white;
      trailing = const Icon(Icons.check_circle_rounded,
          color: AppColors.emerald, size: 19);
    } else if (reveal && isSelected) {
      border = AppColors.rose;
      background = AppColors.rose.withValues(alpha: 0.10);
      badgeColor = AppColors.rose;
      badgeText = Colors.white;
      trailing =
          const Icon(Icons.cancel_rounded, color: AppColors.rose, size: 19);
    } else if (isSelected) {
      border = AppColors.cyan;
      background = AppColors.cyan.withValues(alpha: 0.08);
      badgeColor = AppColors.cyan;
      badgeText = Colors.white;
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(color: border, width: isSelected || reveal ? 1.5 : 1),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: badgeColor,
                borderRadius: BorderRadius.circular(8),
              ),
              alignment: Alignment.center,
              child: Text(
                String.fromCharCode(65 + index),
                style: TextStyle(
                  color: badgeText,
                  fontWeight: FontWeight.w800,
                  fontSize: 12.5,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    option.text,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          height: 1.45,
                          fontWeight:
                              isSelected ? FontWeight.w700 : FontWeight.w500,
                        ),
                  ),
                  if (reveal && (option.explanation ?? '').isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 5),
                      child: Text(
                        option.explanation!,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: palette.textMuted,
                              height: 1.4,
                            ),
                      ),
                    ),
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 10), trailing],
          ],
        ),
      ),
    );
  }
}

class _Explanation extends StatelessWidget {
  const _Explanation({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.indigo.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppColors.indigo.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.lightbulb_outline_rounded,
                  size: 15, color: AppColors.indigo),
              const SizedBox(width: 7),
              Text(
                'Explanation',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.indigo,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            text,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  height: 1.55,
                  color: context.palette.textSecondary,
                ),
          ),
        ],
      ),
    );
  }
}

class _AttemptFooter extends StatelessWidget {
  const _AttemptFooter({
    required this.canPrev,
    required this.isLast,
    required this.onPrev,
    required this.onNext,
    required this.onSubmit,
  });

  final bool canPrev;
  final bool isLast;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: context.palette.card,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: canPrev ? onPrev : null,
                icon: const Icon(Icons.chevron_left_rounded, size: 20),
                label: const Text('Back'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: GradientButton(
                label: isLast ? 'Submit attempt' : 'Next question',
                icon: isLast ? Icons.send_rounded : Icons.chevron_right_rounded,
                gradient:
                    isLast ? AppColors.goldGradient : AppColors.brandGradient,
                onPressed: isLast ? onSubmit : onNext,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuestionGrid extends StatelessWidget {
  const _QuestionGrid({
    required this.quiz,
    required this.answers,
    required this.currentIndex,
    required this.onSelect,
  });

  final Quiz quiz;
  final Map<String, int> answers;
  final int currentIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'All questions',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            '${answers.length} answered · ${quiz.questions.length - answers.length} left',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: palette.textMuted,
                ),
          ),
          const SizedBox(height: 18),
          Flexible(
            child: GridView.builder(
              shrinkWrap: true,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 6,
                mainAxisSpacing: 9,
                crossAxisSpacing: 9,
                childAspectRatio: 1,
              ),
              itemCount: quiz.questions.length,
              itemBuilder: (context, index) {
                final answered =
                    answers.containsKey(quiz.questions[index].id);
                final isCurrent = index == currentIndex;

                return InkWell(
                  onTap: () => onSelect(index),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: isCurrent ? AppColors.brandGradient : null,
                      color: isCurrent
                          ? null
                          : answered
                              ? AppColors.emerald.withValues(alpha: 0.15)
                              : palette.elevated,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      border: Border.all(
                        color: isCurrent
                            ? Colors.transparent
                            : answered
                                ? AppColors.emerald.withValues(alpha: 0.4)
                                : palette.border,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '${index + 1}',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        color: isCurrent
                            ? Colors.white
                            : answered
                                ? AppColors.emerald
                                : palette.textSecondary,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _AttemptSkeleton extends StatelessWidget {
  const _AttemptSkeleton();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: const [
            SkeletonBox(height: 44, radius: AppTheme.radiusMd),
            SizedBox(height: 26),
            SkeletonBox(width: 130, height: 20, radius: 6),
            SizedBox(height: 16),
            SkeletonBox(height: 22),
            SizedBox(height: 8),
            SkeletonBox(width: 240, height: 22),
            SizedBox(height: 26),
            SkeletonBox(height: 56, radius: AppTheme.radiusMd),
            SizedBox(height: 11),
            SkeletonBox(height: 56, radius: AppTheme.radiusMd),
            SizedBox(height: 11),
            SkeletonBox(height: 56, radius: AppTheme.radiusMd),
            SizedBox(height: 11),
            SkeletonBox(height: 56, radius: AppTheme.radiusMd),
          ],
        ),
      ),
    );
  }
}

/// Shown once access is confirmed and before the attempt begins. The clock and
/// the questions only appear when the student presses Start — a just-purchased
/// quiz never opens straight into a running timer.
class _QuizIntroScreen extends StatelessWidget {
  const _QuizIntroScreen({
    required this.quiz,
    required this.starting,
    required this.error,
    required this.hasSavedProgress,
    this.savedElapsedSeconds = 0,
    required this.onStart,
  });

  final Quiz quiz;
  final bool starting;
  final Object? error;
  final bool hasSavedProgress;
  final int savedElapsedSeconds;
  final Future<void> Function() onStart;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final rules = quiz.negativeMarking;
    final totalSec = quiz.durationMinutes * 60;
    final remainingSec = (totalSec - savedElapsedSeconds).clamp(0, totalSec);
    final remMin = remainingSec ~/ 60;
    final remSec = remainingSec % 60;

    return Scaffold(
      appBar: GlassAppBar(title: Text(quiz.title)),
      body: SafeArea(
        child: Responsive.centered(
          maxWidth: Responsive.maxReadingWidth,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: [
              GlassCard(
                borderColor: AppColors.amber.withValues(alpha: 0.34),
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
                        child: const Icon(Icons.checklist_rounded,
                            color: AppColors.amber, size: 30),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      quiz.title,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w900,
                            height: 1.25,
                          ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      hasSavedProgress
                          ? 'You have an attempt in progress with ${remMin}m ${remSec > 0 ? '$remSec s ' : ''}remaining. Press Resume to continue from where you left off.'
                          : 'Check the details below. The timer starts the moment you press Start.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: palette.textSecondary,
                            height: 1.5,
                          ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        _IntroStat(
                          icon: Icons.help_outline_rounded,
                          value: '${quiz.questions.length}',
                          label: 'Questions',
                        ),
                        _IntroStat(
                          icon: Icons.timer_outlined,
                          value: hasSavedProgress
                              ? '${remMin}m${remSec > 0 ? ' ${remSec}s' : ''}'
                              : '${quiz.durationMinutes}m',
                          label: hasSavedProgress ? 'Time Left' : 'Duration',
                        ),
                        _IntroStat(
                          icon: Icons.emoji_events_outlined,
                          value: Fmt.marks(quiz.totalMarks),
                          label: 'Marks',
                        ),
                      ],
                    ),
                    if (rules.enabled) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.rose.withValues(alpha: 0.10),
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusSm),
                          border: Border.all(
                            color: AppColors.rose.withValues(alpha: 0.25),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.remove_circle_outline_rounded,
                                color: AppColors.rose, size: 18),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Negative marking: −${Fmt.marks(rules.deduct)} '
                                'for every ${rules.every} wrong answers'
                                '${rules.allowNegativeScore ? '. Score can go below zero.' : '.'}',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: palette.textSecondary,
                                      height: 1.4,
                                    ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (error != null) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Could not start the quiz. Please check your connection '
                        'and try again.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.rose,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    GradientButton(
                      label: starting
                          ? 'Starting…'
                          : hasSavedProgress
                              ? 'Resume Quiz'
                              : 'Start Quiz',
                      icon: Icons.play_arrow_rounded,
                      gradient: AppColors.goldGradient,
                      isLoading: starting,
                      onPressed: starting ? null : () => onStart(),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: () => context.pop(),
                      icon: const Icon(Icons.arrow_back_rounded, size: 18),
                      label: const Text('Back to Quiz Hub'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _IntroStat extends StatelessWidget {
  const _IntroStat({
    required this.icon,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 3),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: palette.textPrimary.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border: Border.all(color: palette.border),
        ),
        child: Column(
          children: [
            Icon(icon, size: 16, color: AppColors.amber),
            const SizedBox(height: 6),
            Text(
              value,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 2),
            Text(
              label.toUpperCase(),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: palette.textMuted,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Covers the attempt while its answers are on their way to the server, so a
/// slow network cannot be mistaken for a submit that did not register.
class _SubmittingOverlay extends StatelessWidget {
  const _SubmittingOverlay();

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return ColoredBox(
      color: palette.background.withValues(alpha: 0.82),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(strokeWidth: 3),
            const SizedBox(height: 16),
            Text(
              'Submitting your answers…',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: palette.textSecondary,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
