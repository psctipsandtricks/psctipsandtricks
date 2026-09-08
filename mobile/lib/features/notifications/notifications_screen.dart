import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/state_views.dart';
import '../../core/router/notification_destination.dart';
import '../../data/models/notification.dart';
import 'read_notifications.dart';
import '../shell/shell_scaffold.dart';

final notificationsProvider =
    FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  ref.keepAlive();
  return ref.watch(notificationsRepositoryProvider).fetchNotifications();
});

/// How many notifications the student has not opened yet.
final unreadNotificationCountProvider = Provider.autoDispose<int>((ref) {
  final notifications =
      ref.watch(notificationsProvider).valueOrNull ?? const <AppNotification>[];
  return countUnread(notifications, ref.watch(readNotificationsProvider));
});

/// Unread means neither the server nor this device has it marked read.
int countUnread(
  List<AppNotification> all,
  Set<String> locallyRead,
) =>
    all.where((n) => !n.isRead && !locallyRead.contains(n.id)).length;

/// How long a notification the student has already read stays on the list.
const notificationReadRetention = Duration(days: 7);

/// The notifications to show, newest first.
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
    if (created == null) return true;
    return created.isAfter(cutoff);
  }).toList();

  visible.sort(
    (a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)),
  );
  return visible;
}

enum NotificationCategory { all, unread, quizzes, books, announcements }

