import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/data/models/quiz.dart';

/// The review is scored entirely by the server so the app and the website can
/// never disagree about an answer. What matters here is that every field of
/// that contract survives parsing — a dropped `correctOptionIndex` or a
/// mis-mapped status would quietly show a student the wrong verdict.
void main() {
  Map<String, dynamic> question({
    required String id,
    required int number,
    int? selected,
    int? correct,
    required String status,
  }) =>
      {
        'id': id,
        'number': number,
        'text': 'Question $number?',
        'marks': 1,
        'explanation': 'Because.',
        'options': [
          {'id': 'a', 'text': 'Alpha'},
          {'id': 'b', 'text': 'Beta'},
        ],
        'selectedOptionIndex': selected,
        'selectedOptionText': selected == null ? null : (selected == 0 ? 'Alpha' : 'Beta'),
        'correctOptionIndex': correct,
        'correctOptionText': correct == null ? null : (correct == 0 ? 'Alpha' : 'Beta'),
        'status': status,
        'isCorrect': status == 'CORRECT',
      };

  Map<String, dynamic> payload({bool answersStale = false}) => {
        'id': 'sub1',
        'quizId': 'q1',
        'quizTitle': 'Kerala PSC Prelims',
        'attemptNumber': 2,
        'attemptStatus': 'COMPLETED',
        'score': 1,
        'totalMarks': 3,
        'percentage': 33.33,
        'passed': false,
        'passingMarks': 40,
        'totalQuestions': 3,
        'correctAnswers': 1,
        'wrongAnswers': 1,
        'unattempted': 1,
        'timeTakenSeconds': 125,
        'startedAt': '2026-09-01T10:00:00.000Z',
        'submittedAt': '2026-09-01T10:02:05.000Z',
        'negativeMarking': {
          'enabled': true,
          'every': 3,
          'deduct': 1,
          'allowNegativeScore': false,
          'deducted': 0,
        },
        'answersStale': answersStale,
        'questions': [
          question(id: 'q-1', number: 1, selected: 0, correct: 0, status: 'CORRECT'),
          question(id: 'q-2', number: 2, selected: 1, correct: 0, status: 'INCORRECT'),
          question(id: 'q-3', number: 3, correct: 1, status: 'UNATTEMPTED'),
        ],
      };

  test('the summary carries the server-scored totals, not a local recount', () {
    final review = AttemptReview.fromJson(payload());

    expect(review.id, 'sub1');
    expect(review.quizTitle, 'Kerala PSC Prelims');
    expect(review.attemptNumber, 2);
    expect(review.score, 1);
    expect(review.totalMarks, 3);
    expect(review.passed, isFalse);
    expect(review.correctAnswers, 1);
    expect(review.wrongAnswers, 1);
    expect(review.unattempted, 1);
    expect(review.timeTakenSeconds, 125);
    expect(review.accuracy, closeTo(50, 0.001));
  });

  test('questions keep the order the quiz was authored in', () {
    final review = AttemptReview.fromJson(payload());

    expect(review.questions.map((q) => q.number), [1, 2, 3]);
    expect(review.questions.map((q) => q.id), ['q-1', 'q-2', 'q-3']);
  });

  test('a wrong answer keeps both what was picked and what was right', () {
    final wrong = AttemptReview.fromJson(payload()).questions[1];

    expect(wrong.status, AnswerStatus.incorrect);
    expect(wrong.isCorrect, isFalse);
    expect(wrong.selectedOptionIndex, 1);
    expect(wrong.selectedOptionText, 'Beta');
    expect(wrong.correctOptionIndex, 0);
    expect(wrong.correctOptionText, 'Alpha');
  });

  test('a skipped question has no selection but still shows the answer', () {
    final skipped = AttemptReview.fromJson(payload()).questions[2];

    expect(skipped.status, AnswerStatus.unattempted);
    expect(skipped.isSkipped, isTrue);
    expect(skipped.selectedOptionIndex, isNull);
    expect(skipped.selectedOptionText, isNull);
    expect(skipped.correctOptionIndex, 1);
  });

  test('negative marking is read from its nested block, not the root', () {
    final review = AttemptReview.fromJson(payload());

    expect(review.negativeMarking.enabled, isTrue);
    expect(review.negativeMarking.every, 3);
    expect(review.negativeMarking.deduct, 1);
    expect(review.negativeMarks, 0);
  });

  test('an edited quiz is flagged so the screen can warn about stale answers', () {
    expect(AttemptReview.fromJson(payload()).answersStale, isFalse);
    expect(AttemptReview.fromJson(payload(answersStale: true)).answersStale, isTrue);
  });

  test('an unknown status falls back to unattempted rather than claiming correct', () {
    final review = AttemptReview.fromJson({
      ...payload(),
      'questions': [question(id: 'q-1', number: 1, correct: 0, status: 'WHATEVER')],
    });

    expect(review.questions.single.status, AnswerStatus.unattempted);
    expect(review.questions.single.isCorrect, isFalse);
  });
}
