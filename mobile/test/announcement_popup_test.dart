import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/providers/auth_controller.dart';
import 'package:psc_tips_tricks_mobile/core/router/app_router.dart';
import 'package:psc_tips_tricks_mobile/data/models/user.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/notification.dart';
import 'package:psc_tips_tricks_mobile/features/announcements/announcement_popup.dart';
import 'package:psc_tips_tricks_mobile/features/announcements/announcement_providers.dart';

void main() {
  const items = [
    AnnouncementPopup(
      id: 'a1',
      title: 'Exam calendar released for the 2026 recruitment cycle',
      message: 'The 2026 calendar is out, with dates for every notification '
          'the commission has published so far.',
      buttonText: 'View calendar',
      redirectUrl: '/books',
      backgroundColor: '#F59E0B',
    ),
    AnnouncementPopup(id: 'a2', title: 'Second notice', message: 'Next up.'),
  ];

  /// A two-screen router, so the CTA has somewhere real to land and the test
  /// can read back where the student ended up.
  GoRouter buildRouter({String initialLocation = '/'}) => GoRouter(
        initialLocation: initialLocation,
        routes: [
          GoRoute(
            path: '/',
            builder: (_, __) => const Scaffold(body: Text('Home screen')),
          ),
          GoRoute(
            path: '/books',
            builder: (_, __) => const Scaffold(body: Text('Books screen')),
            routes: [
              GoRoute(
                path: ':id/read',
                builder: (_, __) => const Scaffold(body: Text('Reader')),
              ),
            ],
          ),
        ],
      );

  Future<ProviderContainer> pump(
    WidgetTester tester, {
    List<AnnouncementPopup> announcements = items,
    String initialLocation = '/',
    Map<String, Object> storage = const {},
    User? user,
  }) async {
    SharedPreferences.setMockInitialValues(storage);
    final prefs = await SharedPreferences.getInstance();

    final container = ProviderContainer(overrides: [
      sharedPrefsProvider.overrideWithValue(prefs),
      currentUserProvider.overrideWith((ref) => user),
      routerProvider
          .overrideWith((ref) => buildRouter(initialLocation: initialLocation)),
      activeAnnouncementsProvider.overrideWith((ref) async => announcements),
    ]);
    addTearDown(container.dispose);

    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        theme: AppTheme.light(),
        routerConfig: container.read(routerProvider),
        builder: (context, child) => AnnouncementPopupHost(
          child: child ?? const SizedBox.shrink(),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    return container;
  }

  testWidgets('opens the first announcement over the app, with its action',
      (tester) async {
    await pump(tester);

    expect(find.textContaining('Exam calendar released'), findsOneWidget);
    expect(find.text('View calendar'), findsOneWidget);
    // One at a time: the second notice waits its turn.
    expect(find.text('Second notice'), findsNothing);
    // The app is still there, behind the blur.
    expect(find.text('Home screen'), findsOneWidget);
  });

  testWidgets('closing advances to the next, then leaves the app alone',
      (tester) async {
    final container = await pump(tester);

    await tester.tap(find.byTooltip('Close'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Exam calendar released'), findsNothing);
    expect(find.text('Second notice'), findsOneWidget);
    expect(container.read(dismissedAnnouncementsProvider), {'a1'});

    await tester.tap(find.byTooltip('Close'));
    await tester.pumpAndSettle();

    expect(find.text('Second notice'), findsNothing);
    expect(container.read(pendingAnnouncementsProvider), isEmpty);
    expect(find.text('Home screen'), findsOneWidget);
  });

  testWidgets('the CTA navigates and does not leave a popup behind',
      (tester) async {
    final container = await pump(tester);

    await tester.tap(find.text('View calendar'));
    await tester.pumpAndSettle();

    expect(find.text('Books screen'), findsOneWidget);
    // The card that sent them there is gone; the queue carries on with the
    // next one on top of the destination, not a second copy of the first.
    expect(find.textContaining('Exam calendar released'), findsNothing);
    expect(find.text('Second notice'), findsOneWidget);
    expect(container.read(dismissedAnnouncementsProvider), {'a1'});
  });

  testWidgets('an announcement with no link shows no action button',
      (tester) async {
    await pump(tester, announcements: [items[1]]);

    expect(find.text('Second notice'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_forward_rounded), findsNothing);
  });

  testWidgets('fits a narrow phone with long copy', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await pump(tester);
    expect(tester.takeException(), isNull);
  });

  testWidgets('waits rather than covering a book the student is reading',
      (tester) async {
    final container = await pump(tester, initialLocation: '/books/x/read');

    expect(find.text('Reader'), findsOneWidget);
    expect(find.byTooltip('Close'), findsNothing);
    // Nothing was consumed while it waited.
    expect(container.read(pendingAnnouncementsProvider), hasLength(2));

    // Leaving the reader is the cue to show it.
    container.read(routerProvider).go('/');
    await tester.pumpAndSettle();
    expect(find.textContaining('Exam calendar released'), findsOneWidget);
  });

  group('shown once, then never again', () {
    const buyer = User(
      id: 'u1',
      email: 'student@test.local',
      name: 'Student',
      role: UserRole.student,
      isPremium: false,
      isSuspended: false,
    );

    testWidgets('an announcement closed on a previous launch stays closed',
        (tester) async {
      // What a device looks like after the student has already met 'a1'.
      await pump(
        tester,
        user: buyer,
        storage: const {'psc_seen_announcements:u1': ['a1']},
      );

      expect(find.textContaining('Exam calendar released'), findsNothing);
      // The one they have not seen still opens.
      expect(find.text('Second notice'), findsOneWidget);
    });

    testWidgets('closing one writes it to disk under that account',
        (tester) async {
      final container = await pump(tester, user: buyer);

      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();

      expect(
        container.read(sharedPrefsProvider).getStringList(
              'psc_seen_announcements:u1',
            ),
        ['a1'],
      );
    });

    testWidgets('a new announcement still gets through', (tester) async {
      await pump(
        tester,
        user: buyer,
        // Both of the old ones are seen; only the new one should open.
        storage: const {
          'psc_seen_announcements:u1': ['a1', 'a2'],
        },
        announcements: const [
          ...items,
          AnnouncementPopup(
            id: 'a3',
            title: 'Newly published',
            message: 'Just went out.',
          ),
        ],
      );

      expect(find.text('Newly published'), findsOneWidget);
    });

    testWidgets('one student on a shared phone does not silence another',
        (tester) async {
      await pump(
        tester,
        user: const User(
          id: 'u2',
          email: 'other@test.local',
          name: 'Other',
          role: UserRole.student,
          isPremium: false,
          isSuspended: false,
        ),
        storage: const {'psc_seen_announcements:u1': ['a1', 'a2']},
      );

      // u1 dismissed both; u2 has seen nothing.
      expect(find.textContaining('Exam calendar released'), findsOneWidget);
    });

    testWidgets('what a guest read is not replayed once they sign in',
        (tester) async {
      await pump(
        tester,
        user: buyer,
        storage: const {'psc_seen_announcements:guest': ['a1']},
      );

      expect(find.textContaining('Exam calendar released'), findsNothing);
      expect(find.text('Second notice'), findsOneWidget);
    });
  });

  testWidgets('nothing to show leaves the app untouched', (tester) async {
    await pump(tester, announcements: const []);

    expect(find.text('Home screen'), findsOneWidget);
    expect(find.byTooltip('Close'), findsNothing);
  });
}
