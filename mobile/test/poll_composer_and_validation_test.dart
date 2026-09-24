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
import 'package:psc_tips_tricks_mobile/features/community/widgets/poll_composer_sheet.dart';

const _me = User(
  id: 'u1',
  email: 'me@test.dev',
  name: 'Aspirant',
  role: UserRole.student,
  isPremium: false,
  isSuspended: false,
);

class _TestChatRepo extends ChatRepository {
  _TestChatRepo() : super(ApiClient(tokenStore: TokenStore()));

  final sentPolls = <({String groupId, String content, Map<String, dynamic>? metadata})>[];
  final editedPolls = <({String messageId, String? content, Map<String, dynamic>? metadata})>[];

  @override
  Future<List<ChatGroup>> fetchGroups() async => [
        const ChatGroup(
          id: 'g1',
          name: 'Kerala PSC Group',
          description: 'Community for PSC study',
          category: 'General',
          iconEmoji: '💬',
          isLocked: false,
          allowTextMessages: true,
          allowPolls: true,
          memberCount: 5,
          isJoined: true,
          isPinned: false,
          unreadCount: 0,
        ),
      ];

  @override
  Future<List<ChatMessage>> fetchMessages(String groupId,
          {String? before, int limit = 30}) async =>
      [];

  @override
  Future<void> markRead(String groupId, {String? lastReadMessageId}) async {}

  @override
  Future<ChatMessage> sendMessage(
    String groupId, {
    required String content,
    String messageType = 'TEXT',
    String? mediaUrl,
    Map<String, dynamic>? metadata,
  }) async {
    sentPolls.add((groupId: groupId, content: content, metadata: metadata));
    return ChatMessage(
      id: 'poll-1',
      userId: 'u1',
      userName: 'Aspirant',
      content: content,
      type: ChatMessageType.poll,
      groupId: groupId,
      metadata: metadata,
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<ChatMessage> editMessage(
    String messageId, {
    String? content,
    Map<String, dynamic>? metadata,
  }) async {
    editedPolls.add((messageId: messageId, content: content, metadata: metadata));
    return ChatMessage(
      id: messageId,
      userId: 'u1',
      userName: 'Aspirant',
      content: content ?? '',
      type: ChatMessageType.poll,
      groupId: 'g1',
      metadata: metadata,
      createdAt: DateTime.now(),
    );
  }
}

class _SilentAuth extends AuthRepository {
  _SilentAuth() : super(ApiClient(tokenStore: TokenStore()), TokenStore());
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory sandbox;

  setUp(() {
    sandbox = Directory.systemTemp.createTempSync('poll_test');
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

  testWidgets('PollComposerSheet validates duplicate option values and prevents submission',
      (tester) async {
    tester.view.physicalSize = const Size(420, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final repo = _TestChatRepo();
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPrefsProvider.overrideWithValue(prefs),
          chatRepositoryProvider.overrideWith((ref) => repo),
          authRepositoryProvider.overrideWith((ref) => _SilentAuth()),
          currentUserProvider.overrideWithValue(_me),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: PollComposerSheet(groupId: 'g1'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Enter question
    final textFields = find.byType(TextField);
    expect(textFields, findsNWidgets(3)); // 1 question + 2 default options

    await tester.enterText(textFields.at(0), 'What is the capital of Kerala?');
    // Enter duplicate option values: "Thiruvananthapuram" and " thiruvananthapuram "
    await tester.enterText(textFields.at(1), 'Thiruvananthapuram');
    await tester.enterText(textFields.at(2), ' thiruvananthapuram ');

    // Tap submit button
    await tester.tap(find.text('Create & Send Poll'));
    await tester.pumpAndSettle();

    // Verify error banner is shown
    expect(
      find.text('Duplicate poll options are not allowed. Each option must be unique.'),
      findsOneWidget,
    );
    expect(repo.sentPolls, isEmpty);

    // Fix the duplicate option
    await tester.enterText(textFields.at(2), 'Kochi');
    await tester.tap(find.text('Create & Send Poll'));
    await tester.pumpAndSettle();

    // Verify successful submission
    expect(repo.sentPolls.length, 1);
    expect(repo.sentPolls.first.content, 'What is the capital of Kerala?');
    final pollData = repo.sentPolls.first.metadata?['poll'];
    expect(pollData['options'].length, 2);
    expect(pollData['options'][0]['text'], 'Thiruvananthapuram');
    expect(pollData['options'][1]['text'], 'Kochi');
  });

  testWidgets('Poll button appears in GroupChatScreen and opens PollComposerSheet',
      (tester) async {
    tester.view.physicalSize = const Size(420, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final repo = _TestChatRepo();
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
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
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    // Verify the bar chart / poll button icon is present in the composer
    final pollButton = find.byIcon(Icons.bar_chart_rounded);
    expect(pollButton, findsOneWidget);

    // Tap poll button
    await tester.tap(pollButton);
    await tester.pumpAndSettle();

    // Verify poll composer sheet is open
    expect(find.text('CREATE STUDY POLL / QUESTION'), findsOneWidget);
    expect(find.text('POLL OPTIONS'), findsOneWidget);
    expect(find.text('Mark the correct answer'), findsOneWidget);
  });
}
