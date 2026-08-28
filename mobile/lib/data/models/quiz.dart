import '../../core/utils/json.dart';
import 'book.dart' show AccessState, isRecent;

class QuestionOption {
  const QuestionOption({required this.id, required this.text, this.explanation});

  final String id;
  final String text;
  final String? explanation;

  /// Options arrive either as `{ id, text }` objects or as bare strings,
  /// depending on how the quiz was authored.
  factory QuestionOption.from(dynamic raw, int index) {
    if (raw is Map) {
      final map = J.map(raw);
      return QuestionOption(
        id: J.str(map['id'], 'opt-$index'),
        text: J.str(map['text']),
        explanation: J.strOrNull(map['explanation']),
      );
    }
    return QuestionOption(id: 'opt-$index', text: J.str(raw));
  }
}

class Question {
  const Question({
    required this.id,
    required this.text,
    required this.options,
    required this.correctOptionIndex,
    required this.marks,
    this.explanation,
  });

  final String id;
  final String text;
  final List<QuestionOption> options;
  final int correctOptionIndex;
  final String? explanation;
  final double marks;

  factory Question.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['options'];
    final options = <QuestionOption>[];
    if (rawOptions is List) {
      for (var i = 0; i < rawOptions.length; i++) {
        options.add(QuestionOption.from(rawOptions[i], i));
      }
    }
    return Question(
      id: J.str(json['id']),
      text: J.str(json['text']),
      options: options,
      correctOptionIndex: J.intVal(json['correctOptionIndex']),
      explanation: J.strOrNull(json['explanation']),
      marks: J.dbl(json['marks'], 1),
    );
  }
}

/// "For every N wrong answers, deduct M marks" — disabled by default.
class NegativeMarking {
  const NegativeMarking({
    required this.enabled,
    required this.every,
    required this.deduct,
    required this.allowNegativeScore,
  });

  final bool enabled;
  final int every;
  final double deduct;
  final bool allowNegativeScore;

  static const disabled = NegativeMarking(
    enabled: false,
    every: 3,
    deduct: 1,
    allowNegativeScore: false,
  );

  /// Penalty for a given wrong-answer count, matching the server's rule.
  double penaltyFor(int wrongAnswers) {
    if (!enabled) return 0;
    final divisor = every < 1 ? 1 : every;
    return (wrongAnswers ~/ divisor) * deduct;
  }

  factory NegativeMarking.fromJson(Map<String, dynamic> json) => NegativeMarking(
        enabled: J.boolVal(json['negativeMarkingEnabled']),
        every: J.intVal(json['negativeMarkingEvery'], 3),
        deduct: J.dbl(json['negativeMarkingDeduct'], 1),
        allowNegativeScore: J.boolVal(json['allowNegativeScore']),
      );
}

class Quiz {
  const Quiz({
    required this.id,
    required this.title,
    required this.totalQuestions,
    required this.durationMinutes,
    required this.isLiveMock,
    required this.isPremium,
    required this.price,
    required this.passingMarks,
    required this.totalMarks,
    required this.negativeMarking,
    required this.showCorrectAnswerAfterSelection,
    this.category,
    this.topic,
    this.folderName,
    this.access,
    this.questions = const [],
    this.createdAt,
  });

  final String id;
  final String title;
  final String? category;
  final String? topic;
  final String? folderName;
  final int totalQuestions;
  final int durationMinutes;
  final bool isLiveMock;
  final bool isPremium;
  final double price;
  final double passingMarks;
  final double totalMarks;
  final NegativeMarking negativeMarking;
  final bool showCorrectAnswerAfterSelection;
  final AccessState? access;
  final List<Question> questions;
  final DateTime? createdAt;

  bool get isLocked => access != null && !access!.hasAccess;

  /// Mirrors the server's own predicate in `quiz-access.service.ts`.
  bool get isPaid => isPremium || price > 0;

