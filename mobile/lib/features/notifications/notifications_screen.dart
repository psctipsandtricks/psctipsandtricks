import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/state_views.dart';
import '../../core/router/notification_destination.dart';
import '../../data/models/notification.dart';
import 'read_notifications.dart';

final notificationsProvider =
    FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  ref.keepAlive();
  return ref.watch(notificationsRepositoryProvider).fetchNotifications();
});

/// How many notifications the student has not opened yet.
///
/// Counted from the same merged read state the list paints from, so the badge
/// and the list can never disagree. Unread notices are never hidden by the
/// retention rule, so every one of these is reachable on the list — the badge
/// cannot send anyone looking for something that is not there.
final unreadNotificationCountProvider = Provider.autoDispose<int>((ref) {
  final notifications =
      ref.watch(notificationsProvider).valueOrNull ?? const <AppNotification>[];
  return countUnread(notifications, ref.watch(readNotificationsProvider));
});

/// Unread means neither the server nor this device has it marked read — the
/// same test the list uses to decide what to highlight.
int countUnread(
  List<AppNotification> all,
  Set<String> locallyRead,
) =>
    all.where((n) => !n.isRead && !locallyRead.contains(n.id)).length;

/// How long a notification the student has already read stays on the list.
const notificationReadRetention = Duration(days: 7);

/// The notifications to show, newest first.
///
/// Read notices older than a week are hidden — they have been dealt with and
/// the list is not an archive. Unread ones are never hidden however old they
/// are: hiding something the student has not seen would lose it silently. None
/// of this deletes anything; the rows stay on the server either way.
List<AppNotification> visibleNotifications(
  List<AppNotification> all, {
  required Set<String> locallyRead,
  required DateTime now,
}) {
  final cutoff = now.subtract(notificationReadRetention);

  final visible = all.where((n) {
    final isRead = n.isRead || locallyRead.contains(n.id);
    if (!isRead) return true;
    final created = n.createdAt;
    // An undated notification cannot be judged old, so it is kept.
    if (created == null) return true;
    return created.isAfter(cutoff);
  }).toList();

  visible.sort(
    (a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)),
  );
  return visible;
}

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(notificationsProvider.future),
        child: AsyncView(
          value: notificationsAsync,
          onRetry: () => ref.invalidate(notificationsProvider),
          data: (notifications) {
            if (notifications.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 60),
                  EmptyView(
                    icon: Icons.notifications_none_rounded,
                    title: 'No notifications',
                    message:
                        'Announcements about new books, quizzes and mock tests will show up here.',
                  ),
                ],
              );
            }

            final locallyRead = ref.watch(readNotificationsProvider);
            final visible = visibleNotifications(
              notifications,
              locallyRead: locallyRead,
              now: DateTime.now(),
            );

            if (visible.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 60),
                  EmptyView(
                    icon: Icons.notifications_none_rounded,
                    title: 'Nothing new',
                    message:
                        'Notices you have already read are tidied away after a '
                        'week. Anything unread stays here until you open it.',
                  ),
                ],
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
              itemCount: visible.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) => _NotificationCard(
                notification: visible[index],
                unread: !visible[index].isRead &&
                    !locallyRead.contains(visible[index].id),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _NotificationCard extends ConsumerWidget {
  const _NotificationCard({required this.notification, required this.unread});

  final AppNotification notification;

  /// Merged server and on-device read state — see [ReadNotificationsController].
  final bool unread;

  /// Colour and icon by notification kind, so a rank update and a new-book
  /// notice are distinguishable at a glance.
  (Color, IconData) get _look {
    switch ((notification.type ?? '').toUpperCase()) {
      case 'QUIZ':
      case 'MOCK_TEST':
        return (AppColors.amber, Icons.emoji_events_rounded);
      case 'BOOK':
        return (AppColors.cyan, Icons.menu_book_rounded);
      case 'ORDER':
        return (AppColors.emerald, Icons.receipt_long_rounded);
      case 'CHAT':
        return (AppColors.indigo, Icons.forum_rounded);
      default:
        return (AppColors.sky, Icons.campaign_rounded);
    }
  }

  /// Opening a notification marks it read and takes the student wherever it
  /// points. A notice with no destination is still openable — that tap is how
  /// it gets marked read.
  void _handleTap(BuildContext context, WidgetRef ref) {
    ref.read(readNotificationsProvider.notifier).markRead(notification.id);

    final destination = resolveNotificationDestination(notification.route);
    if (destination == null || destination.isExternal) {
      // Already on the list, so an external link is the only thing left to do.
      if (destination?.externalUrl != null) {
        launchUrl(destination!.externalUrl!, mode: LaunchMode.externalApplication);
      }
      return;
    }

    try {
      ref.read(routerProvider).push(destination.location!);
    } catch (e) {
      if (kDebugMode) debugPrint('Could not open ${destination.location}: $e');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final look = _look;
    final hasRoute = (notification.route ?? '').trim().isNotEmpty;
    final hasImage = (notification.imageUrl ?? '').trim().isNotEmpty;

    return GlassCard(
      borderColor: unread ? AppColors.cyan.withValues(alpha: 0.35) : null,
      padding: const EdgeInsets.all(14),
      onTap: () => _handleTap(context, ref),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: look.$1.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            ),
            child: Icon(look.$2, size: 17, color: look.$1),
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
                        notification.title,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight:
                                  unread ? FontWeight.w800 : FontWeight.w600,
                              height: 1.3,
                            ),
                      ),
                    ),
                    if (unread)
                      Container(
                        width: 7,
                        height: 7,
                        margin: const EdgeInsets.only(left: 8, top: 4),
                        decoration: const BoxDecoration(
                          color: AppColors.cyan,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                if (notification.body.trim().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    notification.body,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                          height: 1.5,
                        ),
                  ),
                ],
                if (hasImage) ...[
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    child: AspectRatio(
                      aspectRatio: 16 / 9,
                      child: CachedNetworkImage(
                        imageUrl: notification.imageUrl!,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(
                          color: palette.card,
                          child: const Center(
                            child: SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          ),
                        ),
                        errorWidget: (_, __, ___) => const SizedBox.shrink(),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 7),
                Row(
                  children: [
                    Text(
                      Fmt.relative(notification.createdAt),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                          ),
                    ),
                    if (hasRoute) ...[
                      const Spacer(),
                      Row(
                        children: [
                          Text(
                            'Open',
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(
                                  color: AppColors.cyan,
                                  fontWeight: FontWeight.bold,
                                ),
                          ),
                          const SizedBox(width: 2),
                          const Icon(
                            Icons.arrow_forward_ios_rounded,
                            size: 10,
                            color: AppColors.cyan,
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
