import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../data/models/chat.dart';

final chatGroupsProvider = FutureProvider.autoDispose<List<ChatGroup>>((ref) async {
  ref.keepAlive();
  return ref.watch(chatRepositoryProvider).fetchGroups();
});

/// One group's details, read out of the already-loaded list rather than costing
/// another request — the API has no single-group endpoint for students.
final chatGroupProvider =
    Provider.autoDispose.family<ChatGroup?, String>((ref, groupId) {
  final groups = ref.watch(chatGroupsProvider).valueOrNull;
  if (groups == null) return null;
  for (final group in groups) {
    if (group.id == groupId) return group;
  }
  return null;
});
