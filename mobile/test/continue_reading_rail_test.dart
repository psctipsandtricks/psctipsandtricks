import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/core/widgets/glass_card.dart';
import 'package:psc_tips_tricks_mobile/data/models/dashboard.dart';
import 'package:psc_tips_tricks_mobile/features/dashboard/dashboard_providers.dart';
import 'package:psc_tips_tricks_mobile/features/home/widgets/continue_reading_rail.dart';

/// The home rail used to render `booksInProgress.first` and drop the rest,
/// while the website showed every one. These pin the carousel to that
/// behaviour: all books present, reachable by swiping, and laid out without
/// overflowing whatever font size the reader has chosen.
void main() {
  BookProgress book(int i, {int percent = 40, bool completed = false}) =>
      BookProgress(
        bookId: 'b$i',
        title: 'Kerala PSC Volume $i',
        author: 'Board',
        coverUrl: '',
        category: 'General',
        progressPercent: percent,
        isCompleted: completed,
        lastTopicTitle: 'Chapter $i · Topic $i',
      );

  StudentDashboard dashboardWith(List<BookProgress> books) => StudentDashboard(
        stats: DashboardStats.fromJson(const {}),
        trend: const [],
        recentAttempts: const [],
        subjects: const [],
        upcomingMockTests: const [],
        booksInProgress: books,
        inProgressQuizzes: const [],
      );

  Future<void> pump(
    WidgetTester tester,
    List<BookProgress> books, {
    Size size = const Size(390, 844),
    double textScale = 1.0,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        dashboardProvider.overrideWith((ref) async => dashboardWith(books)),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: MediaQuery(
          data: MediaQueryData(
            size: size,
            textScaler: TextScaler.linear(textScale),
          ),
          child: const Scaffold(
            body: SingleChildScrollView(child: ContinueReadingRail()),
          ),
        ),
      ),
    ));
    await tester.pump();
  }

  testWidgets('every started book is in the rail, not just the newest',
      (tester) async {
    await pump(tester, [for (var i = 1; i <= 5; i++) book(i)]);

    // Off-screen cards are built lazily, so the count comes from the list
    // itself rather than from how many happen to be painted.
    final list = tester.widget<ListView>(find.byType(ListView));
    expect(list.semanticChildCount, 5);

    expect(find.text('Continue reading'), findsOneWidget);
    expect(find.text('5 books in progress'), findsOneWidget);
    expect(find.text('Kerala PSC Volume 1'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('swiping horizontally reaches the books further down the list',
      (tester) async {
    await pump(tester, [for (var i = 1; i <= 5; i++) book(i)]);

    expect(find.text('Kerala PSC Volume 5'), findsNothing);

    await tester.fling(find.byType(ListView), const Offset(-1200, 0), 900);
    await tester.pumpAndSettle();

    expect(find.text('Kerala PSC Volume 5'), findsOneWidget);
    expect(find.text('Kerala PSC Volume 1'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a lone book fills the width and does not scroll', (tester) async {
    await pump(tester, [book(1)]);

    final list = tester.widget<ListView>(find.byType(ListView));
    expect(list.physics, isA<NeverScrollableScrollPhysics>());
    // No count subtitle when there is nothing to count through.
    expect(find.textContaining('in progress'), findsNothing);

    // Full bleed inside the rail's 16px gutters, rather than the 82% width
    // that leaves the next card peeking.
    expect(tester.getSize(find.byType(GlassCard)).width, 390 - 32);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a long title still gets its two lines on a rail-width card',
      (tester) async {
    await pump(tester, [
      const BookProgress(
        bookId: 'b1',
        title: 'Kerala Renaissance and the Social Reform Movements of the '
            'Nineteenth Century',
        author: 'Board',
        coverUrl: '',
        category: 'History',
        progressPercent: 30,
        isCompleted: false,
      ),
      book(2),
    ]);

    // The rail budgets height for two lines; if the Flexible safety net were
    // taking over at ordinary text sizes, this would come back one line tall.
    final title = find.textContaining('Kerala Renaissance');
    final lineHeight = tester.renderObject<RenderBox>(
      find.text('Chapter 2 · Topic 2'),
    ).size.height;
    expect(tester.getSize(title).height, greaterThan(lineHeight * 1.8));
    expect(tester.takeException(), isNull);
  });

  testWidgets('the card lays out cleanly at the largest text sizes',
      (tester) async {
    // The rail has to be given an explicit height, so an under-estimate shows
    // up here as a RenderFlex overflow rather than in a bug report.
    for (final scale in [1.0, 1.3, 1.6, 2.0]) {
      await pump(
        tester,
        [book(1, percent: 100, completed: true), book(2)],
        textScale: scale,
      );
      expect(tester.takeException(), isNull, reason: 'text scale $scale');
    }
  });

  testWidgets('a narrow phone and a tablet both lay out cleanly',
      (tester) async {
    for (final size in [const Size(320, 640), const Size(1024, 1366)]) {
      await pump(tester, [for (var i = 1; i <= 4; i++) book(i)], size: size);
      expect(tester.takeException(), isNull, reason: 'screen $size');
    }
  });
}
