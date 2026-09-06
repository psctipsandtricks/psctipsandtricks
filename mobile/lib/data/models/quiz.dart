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
    this.discountPercent = 0,
    double? finalPrice,
    required this.passingMarks,
    required this.totalMarks,
    required this.negativeMarking,
    required this.showCorrectAnswerAfterSelection,
    this.category,
    this.topic,
    this.folderName,
    this.accessType,
    this.imageUrl,
    this.access,
    this.questions = const [],
    this.createdAt,
    this.releaseDate,
    this.isActive = true,
  }) : finalPrice = finalPrice ?? price;

  final String id;
  final String title;
  final String? category;
  final String? topic;
  final String? folderName;
  final String? accessType;
  final String? imageUrl;
  final int totalQuestions;
  final int durationMinutes;
  final bool isLiveMock;
  final bool isPremium;
  final double price;
  final double discountPercent;
  final double finalPrice;
  final double passingMarks;
  final double totalMarks;
  final NegativeMarking negativeMarking;
  final bool showCorrectAnswerAfterSelection;
  final AccessState? access;
  final List<Question> questions;
  final DateTime? createdAt;
  final DateTime? releaseDate;
  final bool isActive;

  bool get isLocked => access != null ? !access!.hasAccess : isPaid;
  bool get isUnlocked => !isLocked;

  /// Mirrors the server's own predicate in `quiz-access.service.ts`.
  bool get isPaid =>
      isPremium || price > 0 || (accessType?.toUpperCase() == 'PAID');

  /// The price to actually charge/display — the admin's discounted "Final
  /// Student Price" when one is set, otherwise the base price. Prefer
  /// `access?.price` where available (the server-resolved value); this is the
  /// fallback for when `access` hasn't loaded yet.
  double get effectivePrice => finalPrice > 0 ? finalPrice : price;

  bool get isNew => isRecent(createdAt);
  Duration get duration => Duration(minutes: durationMinutes);

  factory Quiz.fromJson(Map<String, dynamic> json) => Quiz(
        id: J.str(json['id']),
        title: J.str(json['title']),
        category: J.strOrNull(json['category']),
        topic: J.strOrNull(json['topic']),
        folderName: J.strOrNull(json['folderName']),
        accessType: J.strOrNull(json['accessType']),
        imageUrl: J.strOrNull(json['imageUrl']) ?? J.strOrNull(json['image']),
        totalQuestions: J.intVal(json['totalQuestions']),
        durationMinutes: J.intVal(json['durationMinutes'], 15),
        isLiveMock: J.boolVal(json['isLiveMock']),
        isPremium: J.boolVal(json['isPremium']),
        price: J.dbl(json['price']),
        discountPercent: J.dbl(json['discountPercent']),
        finalPrice: J.dbl(json['finalPrice'], J.dbl(json['price'])),
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
        releaseDate: J.dateOrNull(json['releaseDate']),
        isActive: J.boolVal(json['isActive'], true),
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
    this.timeTakenMs,
  });

  final String quizId;
  final List<QuizAnswer> answers;
  final int timeTakenSeconds;

  /// Same duration to millisecond precision. Mock tests rank a tied score on
  /// this — two participants can easily finish within the same whole second.
  final int? timeTakenMs;

  Map<String, dynamic> toJson() => {
        'quizId': quizId,
        'answers': answers.map((a) => a.toJson()).toList(),
        'timeTakenSeconds': timeTakenSeconds,
        if (timeTakenMs != null) 'timeTakenMs': timeTakenMs,
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
    this.quizIsPremium = false,
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

  /// Whether the quiz behind this attempt is a paid one — drives the
  /// Free/Premium chip and the Solutions PDF download on the history card.
  final bool quizIsPremium;
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
      quizIsPremium: J.boolVal(quiz['isPremium']) ||
          J.str(quiz['accessType']).toUpperCase() == 'PAID' ||
          J.dbl(quiz['price']) > 0,
      timeTakenSeconds: J.intVal(json['timeTakenSeconds']),
      quizTitle: J.strOrNull(quiz['title']) ?? J.strOrNull(json['title']),
      quizCategory: J.strOrNull(quiz['category']) ?? J.strOrNull(json['category']),
      answers: J.list(json['answers'], QuizAnswer.fromJson),
      submittedAt: J.dateOrNull(json['submittedAt']),
      startedAt: J.dateOrNull(json['startedAt']),
    );
  }
}

