import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/chat.dart';
import '../pdfs/pdf_viewer_screen.dart';
import 'chat_cache.dart';
import 'chat_socket.dart';
import 'community_providers.dart';

/// One study group's conversation, live over Socket.IO with REST for history.
/// Matches the web platform's "liquid glass" UI and layout verbatim.
class GroupChatScreen extends ConsumerStatefulWidget {
  const GroupChatScreen({super.key, required this.groupId});

  final String groupId;

  @override
  ConsumerState<GroupChatScreen> createState() => _GroupChatScreenState();
}

class _GroupChatScreenState extends ConsumerState<GroupChatScreen> {
  /// One screenful plus a little, matching the web client and the API's own
  /// default. History is never fetched whole — the student opens on the newest
  /// page and walks backwards from there.
  static const _pageSize = 30;

  final _scrollController = ScrollController();
  final _composer = TextEditingController();

  final List<ChatMessage> _messages = [];
  final _subscriptions = <StreamSubscription<dynamic>>[];

  bool _loading = true;
  bool _loadingMore = false;
  bool _reachedStart = false;
  bool _joining = false;
  Object? _error;

  /// Held rather than read on demand, so the cache is still reachable from
  /// `dispose`, after the widget can no longer touch its `ref`.
  ChatCache? _cache;
  Timer? _persistTimer;

  @override
  void initState() {
    super.initState();
    _cache = ref.read(chatCacheProvider);
    unawaited(_bootstrap());
  }