NotificationCategory _categorize(AppNotification n) {
  final type = (n.type ?? '').toUpperCase();
  if (type.contains('QUIZ') || type.contains('MOCK')) {
    return NotificationCategory.quizzes;
  }
  if (type.contains('BOOK') || type.contains('PDF') || type.contains('CHAPTER')) {
    return NotificationCategory.books;
  }
  return NotificationCategory.announcements;
}

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  NotificationCategory _selectedCategory = NotificationCategory.all;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.invalidate(notificationsProvider);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final notificationsAsync = ref.watch(notificationsProvider);
    final locallyRead = ref.watch(readNotificationsProvider);
    final unreadCount = ref.watch(unreadNotificationCountProvider);
    final palette = context.palette;

    return Scaffold(
      appBar: GlassAppBar(
        title: const Text('Notifications'),
        actions: [
          if (unreadCount > 0)
            notificationsAsync.maybeWhen(
              data: (notifications) {
                final unreadIds = notifications
                    .where((n) => !n.isRead && !locallyRead.contains(n.id))
                    .map((n) => n.id)
                    .toList();
                if (unreadIds.isEmpty) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: TextButton.icon(
                    onPressed: () {
                      ref.read(readNotificationsProvider.notifier).markAllRead(unreadIds);
                    },
                    icon: const Icon(Icons.done_all_rounded, size: 16),
                    label: const Text('Mark all read'),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.cyan,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      textStyle: Theme.of(context).textTheme.labelSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.2,
                          ),
                    ),
                  ),
                );
              },
              orElse: () => const SizedBox.shrink(),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(notificationsProvider.future),
        child: AsyncView(
          value: notificationsAsync,
          onRetry: () => ref.invalidate(notificationsProvider),
          data: (notifications) {
            // Keep local offline storage in step with server receipts
            final serverReadIds =
                notifications.where((n) => n.isRead).map((n) => n.id);
            if (serverReadIds.isNotEmpty) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) {
                  ref
                      .read(readNotificationsProvider.notifier)
                      .mergeServerReads(serverReadIds);
                }
              });
            }

            if (notifications.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 80),
                  EmptyView(
                    icon: Icons.notifications_none_rounded,
                    title: 'No notifications',
                    message:
                        'Announcements about new books, quizzes and mock tests will show up here.',
                  ),
                ],
              );
            }

            final visible = visibleNotifications(
              notifications,
              locallyRead: locallyRead,
              now: DateTime.now(),
            );

            // Filter by selected category
            final filtered = visible.where((n) {
              final isUnread = !n.isRead && !locallyRead.contains(n.id);
              switch (_selectedCategory) {
                case NotificationCategory.all:
                  return true;
                case NotificationCategory.unread:
                  return isUnread;
                case NotificationCategory.quizzes:
                  return _categorize(n) == NotificationCategory.quizzes;
                case NotificationCategory.books:
                  return _categorize(n) == NotificationCategory.books;
                case NotificationCategory.announcements:
                  return _categorize(n) == NotificationCategory.announcements;
              }
            }).toList();

            final counts = {
              NotificationCategory.all: visible.length,
              NotificationCategory.unread: unreadCount,
              NotificationCategory.quizzes: visible
                  .where((n) => _categorize(n) == NotificationCategory.quizzes)
                  .length,
              NotificationCategory.books: visible
                  .where((n) => _categorize(n) == NotificationCategory.books)
                  .length,
              NotificationCategory.announcements: visible
                  .where((n) =>
                      _categorize(n) == NotificationCategory.announcements)
                  .length,
            };

            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                // Category Filter Pills Strip
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _FilterChip(
                            label: 'All',
                            count: counts[NotificationCategory.all] ?? 0,
                            selected: _selectedCategory == NotificationCategory.all,
                            onTap: () => setState(() =>
                                _selectedCategory = NotificationCategory.all),
                          ),
                          const SizedBox(width: 8),
                          _FilterChip(
                            label: 'Unread',
                            count: counts[NotificationCategory.unread] ?? 0,
                            selected: _selectedCategory == NotificationCategory.unread,
                            highlightBadge: unreadCount > 0,
                            onTap: () => setState(() =>
                                _selectedCategory = NotificationCategory.unread),
                          ),
                          const SizedBox(width: 8),
                          _FilterChip(
                            label: 'Quizzes',
                            count: counts[NotificationCategory.quizzes] ?? 0,
                            selected: _selectedCategory == NotificationCategory.quizzes,
                            onTap: () => setState(() =>
                                _selectedCategory = NotificationCategory.quizzes),
                          ),
                          const SizedBox(width: 8),
                          _FilterChip(
                            label: 'E-Books',
                            count: counts[NotificationCategory.books] ?? 0,
                            selected: _selectedCategory == NotificationCategory.books,
                            onTap: () => setState(() =>
                                _selectedCategory = NotificationCategory.books),
                          ),
                          const SizedBox(width: 8),
                          _FilterChip(
                            label: 'Notices',
                            count: counts[NotificationCategory.announcements] ?? 0,
                            selected: _selectedCategory == NotificationCategory.announcements,
                            onTap: () => setState(() =>
                                _selectedCategory =
                                    NotificationCategory.announcements),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                // Content List or Filter Empty State
                if (filtered.isEmpty)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                color: AppColors.cyan.withValues(alpha: 0.1),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: AppColors.cyan.withValues(alpha: 0.25),
                                ),
                              ),
                              child: const Icon(
                                Icons.inbox_rounded,
                                size: 30,
                                color: AppColors.cyan,
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              _selectedCategory == NotificationCategory.unread
                                  ? "You're all caught up!"
                                  : 'No notifications in this category',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _selectedCategory == NotificationCategory.unread
                                  ? 'All your notifications have been marked as read.'
                                  : 'Check back later for updates and announcements.',
                              textAlign: TextAlign.center,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: palette.textSecondary),
                            ),
                            if (_selectedCategory != NotificationCategory.all) ...[
                              const SizedBox(height: 16),
                              OutlinedButton(
                                onPressed: () => setState(() =>
                                    _selectedCategory = NotificationCategory.all),
                                child: const Text('Show All Notifications'),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(
                        16, 0, 16, 24 + ShellScaffold.dockExtent),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final item = filtered[index];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _NotificationCard(
                              notification: item,
                              unread: !item.isRead &&
                                  !locallyRead.contains(item.id),
                            ),
                          );
                        },
                        childCount: filtered.length,
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
    this.highlightBadge = false,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;
  final bool highlightBadge;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected
              ? (palette.isDark ? AppColors.cyan : AppColors.cyan)
              : palette.card,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(
            color: selected
                ? AppColors.cyan
                : palette.border.withValues(alpha: 0.8),
            width: selected ? 1.4 : 1.0,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: AppColors.cyan.withValues(alpha: 0.25),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
                    color: selected
                        ? (palette.isDark ? AppColors.darkBg : Colors.white)
                        : palette.textPrimary,
                    fontSize: 12,
                  ),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
              decoration: BoxDecoration(
                color: selected
                    ? (palette.isDark
                        ? AppColors.darkBg.withValues(alpha: 0.25)
                        : Colors.white.withValues(alpha: 0.28))
                    : (highlightBadge
                        ? AppColors.rose.withValues(alpha: 0.15)
                        : palette.elevated),
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              ),
              child: Text(
                '$count',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      fontSize: 10.5,
                      fontFamily: 'monospace',
                      color: selected
                          ? (palette.isDark ? AppColors.darkBg : Colors.white)
                          : (highlightBadge
                              ? AppColors.rose
                              : palette.textMuted),
                    ),
              ),
            ),
          ],
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

  (Color, IconData, String) get _categoryMeta {
    switch ((notification.type ?? '').toUpperCase()) {
      case 'QUIZ':
      case 'MOCK_TEST':
        return (AppColors.amber, Icons.emoji_events_rounded, 'QUIZ & MOCK TEST');
      case 'BOOK':
      case 'PDF':
      case 'CHAPTER':
        return (AppColors.cyan, Icons.menu_book_rounded, 'STUDY MATERIAL');
      case 'ORDER':
        return (AppColors.emerald, Icons.receipt_long_rounded, 'ORDER');
      case 'CHAT':
        return (AppColors.indigo, Icons.forum_rounded, 'COMMUNITY');
      default:
        return (AppColors.sky, Icons.campaign_rounded, 'ANNOUNCEMENT');
    }
  }

  void _handleTap(BuildContext context, WidgetRef ref) {
    if (unread) {
      ref.read(readNotificationsProvider.notifier).markRead(notification.id);
    }

    final destination = resolveNotificationDestination(notification.route);
    if (destination == null || destination.isExternal) {
      if (destination?.externalUrl != null) {
        launchUrl(destination!.externalUrl!, mode: LaunchMode.externalApplication);
      }
      return;
    }

    try {
      context.push(destination.location!);
    } catch (e) {
      if (kDebugMode) debugPrint('Could not push ${destination.location}: $e');
      try {
        ref.read(routerProvider).push(destination.location!);
      } catch (_) {
        try {
          ref.read(routerProvider).go(destination.location!);
        } catch (_) {}
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final meta = _categoryMeta;
    final hasRoute = (notification.route ?? '').trim().isNotEmpty;
    final hasImage = (notification.imageUrl ?? '').trim().isNotEmpty;

    return GlassCard(
      borderColor: unread ? AppColors.cyan.withValues(alpha: 0.45) : null,
      padding: EdgeInsets.zero,
      onTap: () => _handleTap(context, ref),
      child: Stack(
        children: [
          // Left Unread Accent Indicator Bar
          if (unread)
            Positioned(
              top: 0,
              bottom: 0,
              left: 0,
              width: 4,
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [AppColors.cyan, AppColors.blue],
                  ),
                  borderRadius: BorderRadius.horizontal(
                    left: Radius.circular(AppTheme.radiusLg),
                  ),
                ),
              ),
            ),

          Padding(
            padding: const EdgeInsets.all(15),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Header Row: Category Badge + Relative Timestamp + Unread NEW Pill
                Row(
                  children: [
                    // Category Pill
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                      decoration: BoxDecoration(
                        color: meta.$1.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                        border: Border.all(
                          color: meta.$1.withValues(alpha: 0.28),
                          width: 0.8,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(meta.$2, size: 13, color: meta.$1),
                          const SizedBox(width: 4.5),
                          Text(
                            meta.$3,
                            style: TextStyle(
                              color: meta.$1,
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    // Timestamp with subtle clock icon
                    Icon(
                      Icons.schedule_rounded,
                      size: 12,
                      color: palette.textMuted,
                    ),
                    const SizedBox(width: 3.5),
                    Text(
                      Fmt.relative(notification.createdAt),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    if (unread) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppColors.cyan, AppColors.blue],
                          ),
                          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.cyan.withValues(alpha: 0.35),
                              blurRadius: 6,
                              offset: const Offset(0, 1.5),
                            ),
                          ],
                        ),
                        child: const Text(
                          'NEW',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),

                const SizedBox(height: 10),

                // Title
                Text(
                  notification.title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: unread ? FontWeight.w900 : FontWeight.w700,
                        fontSize: 15,
                        letterSpacing: -0.2,
                        height: 1.3,
                        color: unread
                            ? palette.textPrimary
                            : palette.textPrimary.withValues(alpha: 0.9),
                      ),
                ),

                // Body Description
                if (notification.body.trim().isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    notification.body,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                          height: 1.45,
                          fontSize: 12.5,
                        ),
                  ),
                ],

                // Rich Image Banner
                if (hasImage) ...[
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    child: Container(
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: palette.border.withValues(alpha: 0.7),
                          width: 0.8,
                        ),
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      ),
                      child: AspectRatio(
                        aspectRatio: 16 / 9,
                        child: CachedNetworkImage(
                          imageUrl: notification.imageUrl!,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(
                            color: palette.card,
                            child: const Center(
                              child: SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.2,
                                  color: AppColors.cyan,
                                ),
                              ),
                            ),
                          ),
                          errorWidget: (_, __, ___) => const SizedBox.shrink(),
                        ),
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 12),

                // Footer Action Bar with Separator
                Container(
                  padding: const EdgeInsets.only(top: 10),
                  decoration: BoxDecoration(
                    border: Border(
                      top: BorderSide(
                        color: palette.border.withValues(alpha: 0.5),
                        width: 0.8,
                      ),
                    ),
                  ),
                  child: Row(
                    children: [
                      if (unread)
                        InkWell(
                          onTap: () {
                            ref
                                .read(readNotificationsProvider.notifier)
                                .markRead(notification.id);
                          },
                          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 9, vertical: 5),
                            decoration: BoxDecoration(
                              color: AppColors.cyan.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                              border: Border.all(
                                color: AppColors.cyan.withValues(alpha: 0.3),
                                width: 0.8,
                              ),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.check_circle_rounded,
                                  size: 13,
                                  color: AppColors.cyan,
                                ),
                                SizedBox(width: 5),
                                Text(
                                  'Mark as read',
                                  style: TextStyle(
                                    color: AppColors.cyan,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 11,
                                    letterSpacing: -0.1,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      else
                        Row(
                          children: [
                            Icon(
                              Icons.done_all_rounded,
                              size: 13,
                              color: palette.textMuted.withValues(alpha: 0.7),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Read',
                              style: TextStyle(
                                color: palette.textMuted,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),

                      const Spacer(),

                      if (hasRoute)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: palette.isDark
                                ? AppColors.cyan.withValues(alpha: 0.15)
                                : AppColors.cyan.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'View Details',
                                style: TextStyle(
                                  color: AppColors.cyan,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 11.5,
                                ),
                              ),
                              SizedBox(width: 4),
                              Icon(
                                Icons.arrow_forward_rounded,
                                size: 12,
                                color: AppColors.cyan,
                              ),
                            ],
                          ),
                        ),
                    ],
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
