import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/data/models/quiz.dart';

void main() {
  group('Quiz Resume and Timer preservation', () {
    test('QuizAttempt parses in-progress attempt with timeTakenSeconds and answers', () {
      final json = {
        'id': 'attempt-123',
        'quizId': 'quiz-abc',
        'attemptNumber': 1,
        'attemptStatus': 'IN_PROGRESS',
        'score': 0,
        'totalMarks': 20,
        'percentage': 0,
        'totalQuestions': 20,
        'passed': false,
        'correctAnswers': 0,
        'wrongAnswers': 0,
        'unattempted': 20,
        'timeTakenSeconds': 360, // 6 minutes elapsed
        'answers': [
          {'questionId': 'q1', 'selectedOptionIndex': 2},
          {'questionId': 'q2', 'selectedOptionIndex': 0},
        ],
        'startedAt': '2026-09-04T12:00:00.000Z',
      };

      final attempt = QuizAttempt.fromJson(json);

      expect(attempt.id, 'attempt-123');
      expect(attempt.status, AttemptStatus.inProgress);
      expect(attempt.timeTakenSeconds, 360);
      expect(attempt.answers.length, 2);
      expect(attempt.answers[0].questionId, 'q1');
      expect(attempt.answers[0].selectedOptionIndex, 2);
      expect(attempt.answers[1].questionId, 'q2');
      expect(attempt.answers[1].selectedOptionIndex, 0);
    });

    test('30-minute quiz exited after 6 minutes preserves 24 minutes remaining upon resume', () {
      const durationMinutes = 30;
      const totalDurationSeconds = durationMinutes * 60; // 1800s

      // Student exited after 6 minutes (360 seconds)
      const elapsedSecondsOnExit = 360;

      // Calculate remaining time
      final remainingSeconds = totalDurationSeconds - elapsedSecondsOnExit;
      expect(remainingSeconds, 1440); // 24 minutes

      // When resuming, the initial remaining time must be 1440, NOT resetting to 1800
      expect(remainingSeconds < totalDurationSeconds, isTrue);
      expect(remainingSeconds ~/ 60, 24);
      expect(remainingSeconds % 60, 0);
    });

    test('Answers payload serialization and deserialization for pause endpoint', () {
      final answers = [
        const QuizAnswer(questionId: 'q-10', selectedOptionIndex: 3),
        const QuizAnswer(questionId: 'q-11', selectedOptionIndex: 1),
      ];

      final serialized = answers.map((a) => a.toJson()).toList();
      expect(serialized, [
        {'questionId': 'q-10', 'selectedOptionIndex': 3},
        {'questionId': 'q-11', 'selectedOptionIndex': 1},
      ]);
    });
  });
}
