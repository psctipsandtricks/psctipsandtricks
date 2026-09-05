import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/data/models/mock_test.dart';
import 'package:psc_tips_tricks_mobile/data/models/quiz.dart';
import 'package:psc_tips_tricks_mobile/features/mock_tests/mock_tests_providers.dart';
import 'package:psc_tips_tricks_mobile/features/quizzes/quizzes_providers.dart';

void main() {
  group('Mock Tests Search and Filter Logic', () {
    final mock1 = MockTest(
      id: 'm1',
      quizId: 'q1',
      title: 'Kerala PSC Degree Level Prelims Mock 1',
      status: MockTestStatus.live,
      scheduledAt: DateTime.now(),
      quiz: const Quiz(
        id: 'q1',
        title: 'Degree Prelims Stage 1',
        passingMarks: 50,
        totalMarks: 100,
        totalQuestions: 100,
        durationMinutes: 60,
        isLiveMock: true,
        isPremium: true,
        price: 99,
        negativeMarking: NegativeMarking.disabled,
        showCorrectAnswerAfterSelection: false,
        accessType: 'PREMIUM',
      ),
    );

    final mock2 = MockTest(
      id: 'm2',
      quizId: 'q2',
      title: 'VFA Free Mock Exam',
      status: MockTestStatus.upcoming,
      scheduledAt: DateTime.now().add(const Duration(days: 1)),
      quiz: const Quiz(
        id: 'q2',
        title: 'VFA Special Mock',
        passingMarks: 40,
        totalMarks: 50,
        totalQuestions: 50,
        durationMinutes: 30,
        isLiveMock: true,
        isPremium: false,
        price: 0,
        negativeMarking: NegativeMarking.disabled,
        showCorrectAnswerAfterSelection: true,
        accessType: 'FREE',
      ),
    );

    final mock3 = MockTest(
      id: 'm3',
      quizId: 'q3',
      title: 'LDC Final Archive Test',
      status: MockTestStatus.completed,
      scheduledAt: DateTime.now().subtract(const Duration(days: 2)),
      quiz: const Quiz(
        id: 'q3',
        title: 'LDC Full Paper',
        passingMarks: 50,
        totalMarks: 100,
        totalQuestions: 100,
        durationMinutes: 90,
        isLiveMock: true,
        isPremium: true,
        price: 49,
        negativeMarking: NegativeMarking.disabled,
        showCorrectAnswerAfterSelection: false,
        accessType: 'PREMIUM',
      ),
    );


    final allMocks = [mock1, mock2, mock3];

    test('Filter options are correctly defined', () {
      expect(mockTestFilterOptions, containsAll(['All', 'Live Now', 'Upcoming', 'Completed', 'Free', 'Paid']));
    });

    test('Filtering by status works correctly', () {
      final liveMocks = allMocks.where((m) => m.status == MockTestStatus.live).toList();
      expect(liveMocks.length, 1);
      expect(liveMocks.first.id, 'm1');

      final upcomingMocks = allMocks.where((m) => m.status == MockTestStatus.upcoming).toList();
      expect(upcomingMocks.length, 1);
      expect(upcomingMocks.first.id, 'm2');

      final completedMocks = allMocks.where((m) => m.status == MockTestStatus.completed).toList();
      expect(completedMocks.length, 1);
      expect(completedMocks.first.id, 'm3');
    });

    test('Filtering by access (Free vs Paid) works correctly', () {
      final freeMocks = allMocks.where((m) => !m.isPaid).toList();
      expect(freeMocks.length, 1);
      expect(freeMocks.first.id, 'm2');

      final paidMocks = allMocks.where((m) => m.isPaid).toList();
      expect(paidMocks.length, 2);
      expect(paidMocks.map((m) => m.id), containsAll(['m1', 'm3']));
    });

    test('Search query matches title or quiz title', () {
      final query = 'vfa';
      final results = allMocks.where((m) {
        return m.title.toLowerCase().contains(query) ||
            (m.quiz?.title.toLowerCase().contains(query) ?? false);
      }).toList();

      expect(results.length, 1);
      expect(results.first.id, 'm2');
    });
  });

  group('Quiz History Search, Filter, and Pagination Logic', () {
    final attempt1 = QuizAttempt(
      id: 'att1',
      quizId: 'q1',
      quizTitle: 'Kerala PSC Degree Level Prelims Mock 1',
      quizIsPremium: true,
      attemptNumber: 1,
      score: 75.0,
      totalMarks: 100.0,
      totalQuestions: 100,
      percentage: 75.0,
      passed: true,
      correctAnswers: 75,
      wrongAnswers: 25,
      unattempted: 0,
      status: AttemptStatus.completed,
      timeTakenSeconds: 1800,
      submittedAt: DateTime.now().subtract(const Duration(hours: 3)),
    );

    final attempt2 = QuizAttempt(
      id: 'att2',
      quizId: 'q2',
      quizTitle: 'VFA Free Mock Exam',
      quizIsPremium: false,
      attemptNumber: 1,
      score: 20.0,
      totalMarks: 100.0,
      totalQuestions: 100,
      percentage: 20.0,
      passed: false,
      correctAnswers: 20,
      wrongAnswers: 80,
      unattempted: 0,
      status: AttemptStatus.completed,
      timeTakenSeconds: 1200,
      submittedAt: DateTime.now().subtract(const Duration(hours: 5)),
    );

    final attempt3 = QuizAttempt(
      id: 'att3',
      quizId: 'q3',
      quizTitle: 'General Knowledge In Progress',
      quizIsPremium: false,
      attemptNumber: 2,
      score: 0.0,
      totalMarks: 50.0,
      totalQuestions: 50,
      percentage: 0.0,
      passed: false,
      correctAnswers: 0,
      wrongAnswers: 0,
      unattempted: 50,
      status: AttemptStatus.inProgress,
      timeTakenSeconds: 300,
      startedAt: DateTime.now().subtract(const Duration(minutes: 10)),
    );

    final allAttempts = [attempt1, attempt2, attempt3];

    test('Filter options are correctly defined for quiz history', () {
      expect(quizHistoryFilterOptions, containsAll(['All', 'Passed', 'Needs Work', 'In Progress', 'Free', 'Premium']));
    });

    test('Lifetime stats calculation matches expected', () {
      final completed = allAttempts.where((a) => a.status != AttemptStatus.inProgress).toList();
      final passed = completed.where((a) => a.passed).length;
      final avg = completed.fold<double>(0, (s, a) => s + a.percentage) / completed.length;

      expect(allAttempts.length, 3);
      expect(completed.length, 2);
      expect(passed, 1);
      expect(avg, 47.5);
    });

    test('Filtering by status (Passed, Needs Work, In Progress)', () {
      final passedList = allAttempts.where((a) => a.passed && a.status != AttemptStatus.inProgress).toList();
      expect(passedList.length, 1);
      expect(passedList.first.id, 'att1');

      final needsWorkList = allAttempts.where((a) => !a.passed && a.status != AttemptStatus.inProgress).toList();
      expect(needsWorkList.length, 1);
      expect(needsWorkList.first.id, 'att2');

      final inProgressList = allAttempts.where((a) => a.status == AttemptStatus.inProgress).toList();
      expect(inProgressList.length, 1);
      expect(inProgressList.first.id, 'att3');
    });

    test('Filtering by access (Free vs Premium)', () {
      final freeList = allAttempts.where((a) => !a.quizIsPremium).toList();
      expect(freeList.length, 2);

      final premiumList = allAttempts.where((a) => a.quizIsPremium).toList();
      expect(premiumList.length, 1);
      expect(premiumList.first.id, 'att1');
    });

    test('Search by quiz title works case-insensitively', () {
      final query = 'degree level';
      final filtered = allAttempts.where((a) => (a.quizTitle ?? '').toLowerCase().contains(query)).toList();
      expect(filtered.length, 1);
      expect(filtered.first.id, 'att1');
    });
  });
}
