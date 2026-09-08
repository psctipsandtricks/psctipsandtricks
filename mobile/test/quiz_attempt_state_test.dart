import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/quiz.dart';
import 'package:psc_tips_tricks_mobile/features/quizzes/widgets/quiz_card.dart';

QuizAttemptSummary _summary({int completed = 0, String? inProgress}) =>
    QuizAttemptSummary(
      quizId: 'q1',
      completedCount: completed,
      inProgressAttemptId: inProgress,
    );

Quiz _quiz() => const Quiz(
      id: 'q1',
      title: 'Kerala Renaissance',
      totalQuestions: 20,
      durationMinutes: 20,
      isLiveMock: false,
      isPremium: false,
      price: 0,
      passingMarks: 40,
      totalMarks: 20,
      negativeMarking: NegativeMarking.disabled,
      showCorrectAnswerAfterSelection: false,
    );

Future<void> _pumpCard(WidgetTester tester, QuizAttemptSummary? attempt) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: 320,
            child: QuizCard(quiz: _quiz(), attempt: attempt, width: 320),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  group('an attempt only counts once it is submitted', () {
    test('a quiz never opened offers Start and counts nothing', () {
      final state = _summary();
      expect(state.canResume, isFalse);
      expect(state.hasCompleted, isFalse);
      expect(state.actionLabel, 'Start');
    });

    test('an unfinished attempt is not a completed attempt', () {
      // Opened, walked away from, never submitted. The count stays at zero —
      // this is the whole rule.
      final state = _summary(inProgress: 'a1');
      expect(state.completedCount, 0);
      expect(state.canResume, isTrue);
      expect(state.actionLabel, 'Resume');
    });

    test('a submitted attempt counts, and leaves nothing to resume', () {
      final state = _summary(completed: 1);
      expect(state.canResume, isFalse);
      expect(state.hasCompleted, isTrue);
      expect(state.actionLabel, 'Retake');
    });

    test('every submitted attempt adds one', () {
      expect(_summary(completed: 3).completedCount, 3);
    });

    test('an unfinished attempt outranks past completed ones', () {
      // Retaken and walked away from again: what to offer is the way back in,
      // not a third fresh run.
      final state = _summary(completed: 2, inProgress: 'a3');
      expect(state.actionLabel, 'Resume');
      expect(state.completedCount, 2);
    });

    test('an empty in-progress id is nothing to resume', () {
      expect(_summary(inProgress: '').canResume, isFalse);
    });

    test('the API payload is read as written', () {
      final parsed = QuizAttemptSummary.fromJson(const {
        'quizId': 'q1',
        'completedCount': 2,
        'inProgressAttemptId': 'a9',
        'lastSubmittedAt': '2026-09-08T10:00:00.000Z',
      });
      expect(parsed.quizId, 'q1');
      expect(parsed.completedCount, 2);
      expect(parsed.inProgressAttemptId, 'a9');
      expect(parsed.lastSubmittedAt, isNotNull);
    });

    test('a payload with no attempt data reads as untouched', () {
      final parsed = QuizAttemptSummary.fromJson(const {'quizId': 'q1'});
      expect(parsed.completedCount, 0);
      expect(parsed.canResume, isFalse);
      expect(parsed.actionLabel, 'Start');
    });
  });

  group('what the card offers', () {
    testWidgets('never opened: Start, and no attempt line', (tester) async {
      await _pumpCard(tester, null);

      expect(find.text('Start'), findsOneWidget);
      expect(find.text('Resume'), findsNothing);
      expect(find.text('Retake'), findsNothing);
      expect(find.text('In progress'), findsNothing);
    });

    testWidgets('left unfinished: Resume, marked in progress', (tester) async {
      await _pumpCard(tester, _summary(inProgress: 'a1'));

      expect(find.text('Resume'), findsOneWidget);
      expect(find.text('In progress'), findsOneWidget);
      // Nothing has been completed, so no count is claimed.
      expect(find.textContaining('attempt'), findsNothing);
    });

    testWidgets('submitted once: Retake, and the count says so',
        (tester) async {
      await _pumpCard(tester, _summary(completed: 1));

      expect(find.text('Retake'), findsOneWidget);
      expect(find.text('1 attempt'), findsOneWidget);
      expect(find.text('In progress'), findsNothing);
    });

    testWidgets('submitted three times: the count is plural', (tester) async {
      await _pumpCard(tester, _summary(completed: 3));
      expect(find.text('3 attempts'), findsOneWidget);
    });

    testWidgets('completed and then left unfinished again: Resume wins',
        (tester) async {
      await _pumpCard(tester, _summary(completed: 2, inProgress: 'a3'));

      expect(find.text('Resume'), findsOneWidget);
      expect(find.text('In progress'), findsOneWidget);
      expect(find.text('2 attempts'), findsNothing);
    });
  });
}
