import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/notification.dart';
import 'package:psc_tips_tricks_mobile/features/home/home_providers.dart';
import 'package:psc_tips_tricks_mobile/features/home/widgets/announcements_section.dart';

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

  Future<ProviderContainer> pump(WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(overrides: [
      sharedPrefsProvider.overrideWithValue(prefs),
      activeAnnouncementsProvider.overrideWith((ref) async => items),
    ]);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const Scaffold(
          body: SingleChildScrollView(child: AnnouncementsSection()),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    return container;
  }

  testWidgets('shows one announcement, with its action button', (tester) async {
    await pump(tester);
    expect(find.textContaining('Exam calendar released'), findsOneWidget);
    expect(find.text('Second notice'), findsNothing);
    expect(find.text('View calendar'), findsOneWidget);
    expect(find.text('+1 more'), findsOneWidget);
  });

  testWidgets('closing advances to the next and remembers the dismissal',
      (tester) async {
    final container = await pump(tester);
    await tester.tap(find.byTooltip('Dismiss'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Exam calendar released'), findsNothing);
    expect(find.text('Second notice'), findsOneWidget);
    expect(container.read(seenAnnouncementsProvider), {'a1'});

    await tester.tap(find.byTooltip('Dismiss'));
    await tester.pumpAndSettle();
    expect(find.text('Second notice'), findsNothing);
    expect(
      container.read(sharedPrefsProvider).getStringList(
          'psc_seen_announcements'),
      ['a1', 'a2'],
    );
  });

  testWidgets('fits a narrow phone with long copy', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await pump(tester);
    expect(tester.takeException(), isNull);
  });

  testWidgets('opening a card marks it seen and queues the next',
      (tester) async {
    await pump(tester);
    await tester.tap(find.textContaining('Exam calendar released'));
    await tester.pumpAndSettle();

    // Full copy in the sheet, next announcement already on the page behind it.
    expect(find.text('ANNOUNCEMENT'), findsWidgets);
    expect(find.text('Second notice'), findsOneWidget);
  });
}
