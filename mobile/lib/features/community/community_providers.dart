import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../data/models/chat.dart';
import 'chat_cache.dart';

final chatCacheProvider = Provider<ChatCache>((ref) => ChatCache());

/// The group list as it was left last time, straight off disk.
///
/// Kept separate from [chatGroupsProvider] rather than folded into it so that
/// provider keeps meaning exactly one thing — "the live list" — and pull to
/// refresh still waits for the network rather than resolving instantly against
/// the cache. Screens read this one only to have something to paint while the
/// live list is still in flight.
final cachedChatGroupsProvider = FutureProvider<List<ChatGroup>>((ref) async {
  return await ref.watch(chatCacheProvider).readGroups() ?? const <ChatGroup>[];
});

final chatGroupsProvider = FutureProvider.autoDispose<List<ChatGroup>>((ref) async {
  ref.keepAlive();
  final groups = await ref.watch(chatRepositoryProvider).fetchGroups();
  // Fire-and-forget: nothing on screen is waiting on the cache being written.
  unawaited(ref.watch(chatCacheProvider).writeGroups(groups));
  return groups;
});

/// One group's details, read out of the already-loaded list rather than costing
/// another request — the API has no single-group endpoint for students.
///
/// Falls back to the cached list so opening a chat from a push notification on
/// a cold start can render its header and composer immediately, instead of
/// showing a nameless screen until the group list arrives.
final chatGroupProvider =
    Provider.autoDispose.family<ChatGroup?, String>((ref, groupId) {
  final groups = ref.watch(chatGroupsProvider).valueOrNull ??
      ref.watch(cachedChatGroupsProvider).valueOrNull;
  if (groups == null) return null;
  for (final group in groups) {
    if (group.id == groupId) return group;
  }
  return null;
});
