import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/router/notification_destination.dart';
import 'package:psc_tips_tricks_mobile/data/models/notification.dart';
import 'package:psc_tips_tricks_mobile/features/notifications/notifications_screen.dart';

void main() {
  group('notification destination', () {
    test('accepts the routes this app actually has', () {
      for (final route in [
        '/',
        '/books',
        '/books/9f2c-abc',
        '/books/9f2c-abc/read',
        '/quizzes',
        '/attempt/xyz',
        '/mock-tests',
        '/mock-tests/m1',
        '/library',
        '/library/videos/v1',
        '/library/pdfs/p1',
        '/community/g1',
        '/dashboard',
        '/orders',
        '/notifications',
      ]) {
        expect(resolveNotificationDestination(route)?.location, route,
            reason: '$route should be openable');
      }
    });

    test('adds the leading slash the admin panel often omits', () {
      expect(resolveNotificationDestination('books/9f2c')?.location, '/books/9f2c');
    });

    test('keeps query parameters the destination carries', () {
      final d = resolveNotificationDestination('/books/9f2c/read?resume=1');
      expect(d?.location, '/books/9f2c/read?resume=1');
    });

    test('rejects anything this build cannot open', () {
      // Null is the signal to fall back to the notification list.
      for (final route in [
        '',
        '   ',
        '/books/9f2c/nonsense',
        '/admin/notifications',
        '/nope',
        'randomtext',
        '/attempt',
        '/library/videos',
      ]) {
        expect(resolveNotificationDestination(route), isNull,
            reason: '$route should not be opened');
      }
      expect(resolveNotificationDestination(null), isNull);
    });

    test('passes http links through for the browser', () {
      final d = resolveNotificationDestination('https://psctipsandtricks.com/offer');
      expect(d?.isExternal, isTrue);
      expect(d?.externalUrl.toString(), 'https://psctipsandtricks.com/offer');
      // A scheme with nothing after it is not a link.
      expect(resolveNotificationDestination('https://'), isNull);
    });
  });

  group('unread badge count', () {
    AppNotification n(String id, {bool isRead = false}) =>
        AppNotification(id: id, title: id, body: '', isRead: isRead);

    test('counts what neither side has marked read', () {
      expect(countUnread([n('a'), n('b'), n('c')], const {}), 3);
    });

    test('discounts server-read and device-read alike', () {
      final all = [n('a', isRead: true), n('b'), n('c')];
      expect(countUnread(all, const {}), 2);
      // 'b' read on this device — a broadcast, say — leaves only 'c'.
      expect(countUnread(all, const {'b'}), 1);
      expect(countUnread(all, const {'b', 'c'}), 0);
    });

    test('is zero with nothing to show', () {
      expect(countUnread(const [], const {}), 0);
    });
  });

  group('student-side 7 day rule', () {
    AppNotification at(String id, {required int daysAgo, bool isRead = false}) =>
        AppNotification(
          id: id,
          title: id,
          body: '',
          isRead: isRead,
          createdAt: DateTime(2026, 8, 29).subtract(Duration(days: daysAgo)),
        );

    final now = DateTime(2026, 8, 29);

    test('hides read notifications older than a week', () {
      final visible = visibleNotifications(
        [at('old-read', daysAgo: 8, isRead: true)],
        locallyRead: const {},
        now: now,
      );
      expect(visible, isEmpty);
    });

    test('keeps unread ones however old they are', () {
      final visible = visibleNotifications(
        [at('ancient-unread', daysAgo: 400)],
        locallyRead: const {},
        now: now,
      );
      expect(visible.single.id, 'ancient-unread');
    });

    test('keeps read ones inside the week', () {
      final visible = visibleNotifications(
        [at('recent-read', daysAgo: 6, isRead: true)],
        locallyRead: const {},
        now: now,
      );
      expect(visible.single.id, 'recent-read');
    });

    test('counts an on-device read the same as a server one', () {
      // Broadcasts are only ever marked read on the device.
      final visible = visibleNotifications(
        [at('broadcast', daysAgo: 30)],
        locallyRead: const {'broadcast'},
        now: now,
      );
      expect(visible, isEmpty);
    });

    test('returns newest first', () {
      final visible = visibleNotifications(
        [at('older', daysAgo: 3), at('newest', daysAgo: 1), at('middle', daysAgo: 2)],
        locallyRead: const {},
        now: now,
      );
      expect(visible.map((n) => n.id), ['newest', 'middle', 'older']);
    });

    test('keeps an undated notification rather than judging it old', () {
      const undated = AppNotification(id: 'u', title: 'u', body: '', isRead: true);
      final visible =
          visibleNotifications([undated], locallyRead: const {}, now: now);
      expect(visible.single.id, 'u');
    });
  });
}
