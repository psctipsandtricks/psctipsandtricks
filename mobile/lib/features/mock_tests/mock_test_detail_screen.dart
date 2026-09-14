import 'dart:async';

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
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/mock_test.dart';
import '../../data/models/quiz.dart';
import '../checkout/purchase_sheet.dart';
import '../home/home_providers.dart';
import '../quizzes/widgets/quiz_result_sheet.dart';
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
  bool _buying = false;

  Future<void> _join(MockTest mock) async {
    setState(() => _joining = true);
    try {
      await ref.read(mockTestsRepositoryProvider).join(mock.id);
      ref.invalidate(mockTestProvider(mock.id));
      ref.invalidate(mockTestsViewProvider);
      ref.invalidate(liveMockTestsProvider);
      if (!mounted) return;

      // Joining only reserves a seat; the paper itself is the underlying quiz.
      // The mock test id tags along so submitting scores this as a ranked
      // attempt rather than a private quiz attempt.
      context.push(AppRoutes.quizAttempt(mock.quizId, mockTestId: mock.id));
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

  Future<void> _buy(MockTest mock) async {
    final signedIn = ref.read(authControllerProvider).isAuthenticated;
    if (!signedIn) {
      final target = AppRoutes.mockTest(mock.id);
      context.push(
        '${AppRoutes.login}?redirect=${Uri.encodeComponent(target)}',
      );
      return;
    }

    setState(() => _buying = true);
    try {
      final success = await showPurchaseSheet(
        context,
        target: PurchaseTarget.quiz(
          id: mock.quizId,
          title: mock.title,
          price: mock.price,
        ),
      );

      if (success && mounted) {
        // Refetch mock test state so it updates to unlocked
        ref.invalidate(mockTestProvider(mock.id));
        ref.invalidate(mockTestsViewProvider);
        ref.invalidate(liveMockTestsProvider);
        await ref.read(mockTestProvider(mock.id).future);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Payment successful! You can now join the test.'),
              backgroundColor: AppColors.emerald,
            ),
          );
        }
      }
    } finally {
      if (mounted) setState(() => _buying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mockAsync = ref.watch(mockTestProvider(widget.mockTestId));

    return Scaffold(
      appBar: const GlassAppBar(title: Text('Mock test')),
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
              // A paper already sat has nothing left to join — the server
              // refuses a second submission — so the rank list takes the slot
              // the join button would have had. Same swap the website makes.
              if (!mockTestSubmitted(ref, mock))
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _Action(
                    mock: mock,
                    busy: _joining,
                    buying: _buying,
                    onJoin: () => _join(mock),
                    onBuy: () => _buy(mock),
                  ),
                ),
              if (mockTestSubmitted(ref, mock))
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _MyRankList(mock: mock),
                )
              else if (mock.status == MockTestStatus.completed) ...[
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
              if (mock.isPaid) ...[
                const SizedBox(width: 8),
                if (mock.isLocked)
                  AppBadge(
                    Fmt.price(mock.price),
                    color: AppColors.amber,
                    icon: Icons.lock_rounded,
                  )
                else
                  const AppBadge(
                    'PURCHASED',
                    color: AppColors.emerald,
                    icon: Icons.check_circle_rounded,
                  ),
              ],
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
  const _Action({
    required this.mock,
    required this.busy,
    required this.buying,
    required this.onJoin,
    required this.onBuy,
  });

  final MockTest mock;
  final bool busy;
  final bool buying;
  final VoidCallback onJoin;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (mock.submitted) {
      return const LockedNotice(
        message: 'You have already submitted this mock test. '
            'Your rank appears in the list below once results are published.',
      );
    }

    final isLocked = mock.isLocked;

    // If the mock test is locked (unpurchased), show a Buy Now button.
    if (isLocked) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GradientButton(
            label: 'Unlock for ${Fmt.price(mock.price)}',
            icon: Icons.lock_rounded,
            gradient: AppColors.goldGradient,
            isLoading: buying,
            onPressed: buying ? null : onBuy,
          ),
          const SizedBox(height: 10),
          Center(
            child: Text(
              'Unlock this premium mock test to participate and get ranked.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: context.palette.textMuted,
                  ),
            ),
          ),
        ],
      );
    }

    // Once payment is completed (or free/unlocked), show Join Now / Continue.
    switch (mock.status) {
      case MockTestStatus.live:
        return GradientButton(
          label: mock.joined ? 'Continue the test' : 'Join Now',
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
                    Row(
                      children: [
                        Text(
                          'Starts ${Fmt.untilStart(mock.startsIn)}',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        if (mock.isPaid) ...[
                          const SizedBox(width: 8),
                          const AppBadge(
                            'PURCHASED',
                            color: AppColors.emerald,
                            icon: Icons.check_circle_rounded,
                          ),
                        ],
                      ],
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
          onPressed: isLocked
              ? onBuy
              : () => context.push(AppRoutes.quizAttempt(mock.quizId, mockTestId: mock.id)),
          icon: Icon(
              isLocked ? Icons.lock_rounded : Icons.replay_rounded,
              size: 18),
          label: Text(isLocked
              ? 'Unlock to practise (${Fmt.price(mock.price)})'
              : 'Practise this paper'),
        );
    }
  }
}

