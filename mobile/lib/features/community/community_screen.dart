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
import '../../data/models/chat.dart';
import 'community_providers.dart';
import '../shell/shell_scaffold.dart';

/// Study groups the student can join, pinned ones first.
class CommunityScreen extends ConsumerWidget {
  const CommunityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupsAsync = ref.watch(chatGroupsProvider);

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

class _GroupTile extends StatelessWidget {
  const _GroupTile({required this.group});

  final ChatGroup group;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final last = group.lastMessage;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: GlassCard(
        onTap: () => context.push(AppRoutes.groupChat(group.id)),
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
