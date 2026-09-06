import '../../core/utils/json.dart';
import 'book.dart' show AccessState;
import 'quiz.dart';

enum MockTestStatus { upcoming, live, completed }

MockTestStatus mockStatusFrom(dynamic v) {
  switch (J.str(v).toUpperCase()) {
    case 'LIVE':
      return MockTestStatus.live;
    case 'COMPLETED':
      return MockTestStatus.completed;
    default:
      return MockTestStatus.upcoming;
  }
}

class MockTest {
  const MockTest({
    required this.id,
    required this.title,
    required this.quizId,
    required this.scheduledAt,
    required this.status,
    this.endsAt,
    this.quiz,
    this.access,
    this.participantCount = 0,
    this.joined = false,
    this.submitted = false,
  });

  final String id;
  final String title;
  final String quizId;
  final DateTime scheduledAt;
  final DateTime? endsAt;
  final MockTestStatus status;
  final Quiz? quiz;

  /// The server's purchase verdict for the paper behind this test. Both the
  /// list and the detail route attach it; null only for a payload old enough
  /// to predate it, which is treated as unlocked rather than as a hard block.
  final AccessState? access;

  final int participantCount;
  final bool joined;
  final bool submitted;

  bool get isLive => status == MockTestStatus.live;
  bool get isUpcoming => status == MockTestStatus.upcoming;
  Duration get startsIn => scheduledAt.difference(DateTime.now());
  Duration get endsIn => (endsAt ?? scheduledAt.add(const Duration(days: 1))).difference(DateTime.now());

  /// The test is sold rather than free.
  bool get isPaid => access?.isPaid ?? (quiz?.isPaid ?? false);

  /// A premium test this student has not bought: no questions were sent, and
  /// join/submit would both be refused, so the UI must show the paywall
  /// instead of an attempt. Mirrors `isLocked` in `mock-tests/[id]/page.tsx`.
  bool get isLocked => access != null && !access!.hasAccess;

  double get price => access?.price ?? quiz?.effectivePrice ?? 0;

  factory MockTest.fromJson(Map<String, dynamic> json) => MockTest(
        id: J.str(json['id']),
        title: J.str(json['title']),
        quizId: J.str(json['quizId']),
        scheduledAt: J.date(json['scheduledAt']),
        endsAt: json['endsAt'] != null ? J.date(json['endsAt']) : null,
        status: mockStatusFrom(json['status']),
        quiz: json['quiz'] is Map ? Quiz.fromJson(J.map(json['quiz'])) : null,
        access: json['access'] is Map
            ? AccessState.fromJson(J.map(json['access']))
            : null,
        participantCount: J.intVal(json['participantCount']),
        joined: J.boolVal(json['joined']),
        submitted: J.boolVal(json['submitted']),
      );
}

class MockTestParticipant {
  const MockTestParticipant({
    required this.id,
    required this.mockTestId,
    this.score,
    this.rank,
    this.submittedAt,
    this.title,
  });

  final String id;
  final String mockTestId;
  final double? score;
  final int? rank;
  final DateTime? submittedAt;
  final String? title;

  factory MockTestParticipant.fromJson(Map<String, dynamic> json) {
    final mock = J.map(json['mockTest']);
    return MockTestParticipant(
      id: J.str(json['id']),
      mockTestId: J.str(json['mockTestId']),
      score: J.dblOrNull(json['score']),
      rank: J.intOrNull(json['rank']),
      submittedAt: J.dateOrNull(json['submittedAt']),
      title: J.strOrNull(mock['title']),
    );
  }
}
