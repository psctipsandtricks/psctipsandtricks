import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/providers/auth_controller.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/mock_test.dart';
import 'package:psc_tips_tricks_mobile/data/models/quiz.dart';
import 'package:psc_tips_tricks_mobile/data/models/user.dart';
import 'package:psc_tips_tricks_mobile/features/home/home_providers.dart';
import 'package:psc_tips_tricks_mobile/features/home/widgets/live_mock_banner.dart';
import 'package:psc_tips_tricks_mobile/features/mock_tests/mock_test_detail_screen.dart';
import 'package:psc_tips_tricks_mobile/features/mock_tests/mock_tests_providers.dart';
import 'package:psc_tips_tricks_mobile/features/quizzes/widgets/quiz_result_sheet.dart';

/// A student who has sat the test, and one other name on the board so a rank
/// list that leaked other people's rows would be visible here.
const _me = User(
  id: 'u-me',
  email: 'me@test.dev',
  name: 'Anjali S',
  role: UserRole.student,
  isPremium: false,
  isSuspended: false,
);

Map<String, dynamic> _payload({
  required String status,
  bool joined = false,
  bool submitted = false,
  num? myScore,
  int? myRank,
}) =>
    {
      'id': 'mt1',
      'title': 'Kerala PSC Full Mock',
      'quizId': 'q1',
      'scheduledAt': '2026-09-01T10:00:00.000Z',
      'status': status,
      'quiz': {
        'id': 'q1',
        'title': 'Paper',
        'durationMinutes': 60,
        'totalMarks': 100,
        'totalQuestions': 50,
        'price': 0,
      },
      'access': {
        'isPaid': false,
        'hasAccess': true,
        'price': 0,
        'reason': 'FREE',
      },
      'joined': joined,
      'submitted': submitted,
      if (myScore != null) 'myScore': myScore,
      if (myRank != null) 'myRank': myRank,
    };

const _board = <LeaderboardEntry>[
  LeaderboardEntry(
    rank: 1,
    userId: 'u-other',
    userName: 'Rahul K',
    score: 88,
    totalMarks: 100,
  ),
  LeaderboardEntry(
    rank: 4,
    userId: 'u-me',
    userName: 'Anjali S',
    score: 72,
    totalMarks: 100,
  ),
];


/// One submitted attempt for `mt1`, shaped as `/mock-tests/my-attempts` sends
/// it — the route that predates the `submitted` flag on the list payload.
final _submittedAttempt = MockTestParticipant.fromJson({
  'id': 'p1',
  'mockTestId': 'mt1',
  'score': 72,
  'rank': 4,
  'submittedAt': '2026-09-01T11:00:00.000Z',
});

Future<void> _pumpBanner(
  WidgetTester tester,
  MockTest mock, {
  List<MockTestParticipant> attempts = const [],
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        currentUserProvider.overrideWithValue(_me),
        myMockAttemptsProvider.overrideWith((ref) async => attempts),
        liveMockTestsProvider.overrideWith((ref) async => [mock]),
      ],
      child: MaterialApp(theme: AppTheme.light(), home: const Scaffold(body: LiveMockBanner())),
    ),
  );
  await tester.pump();
}

Future<void> _pumpDetail(
  WidgetTester tester,
  MockTest mock, {
  List<LeaderboardEntry>? board,
  List<MockTestParticipant> attempts = const [],
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        currentUserProvider.overrideWithValue(_me),
        myMockAttemptsProvider.overrideWith((ref) async => attempts),
        mockTestProvider.overrideWith((ref, id) async => mock),
        mockLeaderboardProvider
            .overrideWith((ref, id) async => board ?? _board),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const MockTestDetailScreen(mockTestId: 'mt1'),
      ),
    ),
  );
  await tester.pump();
  await tester.pump();
}