/// One numbered page of the student's completed attempts, with the lifetime
/// summary (total attempts, passes, average score) the header card shows —
/// those totals are computed server-side across *every* completed attempt, not
/// just the visible page.
class QuizHistoryPage {
  const QuizHistoryPage({
    required this.attempts,
    required this.page,
    required this.totalPages,
    required this.totalAttempts,
    required this.passed,
    required this.avgPercentage,
  });

  final List<QuizAttempt> attempts;
  final int page;
  final int totalPages;
  final int totalAttempts;
  final int passed;
  final double avgPercentage;

  bool get isEmpty => attempts.isEmpty;

  factory QuizHistoryPage.fromJson(dynamic json) {
    final map = J.mapOrNull(json) ?? const {};
    final summary = J.map(map['summary']);
    final parsed = J.rows(json)
        .whereType<Map>()
        .map((e) => QuizAttempt.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    // The pagination envelope already contains completed attempts only; a bare
    // array (a server without the envelope) still carries in-progress ones, so
    // filter and derive the summary from what is on the page.
    final completed =
        parsed.where((a) => a.status == AttemptStatus.completed).toList();
    final attempts = json is List ? completed : parsed;
    return QuizHistoryPage(
      attempts: attempts,
      page: J.intVal(map['page'], 1),
      totalPages: J.intVal(map['totalPages'], 1),
      totalAttempts:
          J.intVal(summary['attempts'], J.intVal(map['total'], completed.length)),
      passed: J.intVal(summary['passed'], completed.where((a) => a.passed).length),
      avgPercentage: J.dbl(
        summary['avgPercentage'],
        completed.isEmpty
            ? 0
            : completed.fold<double>(0, (s, a) => s + a.percentage) /
                completed.length,
      ),
    );
  }
}

/// Whether a reviewed question was answered correctly, wrongly, or skipped.
enum AnswerStatus { correct, incorrect, unattempted }

/// One question of a review, paired with what the student picked. Built by the
/// server so the app and the website judge every answer identically.
class ReviewQuestion {
  const ReviewQuestion({
    required this.id,
    required this.number,
    required this.text,
    required this.marks,
    required this.options,
    required this.status,
    this.explanation,
    this.selectedOptionIndex,
    this.selectedOptionText,
    this.correctOptionIndex,
    this.correctOptionText,
  });

  final String id;

  /// 1-based position in the quiz's own question order.
  final int number;
  final String text;
  final double marks;
  final String? explanation;
  final List<QuestionOption> options;

  /// Null when the question was skipped.
  final int? selectedOptionIndex;
  final String? selectedOptionText;
  final int? correctOptionIndex;
  final String? correctOptionText;
  final AnswerStatus status;

  bool get isCorrect => status == AnswerStatus.correct;
  bool get isSkipped => status == AnswerStatus.unattempted;

  factory ReviewQuestion.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['options'];
    final options = <QuestionOption>[];
    if (rawOptions is List) {
      for (var i = 0; i < rawOptions.length; i++) {
        options.add(QuestionOption.from(rawOptions[i], i));
      }
    }
    return ReviewQuestion(
      id: J.str(json['id']),
      number: J.intVal(json['number']),
      text: J.str(json['text']),
      marks: J.dbl(json['marks'], 1),
      explanation: J.strOrNull(json['explanation']),
      options: options,
      selectedOptionIndex: J.intOrNull(json['selectedOptionIndex']),
      selectedOptionText: J.strOrNull(json['selectedOptionText']),
      correctOptionIndex: J.intOrNull(json['correctOptionIndex']),
      correctOptionText: J.strOrNull(json['correctOptionText']),
      status: switch (J.str(json['status']).toUpperCase()) {
        'CORRECT' => AnswerStatus.correct,
        'INCORRECT' => AnswerStatus.incorrect,
        _ => AnswerStatus.unattempted,
      },
    );
  }
}