  bool get isNew => isRecent(createdAt);
  Duration get duration => Duration(minutes: durationMinutes);

  factory Quiz.fromJson(Map<String, dynamic> json) => Quiz(
        id: J.str(json['id']),
        title: J.str(json['title']),
        category: J.strOrNull(json['category']),
        topic: J.strOrNull(json['topic']),
        folderName: J.strOrNull(json['folderName']),
        totalQuestions: J.intVal(json['totalQuestions']),
        durationMinutes: J.intVal(json['durationMinutes'], 15),
        isLiveMock: J.boolVal(json['isLiveMock']),
        isPremium: J.boolVal(json['isPremium']),
        price: J.dbl(json['price']),
        passingMarks: J.dbl(json['passingMarks']),
        totalMarks: J.dbl(json['totalMarks']),
        negativeMarking: NegativeMarking.fromJson(json),
        // The site defaults this on when the field is absent.
        showCorrectAnswerAfterSelection:
            J.boolVal(json['showCorrectAnswerAfterSelection'], true),
        access: json['access'] is Map
            ? AccessState.fromJson(J.map(json['access']))
            : null,
        questions: J.list(json['questions'], Question.fromJson),
        createdAt: J.dateOrNull(json['createdAt']),
      );
}

class QuizFolder {
  const QuizFolder({
    required this.id,
    required this.name,
    required this.orderIndex,
    this.parentId,
    this.parentName,
    this.description,
    this.quizCount = 0,
    this.subFolderCount = 0,
  });

  final String id;
  final String name;
  final String? parentId;
  final String? parentName;
  final String? description;
  final int orderIndex;
  final int quizCount;
  final int subFolderCount;

  bool get isEmpty => quizCount == 0 && subFolderCount == 0;

  factory QuizFolder.fromJson(Map<String, dynamic> json) => QuizFolder(
        id: J.str(json['id']),
        name: J.str(json['name']),
        parentId: J.strOrNull(json['parentId']),
        parentName: J.strOrNull(json['parentName']),
        description: J.strOrNull(json['description']),
        orderIndex: J.intVal(json['orderIndex']),
        quizCount: J.intVal(json['quizCount']),
        subFolderCount: J.intVal(json['subFolderCount']),
      );
}

/// One answer in a submission. A null `selectedOptionIndex` marks the question
/// as unattempted, which the server scores separately from a wrong answer.
class QuizAnswer {
  const QuizAnswer({required this.questionId, this.selectedOptionIndex});

  final String questionId;
  final int? selectedOptionIndex;

  Map<String, dynamic> toJson() => {
        'questionId': questionId,
        if (selectedOptionIndex != null)
          'selectedOptionIndex': selectedOptionIndex,
      };

  factory QuizAnswer.fromJson(Map<String, dynamic> json) => QuizAnswer(
        questionId: J.str(json['questionId']),
        selectedOptionIndex: J.intOrNull(json['selectedOptionIndex']),
      );
}

class QuizSubmission {
  const QuizSubmission({
    required this.quizId,
    required this.answers,
    required this.timeTakenSeconds,
  });

  final String quizId;
  final List<QuizAnswer> answers;
  final int timeTakenSeconds;

  Map<String, dynamic> toJson() => {
        'quizId': quizId,
        'answers': answers.map((a) => a.toJson()).toList(),
        'timeTakenSeconds': timeTakenSeconds,
      };
}

enum AttemptStatus { inProgress, completed, abandoned }

class QuizAttempt {
  const QuizAttempt({
    required this.id,
    required this.quizId,
    required this.attemptNumber,
    required this.status,
    required this.score,
    required this.totalMarks,
    required this.percentage,
    required this.totalQuestions,
    required this.passed,
    required this.correctAnswers,
    required this.wrongAnswers,
    required this.unattempted,
    required this.timeTakenSeconds,
    this.quizTitle,
    this.quizCategory,
    this.answers = const [],
    this.submittedAt,
    this.startedAt,
  });

