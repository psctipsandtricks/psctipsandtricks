import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/router/app_router.dart';
import '../../core/router/notification_destination.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/glass_card.dart';
import '../../data/models/notification.dart';
import 'announcement_providers.dart';

/// Puts the active announcements in front of the student, one modal at a time.
///
/// Wraps the whole app rather than living on the home screen, because the
/// brief is "when the user opens the application" — not "when the user reaches
/// a particular tab". The queue drains in order: closing a card marks it seen
/// for the session and the next one opens behind it, until there is nothing
/// left to show.
///
/// The dialog is a real route on the root navigator, so the system back button
/// and the barrier dismiss it the way every other dialog in the app behaves,
/// and a single `.then()` marks the card seen no matter which of the three
/// ways closed it.
class AnnouncementPopupHost extends ConsumerStatefulWidget {
  const AnnouncementPopupHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AnnouncementPopupHost> createState() =>
      _AnnouncementPopupHostState();
}

class _AnnouncementPopupHostState extends ConsumerState<AnnouncementPopupHost>
    with WidgetsBindingObserver {
  /// Full-screen tasks and sign-in flows the popup must not cover. Dropping a
  /// modal onto a student mid-question, or on top of the login form they were
  /// sent to, is worse than showing the notice a moment later — so the popup
  /// waits and the route listener brings it back when they leave.
  static const _blockedPrefixes = <String>[
    '/attempt/',
    '/login',
    '/signup',
    '/auth/',
  ];

  /// After this long in the background, the app re-asks what is active so a
  /// newly published announcement arrives without needing a restart. It does
  /// not reopen anything already seen — those are gone for good.
  static const _refetchAfterBackground = Duration(minutes: 30);

  bool _isShowing = false;
  bool _isScheduled = false;
  DateTime? _backgroundedAt;
  Listenable? _routeListenable;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // The router only exists once the first frame is up.
      _routeListenable = ref.read(routerProvider).routerDelegate
        ..addListener(_scheduleShow);
      _maybeShow();
    });
  }

  @override
  void dispose() {
    _routeListenable?.removeListener(_scheduleShow);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      _backgroundedAt = DateTime.now();
      return;
    }
    if (state != AppLifecycleState.resumed) return;

    final since = _backgroundedAt;
    _backgroundedAt = null;
    if (since == null ||
        DateTime.now().difference(since) < _refetchAfterBackground) {
      return;
    }

    // Only the list is refreshed. What the student has already seen stays
    // seen — anything new the admin has published since carries a new id and
    // is not in the dismissed set, so it opens on its own.
    ref.invalidate(activeAnnouncementsProvider);
  }

  @override
  Widget build(BuildContext context) {
    // The queue is watched here rather than polled: a late API response, a
    // pull-to-refresh, or a dismissal all land in the same place.
    ref.listen<List<AnnouncementPopup>>(
      pendingAnnouncementsProvider,
      (_, __) => _scheduleShow(),
    );
    return widget.child;
  }

  /// Waits for the end of the frame before opening anything.
  ///
  /// Both triggers — a route change and a change to the queue — arrive in the
  /// middle of a build, and a dialog pushed while the router is swapping its
  /// pages over is discarded along with them. One post-frame callback at a
  /// time, so a burst of notifications still opens a single card.
  void _scheduleShow() {
    if (_isScheduled || _isShowing) return;
    _isScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _isScheduled = false;
      _maybeShow();
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  /// Opens the head of the queue, if there is one and now is a good moment.
  void _maybeShow() {
    if (!mounted || _isShowing) return;

    final pending = ref.read(pendingAnnouncementsProvider);
    if (pending.isEmpty) return;

    final router = ref.read(routerProvider);
    // The last match, not `currentConfiguration.uri`: the uri reports the last
    // declarative location, so it still says `/` while the student is inside a
    // book that was pushed onto it.
    final location =
        router.routerDelegate.currentConfiguration.last.matchedLocation;
    if (_blockedPrefixes.any(location.startsWith)) return;
    // The reader is nested under a book, so it needs a suffix match too.
    if (location.endsWith('/read')) return;

    final navigatorContext = router.routerDelegate.navigatorKey.currentContext;
    if (navigatorContext == null) return;

    final announcement = pending.first;
    _isShowing = true;

    showGeneralDialog<bool>(
      context: navigatorContext,
      barrierDismissible: true,
      barrierLabel: 'Dismiss announcement',
      // Transparent, because the dim is painted by the blur layer inside the
      // dialog — one surface doing both keeps them fading in together.
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 240),
      pageBuilder: (dialogContext, _, __) =>
          _AnnouncementDialog(announcement: announcement),
      transitionBuilder: (context, animation, _, child) {
        final curved =
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
        return FadeTransition(
          opacity: curved,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.94, end: 1).animate(curved),
            child: child,
          ),
        );
      },
    ).then((followLink) {
      // The host outlives every dialog in practice; if the app is tearing down
      // there is nobody left to show the next card to.
      if (!mounted) return;

      // Every exit — the X, the barrier, the back button, the link — funnels
      // through here, so a card is marked seen exactly once.
      ref.read(dismissedAnnouncementsProvider.notifier).dismiss(announcement.id);

      // Navigation is deliberately deferred until the dialog has finished
      // closing: pushing a route disposes whatever pageless routes are sitting
      // on the navigator, so a popup opened before this line would be torn
      // straight back off the screen.
      if (followLink == true) _followLink(announcement);

      // `_isShowing` stays set across the whole handover, which is what keeps
      // the queue watcher from opening the next card into the middle of it.
      // Released a beat later, once the exit transition and any navigation the
      // link started have settled, so the next card opens on the new page.
      Future<void>.delayed(const Duration(milliseconds: 280), () {
        _isShowing = false;
        _maybeShow();
      });
    });
  }

  /// Sends the student wherever the admin panel pointed the card: a route this
  /// build actually has is pushed, anything web-shaped opens in the browser.
  void _followLink(AnnouncementPopup announcement) {
    final destination = resolveNotificationDestination(announcement.redirectUrl);
    if (destination == null) return;

    final router = ref.read(routerProvider);
    if (destination.isExternal) {
      launchUrl(destination.externalUrl!, mode: LaunchMode.externalApplication);
    } else {
      router.push(destination.location!);
    }
  }
}

