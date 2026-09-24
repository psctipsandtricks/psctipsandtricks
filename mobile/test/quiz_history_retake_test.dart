import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/quiz.dart';
import 'package:psc_tips_tricks_mobile/features/quizzes/quiz_history_screen.dart';
import 'package:psc_tips_tricks_mobile/features/quizzes/quizzes_providers.dart';

void main() {
  testWidgets('completed quiz attempts show Retake Quiz button and tapping navigates to attempt',
      (tester) async {
    final completedAttempt = QuizAttempt(
      id: 'att-1',
      quizId: 'quiz-1',
      quizTitle: 'CHAPTER 1 - പിലിയുടെ ഗ്രാമം',
      quizIsPremium: false,
      attemptNumber: 1,
      status: AttemptStatus.completed,
      score: 4,
      totalMarks: 30,
      totalQuestions: 30,
      percentage: 13.33,
      correctAnswers: 4,
      wrongAnswers: 7,
      unattempted: 19,
      timeTakenSeconds: 761,
      submittedAt: DateTime.now().subtract(const Duration(days: 13)),
      passed: false,
    );

    final historyView = QuizHistoryView(
      attempts: [completedAttempt],
      page: 1,
      totalFiltered: 1,
      totalPages: 1,
      lifetimeAttempts: 1,
      lifetimePassed: 0,
      lifetimeAvgPercentage: 13.33,
    );

    bool navigatedToRetake = false;

    final router = GoRouter(
      initialLocation: '/history',
      routes: [
        GoRoute(
          path: '/history',
          builder: (context, state) => const QuizHistoryScreen(),
        ),
        GoRoute(
          path: '/attempt/:id',
          builder: (context, state) {
            navigatedToRetake = state.pathParameters['id'] == 'quiz-1';
            return const Scaffold(body: Text('Attempt Screen'));
          },
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          quizHistoryViewProvider.overrideWithValue(AsyncData(historyView)),
        ],
        child: MaterialApp.router(
          theme: AppTheme.light(),
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('CHAPTER 1 - പിലിയുടെ ഗ്രാമം'), findsOneWidget);
    expect(find.text('Retake Quiz'), findsOneWidget);

    await tester.tap(find.text('Retake Quiz'));
    await tester.pumpAndSettle();

    expect(navigatedToRetake, isTrue);
    expect(find.text('Attempt Screen'), findsOneWidget);
  });
}