/// The student's own standing in a mock test they have submitted.
///
/// The rank list a student is shown is their row and no one else's — the same
/// shape the website's rank list page has, where the full board is fetched but
/// filtered down to the signed-in user before it is drawn. While the test is
/// still running that row moves as other people submit, so it re-reads the
/// board on a timer and says so; once the window closes the numbers are final
/// and the timer stops.
class _MyRankList extends ConsumerStatefulWidget {
  const _MyRankList({required this.mock});

  final MockTest mock;

  @override
  ConsumerState<_MyRankList> createState() => _MyRankListState();
}

class _MyRankListState extends ConsumerState<_MyRankList> {
  /// Matches the website's `LEADERBOARD_POLL_MS`, so a rank moves at the same
  /// pace on both.
  static const _pollInterval = Duration(seconds: 4);

  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _syncPoll();
  }

  @override
  void didUpdateWidget(covariant _MyRankList old) {
    super.didUpdateWidget(old);
    // The test finishing mid-view is exactly when the timer should stop.
    if (old.mock.status != widget.mock.status) _syncPoll();
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  void _syncPoll() {
    _poll?.cancel();
    if (widget.mock.status == MockTestStatus.completed) return;
    _poll = Timer.periodic(_pollInterval, (_) {
      if (!mounted) return;
      ref.invalidate(mockLeaderboardProvider(widget.mock.id));
    });
  }

  @override
  Widget build(BuildContext context) {
    final mock = widget.mock;
    final isFinal = mock.status == MockTestStatus.completed;
    final me = ref.watch(currentUserProvider);
    final board = ref.watch(mockLeaderboardProvider(mock.id)).valueOrNull;

    // The board is the live source — its rank is recomputed on read, so it
    // moves the moment someone else overtakes. The row carried on the mock
    // test itself is the fallback: it is written by the background recompute,
    // and it is all there is for a student ranked past the board's cut-off.
    final mine = board?.where((e) => e.userId == me?.id).firstOrNull;
    final rank = mine?.rank ?? mock.myRank;
    final score = mine?.score ?? mock.myScore;
    final totalMarks = mine?.totalMarks ?? mock.quiz?.totalMarks;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Icon(Icons.leaderboard_rounded,
                size: 17, color: AppColors.cyan),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                isFinal ? 'Final rank list' : 'Live rank list',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
              ),
            ),
            AppBadge(
              isFinal ? 'FINAL' : 'UPDATING',
              color: isFinal ? AppColors.emerald : AppColors.rose,
              filled: !isFinal,
            ),
          ],
        ),
        const SizedBox(height: 12),
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
                // Null between submitting and the rank recompute landing —
                // "Pending" says that honestly rather than inventing a #1.
                value: rank == null ? 'Pending' : '#$rank',
                accent: AppColors.emerald,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // Only once there is a real rank to show. `MockRankRow` reads anything at
        // or under 3 as a podium finish and draws a trophy for it, so handing
        // it a placeholder while the recompute is still running would award
        // the student a medal they have not earned.
        if (rank != null)
          MockRankRow(
            entry: LeaderboardEntry(
              rank: rank,
              userId: me?.id ?? '',
              userName: mine?.userName ?? me?.name ?? 'You',
              score: score ?? 0,
              avatarUrl: mine?.avatarUrl ?? me?.avatarUrl,
              totalMarks: totalMarks,
              timeTakenSeconds: mine?.timeTakenSeconds,
            ),
            isMe: true,
          )
        else
          GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 14),
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
                    'Your answers are in. Your place on the rank list is being '
                    'worked out.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: context.palette.textSecondary,
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
              : 'Your rank moves as other aspirants submit. Only your own row '
                  'is shown.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: context.palette.textMuted,
                height: 1.4,
              ),
        ),
        if (mock.quiz != null && mock.quiz!.questions.isNotEmpty) ...[
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: () {
              final quiz = mock.quiz!;
              final rules = quiz.negativeMarking;
              final sc = score ?? mock.myScore ?? 0.0;
              final tm = totalMarks ?? quiz.totalMarks;
              final res = QuizResult(
                score: sc,
                positiveMarks: sc,
                negativeMarks: 0,
                totalMarks: tm,
                correct: 0,
                wrong: 0,
                unattempted: 0,
                timeTakenSeconds: 0,
                attemptNumber: 1,
                negativeMarking: rules,
                passingMarks: quiz.passingMarks,
              );
              showQuizResultSheet(
                context,
                quiz: quiz,
                result: res,
                questions: quiz.questions,
                answers: const {},
                mockTestId: mock.id,
              );
            },
            icon: const Icon(Icons.fact_check_outlined, size: 18),
            label: const Text('View solutions & answers'),
          ),
        ],
      ],
    );
  }
}

/// One of the two numbers above the rank row.
class MockStatTile extends StatelessWidget {
  const MockStatTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.accent,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 13, color: accent),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          FittedBox(
            child: Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: accent,
                  ),
            ),
          ),
        ],
      ),
    );
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
                child: MockRankRow(
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

class MockRankRow extends StatelessWidget {
  const MockRankRow({super.key, required this.entry, required this.isMe});

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
