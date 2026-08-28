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

/// The live mock test, given the top of the home screen while it is running.
///
/// A test that is live is time-boxed, so it outranks everything else on the
/// page; one that is merely upcoming appears in the same slot but reads as a
/// heads-up rather than a call to action.
class LiveMockBanner extends ConsumerStatefulWidget {
  const LiveMockBanner({super.key});

  @override
  ConsumerState<LiveMockBanner> createState() => _LiveMockBannerState();
}

class _LiveMockBannerState extends ConsumerState<LiveMockBanner> {
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
    final mock = ref.read(liveMockTestProvider).valueOrNull;
    if (mock == null) return;

    // The moment an upcoming test is due, the server knows it is live and this
    // card does not — the provider only refetches on pull-to-refresh. Asking
    // once here is what turns "starting now" into "Join now" without the
    // student having to pull the page.
    if (!mock.isLive && mock.startsIn.isNegative && !_refetchedAtStart) {
      _refetchedAtStart = true;
      ref.invalidate(liveMockTestProvider);
      return;
    }

    final next = _countdownLabel(mock);
    if (next != _shownCountdown) setState(() => _shownCountdown = next);
  }

  String? _countdownLabel(MockTest mock) =>
      mockCountdownLabel(isLive: mock.isLive, startsIn: mock.startsIn);

  @override
  Widget build(BuildContext context) {
    final mock = ref.watch(liveMockTestProvider).valueOrNull;
    if (mock == null) return const SizedBox.shrink();

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

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: GlassCard(
        onTap: open,
        borderColor: accent.withValues(alpha: 0.45),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
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
            const SizedBox(height: 11),
            Text(
              mock.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    height: 1.25,
                  ),
            ),
            const SizedBox(height: 8),
            if (isLive)
              Text(
                'Running now — join before the window closes.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                      height: 1.45,
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
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
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
            const SizedBox(height: 14),
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