  final String id;
  final String quizId;
  final int attemptNumber;
  final AttemptStatus status;
  final double score;
  final double totalMarks;
  final double percentage;
  final int totalQuestions;
  final bool passed;
  final int correctAnswers;
  final int wrongAnswers;
  final int unattempted;
  final int timeTakenSeconds;
  final String? quizTitle;
  final String? quizCategory;
  final List<QuizAnswer> answers;
  final DateTime? submittedAt;
  final DateTime? startedAt;

  factory QuizAttempt.fromJson(Map<String, dynamic> json) {
    final quiz = J.map(json['quiz']);
    final statusRaw = J.str(json['attemptStatus']).toUpperCase();
    return QuizAttempt(
      id: J.str(json['id']),
      quizId: J.str(json['quizId']),
      attemptNumber: J.intVal(json['attemptNumber'], 1),
      status: statusRaw == 'COMPLETED'
          ? AttemptStatus.completed
          : statusRaw == 'ABANDONED'
              ? AttemptStatus.abandoned
              : AttemptStatus.inProgress,
      score: J.dbl(json['score']),
      totalMarks: J.dbl(json['totalMarks']),
      percentage: J.dbl(json['percentage']),
      totalQuestions: J.intVal(json['totalQuestions']),
      passed: J.boolVal(json['passed']),
      correctAnswers: J.intVal(json['correctAnswers']),
      wrongAnswers: J.intVal(json['wrongAnswers']),
      unattempted: J.intVal(json['unattempted']),
      timeTakenSeconds: J.intVal(json['timeTakenSeconds']),
      quizTitle: J.strOrNull(quiz['title']) ?? J.strOrNull(json['title']),
      quizCategory: J.strOrNull(quiz['category']) ?? J.strOrNull(json['category']),
      answers: J.list(json['answers'], QuizAnswer.fromJson),
      submittedAt: J.dateOrNull(json['submittedAt']),
      startedAt: J.dateOrNull(json['startedAt']),
    );
  }
}

class LeaderboardEntry {
  const LeaderboardEntry({
    required this.rank,
    required this.userId,
    required this.userName,
    required this.score,
    this.avatarUrl,
    this.totalMarks,
    this.timeTakenSeconds,
  });

  final int rank;
  final String userId;
  final String userName;
  final double score;
  final String? avatarUrl;
  final double? totalMarks;
  final int? timeTakenSeconds;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) =>
      LeaderboardEntry(
        rank: J.intVal(json['rank']),
        userId: J.str(json['userId']),
        userName: J.str(json['userName'], 'Aspirant'),
        score: J.dbl(json['score']),
        avatarUrl: J.strOrNull(json['avatarUrl']),
        totalMarks: J.dblOrNull(json['totalMarks']),
        timeTakenSeconds: J.intOrNull(json['timeTakenSeconds']),
      );
}

/// The locally computed outcome shown the instant a student submits, before the
/// background persist call settles — the same trade-off the website makes.
class QuizResult {
  const QuizResult({
    required this.score,
    required this.positiveMarks,
    required this.negativeMarks,
    required this.totalMarks,
    required this.correct,
    required this.wrong,
    required this.unattempted,
    required this.timeTakenSeconds,
    required this.attemptNumber,
    required this.negativeMarking,
    required this.passingMarks,
  });

  final double score;
  final double positiveMarks;
  final double negativeMarks;
  final double totalMarks;
  final int correct;
  final int wrong;
  final int unattempted;
  final int timeTakenSeconds;
  final int attemptNumber;
  final NegativeMarking negativeMarking;
  final double passingMarks;

  bool get passed => score >= passingMarks;
  double get percentage => totalMarks <= 0 ? 0 : (score / totalMarks) * 100;
  int get attempted => correct + wrong;
  double get accuracy => attempted == 0 ? 0 : (correct / attempted) * 100;
}
