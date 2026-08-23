import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/notification.dart';

final notificationsProvider =
    FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  ref.keepAlive();
  return ref.watch(notificationsRepositoryProvider).fetchNotifications();
});

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

            final sorted = [...notifications]..sort(
                (a, b) => (b.createdAt ?? DateTime(0))
                    .compareTo(a.createdAt ?? DateTime(0)),
              );

            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
              itemCount: sorted.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) =>
                  _NotificationCard(notification: sorted[index]),
            );
          },
        ),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.notification});

  final AppNotification notification;

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

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final look = _look;

    return GlassCard(
      borderColor: notification.isRead
          ? null
          : AppColors.cyan.withValues(alpha: 0.35),
      padding: const EdgeInsets.all(14),
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
                              fontWeight: notification.isRead
                                  ? FontWeight.w600
                                  : FontWeight.w800,
                              height: 1.3,
                            ),
                      ),
                    ),
                    if (!notification.isRead)
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
                const SizedBox(height: 7),
                Text(
                  Fmt.relative(notification.createdAt),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