  @override
  void dispose() {
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
    // Leaving must not throw away messages the debounce was still holding.
    if (_persistTimer?.isActive ?? false) _flushPersist();
    _persistTimer?.cancel();
    _scrollController.dispose();
    _composer.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final cache = _cache;

    // Show the conversation as it was last left, then let the fetch below
    // correct it. Reading a file beats a round trip by enough that the chat is
    // usually already on screen and scrollable before the network answers.
    final cached = await cache?.readMessages(widget.groupId);
    if (!mounted) return;
    if (cached != null && cached.isNotEmpty && _messages.isEmpty) {
      setState(() {
        _messages
          ..clear()
          ..addAll(cached);
        _loading = false;
      });
    }

    try {
      final history = await ref
          .read(chatRepositoryProvider)
          .fetchMessages(widget.groupId, limit: _pageSize);
      if (!mounted) return;

      setState(() {
        _messages
          ..clear()
          ..addAll(_mergeWithCached(history.reversed.toList()));
        _loading = false;
        _error = null;
        // A short page means there is nothing before it — the group's whole
        // history fits in one page, so there is nothing older to offer.
        _reachedStart = history.length < _pageSize;
      });

      _persist();
      _connectSocket();
      unawaited(_markRead());
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        // Only surface the failure if there is nothing to read. With a cached
        // conversation already on screen, replacing it with an error page would
        // take away the one thing that still works offline.
        if (_messages.isEmpty) _error = e;
      });
    }
  }

  /// Keeps any cached history that reaches further back than [fresh] does.
  ///
  /// Without this, a student who had scrolled back through several pages last
  /// visit would watch that history disappear the moment the newest page
  /// arrived, and have to load it all again.
  List<ChatMessage> _mergeWithCached(List<ChatMessage> fresh) {
    if (fresh.isEmpty) return List.of(_messages);

    final oldestFresh = fresh.last.createdAt;
    final freshIds = fresh.map((m) => m.id).toSet();
    final tail = _messages.where(
      (m) => m.createdAt.isBefore(oldestFresh) && !freshIds.contains(m.id),
    );
    return [...fresh, ...tail];
  }

  /// Stores the newest slice of the conversation for the next visit.
  ///
  /// Debounced, because a lively group delivers messages faster than it is
  /// worth rewriting the file — every one of them would otherwise cost a full
  /// re-serialise and a disk write, and only the last one matters.
  void _persist() {
    _persistTimer?.cancel();
    _persistTimer = Timer(const Duration(seconds: 1), _flushPersist);
  }

  /// Writes now, whatever the debounce was still waiting for. The list is
  /// copied because it keeps mutating while the write is in flight.
  void _flushPersist() {
    _persistTimer?.cancel();
    _persistTimer = null;
    final cache = _cache;
    if (cache == null) return;
    unawaited(cache.writeMessages(widget.groupId, List.of(_messages)));
  }

  void _connectSocket() {
    final token = ref.read(tokenStoreProvider).accessToken;
    if (token == null || token.isEmpty) return;

    final socket = ref.read(chatSocketProvider(token));
    socket.connect();
    socket.joinGroup(widget.groupId);

    _subscriptions.add(
      socket.onMessage.listen((message) {
        if (message.groupId != null && message.groupId != widget.groupId) return;
        if (!mounted) return;

        // If message already exists by id, ignore
        if (_messages.any((m) => m.id == message.id)) return;

        // If it matches an optimistic message from the same user with the same content, replace it
        final optimisticIdx = _messages.indexWhere((m) =>
            m.id.startsWith('optimistic-') &&
            m.userId == message.userId &&
            m.content == message.content);
        if (optimisticIdx != -1) {
          setState(() => _messages[optimisticIdx] = message);
          _persist();
          unawaited(_markRead());
          return;
        }

        setState(() => _messages.insert(0, message));
        _persist();
        unawaited(_markRead());
      }),
    );

    _subscriptions.add(
      socket.onDelete.listen((messageId) {
        if (!mounted) return;
        setState(() => _messages.removeWhere((m) => m.id == messageId));
        _persist();
      }),
    );

    _subscriptions.add(
      socket.onMetadataUpdate.listen((update) {
        if (!mounted) return;
        final index =
            _messages.indexWhere((m) => m.id == update.messageId);
        if (index < 0) return;
        final existing = _messages[index];
        setState(() {
          _messages[index] = ChatMessage(
            id: existing.id,
            userId: existing.userId,
            userName: existing.userName,
            userAvatar: existing.userAvatar,
            content: existing.content,
            type: existing.type,
            mediaUrl: existing.mediaUrl,
            metadata: update.metadata,
            groupId: existing.groupId,
            createdAt: existing.createdAt,
          );
        });
        _persist();
      }),
    );
  }

  Future<void> _markRead() async {
    try {
      await ref.read(chatRepositoryProvider).markRead(
            widget.groupId,
            lastReadMessageId: _messages.isEmpty ? null : _messages.first.id,
          );
      ref.invalidate(chatGroupsProvider);
    } catch (_) {
      // Ignore read receipt error
    }
  }

  /// Fetches the page before the oldest message on screen, on demand.
  ///
  /// `_messages` runs newest-first, so its last entry is the oldest one loaded
  /// and its timestamp is exactly where the previous page ends.
  Future<void> _loadOlder() async {
    if (_messages.isEmpty || _loadingMore || _reachedStart) return;
    setState(() => _loadingMore = true);
    try {
      final older = await ref.read(chatRepositoryProvider).fetchMessages(
            widget.groupId,
            before: _messages.last.createdAt.toUtc().toIso8601String(),
            limit: _pageSize,
          );
      if (!mounted) return;

      final known = _messages.map((m) => m.id).toSet();
      setState(() {
        _messages.addAll(older.reversed.where((m) => !known.contains(m.id)));
        // A short page is the end of the history; an empty one certainly is.
        _reachedStart = older.length < _pageSize;
      });
    } catch (_) {
      // Leave `_reachedStart` alone: a failed request is not proof the history
      // ran out, and clearing the flag here would hide the button that lets the
      // student try again.
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _join() async {
    setState(() => _joining = true);
    try {
      await ref.read(chatRepositoryProvider).join(widget.groupId);
      ref.invalidate(chatGroupsProvider);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  Future<void> _send() async {
    final text = _composer.text.trim();
    if (text.isEmpty) return;

    final me = ref.read(currentUserProvider);
    if (me == null) return;

    final tempId = 'optimistic-${DateTime.now().millisecondsSinceEpoch}';
    final optimisticMsg = ChatMessage(
      id: tempId,
      userId: me.id,
      userName: me.name,
      userAvatar: me.avatarUrl,
      content: text,
      type: ChatMessageType.text,
      groupId: widget.groupId,
      createdAt: DateTime.now(),
    );

    _composer.clear();
    setState(() {
      _messages.insert(0, optimisticMsg);
    });

    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    }

    try {
      final savedMessage = await ref.read(chatRepositoryProvider).sendMessage(
            widget.groupId,
            content: text,
          );

      if (!mounted) return;
      setState(() {
        final index = _messages.indexWhere((m) => m.id == tempId);
        if (index != -1) {
          _messages[index] = savedMessage;
        } else if (!_messages.any((m) => m.id == savedMessage.id)) {
          _messages.insert(0, savedMessage);
        }
      });
      unawaited(_markRead());
      ref.invalidate(chatGroupsProvider);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _messages.removeWhere((m) => m.id == tempId);
          _composer.text = text;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppColors.rose,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _messages.removeWhere((m) => m.id == tempId);
          _composer.text = text;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to send message. Please check connection.'),
            backgroundColor: AppColors.rose,
          ),
        );
      }
    }
  }

  Future<void> _vote(ChatMessage message, int optionIndex) async {
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    if (message.userId == me.id) return; // Author cannot vote in poll

    final metadata = Map<String, dynamic>.from(message.metadata ?? {});
    final pollData = metadata['poll'] is Map
        ? Map<String, dynamic>.from(metadata['poll'] as Map)
        : null;

    if (pollData != null) {
      final rawOptions = pollData['options'];
      if (rawOptions is! List) return;
      final options = rawOptions
          .map((o) => Map<String, dynamic>.from(o as Map))
          .toList();

      final alreadyVoted = options.any((opt) {
        final voted = (opt['votedUserIds'] as List?) ?? [];
        return voted.contains(me.id);
      });
      if (alreadyVoted) return;

      for (var i = 0; i < options.length; i++) {
        if (i == optionIndex) {
          final votes = (options[i]['votedUserIds'] as List?)
                  ?.map((v) => v.toString())
                  .toList() ??
              <String>[];
          if (!votes.contains(me.id)) votes.add(me.id);
          options[i]['votedUserIds'] = votes;
          options[i]['votes'] = votes.length;
        }
      }
      pollData['options'] = options;
      pollData['totalVotes'] = (pollData['totalVotes'] as num? ?? 0).toInt() + 1;
      metadata['poll'] = pollData;
    } else {
      final rawOptions = metadata['options'];
      if (rawOptions is! List) return;
      final options = rawOptions
          .map((o) => Map<String, dynamic>.from(o as Map))
          .toList();

      for (var i = 0; i < options.length; i++) {
        final votes = (options[i]['votes'] as List?)
                ?.map((v) => v.toString())
                .toList() ??
            <String>[];
        votes.remove(me.id);
        if (i == optionIndex) votes.add(me.id);
        options[i]['votes'] = votes;
      }
      metadata['options'] = options;
    }

    try {
      await ref
          .read(chatRepositoryProvider)
          .votePoll(messageId: message.id, metadata: metadata);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  void _showGroupDetails(ChatGroup group) {
    showGlassSheet<void>(
      context: context,
      isScrollControlled: false,
      handle: false,
      builder: (context) {
        final palette = context.palette;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: palette.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 18),
                _GroupAvatar(group: group, size: 52),
                const SizedBox(height: 12),
                Text(
                  group.name,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${Fmt.count(group.memberCount, 'member')} • ${group.category}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
                if (group.description.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: palette.elevated,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      border: Border.all(color: palette.border),
                    ),
                    child: Text(
                      group.description,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: palette.textSecondary,
                            height: 1.45,
                          ),
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: Icon(
                          group.isPinned
                              ? Icons.push_pin_rounded
                              : Icons.push_pin_outlined,
                          size: 18,
                        ),
                        label: Text(group.isPinned ? 'Unpin' : 'Pin Group'),
                        onPressed: () async {
                          Navigator.of(context).pop();
                          await ref
                              .read(chatRepositoryProvider)
                              .setPinned(group.id, !group.isPinned);
                          ref.invalidate(chatGroupsProvider);
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  bool _isDifferentDay(DateTime a, DateTime b) {
    return a.year != b.year || a.month != b.month || a.day != b.day;
  }

  @override
  Widget build(BuildContext context) {
    final group = ref.watch(chatGroupProvider(widget.groupId));
    final me = ref.watch(currentUserProvider);
    final palette = context.palette;
    final isDark = palette.isDark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF070C18) : const Color(0xFFF8FAFC),
      appBar: GlassAppBar(
        titleSpacing: 0,
        title: InkWell(
          onTap: group == null ? null : () => _showGroupDetails(group),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
            child: Row(
              children: [
                if (group != null) ...[
                  _GroupAvatar(group: group, size: 36),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              group?.name ?? 'Group chat',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 14,
                                  ),
                            ),
                          ),
                          if (group != null && group.isLocked) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                color: AppColors.rose.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(
                                  color: AppColors.rose.withValues(alpha: 0.3),
                                ),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.lock_rounded, size: 10, color: AppColors.rose),
                                  SizedBox(width: 2),
                                  Text(
                                    'Locked',
                                    style: TextStyle(
                                      color: AppColors.rose,
                                      fontSize: 9,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (group != null) ...[
                        const SizedBox(height: 1),
                        Text(
                          '${group.memberCount.toString()} members',
                          style: TextStyle(
                            color: palette.textMuted,
                            fontSize: 10.5,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          if (group != null && group.isJoined)
            IconButton(
              tooltip: group.isPinned ? 'Unpin' : 'Pin',
              icon: Icon(
                group.isPinned
                    ? Icons.push_pin_rounded
                    : Icons.push_pin_outlined,
                size: 20,
                color: group.isPinned ? AppColors.cyan : null,
              ),
              onPressed: () async {
                await ref
                    .read(chatRepositoryProvider)
                    .setPinned(group.id, !group.isPinned);
                ref.invalidate(chatGroupsProvider);
              },
            ),
          if (group != null)
            IconButton(
              tooltip: 'Group info',
              icon: const Icon(Icons.more_vert_rounded, size: 20),
              onPressed: () => _showGroupDetails(group),
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(child: _buildBody(me?.id)),
          if (group != null) _buildComposer(group),
        ],
      ),
    );
  }

  Widget _buildBody(String? myId) {
    if (_loading) {
      return const ListSkeleton(count: 6, height: 62);
    }
    if (_error != null) {
      return ErrorView(error: _error!, onRetry: _bootstrap);
    }
    if (_messages.isEmpty) {
      return const EmptyView(
        icon: Icons.chat_bubble_outline_rounded,
        title: 'No messages yet',
        message: 'Be the first to start the discussion.',
      );
    }

    // The list is reversed, so the extra trailing item sits at the *top* of the
    // conversation — where a student looking for older messages will reach for
    // it, and where the web client puts the same control.
    final hasOlderControl = !_reachedStart;

    return ListView.builder(
      controller: _scrollController,
      reverse: true,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      itemCount: _messages.length + (hasOlderControl ? 1 : 0),
      itemBuilder: (context, index) {
        if (index >= _messages.length) return _buildLoadOlderButton();

        final message = _messages[index];
        final older = index + 1 < _messages.length ? _messages[index + 1] : null;
        final showDateSeparator =
            older == null || _isDifferentDay(older.createdAt, message.createdAt);

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (showDateSeparator) _WebDateChip(date: message.createdAt),
            _WebMessageRow(
              message: message,
              isMe: message.userId == myId,
              myId: myId,
              onVote: (optionIndex) => _vote(message, optionIndex),
            ),
          ],
        );
      },
    );
  }

  /// Pulls in the previous page on demand. Loading history only when it is
  /// asked for is what keeps opening a busy group to a single small request,
  /// however far back the conversation goes.
  Widget _buildLoadOlderButton() {
    final palette = context.palette;

    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 14),
      child: Center(
        child: TextButton.icon(
          onPressed: _loadingMore ? null : () => unawaited(_loadOlder()),
          style: TextButton.styleFrom(
            backgroundColor: palette.textMuted.withValues(alpha: 0.10),
            foregroundColor: palette.textSecondary,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          ),
          icon: _loadingMore
              ? const SizedBox(
                  width: 13,
                  height: 13,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.arrow_upward_rounded, size: 14),
          label: Text(
            _loadingMore ? 'Loading older messages…' : 'Load Older Messages',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
          ),
        ),
      ),
    );
  }

  Widget _buildComposer(ChatGroup group) {
    final palette = context.palette;
    final isDark = palette.isDark;

    if (!group.isJoined) {
      return _Notice(
        icon: Icons.group_add_rounded,
        message: 'Join this group to start messaging.',
        action: FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.cyan,
            foregroundColor: Colors.white,
          ),
          onPressed: _joining ? null : _join,
          child: _joining
              ? const SizedBox(
                  width: 15,
                  height: 15,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Text('Join Group', style: TextStyle(fontWeight: FontWeight.w800)),
        ),
      );
    }
    if (group.isLocked) {
      return const _Notice(
        icon: Icons.lock_rounded,
        message: 'This group is locked. Only admins can post right now.',
      );
    }
    if (!group.allowTextMessages) {
      return const _Notice(
        icon: Icons.campaign_rounded,
        message: 'Messaging is turned off for this study circle by the admin.',
      );
    }

    final hasText = _composer.text.trim().isNotEmpty;

    return Container(
      decoration: BoxDecoration(
        color: palette.card,
        border: Border(
          top: BorderSide(
            color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
            width: 1,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
                    ),
                  ),
                  child: TextField(
                    controller: _composer,
                    minLines: 1,
                    maxLines: 4,
                    textCapitalization: TextCapitalization.sentences,
                    onChanged: (_) => setState(() {}),
                    style: TextStyle(
                      color: palette.textPrimary,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Write a message…',
                      hintStyle: TextStyle(
                        color: palette.textMuted,
                        fontSize: 13,
                      ),
                      isDense: true,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _WebSendButton(
                enabled: hasText,
                onTap: _send,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

final chatSocketProvider =
    Provider.family.autoDispose<ChatSocket, String>((ref, token) {
  final link = ref.keepAlive();
  final socket = ChatSocket(accessToken: token);
  ref.onDispose(() {
    link.close();
    socket.dispose();
  });
  return socket;
});

/// Web-style date chip in the middle of the chat
class _WebDateChip extends StatelessWidget {
  const _WebDateChip({required this.date});

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
        decoration: BoxDecoration(
          color: isDark
              ? const Color(0xFF0F172A).withValues(alpha: 0.8)
              : const Color(0xFFE2E8F0).withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isDark ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1),
          ),
        ),
        child: Text(
          Fmt.date(date).toUpperCase(),
          style: TextStyle(
            color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569),
            fontSize: 9.5,
            fontFamily: 'monospace',
            fontWeight: FontWeight.w800,
            letterSpacing: 0.6,
          ),
        ),
      ),
    );
  }
}

/// Web-style message row matching `community-view.tsx` exactly
class _WebMessageRow extends StatelessWidget {
  const _WebMessageRow({
    required this.message,
    required this.isMe,
    required this.myId,
    required this.onVote,
  });

  final ChatMessage message;
  final bool isMe;
  final String? myId;
  final ValueChanged<int> onVote;

  bool _isAdmin(String name) {
    final lower = name.toLowerCase();
    return lower.contains('psc tips') ||
        lower.contains('admin') ||
        lower.contains('staff') ||
        lower.contains('moderator');
  }

  String _getInitials(String name) {
    final parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return 'U';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  void _onLongPress(BuildContext context) {
    Clipboard.setData(ClipboardData(text: message.content));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Message copied'),
        duration: Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;
    final isAdminSender = _isAdmin(message.userName);
    final maxBubbleWidth = MediaQuery.sizeOf(context).width * 0.78;
    final isPoll = message.isPoll || message.pollOptions.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!isMe) ...[
            _WebAvatar(
              name: message.userName,
              avatarUrl: message.userAvatar,
              isAdmin: isAdminSender,
              initials: _getInitials(message.userName),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: GestureDetector(
              onLongPress: () => _onLongPress(context),
              child: Column(
                crossAxisAlignment:
                    isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Metadata header line: [Name] [👑 Admin] [Time] [✓]
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (!isMe) ...[
                          Text(
                            message.userName,
                            style: TextStyle(
                              color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A),
                              fontWeight: FontWeight.w800,
                              fontSize: 11,
                            ),
                          ),
                          if (isAdminSender) ...[
                            const SizedBox(width: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF06B6D4), Color(0xFF2563EB)],
                                ),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                '👑 Admin',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 8.5,
                                  fontFamily: 'monospace',
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(width: 6),
                        ],
                        Text(
                          Fmt.timeOfDay(message.createdAt),
                          style: TextStyle(
                            color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
                            fontSize: 10,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        if (isMe) ...[
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.check_rounded,
                            size: 13,
                            color: Color(0xFF10B981),
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Liquid Glass Message Bubble
                  Container(
                    constraints: BoxConstraints(
                      maxWidth: maxBubbleWidth,
                      minWidth: isPoll ? (maxBubbleWidth * 0.95) : 0,
                    ),
                    padding: EdgeInsets.symmetric(
                      horizontal: isPoll ? 8 : 13,
                      vertical: isPoll ? 8 : 10,
                    ),
                    decoration: BoxDecoration(
                      color: isMe
                          ? const Color(0xFF06B6D4).withValues(alpha: isDark ? 0.20 : 0.14)
                          : isAdminSender
                              ? const Color(0xFF3B82F6).withValues(alpha: isDark ? 0.15 : 0.10)
                              : isDark
                                  ? const Color(0xFF0F172A).withValues(alpha: 0.85)
                                  : Colors.white.withValues(alpha: 0.95),
                      border: Border.all(
                        color: isMe
                            ? const Color(0xFF06B6D4).withValues(alpha: 0.35)
                            : isAdminSender
                                ? const Color(0xFF3B82F6).withValues(alpha: 0.40)
                                : isDark
                                    ? const Color(0xFF1E293B)
                                    : const Color(0xFFE2E8F0),
                        width: isAdminSender ? 1.5 : 1,
                      ),
                      borderRadius: isMe
                          ? const BorderRadius.only(
                              topLeft: Radius.circular(16),
                              bottomLeft: Radius.circular(16),
                              bottomRight: Radius.circular(16),
                              topRight: Radius.circular(0),
                            )
                          : const BorderRadius.only(
                              topRight: Radius.circular(16),
                              bottomLeft: Radius.circular(16),
                              bottomRight: Radius.circular(16),
                              topLeft: Radius.circular(0),
                            ),
                      boxShadow: [
                        BoxShadow(
                          color: isMe
                              ? const Color(0xFF06B6D4).withValues(alpha: 0.08)
                              : Colors.black.withValues(alpha: isDark ? 0.15 : 0.04),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: _WebMessageContent(
                      message: message,
                      isMe: isMe,
                      myId: myId,
                      onVote: onVote,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (isMe) ...[
            const SizedBox(width: 8),
            _WebAvatar(
              name: message.userName,
              avatarUrl: message.userAvatar,
              isAdmin: isAdminSender,
              initials: _getInitials(message.userName),
            ),
          ],
        ],
      ),
    );
  }
}

/// Web-style avatar square
class _WebAvatar extends StatelessWidget {
  const _WebAvatar({
    required this.name,
    required this.initials,
    required this.isAdmin,
    this.avatarUrl,
  });

  final String name;
  final String initials;
  final bool isAdmin;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;

    if ((avatarUrl ?? '').isNotEmpty) {
      return AppImage(
        url: avatarUrl,
        width: 28,
        height: 28,
        radius: 8,
        fallbackIcon: Icons.person_rounded,
      );
    }

    if (isAdmin) {
      return Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.bottomLeft,
            end: Alignment.topRight,
            colors: [Color(0xFF06B6D4), Color(0xFF2563EB)],
          ),
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF06B6D4).withValues(alpha: 0.3),
              blurRadius: 3,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        alignment: Alignment.center,
        child: const Text('👑', style: TextStyle(fontSize: 13)),
      );
    }

    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
        borderRadius: BorderRadius.circular(8),
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: TextStyle(
          color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF334155),
          fontWeight: FontWeight.w800,
          fontSize: 11,
          letterSpacing: -0.2,
        ),
      ),
    );
  }
}

/// Web-style message content renderer
class _WebMessageContent extends StatelessWidget {
  const _WebMessageContent({
    required this.message,
    required this.isMe,
    required this.myId,
    required this.onVote,
  });

  final ChatMessage message;
  final bool isMe;
  final String? myId;
  final ValueChanged<int> onVote;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;

    if (message.isPoll || message.pollOptions.isNotEmpty) {
      return _WebPollCard(
        message: message,
        isMe: isMe,
        myId: myId,
        onVote: onVote,
      );
    }

    switch (message.type) {
      case ChatMessageType.image:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if ((message.mediaUrl ?? '').isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: AppImage(
                  url: message.mediaUrl,
                  height: 180,
                  fit: BoxFit.cover,
                ),
              ),
            if (message.content.trim().isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                message.content,
                style: TextStyle(
                  color: isMe
                      ? (isDark ? const Color(0xFFECFEFF) : const Color(0xFF0F172A))
                      : (isDark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A)),
                  fontSize: 12.5,
                  fontWeight: FontWeight.w500,
                  height: 1.4,
                ),
              ),
            ],
          ],
        );

      case ChatMessageType.document:
        return PdfAttachmentTile(
          title: message.content.isEmpty ? 'Document' : message.content,
          subtitle: 'Tap to open',
          onTap: () => openPdf(
            context,
            url: message.mediaUrl ?? '',
            title: message.content.isEmpty ? 'Document' : message.content,
          ),
        );

      case ChatMessageType.poll:
        return _WebPollCard(
          message: message,
          isMe: isMe,
          myId: myId,
          onVote: onVote,
        );

      case ChatMessageType.text:
        return Text(
          message.content,
          style: TextStyle(
            color: isMe
                ? (isDark ? const Color(0xFFECFEFF) : const Color(0xFF0F172A))
                : (isDark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A)),
            fontSize: 12.5,
            fontWeight: isMe ? FontWeight.w600 : FontWeight.w500,
            height: 1.4,
          ),
        );
    }
  }
}