/// A scored attempt plus its full answer key, from
/// `GET /quizzes/attempts/:attemptId/review`. This is the payload behind both
/// the app's and the website's result screens — neither re-scores locally.
class AttemptReview {
  const AttemptReview({
    required this.id,
    required this.quizId,
    required this.quizTitle,
    required this.isPremium,
    required this.attemptNumber,
    required this.score,
    required this.totalMarks,
    required this.percentage,
    required this.passed,
    required this.passingMarks,
    required this.totalQuestions,
    required this.correctAnswers,
    required this.wrongAnswers,
    required this.unattempted,
    required this.timeTakenSeconds,
    required this.negativeMarking,
    required this.negativeMarks,
    required this.answersStale,
    required this.questions,
    this.startedAt,
    this.submittedAt,
  });

  final String id;
  final String quizId;
  final String quizTitle;

  /// Gates the "Download Solutions PDF" button — available once an attempt
  /// is submitted, and only for a premium quiz.
  final bool isPremium;
  final int attemptNumber;
  final double score;
  final double totalMarks;
  final double percentage;
  final bool passed;
  final double passingMarks;
  final int totalQuestions;
  final int correctAnswers;
  final int wrongAnswers;
  final int unattempted;
  final int timeTakenSeconds;
  final NegativeMarking negativeMarking;

  /// Marks actually deducted on this attempt.
  final double negativeMarks;

  /// True when the quiz was edited after the attempt, so the saved answers no
  /// longer line up with the questions below.
  final bool answersStale;
  final List<ReviewQuestion> questions;
  final DateTime? startedAt;
  final DateTime? submittedAt;

  int get attempted => correctAnswers + wrongAnswers;
  double get accuracy => attempted == 0 ? 0 : (correctAnswers / attempted) * 100;

  factory AttemptReview.fromJson(Map<String, dynamic> json) {
    final negative = J.map(json['negativeMarking']);
    return AttemptReview(
      id: J.str(json['id']),
      quizId: J.str(json['quizId']),
      quizTitle: J.str(json['quizTitle'], 'Quiz'),
      isPremium: J.boolVal(json['isPremium']),
      attemptNumber: J.intVal(json['attemptNumber'], 1),
      score: J.dbl(json['score']),
      totalMarks: J.dbl(json['totalMarks']),
      percentage: J.dbl(json['percentage']),
      passed: J.boolVal(json['passed']),
      passingMarks: J.dbl(json['passingMarks']),
      totalQuestions: J.intVal(json['totalQuestions']),
      correctAnswers: J.intVal(json['correctAnswers']),
      wrongAnswers: J.intVal(json['wrongAnswers']),
      unattempted: J.intVal(json['unattempted']),
      timeTakenSeconds: J.intVal(json['timeTakenSeconds']),
      // The review nests the rules one level down rather than flattening them
      // onto the root the way a quiz payload does.
      negativeMarking: NegativeMarking(
        enabled: J.boolVal(negative['enabled']),
        every: J.intVal(negative['every'], 3),
        deduct: J.dbl(negative['deduct'], 1),
        allowNegativeScore: J.boolVal(negative['allowNegativeScore']),
      ),
      negativeMarks: J.dbl(negative['deducted']),
      answersStale: J.boolVal(json['answersStale']),
      questions: J.list(json['questions'], ReviewQuestion.fromJson),
      startedAt: J.dateOrNull(json['startedAt']),
      submittedAt: J.dateOrNull(json['submittedAt']),
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
