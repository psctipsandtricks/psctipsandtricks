import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:psc_tips_tricks_mobile/core/network/api_client.dart';
import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/providers/auth_controller.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:psc_tips_tricks_mobile/data/models/chat.dart';
import 'package:psc_tips_tricks_mobile/data/models/user.dart';
import 'package:psc_tips_tricks_mobile/data/repositories/auth_repository.dart';
import 'package:psc_tips_tricks_mobile/data/repositories/chat_repository.dart';
import 'package:psc_tips_tricks_mobile/features/community/community_providers.dart';
import 'package:psc_tips_tricks_mobile/features/community/group_chat_screen.dart';

const _me = User(
  id: 'u1',
  email: 'me@test.dev',
  name: 'Aspirant',
  role: UserRole.student,
  isPremium: false,
  isSuspended: false,
);

ChatMessage _message({String id = 'm1', String userId = 'u1'}) => ChatMessage(
      id: id,
      userId: userId,
      userName: userId == 'u1' ? 'Aspirant' : 'Someone Else',
      content: 'orignal typo',
      type: ChatMessageType.text,
      groupId: 'g1',
      createdAt: DateTime.utc(2026, 9, 9, 10),
    );

/// Serves one message and records what the screen asks of the server.
class _FakeChat extends ChatRepository {
  _FakeChat(this._messages) : super(ApiClient(tokenStore: TokenStore()));

  final List<ChatMessage> _messages;
  final edits = <({String id, String? content})>[];
  final deletes = <String>[];

  @override
  Future<List<ChatGroup>> fetchGroups() async => [
        const ChatGroup(
          id: 'g1',
          name: 'Kerala PSC LDC',
          description: '',
          category: 'General',
          iconEmoji: '💬',
          isLocked: false,
          allowTextMessages: true,
          allowPolls: true,
          memberCount: 3,
          isJoined: true,
          isPinned: false,
          unreadCount: 0,
        ),
      ];

  @override
  Future<List<ChatMessage>> fetchMessages(String groupId,
          {String? before, int limit = 30}) async =>
      before == null ? _messages : const [];

  @override
  Future<void> markRead(String groupId, {String? lastReadMessageId}) async {}

  @override
  Future<ChatMessage> editMessage(String messageId,
      {String? content, Map<String, dynamic>? metadata}) async {
    edits.add((id: messageId, content: content));
    final old = _messages.firstWhere((m) => m.id == messageId);
    return ChatMessage(
      id: old.id,
      userId: old.userId,
      userName: old.userName,
      content: content ?? old.content,
      type: old.type,
      groupId: old.groupId,
      createdAt: old.createdAt,
      editedAt: DateTime.now(),
    );
  }

  @override
  Future<void> deleteOwnMessage(String messageId) async =>
      deletes.add(messageId);
}

class _SilentAuth extends AuthRepository {
  _SilentAuth() : super(ApiClient(tokenStore: TokenStore()), TokenStore());
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory sandbox;

  setUp(() {
    // The chat screen reads its offline cache on the way in; without a
    // directory that read never resolves and the screen never leaves its
    // skeleton.
    sandbox = Directory.systemTemp.createTempSync('edit_msg_test');
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
            const MethodChannel('plugins.flutter.io/path_provider'), null);
    if (sandbox.existsSync()) sandbox.deleteSync(recursive: true);
  });

  Future<_FakeChat> pump(WidgetTester tester, {String authorId = 'u1'}) async {
    tester.view.physicalSize = const Size(420, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final repo = _FakeChat([_message(userId: authorId)]);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        sharedPrefsProvider.overrideWithValue(prefs),
        chatRepositoryProvider.overrideWith((ref) => repo),
        authRepositoryProvider.overrideWith((ref) => _SilentAuth()),
        currentUserProvider.overrideWithValue(_me),
        chatGroupsProvider.overrideWith((ref) => repo.fetchGroups()),
        cachedChatGroupsProvider.overrideWith((ref) async => <ChatGroup>[]),
      ],
      child: const MaterialApp(
        home: GroupChatScreen(groupId: 'g1'),
      ),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    return repo;
  }

  Future<void> openMessageMenu(WidgetTester tester) async {
    await tester.longPress(find.text('orignal typo'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  group('editing your own message', () {
    testWidgets('the dialog opens, saves, and tears down cleanly',
        (tester) async {
      // The regression this exists for: the caller created the text controller
      // and disposed it the instant `showDialog` resolved — while the field was
      // still on screen for the route's exit animation. That threw during
      // teardown and brought the page down on `_dependents.isEmpty`.
      final repo = await pump(tester);

      await openMessageMenu(tester);
      await tester.tap(find.text('Edit message'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('Edit message'), findsWidgets);

      await tester.enterText(find.byType(TextField).last, 'original, fixed');
      await tester.tap(find.widgetWithText(TextButton, 'Save'));
      // Past the pop and all the way through the route's exit animation, which
      // is exactly the window the crash lived in.
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(repo.edits, [(id: 'm1', content: 'original, fixed')]);
    });

    testWidgets('cancelling tears down cleanly and saves nothing',
        (tester) async {
      final repo = await pump(tester);

      await openMessageMenu(tester);
      await tester.tap(find.text('Edit message'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(repo.edits, isEmpty);
    });

    testWidgets('an unchanged message is not sent to the server',
        (tester) async {
      final repo = await pump(tester);

      await openMessageMenu(tester);
      await tester.tap(find.text('Edit message'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.widgetWithText(TextButton, 'Save'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(repo.edits, isEmpty);
    });
  });

  group('somebody else\'s message', () {
    testWidgets('offers no edit or delete', (tester) async {
      await pump(tester, authorId: 'u2');

      await openMessageMenu(tester);

      // A long press on another student's message still copies, as it always
      // did — it just does not offer to change it.
      expect(find.text('Edit message'), findsNothing);
      expect(find.text('Delete'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });
}