/// Web-style Poll container
class _WebPollCard extends StatelessWidget {
  const _WebPollCard({
    required this.message,
    required this.isMe,
    required this.myId,
    required this.onVote,
  });

  final ChatMessage message;
  final bool isMe;
  final String? myId;
  final ValueChanged<int> onVote;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;
    final options = message.pollOptions;
    final totalVotes = message.pollTotalVotes;
    final correctOptionId = message.pollCorrectOptionId;
    final isAuthor = myId != null && message.userId == myId;

    final hasVotedAny = myId != null && options.any((o) => o.votedBy(myId!));
    final votedOption = myId != null
        ? options.where((o) => o.votedBy(myId!)).firstOrNull
        : null;
    final isUserCorrect = votedOption != null &&
        correctOptionId != null &&
        votedOption.id == correctOptionId;
    final isUserWrong = votedOption != null &&
        correctOptionId != null &&
        votedOption.id != correctOptionId;
    final correctOption =
        options.where((o) => o.id == correctOptionId).firstOrNull;

    return Container(
      margin: const EdgeInsets.only(top: 2),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark
            ? const Color(0xFF020617).withValues(alpha: 0.6)
            : Colors.white.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Poll Header: icon + question
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.bar_chart_rounded,
                size: 16,
                color: Color(0xFF06B6D4),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  message.pollQuestion,
                  style: TextStyle(
                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                    fontWeight: FontWeight.w900,
                    fontSize: 13.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),

          // Subheader row: [📊 Author View (Voting Disabled)] [X votes]
          Padding(
            padding: const EdgeInsets.only(left: 22, bottom: 8),
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 4,
              children: [
                if (isAuthor)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0x2606B6D4),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0x4D06B6D4)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('📊', style: TextStyle(fontSize: 10)),
                        SizedBox(width: 4),
                        Text(
                          'Author View (Voting Disabled)',
                          style: TextStyle(
                            color: Color(0xFF0E7490),
                            fontSize: 9.5,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                Text(
                  '$totalVotes votes',
                  style: TextStyle(
                    color: palette.textMuted,
                    fontFamily: 'monospace',
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),

          // Divider line below header
          Divider(
            height: 1,
            color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
          ),
          const SizedBox(height: 9),

          // Poll Option rows
          for (var i = 0; i < options.length; i++) ...[
            _WebPollOptionButton(
              option: options[i],
              totalVotes: totalVotes,
              isAuthor: isAuthor,
              hasVotedAny: hasVotedAny,
              hasVotedThis: myId != null && options[i].votedBy(myId!),
              isCorrectOpt:
                  correctOptionId != null && options[i].id == correctOptionId,
              onTap: (isAuthor || hasVotedAny) ? () {} : () => onVote(i),
            ),
            if (i < options.length - 1) const SizedBox(height: 7),
          ],

          // Result Feedback Banner / Author footer
          if (isAuthor || (correctOptionId != null && hasVotedAny)) ...[
            const SizedBox(height: 9),
            Divider(
              height: 1,
              color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
            ),
            const SizedBox(height: 8),
            if (isAuthor)
              const Row(
                children: [
                  Text('📊', style: TextStyle(fontSize: 11)),
                  SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      'Poll Author View • Student votes update in real-time',
                      style: TextStyle(
                        color: Color(0xFF0891B2),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              )
            else if (isUserCorrect)
              const Row(
                children: [
                  Text('🎉', style: TextStyle(fontSize: 12)),
                  SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      'Correct Answer chosen! Outstanding effort.',
                      style: TextStyle(
                        color: Color(0xFF059669),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              )
            else if (isUserWrong)
              Row(
                children: [
                  const Text('❌', style: TextStyle(fontSize: 12)),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      'Wrong Answer! Correct Answer: ${correctOption?.text ?? ""}',
                      style: const TextStyle(
                        color: Color(0xFFE11D48),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
          ],
        ],
      ),
    );
  }
}

class _WebPollOptionButton extends StatelessWidget {
  const _WebPollOptionButton({
    required this.option,
    required this.totalVotes,
    required this.isAuthor,
    required this.hasVotedAny,
    required this.hasVotedThis,
    required this.isCorrectOpt,
    required this.onTap,
  });

  final PollOption option;
  final int totalVotes;
  final bool isAuthor;
  final bool hasVotedAny;
  final bool hasVotedThis;
  final bool isCorrectOpt;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;
    final percent = totalVotes > 0 ? (option.voteCount / totalVotes) : 0.0;

    final isWrongSelection = hasVotedThis && !isCorrectOpt;
    final showCorrectBadge = isCorrectOpt && (hasVotedAny || isAuthor);
    final showWrongBadge = isWrongSelection && !isAuthor;

    Color borderColor;
    Color bgColor;
    Color textColor;

    if (isAuthor) {
      if (isCorrectOpt) {
        borderColor = const Color(0xFF10B981);
        bgColor = const Color(0x1A10B981);
        textColor = isDark ? const Color(0xFF6EE7B7) : const Color(0xFF065F46);
      } else {
        borderColor =
            isDark ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1);
        bgColor = isDark
            ? const Color(0xFF020617).withValues(alpha: 0.4)
            : Colors.white.withValues(alpha: 0.6);
        textColor = isDark ? const Color(0xFFCBD5E1) : const Color(0xFF334155);
      }
    } else if (isWrongSelection) {
      borderColor = const Color(0xFFF43F5E);
      bgColor = const Color(0x1AF43F5E);
      textColor = isDark ? const Color(0xFFFDA4AF) : const Color(0xFF9F1239);
    } else if (isCorrectOpt && hasVotedAny) {
      borderColor = const Color(0xFF10B981);
      bgColor = const Color(0x1A10B981);
      textColor = isDark ? const Color(0xFF6EE7B7) : const Color(0xFF065F46);
    } else if (hasVotedThis) {
      borderColor = const Color(0xFF06B6D4);
      bgColor = const Color(0x1A06B6D4);
      textColor = isDark ? const Color(0xFF67E8F9) : const Color(0xFF155E75);
    } else {
      borderColor =
          isDark ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1);
      bgColor = isDark
          ? const Color(0xFF020617).withValues(alpha: 0.4)
          : Colors.white.withValues(alpha: 0.6);
      textColor = isDark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A);
    }

    return InkWell(
      onTap: (isAuthor || hasVotedAny) ? null : onTap,
      borderRadius: BorderRadius.circular(12),
      child: Stack(
        children: [
          // Progress fill
          if (!isAuthor && (hasVotedAny || totalVotes > 0))
            Positioned.fill(
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: percent.clamp(0.0, 1.0),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: isWrongSelection
                        ? const Color(0x33F43F5E)
                        : (isCorrectOpt && hasVotedAny
                            ? const Color(0x4010B981)
                            : const Color(0x3306B6D4)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),

          Container(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: borderColor,
                width: (showCorrectBadge || showWrongBadge) ? 1.5 : 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        option.text,
                        style: TextStyle(
                          color: textColor,
                          fontWeight: (showCorrectBadge || (isAuthor && isCorrectOpt))
                              ? FontWeight.w900
                              : FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    Text(
                      '${(percent * 100).round()}% (${option.voteCount})',
                      style: TextStyle(
                        color: textColor,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w700,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
                if (showCorrectBadge || showWrongBadge) ...[
                  const SizedBox(height: 5),
                  if (showCorrectBadge)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check_circle_rounded,
                              size: 10, color: Colors.white),
                          SizedBox(width: 3),
                          Text(
                            'Correct Answer',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    )
                  else if (showWrongBadge)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF43F5E),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.close_rounded,
                              size: 10, color: Colors.white),
                          SizedBox(width: 3),
                          Text(
                            'Wrong Answer',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Web-style gradient send button
class _WebSendButton extends StatelessWidget {
  const _WebSendButton({required this.enabled, required this.onTap});

  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;

    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          gradient: enabled
              ? const LinearGradient(
                  colors: [Color(0xFF06B6D4), Color(0xFF2563EB)],
                )
              : null,
          color: enabled
              ? null
              : (isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0)),
          borderRadius: BorderRadius.circular(12),
          boxShadow: enabled
              ? [
                  BoxShadow(
                    color: const Color(0xFF06B6D4).withValues(alpha: 0.35),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Icon(
          Icons.send_rounded,
          size: 16,
          color: enabled ? Colors.white : palette.textMuted,
        ),
      ),
    );
  }
}

/// Group Avatar component matching web's GroupAvatar
class _GroupAvatar extends StatelessWidget {
  const _GroupAvatar({required this.group, this.size = 36});

  final ChatGroup group;
  final double size;

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
            width: size,
            height: size,
            radius: size * 0.3,
            fallbackIcon: Icons.groups_rounded,
          ),
          if (group.isJoined)
            Positioned(
              right: -1,
              bottom: -1,
              child: Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.5),
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
          width: size,
          height: size,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0x33F59E0B), Color(0x33EA580C)],
            ),
            borderRadius: BorderRadius.circular(size * 0.3),
            border: Border.all(
              color: const Color(0x4DF59E0B),
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            _getInitials(group.name),
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: size * 0.36,
              color: const Color(0xFFD97706),
            ),
          ),
        ),
        if (group.isJoined)
          Positioned(
            right: -1,
            bottom: -1,
            child: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: const Color(0xFF10B981),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 1.5),
              ),
            ),
          ),
      ],
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.message, this.action});

  final IconData icon;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Material(
      color: palette.card,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Row(
            children: [
              Icon(icon, size: 19, color: palette.textMuted),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  message,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                        height: 1.4,
                      ),
                ),
              ),
              if (action != null) ...[const SizedBox(width: 12), action!],
            ],
          ),
        ),
      ),
    );
  }
}