/// The card itself: a centred notice over a blurred, dimmed app.
class _AnnouncementDialog extends StatelessWidget {
  const _AnnouncementDialog({required this.announcement});

  final AnnouncementPopup announcement;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final palette = context.palette;
    final accent = announcementAccentColor(announcement.backgroundColor);
    final action = announcementActionLabel(announcement);
    final hasImage = (announcement.imageUrl ?? '').isNotEmpty;
    final radius = BorderRadius.circular(AppTheme.radiusLg);

    // Popping with `true` is how the card asks the host to follow its link —
    // the host waits for the close to finish before navigating.
    void close({bool follow = false}) => Navigator.of(context).maybePop(follow);

    return Stack(
      children: [
        // The blur: the app stays legible behind the notice without competing
        // with it. Tapping it is the third way out, alongside X and back.
        Positioned.fill(
          child: GestureDetector(
            onTap: close,
            behavior: HitTestBehavior.opaque,
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
              child: ColoredBox(
                color: Colors.black.withValues(alpha: palette.isDark ? 0.6 : 0.4),
              ),
            ),
          ),
        ),
        Center(
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: 20,
              // Clear of the keyboard-less system insets on short devices.
              vertical: media.padding.vertical + 24,
            ),
            child: ConstrainedBox(
              // Wide enough to read on a tablet, never edge-to-edge on one.
              constraints: const BoxConstraints(maxWidth: 420),
              child: Material(
                color: palette.card,
                borderRadius: radius,
                clipBehavior: Clip.antiAlias,
                elevation: 12,
                shadowColor: Colors.black.withValues(alpha: 0.4),
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: radius,
                    border: Border.all(color: accent.withValues(alpha: 0.35)),
                  ),
                  child: Stack(
                    children: [
                      // Scrollable so a long notice, a large text scale or a
                      // short screen can never overflow the card.
                      SingleChildScrollView(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (hasImage)
                              // Tapping the artwork follows the link too — the
                              // banner is the most obvious thing to press.
                              GestureDetector(
                                onTap: action == null
                                    ? null
                                    : () => close(follow: true),
                                child: AppImage(
                                  url: announcement.imageUrl,
                                  height: 170,
                                  fallbackIcon: Icons.campaign_rounded,
                                ),
                              ),
                            Padding(
                              padding: EdgeInsets.fromLTRB(
                                  20, hasImage ? 18 : 44, 20, 20),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  AppBadge(
                                    'ANNOUNCEMENT',
                                    color: accent,
                                    icon: Icons.campaign_rounded,
                                  ),
                                  const SizedBox(height: 14),
                                  Text(
                                    announcement.title,
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleLarge
                                        ?.copyWith(
                                          fontWeight: FontWeight.w900,
                                          height: 1.25,
                                        ),
                                  ),
                                  if (announcement.message.trim().isNotEmpty) ...[
                                    const SizedBox(height: 10),
                                    Text(
                                      announcement.message,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium
                                          ?.copyWith(
                                            color: palette.textSecondary,
                                            height: 1.6,
                                          ),
                                    ),
                                  ],
                                  if (action != null) ...[
                                    const SizedBox(height: 20),
                                    GradientButton(
                                      label: action,
                                      icon: Icons.arrow_forward_rounded,
                                      onPressed: () => close(follow: true),
                                    ),
                                  ],
                                  if (announcement.endDate != null) ...[
                                    const SizedBox(height: 14),
                                    Center(
                                      child: Text(
                                        'Valid until ${Fmt.date(announcement.endDate)}',
                                        style: Theme.of(context)
                                            .textTheme
                                            .labelSmall
                                            ?.copyWith(color: palette.textMuted),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      Positioned(
                        top: 6,
                        right: 6,
                        child: _CloseButton(onPressed: () => close(), onImage: hasImage),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// The X. Sits on a scrim when it overlaps artwork, so it stays visible on a
/// light photograph as well as on a dark one.
class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.onPressed, required this.onImage});

  final VoidCallback onPressed;
  final bool onImage;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Close',
      child: Material(
        color: onImage
            ? Colors.black.withValues(alpha: 0.45)
            : context.palette.elevated,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Icon(
              Icons.close_rounded,
              size: 20,
              color: onImage ? Colors.white : context.palette.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

/// The label for the card's action button, or null when the announcement has
/// nowhere this build can send the student. A destination without a label
/// still gets a button — the admin panel leaves the text blank more often than
/// the link.
String? announcementActionLabel(AnnouncementPopup announcement) {
  if (resolveNotificationDestination(announcement.redirectUrl) == null) {
    return null;
  }
  final label = (announcement.buttonText ?? '').trim();
  return label.isEmpty ? 'Open' : label;
}

/// The admin panel's colour when it sent a usable `#rrggbb`, amber otherwise.
Color announcementAccentColor(String? hex) {
  final clean = (hex ?? '').trim().replaceFirst('#', '');
  if (clean.length != 6) return AppColors.amber;
  final value = int.tryParse(clean, radix: 16);
  return value == null ? AppColors.amber : Color(0xFF000000 | value);
}
