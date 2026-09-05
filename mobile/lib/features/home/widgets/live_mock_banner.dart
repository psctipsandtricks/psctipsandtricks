import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/auth_controller.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../data/models/mock_test.dart';
import '../home_providers.dart';

/// The live (or soon) mock tests, given the top of the home screen while they
/// are running.
///
/// A test that is live is time-boxed, so it outranks everything else on the
/// page; one that is merely upcoming appears in the same slot but reads as a
/// heads-up rather than a call to action. When more than one is published at
/// once they become a horizontally swipeable carousel so each still gets a
/// full card.
class LiveMockBanner extends ConsumerWidget {
  const LiveMockBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mocks = ref.watch(liveMockTestsProvider).valueOrNull ?? const [];
    if (mocks.isEmpty) return const SizedBox.shrink();

    if (mocks.length == 1) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        child: _MockCard(mock: mocks.first),
      );
    }

    return _MockCarousel(mocks: mocks);
  }
}

/// Pages one mock card at a time in a horizontally scrollable carousel,
/// with a peek of the next card, dot indicators, and swipe indicator.
class _MockCarousel extends StatefulWidget {
  const _MockCarousel({required this.mocks});

  final List<MockTest> mocks;

  @override
  State<_MockCarousel> createState() => _MockCarouselState();
}

