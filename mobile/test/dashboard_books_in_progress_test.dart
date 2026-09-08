import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/network/api_client.dart';
import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/providers/auth_controller.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/core/widgets/app_image.dart';
import 'package:psc_tips_tricks_mobile/data/models/dashboard.dart';
import 'package:psc_tips_tricks_mobile/data/models/user.dart';
import 'package:psc_tips_tricks_mobile/data/repositories/dashboard_repository.dart';
import 'package:psc_tips_tricks_mobile/features/dashboard/dashboard_screen.dart';

const _student = User(
  id: 'student-1',
  email: 'student@test.local',
  name: 'Anila',
  role: UserRole.student,
  isPremium: false,
  isSuspended: false,
);

const _hero = 'https://cdn.test/hero-3x4.jpg';
const _catalog = 'https://cdn.test/catalog-16x9.jpg';

class _FakeDashboard extends DashboardRepository {
  _FakeDashboard(this._payload) : super(ApiClient(tokenStore: TokenStore()));

  final StudentDashboard _payload;

  @override
  Future<StudentDashboard> fetchDashboard() async => _payload;
}

BookProgress _book({
  String title = 'PSC Hot Topics',
  String coverUrl = _catalog,
  String? heroCoverUrl = _hero,
  int percent = 4,
  String? topic = 'നവോത്ഥാന നായകർ',
}) =>
    BookProgress(
      bookId: 'b1',
      title: title,
      author: 'PSC',
      coverUrl: coverUrl,
      heroCoverUrl: heroCoverUrl,
      category: 'Kerala PSC',
      progressPercent: percent,
      isCompleted: percent >= 100,
      lastTopicTitle: topic,
    );

StudentDashboard _dashboard(List<BookProgress> books) => StudentDashboard(
      stats: const DashboardStats(
        totalAttempts: 2,
        mockTestsTaken: 0,
        attemptsThisWeek: 0,
        averagePercent: 3.3,
        averagePercentThisWeek: 0,
        averagePercentLastWeek: 0,
        accuracyPercent: 15,
        studyHours: 0.4,
        studyHoursThisWeek: 0,
        passedCount: 0,
        streakDays: 0,
      ),
      trend: const [],
      recentAttempts: const [],
      subjects: const [],
      upcomingMockTests: const [],
      booksInProgress: books,
      inProgressQuizzes: const [],
    );

Future<void> _pump(WidgetTester tester, List<BookProgress> books) async {
  tester.view.physicalSize = const Size(420, 1600);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        currentUserProvider.overrideWithValue(_student),
        dashboardRepositoryProvider
            .overrideWith((ref) => _FakeDashboard(_dashboard(books))),
      ],
      child: MaterialApp(theme: AppTheme.light(), home: const DashboardScreen()),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}

/// The cover image inside the first book row.
AppImage _coverOf(WidgetTester tester) => tester.widget<AppImage>(
      find
          .descendant(
            of: find.byType(DashboardScreen),
            matching: find.byWidgetPredicate(
              (w) => w is AppImage && w.fallbackIcon == Icons.menu_book_rounded,
            ),
          )
          .first,
    );

void main() {
  group('the row shows the book, not its catalog banner', () {
    test('the hero cover wins', () {
      expect(_book().effectiveHeroCoverUrl, _hero);
    });

    test('a book with no hero cover falls back to the catalog one', () {
      expect(_book(heroCoverUrl: null).effectiveHeroCoverUrl, _catalog);
      expect(_book(heroCoverUrl: '   ').effectiveHeroCoverUrl, _catalog);
    });

    test('with neither, there is nothing to show rather than whitespace', () {
      expect(_book(coverUrl: '', heroCoverUrl: null).effectiveHeroCoverUrl, '');
    });

    testWidgets('the row paints the hero cover', (tester) async {
      await _pump(tester, [_book()]);
      expect(_coverOf(tester).url, _hero);
    });

    testWidgets('the row falls back to the catalog cover', (tester) async {
      await _pump(tester, [_book(heroCoverUrl: null)]);
      expect(_coverOf(tester).url, _catalog);
    });

    testWidgets('the cover is portrait, the shape a book actually is',
        (tester) async {
      await _pump(tester, [_book()]);
      final cover = _coverOf(tester);
      expect(cover.height! > cover.width!, isTrue,
          reason: 'a 3:4 hero cover is taller than it is wide');
      expect(cover.height! / cover.width!, closeTo(4 / 3, 0.01));
    });
  });

  group('what each row says', () {
    testWidgets('an unfinished book offers to carry on', (tester) async {
      await _pump(tester, [_book(percent: 4)]);

      expect(find.text('നവോത്ഥാന നായകർ'), findsOneWidget);
      expect(find.text('4%'), findsOneWidget);
      expect(find.byIcon(Icons.play_circle_fill_rounded), findsOneWidget);
      expect(find.byIcon(Icons.replay_rounded), findsNothing);
    });

    testWidgets('a finished book offers to start over', (tester) async {
      await _pump(tester, [_book(title: 'Test Book', percent: 100)]);

      expect(find.text('Finished — read it again'), findsOneWidget);
      expect(find.text('100%'), findsOneWidget);
      expect(find.byIcon(Icons.replay_rounded), findsOneWidget);
      expect(find.byIcon(Icons.play_circle_fill_rounded), findsNothing);
    });

    testWidgets('a book opened but never read still names a starting point',
        (tester) async {
      await _pump(tester, [_book(percent: 0, topic: null)]);
      expect(find.text('Start from the beginning'), findsOneWidget);
    });

    testWidgets('a long title keeps to two lines on a narrow phone',
        (tester) async {
      await _pump(tester, [
        _book(title: 'NEW SCERT BASIC SCIENCE & SOCIAL SCIENCE COMPLETE NOTES'),
      ]);

      expect(tester.takeException(), isNull);
      final title = tester.widget<Text>(
        find.text('NEW SCERT BASIC SCIENCE & SOCIAL SCIENCE COMPLETE NOTES'),
      );
      expect(title.maxLines, 2);
    });

    testWidgets('several books lay out cleanly together', (tester) async {
      await _pump(tester, [
        _book(title: 'One', percent: 1),
        _book(title: 'Two', percent: 4),
        _book(title: 'Three', percent: 100),
      ]);

      expect(tester.takeException(), isNull);
      expect(find.text('One'), findsOneWidget);
      expect(find.text('Three'), findsOneWidget);
    });
  });
}
