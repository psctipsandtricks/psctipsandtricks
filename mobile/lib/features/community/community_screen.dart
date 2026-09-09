import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../../core/network/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../data/models/chat.dart';
import 'community_providers.dart';
import '../shell/shell_scaffold.dart';

/// Study groups the student can join, pinned ones first.
class CommunityScreen extends ConsumerWidget {
  const CommunityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final live = ref.watch(chatGroupsProvider);

    // Stand in with the last known list until the live one has a value, so
    // returning to Community paints the student's groups immediately instead of
    // a skeleton. This also covers a failed fetch: offline, the groups they had
    // a moment ago are far more use than an error page, and pull-to-refresh is
    // still there to retry.
    final cached = ref.watch(cachedChatGroupsProvider).valueOrNull;
    final groupsAsync = !live.hasValue && cached != null && cached.isNotEmpty
        ? AsyncValue<List<ChatGroup>>.data(cached)
        : live;

    return Scaffold(
      appBar: const GlassAppBar(title: Text('Community')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(chatGroupsProvider.future),
        child: AsyncView(
          value: groupsAsync,
          onRetry: () => ref.invalidate(chatGroupsProvider),
          data: (groups) {
            if (groups.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 60),
                  EmptyView(
                    icon: Icons.forum_rounded,
                    title: 'No study groups yet',
                    message:
                        'Discussion groups for each exam will appear here once they open.',
                  ),
                ],
              );
            }

            final pinned = groups.where((g) => g.isPinned).toList();
            final joined =
                groups.where((g) => g.isJoined && !g.isPinned).toList();
            final discover = groups.where((g) => !g.isJoined).toList();

            return ListView(
              padding: const EdgeInsets.only(
                  bottom: 28 + ShellScaffold.dockExtent),
              children: [
                const SizedBox(height: 10),
                if (pinned.isNotEmpty) ...[
                  const SectionHeader(
                    title: 'Pinned',
                    icon: Icons.push_pin_rounded,
                  ),
                  for (final group in pinned) _GroupTile(group: group),
                  const SizedBox(height: 14),
                ],
                if (joined.isNotEmpty) ...[
                  const SectionHeader(
                    title: 'Your groups',
                    icon: Icons.groups_rounded,
                  ),
                  for (final group in joined) _GroupTile(group: group),
                  const SizedBox(height: 14),
                ],
                if (discover.isNotEmpty) ...[
                  const SectionHeader(
                    title: 'Discover',
                    subtitle: 'Join a group to take part',
                    icon: Icons.explore_rounded,
                  ),
                  for (final group in discover) _GroupTile(group: group),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

/// The long-press menu on a group row: mute, pin and leave.
///
/// A sheet rather than a popup because these are decisions about a group, not
/// commands on a list item — and because Leave needs room to be confirmed.
Future<void> _showGroupOptions(
  BuildContext context, WidgetRef ref, ChatGroup group) async {
  if (!group.isJoined) {
    // Nothing here applies to a group they have not joined; the row's own tap
    // takes them in to read it and join.
    return;
  }

  final action = await showModalBottomSheet<String>(
    context: context,
    backgroundColor: context.palette.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
    ),
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 8),
          Container(
            width: 38,
            height: 4,
            decoration: BoxDecoration(
              color: sheetContext.palette.textMuted.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              group.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(sheetContext)
                  .textTheme
                  .titleSmall
                  ?.copyWith(fontWeight: FontWeight.w900),
            ),
          ),
          const SizedBox(height: 10),
          ListTile(
            leading: Icon(
              group.isMuted
                  ? Icons.notifications_active_rounded
                  : Icons.notifications_off_rounded,
              size: 20,
            ),
            title: Text(
              group.isMuted ? 'Unmute Notifications' : 'Mute Notifications',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
            ),
            subtitle: Text(
              group.isMuted
                  ? 'Start getting alerts from this group again'
                  : 'Stop alerts from this group everywhere, including the website',
              style: const TextStyle(fontSize: 11),
            ),
            onTap: () => Navigator.of(sheetContext).pop('mute'),
          ),
          ListTile(
            leading: Icon(
              group.isPinned ? Icons.push_pin_outlined : Icons.push_pin_rounded,
              size: 20,
            ),
            title: Text(
              group.isPinned ? 'Unpin Group' : 'Pin Group',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
            ),
            subtitle: const Text(
              'Pinned groups sit at the top of your list',
              style: TextStyle(fontSize: 11),
            ),
            onTap: () => Navigator.of(sheetContext).pop('pin'),
          ),
          ListTile(
            leading: const Icon(Icons.logout_rounded,
                size: 20, color: AppColors.rose),
            title: const Text(
              'Leave Group',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 14,
                color: AppColors.rose,
              ),
            ),
            subtitle: const Text(
              'You will stop receiving its messages',
              style: TextStyle(fontSize: 11),
            ),
            onTap: () => Navigator.of(sheetContext).pop('leave'),
          ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );

  if (action == null || !context.mounted) return;
  final repo = ref.read(chatRepositoryProvider);
  final messenger = ScaffoldMessenger.of(context);

  try {
    switch (action) {
      case 'mute':
        await repo.setMuted(group.id, !group.isMuted);
        messenger.showSnackBar(SnackBar(
          content: Text(group.isMuted
              ? 'Notifications on for ${group.name}'
              : 'Notifications muted for ${group.name}'),
        ));
      case 'pin':
        await repo.setPinned(group.id, !group.isPinned);
      case 'leave':
        await _confirmAndLeaveGroup(context, ref, group);
        return;
    }
    ref.invalidate(chatGroupsProvider);
  } catch (e) {
    messenger.showSnackBar(
      SnackBar(content: Text(e is ApiException ? e.message : 'Something went wrong')),
    );
  }
}

Future<void> _confirmAndLeaveGroup(
  BuildContext context,
  WidgetRef ref,
  ChatGroup group,
) async {
  final repo = ref.read(chatRepositoryProvider);
  final messenger = ScaffoldMessenger.of(context);
  var isLeaving = false;

  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (dialogContext) {
      return StatefulBuilder(
        builder: (context, setDialogState) {
          final palette = context.palette;

          return AlertDialog(
            backgroundColor: palette.card,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            title: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.rose.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.logout_rounded,
                    color: AppColors.rose,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Leave this group?',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ),
              ],
            ),
            content: Text(
              'You will stop receiving messages from ${group.name}. You can join again later.',
              style: TextStyle(
                color: palette.textSecondary,
                fontSize: 13,
                height: 1.45,
              ),
            ),
            actions: [
              TextButton(
                onPressed: isLeaving
                    ? null
                    : () => Navigator.of(dialogContext).pop(),
                child: Text(
                  'Cancel',
                  style: TextStyle(
                    color: isLeaving ? palette.textMuted : palette.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              TextButton(
                onPressed: isLeaving
                    ? null
                    : () async {
                        setDialogState(() => isLeaving = true);
                        try {
                          // Automatically unpin the group if it was pinned
                          if (group.isPinned) {
                            await repo.setPinned(group.id, false);
                          }
                          await repo.leave(group.id);
                          ref.invalidate(chatGroupsProvider);
                          await ref.read(chatGroupsProvider.future);

                          if (context.mounted) {
                            Navigator.of(dialogContext).pop();
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text('Left ${group.name}'),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            setDialogState(() => isLeaving = false);
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text(e is ApiException
                                    ? e.message
                                    : 'Failed to leave group'),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        }
                      },
                child: isLeaving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.rose,
                        ),
                      )
                    : const Text(
                        'Leave',
                        style: TextStyle(
                          color: AppColors.rose,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
              ),
            ],
          );
        },
      );
    },
  );
}

class _GroupTile extends ConsumerWidget {
  const _GroupTile({required this.group});

  final ChatGroup group;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final last = group.lastMessage;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: GlassCard(
        onTap: () => context.push(AppRoutes.groupChat(group.id)),
        // Long press does the same as the button below. Kept as a shortcut for
        // anyone who reaches for it, but it is not the only way in — a menu you
        // can only find by holding down a row is a menu most people never find.
        onLongPress: group.isJoined
            ? () => _showGroupOptions(context, ref, group)
            : null,
        padding: const EdgeInsets.all(13),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _GroupAvatar(group: group),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          group.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      if (group.isLocked) ...[
                        const SizedBox(width: 6),
                        Icon(Icons.lock_rounded,
                            size: 12, color: palette.textMuted),
                      ],
                      // Muting is otherwise invisible once done — the group
                      // simply stops making noise, which is indistinguishable
                      // from nobody posting.
                      if (group.isMuted) ...[
                        const SizedBox(width: 6),
                        Icon(Icons.notifications_off_rounded,
                            size: 12, color: palette.textMuted),
                      ],
                      const Spacer(),
                      if (last != null)
                        Text(
                          Fmt.messageStamp(last.createdAt),
                          style: Theme.of(context)
                              .textTheme
                              .labelSmall
                              ?.copyWith(color: palette.textMuted, fontSize: 10),
                        ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    last != null
                        ? '${last.userName}: ${_preview(last)}'
                        : group.description,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.person_rounded,
                          size: 12, color: palette.textMuted),
                      const SizedBox(width: 4),
                      Text(
                        Fmt.count(group.memberCount, 'member'),
                        style: Theme.of(context)
                            .textTheme
                            .labelSmall
                            ?.copyWith(color: palette.textMuted),
                      ),
                      const Spacer(),
                      if (group.unreadCount > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            gradient: AppColors.brandGradient,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            group.unreadCount > 99
                                ? '99+'
                                : '${group.unreadCount}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        )
                      else if (!group.isJoined)
                        const AppBadge('JOIN', color: AppColors.emerald),
                    ],
                  ),
                ],
              ),
            ),

            // The way in to mute and leave. Visible rather than hidden behind a
            // long press: these are the two things a student wants to do to a
            // group they have joined, and an invisible gesture is not an
            // option anyone can be expected to discover.
            if (group.isJoined) ...[
              const SizedBox(width: 4),
              _GroupOptionsButton(
                onTap: () => _showGroupOptions(context, ref, group),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _preview(ChatMessage message) => switch (message.type) {
        ChatMessageType.image => '📷 Photo',
        ChatMessageType.document => '📄 Document',
        ChatMessageType.poll => '📊 ${message.pollQuestion}',
        ChatMessageType.text => message.content,
      };
}

/// The three-dot control on a joined group's row.
///
/// Sized to a comfortable tap target while drawing small, so it reads as a
/// quiet affordance rather than a second action competing with opening the
/// group.
class _GroupOptionsButton extends StatelessWidget {
  const _GroupOptionsButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Group options',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          child: Icon(
            Icons.more_vert_rounded,
            size: 18,
            color: context.palette.textMuted,
          ),
        ),
      ),
    );
  }
}

class _GroupAvatar extends StatelessWidget {
  const _GroupAvatar({required this.group});

  final ChatGroup group;

  String _getInitials(String name) {
    final parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '#';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    if ((group.imageUrl ?? '').isNotEmpty) {
      return Stack(
        clipBehavior: Clip.none,
        children: [
          AppImage(
            url: group.imageUrl,
            width: 44,
            height: 44,
            radius: 14,
            fallbackIcon: Icons.groups_rounded,
          ),
          if (group.isJoined)
            Positioned(
              right: -1,
              bottom: -1,
              child: Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
              ),
            ),
        ],
      );
    }

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0x33F59E0B), Color(0x33EA580C)],
            ),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: const Color(0x4DF59E0B),
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            _getInitials(group.name),
            style: const TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 16,
              color: Color(0xFFD97706),
            ),
          ),
        ),
        if (group.isJoined)
          Positioned(
            right: -1,
            bottom: -1,
            child: Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: const Color(0xFF10B981),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
          ),
      ],
    );
  }
}
