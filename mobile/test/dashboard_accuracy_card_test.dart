import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/network/api_client.dart';
import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/providers/auth_controller.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
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

class _FakeDashboard extends DashboardRepository {
  _FakeDashboard(this._payload) : super(ApiClient(tokenStore: TokenStore()));

  final StudentDashboard _payload;

  @override
  Future<StudentDashboard> fetchDashboard() async => _payload;
}

StudentDashboard _dashboard({
  required int streakDays,
  double accuracy = 15,
  int passed = 0,
  int attempts = 2,
  List<SubjectPerformance> subjects = const [],
}) =>
    StudentDashboard(
      stats: DashboardStats(
        totalAttempts: attempts,
        mockTestsTaken: 0,
        attemptsThisWeek: attempts,
        averagePercent: 3.3,
        averagePercentThisWeek: 3.3,
        averagePercentLastWeek: 0,
        accuracyPercent: accuracy,
        studyHours: 0.4,
        studyHoursThisWeek: 0.4,
        passedCount: passed,
        streakDays: streakDays,
      ),
      trend: const [],
      recentAttempts: const [],
      subjects: subjects,
      upcomingMockTests: const [],
      booksInProgress: const [],
      inProgressQuizzes: const [],
    );

Future<void> _pump(WidgetTester tester, StudentDashboard payload) async {
  // A tall viewport so the whole card is laid out; the dashboard is a long
  // scrolling list and finders skip what was never built.
  tester.view.physicalSize = const Size(420, 1400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        currentUserProvider.overrideWithValue(_student),
        dashboardRepositoryProvider.overrideWith((ref) => _FakeDashboard(payload)),
      ],
      child: MaterialApp(theme: AppTheme.light(), home: const DashboardScreen()),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  testWidgets('the card shows accuracy, pass rate and the study streak',
      (tester) async {
    await _pump(
      tester,
      _dashboard(streakDays: 4, accuracy: 15, passed: 0, attempts: 2),
    );

    expect(find.text('Overall accuracy'), findsOneWidget);
    expect(find.text('15%'), findsOneWidget);
    expect(find.text('ACCURACY'), findsOneWidget);
    expect(find.text('PASS RATE'), findsOneWidget);
    expect(find.text('(0/2)'), findsOneWidget);
    expect(find.text('STUDY STREAK'), findsOneWidget);
    expect(find.text('4 days'), findsOneWidget);
  });

  testWidgets('one day reads as a day, not days', (tester) async {
    await _pump(tester, _dashboard(streakDays: 1));
    expect(find.text('1 day'), findsOneWidget);
  });

  testWidgets('a broken streak still reads as zero days', (tester) async {
    await _pump(tester, _dashboard(streakDays: 0));
    expect(find.text('0 days'), findsOneWidget);
  });

  testWidgets('strongest subjects are listed inside the card, once',
      (tester) async {
    await _pump(
      tester,
      _dashboard(
        streakDays: 2,
        subjects: const [
          SubjectPerformance(category: 'Quiz', attempts: 2, averagePercent: 3.3),
        ],
      ),
    );

    expect(find.text('STRONGEST SUBJECTS'), findsOneWidget);
    // The standalone "Subject strengths" section was removed when the card
    // took the bars over — the same list twice is only noise on a phone.
    expect(find.text('Subject strengths'), findsNothing);
    expect(find.text('Quiz'), findsOneWidget);
    expect(find.text('3.3%'), findsOneWidget);
    expect(find.text('(2)'), findsOneWidget);
  });

  testWidgets('accuracy and the streak are not also repeated as tiles',
      (tester) async {
    await _pump(tester, _dashboard(streakDays: 4));

    expect(find.text('Day streak'), findsNothing);
    expect(find.text('Accuracy'), findsNothing);
    // What the tiles still carry.
    expect(find.text('Average score'), findsOneWidget);
    expect(find.text('Attempts'), findsOneWidget);
  });
}
