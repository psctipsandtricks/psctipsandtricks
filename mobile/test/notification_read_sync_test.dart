import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:psc_tips_tricks_mobile/core/network/api_client.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:psc_tips_tricks_mobile/data/models/notification.dart';
import 'package:psc_tips_tricks_mobile/data/repositories/notifications_repository.dart';
import 'package:psc_tips_tricks_mobile/features/notifications/notifications_screen.dart';
import 'package:psc_tips_tricks_mobile/features/notifications/read_notifications.dart';

/// Records what the app told the server, which is the half of the
/// synchronisation this side is responsible for.
class _FakeNotifications extends NotificationsRepository {
  _FakeNotifications() : super(ApiClient(tokenStore: TokenStore()));

  final List<String> marked = [];
  final List<List<String>> bulkMarked = [];
  Object? failWith;

  @override
  Future<void> markRead(String id) async {
    if (failWith != null) throw failWith!;
    marked.add(id);
  }

  @override
  Future<void> markManyRead(List<String> ids) async {
    if (failWith != null) throw failWith!;
    bulkMarked.add(ids);
  }
}

void main() {
  late _FakeNotifications repo;

  Future<ReadNotificationsController> controller({
    String? userId = 'student-1',
    List<String> alreadyRead = const [],
    bool alreadySynced = false,
  }) async {
    SharedPreferences.setMockInitialValues({
      if (alreadyRead.isNotEmpty)
        'psc_read_notifications_${userId ?? 'guest'}': alreadyRead,
      if (alreadySynced)
        'psc_read_notifications_synced_${userId ?? 'guest'}': true,
    });
    final prefs = await SharedPreferences.getInstance();
    repo = _FakeNotifications();
    return ReadNotificationsController(prefs, userId, repo);
  }

  group('marking read reaches the server', () {
    test('a broadcast is reported too, not just a targeted notice', () async {
      final c = await controller();
      // A broadcast has no userId, and used to be remembered only on the
      // device — which is exactly what left the website disagreeing.
      c.markRead('broadcast-1');
      await Future<void>.delayed(Duration.zero);

      expect(repo.marked, ['broadcast-1']);
      expect(c.contains('broadcast-1'), isTrue);
    });

    test('a notice already known here is still reported', () async {
      final c = await controller(alreadyRead: ['n1'], alreadySynced: true);
      c.markRead('n1');
      await Future<void>.delayed(Duration.zero);

      // The device already knew, but another device may not.
      expect(repo.marked, ['n1']);
    });

    test('a failed report leaves the notice read on this device', () async {
      final c = await controller(alreadySynced: true);
      repo.failWith = Exception('offline');
      c.markRead('n1');
      await Future<void>.delayed(Duration.zero);

      // Read state is never worth interrupting anyone for.
      expect(c.contains('n1'), isTrue);
    });
  });

  group('the read state this device already had is handed over', () {
    test('existing ids are uploaded once', () async {
      final c = await controller(alreadyRead: ['a', 'b']);
      await Future<void>.delayed(Duration.zero);

      expect(repo.bulkMarked, [
        ['a', 'b']
      ]);
      expect(c.state, {'a', 'b'});

      // A second controller for the same student — a sign-out and back in, or
      // the next launch — does not re-upload.
      final prefs = await SharedPreferences.getInstance();
      final again = _FakeNotifications();
      ReadNotificationsController(prefs, 'student-1', again);
      await Future<void>.delayed(Duration.zero);
      expect(again.bulkMarked, isEmpty);
    });

    test('a failed upload is retried on the next launch', () async {
      SharedPreferences.setMockInitialValues({
        'psc_read_notifications_student-1': ['a'],
      });
      final prefs = await SharedPreferences.getInstance();
      final failing = _FakeNotifications()..failWith = Exception('offline');
      ReadNotificationsController(prefs, 'student-1', failing);
      await Future<void>.delayed(Duration.zero);

      final retry = _FakeNotifications();
      ReadNotificationsController(prefs, 'student-1', retry);
      await Future<void>.delayed(Duration.zero);
      expect(retry.bulkMarked, [
        ['a']
      ]);
    });

    test('a signed-out device has nobody to sync for', () async {
      await controller(userId: null, alreadyRead: ['a']);
      await Future<void>.delayed(Duration.zero);

      expect(repo.bulkMarked, isEmpty);
    });
  });

  group('the server answer decides what is unread', () {
    AppNotification n(String id, {bool isRead = false}) =>
        AppNotification(id: id, title: id, body: '', isRead: isRead);

    test('a broadcast read on the website comes back read here', () {
      // The server now answers `isRead` per student for broadcasts as well, so
      // this device does not need its own record to stop showing a badge.
      expect(countUnread([n('a', isRead: true), n('b')], const {}), 1);
    });

    test('a notice read here is not shown unread while the server catches up',
        () {
      expect(countUnread([n('a'), n('b')], const {'a'}), 1);
    });
  });
}