void main() {
  group('the home banner reflects what the student has already done', () {
    testWidgets('a live test not yet joined still says Join now',
        (tester) async {
      await _pumpBanner(tester, MockTest.fromJson(_payload(status: 'LIVE')));

      expect(find.text('Join now'), findsOneWidget);
      expect(find.text('View Live Rank List'), findsNothing);
    });

    testWidgets('a live test joined but not submitted offers to continue',
        (tester) async {
      await _pumpBanner(
        tester,
        MockTest.fromJson(_payload(status: 'LIVE', joined: true)),
      );

      expect(find.text('Continue the test'), findsOneWidget);
      expect(find.text('View Live Rank List'), findsNothing);
    });

    testWidgets('once submitted the button is the rank list, not another join',
        (tester) async {
      // The regression this exists for: the server refuses a second
      // submission, so a card still reading "Join now" after the student has
      // finished sends them into a join that fails.
      await _pumpBanner(
        tester,
        MockTest.fromJson(
          _payload(status: 'LIVE', joined: true, submitted: true),
        ),
      );

      expect(find.text('View Live Rank List'), findsOneWidget);
      expect(find.text('Join now'), findsNothing);
      expect(find.text('Continue the test'), findsNothing);
    });

    testWidgets('an API too old to send `submitted` still swaps the button',
        (tester) async {
      // The app ships before the server does. `/my-attempts` has always known
      // the student handed this paper in, so the card must not fall back to
      // offering a join the server would refuse.
      await _pumpBanner(
        tester,
        MockTest.fromJson(_payload(status: 'LIVE', joined: true)),
        attempts: [_submittedAttempt],
      );
      await tester.pump();

      expect(find.text('View Live Rank List'), findsOneWidget);
      expect(find.text('Continue the test'), findsNothing);
    });

    testWidgets('an attempt joined but not handed in is not treated as sat',
        (tester) async {
      final joinedOnly = MockTestParticipant.fromJson({
        'id': 'p1',
        'mockTestId': 'mt1',
      });
      await _pumpBanner(
        tester,
        MockTest.fromJson(_payload(status: 'LIVE', joined: true)),
        attempts: [joinedOnly],
      );
      await tester.pump();

      expect(find.text('Continue the test'), findsOneWidget);
      expect(find.text('View Live Rank List'), findsNothing);
    });

    testWidgets('a locked paid test is still the paywall, submitted or not',
        (tester) async {
      final locked = MockTest.fromJson({
        ..._payload(status: 'LIVE', submitted: true),
        'access': {
          'isPaid': true,
          'hasAccess': false,
          'price': 199,
          'reason': 'PAYMENT_REQUIRED',
        },
      });
      await _pumpBanner(tester, locked);

      expect(find.textContaining('Unlock for'), findsOneWidget);
      expect(find.text('View Live Rank List'), findsNothing);
    });
  });

  group('the live rank list', () {
    testWidgets('a submitted test opens on the rank list, not the join button',
        (tester) async {
      await _pumpDetail(
        tester,
        MockTest.fromJson(
          _payload(status: 'LIVE', joined: true, submitted: true),
        ),
      );

      expect(find.text('Live rank list'), findsOneWidget);
      expect(find.text('Join Now'), findsNothing);
      expect(find.text('Continue the test'), findsNothing);
    });

    testWidgets('it shows the score and rank off the live board',
        (tester) async {
      await _pumpDetail(
        tester,
        MockTest.fromJson(
          _payload(status: 'LIVE', joined: true, submitted: true),
        ),
      );

      expect(find.text('Your score'), findsOneWidget);
      expect(find.text('Your rank'), findsOneWidget);
      // Twice over: the big "Your rank" tile, and the row underneath it.
      expect(find.text('#4'), findsNWidgets(2));
      expect(find.textContaining('72'), findsWidgets);
    });

    testWidgets('only the student\'s own row is drawn', (tester) async {
      // Deliberate, and the same on the website: the board is fetched whole and
      // filtered down to the signed-in student before anything is drawn.
      await _pumpDetail(
        tester,
        MockTest.fromJson(
          _payload(status: 'LIVE', joined: true, submitted: true),
        ),
      );

      expect(find.textContaining('Anjali S'), findsOneWidget);
      expect(find.textContaining('Rahul K'), findsNothing);
      expect(find.text('88'), findsNothing);
    });

    testWidgets('a rank the recompute has not landed yet reads as pending',
        (tester) async {
      // Submitting is instant; the rank behind it is written by a background
      // job. An empty board must not be dressed up as a #1 finish.
      await _pumpDetail(
        tester,
        MockTest.fromJson(
          _payload(status: 'LIVE', joined: true, submitted: true),
        ),
        board: const [],
      );

      expect(find.text('Pending'), findsOneWidget);
      // And no fabricated row: an unknown rank must not be drawn as a podium
      // finish, which is what a placeholder of 0 or 1 would look like.
      expect(find.text('#1'), findsNothing);
      // The two are mutually exclusive branches, so this also rules out a row
      // drawn with a placeholder rank of 0 — which `_RankRow` would render as
      // a podium trophy rather than as any text at all.
      expect(find.textContaining('being worked out'), findsOneWidget);
    });

    testWidgets('a student past the board cut-off falls back to their own row',
        (tester) async {
      // `getLeaderboard` stops at 100 rows; the rank stored on the participant
      // is all a student below that has, and it is enough.
      await _pumpDetail(
        tester,
        MockTest.fromJson(_payload(
          status: 'LIVE',
          joined: true,
          submitted: true,
          myScore: 31,
          myRank: 143,
        )),
        board: const [],
      );

      expect(find.text('#143'), findsNWidgets(2));
      expect(find.text('Pending'), findsNothing);
    });

    testWidgets('once the window closes the list reads as final',
        (tester) async {
      await _pumpDetail(
        tester,
        MockTest.fromJson(
          _payload(status: 'COMPLETED', joined: true, submitted: true),
        ),
      );

      expect(find.text('Final rank list'), findsOneWidget);
      expect(find.text('Live rank list'), findsNothing);
    });

    testWidgets('a live test not submitted has no rank list at all',
        (tester) async {
      await _pumpDetail(
        tester,
        MockTest.fromJson(_payload(status: 'LIVE')),
      );

      expect(find.text('Live rank list'), findsNothing);
      expect(find.text('Join Now'), findsOneWidget);
    });
  });

  group('Live Mock Result Sheet', () {
    Future<void> pumpSheet(
      WidgetTester tester, {
      String? mockTestId,
      MockTest? mock,
      bool isLiveMock = true,
      List<LeaderboardEntry> board = _board,
    }) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final quiz = Quiz(
        id: 'q1',
        title: 'Kerala PSC Full Mock Quiz',
        durationMinutes: 60,
        totalMarks: 100,
        totalQuestions: 50,
        price: 0,
        isLiveMock: isLiveMock,
        mockTestId: mockTestId,
        isPremium: false,
        passingMarks: 40,
        negativeMarking: NegativeMarking.disabled,
        showCorrectAnswerAfterSelection: true,
        questions: [],
      );
      const result = QuizResult(
        score: 72,
        positiveMarks: 72,
        negativeMarks: 0,
        totalMarks: 100,
        correct: 36,
        wrong: 0,
        unattempted: 14,
        timeTakenSeconds: 1200,
        attemptNumber: 1,
        negativeMarking: NegativeMarking.disabled,
        passingMarks: 40,
      );

      final liveMockList = mock != null ? [mock] : <MockTest>[];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentUserProvider.overrideWithValue(_me),
            liveMockTestsProvider.overrideWith((ref) async => liveMockList),
            allMockTestsProvider.overrideWith((ref) async => liveMockList),
            if (mockTestId != null && mock != null)
              mockTestProvider(mockTestId).overrideWith((ref) async => mock),
            if (mockTestId != null)
              mockLeaderboardProvider(mockTestId)
                  .overrideWith((ref) async => board),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: Scaffold(
              body: QuizResultSheet(
                quiz: quiz,
                result: result,
                questions: const [],
                answers: const {},
                mockTestId: mockTestId,
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
    }

    testWidgets('displays Live Rank List hero and solutions PDF on live mock submission',
        (tester) async {
      final mock = MockTest.fromJson(
        _payload(status: 'LIVE', joined: true, submitted: true),
      );

      await pumpSheet(tester, mockTestId: 'mt1', mock: mock);

      // Live Rank List badge, your score and rank are immediately visible
      expect(find.text('LIVE RANK LIST — UPDATING…'), findsOneWidget);
      expect(find.text('Your score'), findsOneWidget);
      expect(find.text('Your rank'), findsOneWidget);
      expect(find.text('#4'), findsNWidgets(2)); // Stat tile and student row
      expect(find.textContaining('Anjali S'), findsOneWidget);
      expect(find.textContaining('Rahul K'), findsNothing); // Only user's own row
      expect(find.text('Download Solutions PDF'), findsOneWidget);
      expect(find.text('Review all answers'), findsOneWidget);

      // Test toggling full live rank list
      final viewAll = find.textContaining('View live rank list');
      expect(viewAll, findsOneWidget);
      await tester.tap(viewAll);
      await tester.pump();
      expect(find.textContaining('Rahul K'), findsOneWidget); // Now visible!
    });

    testWidgets('displays Live Rank List hero when isLiveMock is true even if mockTestId is null',
        (tester) async {
      final mock = MockTest.fromJson(
        _payload(status: 'LIVE', joined: true, submitted: true),
      );

      // mockTestId: null, but isLiveMock: true (matches user's real issue)
      await pumpSheet(tester, mockTestId: null, mock: mock, isLiveMock: true);

      expect(find.text('LIVE RANK LIST — UPDATING…'), findsOneWidget);
      expect(find.text('Your score'), findsOneWidget);
      expect(find.text('Your rank'), findsOneWidget);
      expect(find.text('Download Solutions PDF'), findsOneWidget);
    });

    testWidgets('displays normal practice dial when not a mock test',
        (tester) async {
      await pumpSheet(tester, mockTestId: null, isLiveMock: false);

      expect(find.text('LIVE RANK LIST — UPDATING…'), findsNothing);
      expect(find.text('Your rank'), findsNothing);
      expect(find.text('Download Solutions PDF'), findsNothing);
      expect(find.text('PASSED'), findsOneWidget);
      expect(find.text('Review all answers'), findsOneWidget);
    });
  });
}