class _MockCarouselState extends State<_MockCarousel> {
  // A sliver of the neighbouring card peeks in, which is the clearest possible
  // hint that the row scrolls.
  late final PageController _controller;
  int _page = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _controller = PageController(viewportFraction: 0.92);
    if (widget.mocks.length > 1) {
      _startTimer();
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 4200), (t) {
      if (!mounted || !_controller.hasClients) return;
      final nextPage = (_page + 1) % widget.mocks.length;
      _controller.animateToPage(
        nextPage,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  void _pauseAndRestartTimer() {
    _timer?.cancel();
    _timer = Timer(const Duration(seconds: 6), () {
      if (mounted && widget.mocks.length > 1) {
        _startTimer();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final count = widget.mocks.length;
    final anyLive = widget.mocks.any((m) => m.isLive);
    final accent = anyLive ? AppColors.rose : AppColors.amber;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 10),
          child: Row(
            children: [
              if (anyLive)
                const _LivePulse()
              else
                Icon(Icons.schedule_rounded, size: 13, color: accent),
              const SizedBox(width: 7),
              Text(
                anyLive ? 'LIVE MOCK TESTS' : 'MOCK TESTS COMING UP',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: accent,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1,
                      fontSize: 10,
                    ),
              ),
              const SizedBox(width: 6),
              Text(
                '· ${_page + 1}/$count',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.textMuted,
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const Spacer(),
              Text(
                'Swipe to view',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.textMuted.withValues(alpha: 0.7),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(width: 3),
              Icon(
                Icons.arrow_forward_ios_rounded,
                size: 9,
                color: palette.textMuted.withValues(alpha: 0.7),
              ),
            ],
          ),
        ),
        NotificationListener<ScrollNotification>(
          onNotification: (notification) {
            if (notification is UserScrollNotification) {
              _pauseAndRestartTimer();
            }
            return false;
          },
          child: SizedBox(
            height: 205,
            child: PageView.builder(
              controller: _controller,
              itemCount: count,
              padEnds: false,
              physics: const BouncingScrollPhysics(),
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (context, i) => Padding(
                padding: EdgeInsets.only(
                  left: i == 0 ? 16 : 6,
                  right: i == count - 1 ? 16 : 6,
                ),
                child: _MockCard(mock: widget.mocks[i], filled: true),
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < count; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _page ? 20 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: i == _page
                      ? accent
                      : palette.textMuted.withValues(alpha: 0.35),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// One mock test card. Owns a per-second ticker so its countdown stays live and
/// so it can ask for a refetch the moment an upcoming test is due.
class _MockCard extends ConsumerStatefulWidget {
  const _MockCard({required this.mock, this.filled = false});

  final MockTest mock;

  /// True inside the carousel, where every page is a fixed height and the
  /// button should sit at the bottom of the card rather than under the content.
  final bool filled;

  @override
  ConsumerState<_MockCard> createState() => _MockCardState();
}

class _MockCardState extends ConsumerState<_MockCard> {
  Timer? _ticker;

  /// What the countdown last read. The ticker fires every second, but a
  /// rebuild only happens when the text would actually change — a test three
  /// days out costs one string compare a second, not sixty rebuilds a minute.
  String? _shownCountdown;

  /// Set once the countdown has run out, so the refetch that flips the card to
  /// LIVE is asked for a single time rather than on every following tick.
  bool _refetchedAtStart = false;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _onTick());
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _onTick() {
    if (!mounted) return;
    final mock = widget.mock;

    // The moment an upcoming test is due, the server knows it is live and this
    // card does not — the provider only refetches on pull-to-refresh. Asking
    // once here is what turns "starting now" into "Join now" without the
    // student having to pull the page.
    if (!mock.isLive && mock.startsIn.isNegative && !_refetchedAtStart) {
      _refetchedAtStart = true;
      ref.invalidate(liveMockTestsProvider);
      return;
    }

    final next = _countdownLabel(mock);
    if (next != _shownCountdown) setState(() => _shownCountdown = next);
  }

  String? _countdownLabel(MockTest mock) =>
      mockCountdownLabel(isLive: mock.isLive, startsIn: mock.startsIn);

  @override
  Widget build(BuildContext context) {
    final mock = widget.mock;
    final filled = widget.filled;
    final palette = context.palette;
    final isLive = mock.isLive;
    final locked = mock.isLocked;
    final accent = isLive ? AppColors.rose : AppColors.amber;
    final countdown = _countdownLabel(mock);

    void open() {
      final signedIn = ref.read(authControllerProvider).isAuthenticated;
      final target = AppRoutes.mockTest(mock.id);
      context.push(
        signedIn
            ? target
            : '${AppRoutes.login}?redirect=${Uri.encodeComponent(target)}',
      );
    }

    return GlassCard(
      onTap: open,
      borderColor: accent.withValues(alpha: 0.45),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: filled ? MainAxisSize.max : MainAxisSize.min,
        children: [
          Row(
            children: [
              if (isLive)
                const _LivePulse()
              else
                Icon(Icons.schedule_rounded, size: 13, color: accent),
              const SizedBox(width: 7),
              Text(
                isLive ? 'LIVE MOCK TEST' : 'MOCK TEST COMING UP',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: accent,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1,
                      fontSize: 10,
                    ),
              ),
              const Spacer(),
              if (mock.isPaid) ...[
                Icon(
                  locked ? Icons.lock_rounded : Icons.lock_open_rounded,
                  size: 12,
                  color: locked ? AppColors.amber : AppColors.emerald,
                ),
                const SizedBox(width: 4),
                Text(
                  locked ? Fmt.price(mock.price) : 'Unlocked',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: locked ? AppColors.amber : AppColors.emerald,
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(width: 10),
              ],
              // A bare "0" beside a group icon reads as a score, not as an
              // empty room; the count earns its place only once someone is
              // actually in.
              if (mock.participantCount > 0) ...[
                Icon(Icons.groups_rounded, size: 13, color: palette.textMuted),
                const SizedBox(width: 4),
                Text(
                  '${mock.participantCount}',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 7),
          Text(
            mock.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                  height: 1.2,
                ),
          ),
          const SizedBox(height: 5),
          if (isLive)
            Text(
              'Running now — join before the window closes.',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: palette.textSecondary,
                    height: 1.3,
                  ),
            )
          else
            Row(
              children: [
                Text(
                  'Starts in',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                ),
                const SizedBox(width: 7),
                if (countdown != null)
                  _Countdown(label: countdown, accent: accent)
                else
                  Text(
                    Fmt.untilStart(mock.startsIn).replaceFirst('in ', ''),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: palette.textPrimary,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '· ${Fmt.dateTime(mock.scheduledAt)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: palette.textMuted,
                        ),
                  ),
                ),
              ],
            ),
          if (mock.quiz != null) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                _Fact(
                  icon: Icons.help_outline_rounded,
                  label: Fmt.count(mock.quiz!.totalQuestions, 'question'),
                ),
                _Fact(
                  icon: Icons.timer_outlined,
                  label: '${mock.quiz!.durationMinutes} min',
                ),
                _Fact(
                  icon: Icons.military_tech_outlined,
                  label: Fmt.count(mock.quiz!.totalMarks.round(), 'mark'),
                ),
              ],
            ),
          ],
          if (filled) const Spacer(),
          const SizedBox(height: 8),
          // A locked test must not promise a seat it cannot give: tapping
          // through lands on the paywall either way, so the button says so
          // rather than reading "Join now" and then refusing.
          GradientButton(
            label: locked
                ? 'Unlock for ${Fmt.price(mock.price)}'
                : isLive
                    ? (mock.joined ? 'Continue the test' : 'Join now')
                    : 'View details',
            icon: locked
                ? Icons.lock_rounded
                : isLive
                    ? Icons.bolt_rounded
                    : Icons.event_rounded,
            compact: true,
            gradient: locked
                ? AppColors.goldGradient
                : isLive
                    ? const LinearGradient(
                        colors: [AppColors.rose, AppColors.amber],
                      )
                    : AppColors.brandGradient,
            onPressed: open,
          ),
        ],
      ),
    );
  }
}

/// The ticking clock, in a tinted pill.
///
/// Tabular figures are the point: without them the digits are different widths
/// and the whole line twitches sideways every second.
class _Countdown extends StatelessWidget {
  const _Countdown({required this.label, required this.accent});

  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border.all(color: accent.withValues(alpha: 0.32)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: accent,
              fontWeight: FontWeight.w900,
              fontFeatures: const [FontFeature.tabularFigures()],
              letterSpacing: 0.4,
            ),
      ),
    );
  }
}

/// The countdown a mock test card should show right now, or null when there is
/// nothing worth ticking — the test is already running, or it is far enough out
/// that a second hand is noise rather than information.
///
/// Split out from the widget so the minutes before a test starts, which a test
/// run cannot sit and wait for, can still be checked.
String? mockCountdownLabel({
  required bool isLive,
  required Duration startsIn,
}) {
  if (isLive) return null;
  if (startsIn.isNegative) return 'starting now';
  // Under an hour the seconds matter, so show a real clock.
  if (startsIn.inHours < 1) return Fmt.clock(startsIn);
  return null;
}

/// A slow pulse on the LIVE dot — enough to read as "happening now" without
/// becoming the noisiest thing on the screen.
class _LivePulse extends StatefulWidget {
  const _LivePulse();

  @override
  State<_LivePulse> createState() => _LivePulseState();
}

class _LivePulseState extends State<_LivePulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.35, end: 1).animate(_controller),
      child: Container(
        width: 9,
        height: 9,
        decoration: const BoxDecoration(
          color: AppColors.rose,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: palette.textMuted),
          const SizedBox(width: 5),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: palette.textMuted,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}
