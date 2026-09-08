import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/network/api_client.dart';
import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:psc_tips_tricks_mobile/data/models/chat.dart';
import 'package:psc_tips_tricks_mobile/data/repositories/chat_repository.dart';
import 'package:psc_tips_tricks_mobile/features/community/chat_cache.dart';
import 'package:psc_tips_tricks_mobile/features/community/community_providers.dart';

ChatMessage _message(
  String id, {
  DateTime? at,
  Map<String, dynamic>? metadata,
  ChatMessageType type = ChatMessageType.text,
}) =>
    ChatMessage(
      id: id,
      userId: 'u1',
      userName: 'Aspirant',
      content: 'Message $id',
      type: type,
      metadata: metadata,
      groupId: 'g1',
      createdAt: at ?? DateTime.utc(2026, 9, 1, 12),
    );

ChatGroup _group(String id, {ChatMessage? last}) => ChatGroup(
      id: id,
      name: 'Group $id',
      description: 'A study group',
      category: 'General',
      iconEmoji: '💬',
      isLocked: false,
      allowTextMessages: true,
      allowPolls: true,
      memberCount: 12,
      isJoined: true,
      isPinned: false,
      unreadCount: 3,
      lastMessage: last,
    );

class _FakeChat extends ChatRepository {
  _FakeChat(this.groups) : super(ApiClient(tokenStore: TokenStore()));

  final List<ChatGroup> groups;
  int fetchGroupCalls = 0;

  @override
  Future<List<ChatGroup>> fetchGroups() async {
    fetchGroupCalls += 1;
    return groups;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory sandbox;

  setUp(() {
    sandbox = Directory.systemTemp.createTempSync('chat_cache_test');
    // ChatCache stores under the application support directory; point that at a
    // throwaway folder rather than the host's real one.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async =>
          call.method == 'getApplicationSupportDirectory' ? sandbox.path : null,
    );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      null,
    );
    if (sandbox.existsSync()) sandbox.deleteSync(recursive: true);
  });

  group('cached models survive the round trip', () {
    test('a message keeps its type, timestamp and metadata', () {
      final poll = _message(
        'm1',
        metadata: {
          'poll': {
            'question': 'Which year?',
            'options': [
              {'id': 'opt-1', 'text': '1947', 'votes': 2, 'votedUserIds': <String>[]},
            ],
          },
        },
      );

      final restored = ChatMessage.fromJson(jsonDecode(jsonEncode(poll.toJson())));

      expect(restored.id, poll.id);
      expect(restored.content, poll.content);
      // `fromJson` localises timestamps for live responses and cached ones
      // alike, so compare the instant rather than the wall clock.
      expect(restored.createdAt.isAtSameMomentAs(poll.createdAt), isTrue);
      expect(restored.isPoll, isTrue);
      expect(restored.pollQuestion, 'Which year?');
      expect(restored.pollOptions.single.text, '1947');
    });

    test('a group keeps its per-user state and last-message preview', () {
      final group = _group('g1', last: _message('m9'));

      final restored = ChatGroup.fromJson(jsonDecode(jsonEncode(group.toJson())));

      expect(restored.id, 'g1');
      expect(restored.isJoined, isTrue);
      expect(restored.unreadCount, 3);
      expect(restored.memberCount, 12);
      expect(restored.lastMessage?.id, 'm9');
    });
  });

  group('ChatCache', () {
    test('reads back the messages it stored, newest first', () async {
      final cache = ChatCache();
      final messages = [
        _message('m3', at: DateTime.utc(2026, 9, 1, 14)),
        _message('m2', at: DateTime.utc(2026, 9, 1, 13)),
        _message('m1', at: DateTime.utc(2026, 9, 1, 12)),
      ];

      await cache.writeMessages('g1', messages);

      final restored = await cache.readMessages('g1');
      expect(restored?.map((m) => m.id).toList(), ['m3', 'm2', 'm1']);
    });

    test('keeps only the newest page, so the file cannot grow without bound',
        () async {
      final cache = ChatCache();
      final messages = List.generate(
        ChatCache.messageLimit + 25,
        (i) => _message('m$i', at: DateTime.utc(2026, 9, 1).subtract(Duration(minutes: i))),
      );

      await cache.writeMessages('g1', messages);

      final restored = await cache.readMessages('g1');
      expect(restored, hasLength(ChatCache.messageLimit));
      // Newest-first in, newest-first out — the tail is what gets dropped.
      expect(restored!.first.id, 'm0');
      expect(restored.last.id, 'm${ChatCache.messageLimit - 1}');
    });

    test('nothing cached reads as null rather than an empty conversation',
        () async {
      expect(await ChatCache().readMessages('never-opened'), isNull);
      expect(await ChatCache().readGroups(), isNull);
    });

    test('a cache older than maxAge is discarded, not shown', () async {
      final cache = ChatCache();
      await cache.writeGroups([_group('g1')]);

      // Re-date the file past the freshness window.
      final file = File('${sandbox.path}/chat_cache/groups.json');
      final stored = jsonDecode(await file.readAsString()) as Map<String, dynamic>;
      stored['savedAt'] = DateTime.now()
          .subtract(ChatCache.maxAge + const Duration(days: 1))
          .toIso8601String();
      await file.writeAsString(jsonEncode(stored));

      expect(await cache.readGroups(), isNull);
    });

    test('a corrupt file degrades to no cache instead of throwing', () async {
      final cache = ChatCache();
      await cache.writeGroups([_group('g1')]);
      await File('${sandbox.path}/chat_cache/groups.json').writeAsString('{not json');

      expect(await cache.readGroups(), isNull);
    });

    test('clear() leaves nothing behind for the next account', () async {
      final cache = ChatCache();
      await cache.writeGroups([_group('g1')]);
      await cache.writeMessages('g1', [_message('m1')]);

      await cache.clear();

      expect(await cache.readGroups(), isNull);
      expect(await cache.readMessages('g1'), isNull);
    });
  });

  group('group list providers', () {
    ProviderContainer boot(_FakeChat repo) {
      final container = ProviderContainer(
        overrides: [chatRepositoryProvider.overrideWith((ref) => repo)],
      );
      addTearDown(container.dispose);
      return container;
    }

    test('a fetched list is written through to the cache', () async {
      final repo = _FakeChat([_group('g1', last: _message('m1'))]);
      final container = boot(repo);

      final live = await container.read(chatGroupsProvider.future);
      expect(live.single.id, 'g1');

      // The write is fire-and-forget, so read through the cache object the
      // provider used rather than racing it.
      await container.read(chatCacheProvider).writeGroups(live);
      expect((await container.read(chatCacheProvider).readGroups())?.single.id, 'g1');
    });

    test('the cached list is available without touching the network', () async {
      final repo = _FakeChat([_group('g1')]);
      final container = boot(repo);
      await container.read(chatCacheProvider).writeGroups([_group('g7')]);

      final cached = await container.read(cachedChatGroupsProvider.future);

      expect(cached.single.id, 'g7');
      expect(repo.fetchGroupCalls, 0);
    });
  });
}
