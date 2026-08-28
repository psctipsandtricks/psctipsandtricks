import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../data/models/notification.dart';
import '../home_providers.dart';

/// The announcement queue, shown one card at a time at the top of the home
/// screen.
///
/// Only the head of the queue is on screen: a stack of notices pushes the rest
/// of the page away, and students read the top one anyway. Closing a card, or
/// opening it, marks it seen and slides the next one in — so the queue drains
/// in order instead of repeating itself. Seen ids are remembered across
/// launches by [SeenAnnouncementsController].
class AnnouncementsSection extends ConsumerWidget {
  const AnnouncementsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref.watch(pendingAnnouncementsProvider);
    final current = pending.isEmpty ? null : pending.first;

    return AnimatedSize(
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOutCubic,
      alignment: Alignment.topCenter,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 240),
        // Keyed by id so advancing the queue cross-fades between two cards
        // rather than mutating one in place.
        child: current == null
            ? const SizedBox(width: double.infinity)
            : Padding(
                key: ValueKey(current.id),
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 2),
                child: _AnnouncementCard(
                  announcement: current,
                  remaining: pending.length - 1,
                  onSeen: () => ref
                      .read(seenAnnouncementsProvider.notifier)
                      .markSeen(current.id),
                ),
              ),
      ),
    );
  }
}

class _AnnouncementCard extends StatelessWidget {
  const _AnnouncementCard({
    required this.announcement,
    required this.remaining,
    required this.onSeen,
  });

  final AnnouncementPopup announcement;

  /// How many announcements are still queued behind this one.
  final int remaining;

  final VoidCallback onSeen;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final accent = _accentColor(announcement.backgroundColor);
    final hasImage = (announcement.imageUrl ?? '').isNotEmpty;
    final action = _actionLabel(announcement);

    return GlassCard(
      onTap: () => _open(context),
      borderColor: accent.withValues(alpha: 0.32),
      padding: const EdgeInsets.fromLTRB(12, 10, 6, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // A thumbnail rather than a banner: a full-width image on the first
          // card would push the whole home screen down a phone's worth.
          if (hasImage)
            AppImage(
              url: announcement.imageUrl,
              width: 58,
              height: 58,
              radius: AppTheme.radiusSm,
              fallbackIcon: Icons.campaign_rounded,
            )
          else
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.13),
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              ),
              child: Icon(Icons.campaign_rounded, size: 17, color: accent),
            ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'ANNOUNCEMENT',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: accent,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.7,
                              fontSize: 9.5,
                            ),
                      ),
                    ),
                    if (remaining > 0)
                      Padding(
                        padding: const EdgeInsets.only(left: 6),
                        child: Text(
                          '+$remaining more',
                          style: Theme.of(context)
                              .textTheme
                              .labelSmall
                              ?.copyWith(color: palette.textMuted, fontSize: 10),
                        ),
                      ),
                    // Dismiss sits inside the text column so it stays clear of
                    // the thumbnail and keeps a full 40dp tap target.
                    _CloseButton(onPressed: onSeen),
                  ],
                ),
                Text(
                  announcement.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        height: 1.3,
                      ),
                ),
                if (announcement.message.trim().isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    announcement.message,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                          height: 1.45,
                        ),
                  ),
                ],
                const SizedBox(height: 9),
                Wrap(
                  spacing: 10,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (action != null)
                      FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: accent,
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 7),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusSm),
                          ),
                        ),
                        onPressed: () {
                          // The router is captured first: marking the card seen
                          // swaps this widget out for the next announcement.
                          final router = GoRouter.maybeOf(context);
                          onSeen();
                          _handleRedirect(router);
                        },
                        icon: const Icon(Icons.arrow_forward_rounded, size: 14),
                        label: Text(
                          action,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    if (announcement.endDate != null)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.schedule_rounded,
                              size: 12, color: palette.textMuted),
                          const SizedBox(width: 4),
                          Text(
                            'Until ${Fmt.date(announcement.endDate)}',
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(color: palette.textMuted),
                          ),
                        ],
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

  /// Opens the full notice and advances the queue: an announcement the student
  /// has read should not be waiting for them again on the way back.
  void _open(BuildContext context) {
    final router = GoRouter.maybeOf(context);
    onSeen();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.62,
        maxChildSize: 0.92,
        builder: (sheetContext, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                margin: const EdgeInsets.only(bottom: 18),
                decoration: BoxDecoration(
                  color: sheetContext.palette.border,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            if ((announcement.imageUrl ?? '').isNotEmpty) ...[
              AppImage(
                url: announcement.imageUrl,
                height: 168,
                radius: AppTheme.radiusLg,
                fallbackIcon: Icons.campaign_rounded,
              ),
              const SizedBox(height: 18),
            ],
            AppBadge('ANNOUNCEMENT',
                color: _accentColor(announcement.backgroundColor),
                icon: Icons.campaign_rounded),
            const SizedBox(height: 12),
            Text(
              announcement.title,
              style: Theme.of(sheetContext).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                    height: 1.25,
                  ),
            ),
            const SizedBox(height: 12),
            SelectableText(
              announcement.message,
              style: Theme.of(sheetContext).textTheme.bodyMedium?.copyWith(
                    color: sheetContext.palette.textSecondary,
                    height: 1.65,
                  ),
            ),
            if (_actionLabel(announcement) != null) ...[
              const SizedBox(height: 20),
              GradientButton(
                label: _actionLabel(announcement)!,
                icon: Icons.arrow_forward_rounded,
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  _handleRedirect(router);
                },
              ),
            ],
            if (announcement.endDate != null) ...[
              const SizedBox(height: 20),
              Text(
                'Valid until ${Fmt.date(announcement.endDate)}',
                style: Theme.of(sheetContext).textTheme.labelSmall?.copyWith(
                      color: sheetContext.palette.textMuted,
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Sends the student wherever the admin panel pointed the card: an in-app
  /// route is pushed, anything web-shaped opens in the browser.
  void _handleRedirect(GoRouter? router) {
    final url = announcement.redirectUrl?.trim() ?? '';
    if (url.isEmpty) return;

    if (url.startsWith('http://') || url.startsWith('https://')) {
      launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } else {
      // A relative destination is an in-app route; the admin panel writes them
      // with and without the leading slash.
      router?.push(url.startsWith('/') ? url : '/$url');
    }
  }
}

/// The label for the card's action button, or null when the announcement has
/// nowhere to send the student. A destination without a label still gets a
/// button — the admin panel leaves the text blank more often than the link.
String? _actionLabel(AnnouncementPopup announcement) {
  if ((announcement.redirectUrl ?? '').trim().isEmpty) return null;
  final label = (announcement.buttonText ?? '').trim();
  return label.isEmpty ? 'Open' : label;
}

/// The admin panel's colour when it sent a usable `#rrggbb`, amber otherwise.
Color _accentColor(String? hex) {
  final clean = (hex ?? '').trim().replaceFirst('#', '');
  if (clean.length != 6) return AppColors.amber;
  final value = int.tryParse(clean, radix: 16);
  return value == null ? AppColors.amber : Color(0xFF000000 | value);
}

class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Dismiss',
      child: InkWell(
        onTap: onPressed,
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.all(7),
          child: Icon(Icons.close_rounded,
              size: 17, color: context.palette.textMuted),
        ),
      ),
    );
  }
}
