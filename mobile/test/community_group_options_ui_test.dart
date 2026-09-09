import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/network/api_client.dart';
import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/chat.dart';
import 'package:psc_tips_tricks_mobile/data/repositories/chat_repository.dart';
import 'package:psc_tips_tricks_mobile/features/community/community_providers.dart';
import 'package:psc_tips_tricks_mobile/features/community/community_screen.dart';

/// Records what the row's menu actually asked the server to do.
class _RecordingChat extends ChatRepository {
  _RecordingChat() : super(ApiClient(tokenStore: TokenStore()));

  final muted = <({String groupId, bool muted})>[];
  final left = <String>[];
  final pinned = <({String groupId, bool pinned})>[];

  @override
  Future<void> setMuted(String groupId, bool muted) async {
    this.muted.add((groupId: groupId, muted: muted));
  }

  @override
  Future<void> leave(String groupId) async => left.add(groupId);

  @override
  Future<void> setPinned(String groupId, bool pinned) async {
    this.pinned.add((groupId: groupId, pinned: pinned));
  }
}

void main() {
  ChatGroup aGroup({
    bool isJoined = true,
    bool isMuted = false,
    bool isPinned = false,
  }) =>
      ChatGroup(
        id: 'g1',
        name: 'Kerala PSC LDC 2026',
        description: 'Daily practice and doubts',
        category: 'Kerala PSC',
        iconEmoji: '💬',
        isLocked: false,
        allowTextMessages: true,
        allowPolls: true,
        memberCount: 240,
        isJoined: isJoined,
        isPinned: isPinned,
        isMuted: isMuted,
        unreadCount: 0,
      );

  Future<_RecordingChat> pump(WidgetTester tester, ChatGroup g) async {
    tester.view.physicalSize = const Size(420, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final repo = _RecordingChat();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        chatRepositoryProvider.overrideWith((ref) => repo),
        chatGroupsProvider.overrideWith((ref) async => [g]),
        cachedChatGroupsProvider.overrideWith((ref) async => <ChatGroup>[]),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const CommunityScreen(),
      ),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    return repo;
  }

  /// Opens the row's menu through the visible control, not a hidden gesture.
  Future<void> openMenu(WidgetTester tester) async {
    await tester.tap(find.bySemanticsLabel('Group options'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  group('a joined group offers its options', () {
    testWidgets('the row carries a visible control, not just a long press',
        (tester) async {
      // The regression this exists for: the menu was reachable only by holding
      // down a row, which is an option nobody can be expected to find.
      await pump(tester, aGroup());

      expect(find.bySemanticsLabel('Group options'), findsOneWidget);
    });

    testWidgets('it opens Mute Notifications and Leave Group', (tester) async {
      await pump(tester, aGroup());
      await openMenu(tester);

      expect(find.text('Mute Notifications'), findsOneWidget);
      expect(find.text('Leave Group'), findsOneWidget);
    });

    testWidgets('Mute Notifications silences the group', (tester) async {
      final repo = await pump(tester, aGroup());
      await openMenu(tester);
      await tester.tap(find.text('Mute Notifications'));
      await tester.pump(const Duration(milliseconds: 400));

      expect(repo.muted, [(groupId: 'g1', muted: true)]);
    });

    testWidgets('an already-muted group is offered the way back',
        (tester) async {
      final repo = await pump(tester, aGroup(isMuted: true));
      await openMenu(tester);

      expect(find.text('Unmute Notifications'), findsOneWidget);
      await tester.tap(find.text('Unmute Notifications'));
      await tester.pump(const Duration(milliseconds: 400));

      expect(repo.muted, [(groupId: 'g1', muted: false)]);
    });

    testWidgets('a muted group says so on its row', (tester) async {
      // Otherwise muting is invisible once done: the group simply goes quiet,
      // which looks the same as nobody posting.
      await pump(tester, aGroup(isMuted: true));

      expect(find.byIcon(Icons.notifications_off_rounded), findsOneWidget);
    });

    testWidgets('Leave Group asks before it does it', (tester) async {
      final repo = await pump(tester, aGroup());
      await openMenu(tester);
      await tester.tap(find.text('Leave Group'));
      await tester.pump(const Duration(milliseconds: 400));

      // Nothing has happened yet — leaving cannot be undone without rejoining.
      expect(repo.left, isEmpty);
      expect(find.text('Leave this group?'), findsOneWidget);

      await tester.tap(find.widgetWithText(TextButton, 'Leave'));
      await tester.pump(const Duration(milliseconds: 400));

      expect(repo.left, ['g1']);
    });

    testWidgets('leaving a pinned group automatically unpins it', (tester) async {
      final repo = await pump(tester, aGroup(isPinned: true));
      await openMenu(tester);
      await tester.tap(find.text('Leave Group'));
      await tester.pump(const Duration(milliseconds: 400));

      expect(repo.left, isEmpty);
      expect(repo.pinned, isEmpty);

      await tester.tap(find.widgetWithText(TextButton, 'Leave'));
      await tester.pump(const Duration(milliseconds: 400));

      expect(repo.pinned, [(groupId: 'g1', pinned: false)]);
      expect(repo.left, ['g1']);
    });

    testWidgets('backing out of Leave keeps the membership', (tester) async {
      final repo = await pump(tester, aGroup());
      await openMenu(tester);
      await tester.tap(find.text('Leave Group'));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pump(const Duration(milliseconds: 400));

      expect(repo.left, isEmpty);
    });

    testWidgets('Pin Group is there too', (tester) async {
      final repo = await pump(tester, aGroup());
      await openMenu(tester);
      await tester.tap(find.text('Pin Group'));
      await tester.pump(const Duration(milliseconds: 400));

      expect(repo.pinned, [(groupId: 'g1', pinned: true)]);
    });
  });

  group('a group the student has not joined', () {
    testWidgets('offers no options — there is nothing to mute or leave',
        (tester) async {
      await pump(tester, aGroup(isJoined: false));

      expect(find.bySemanticsLabel('Group options'), findsNothing);
    });
  });
}
