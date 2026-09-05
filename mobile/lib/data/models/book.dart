import '../../core/utils/json.dart';
import 'pdf_sync.dart';

/// Why the API granted or withheld access to a book or quiz.
enum AccessReason { free, purchased, staff, loginRequired, paymentRequired }

AccessReason _reasonFrom(dynamic v) {
  switch (J.str(v).toUpperCase()) {
    case 'FREE':
      return AccessReason.free;
    case 'PURCHASED':
      return AccessReason.purchased;
    case 'STAFF':
      return AccessReason.staff;
    case 'LOGIN_REQUIRED':
      return AccessReason.loginRequired;
    default:
      return AccessReason.paymentRequired;
  }
}

/// When a paid book is sold as a subscription rather than outright, this is
/// when the entitlement lapses. Mirrors `BookSubscriptionAccessInfo` on the API.
class SubscriptionAccess {
  const SubscriptionAccess({
    required this.isSubscription,
    required this.isExpired,
    this.validTill,
    this.expiresInDays,
  });

  final bool isSubscription;
  final bool isExpired;
  final DateTime? validTill;
  final int? expiresInDays;

  /// True while the subscription is live but close enough to lapsing that the
  /// student should be warned before they rely on an offline copy.
  bool get isExpiringSoon =>
      !isExpired && expiresInDays != null && expiresInDays! <= 7;

  factory SubscriptionAccess.fromJson(Map<String, dynamic> json) =>
      SubscriptionAccess(
        isSubscription: J.boolVal(json['isSubscription'], true),
        isExpired: J.boolVal(json['isExpired']),
        validTill: J.dateOrNull(json['validTill']),
        expiresInDays: J.intOrNull(json['expiresInDays']),
      );
}

/// The caller's purchase state, attached by the API to books and quizzes.
class AccessState {
  const AccessState({
    required this.isPaid,
    required this.hasAccess,
    required this.price,
    required this.reason,
    this.subscription,
  });

  final bool isPaid;
  final bool hasAccess;
  final double price;
  final AccessReason reason;

  /// Present only for subscription-style purchases; null means the entitlement
  /// does not lapse.
  final SubscriptionAccess? subscription;

  bool get needsLogin => reason == AccessReason.loginRequired;
  bool get needsPayment => reason == AccessReason.paymentRequired;

  /// When this entitlement runs out, or null when it never does.
  DateTime? get validTill => subscription?.validTill;

  factory AccessState.fromJson(Map<String, dynamic> json) => AccessState(
        isPaid: J.boolVal(json['isPaid']),
        hasAccess: J.boolVal(json['hasAccess'], false),
        price: J.dbl(json['price']),
        reason: _reasonFrom(json['reason']),
        subscription: json['subscription'] is Map
            ? SubscriptionAccess.fromJson(J.map(json['subscription']))
            : null,
      );
}

class Book {
  const Book({
    required this.id,
    required this.title,
    required this.author,
    required this.description,
    required this.coverUrl,
    required this.price,
    required this.discountPercent,
    required this.finalPrice,
    required this.category,
    required this.isPremium,
    required this.downloadCount,
    this.heroCoverUrl,
    this.previewPdfUrl,
    this.previewAudioUrl,
    this.publicationYear,
    this.chaptersCount,
    this.topicsCount,
    this.access,
    this.chapters = const [],
    this.createdAt,
  });

  final String id;
  final String title;
  final String author;
  final String description;
  final String coverUrl;
  final String? heroCoverUrl;
  final String? previewPdfUrl;
  final String? previewAudioUrl;
  final double price;
  final int discountPercent;

  /// Server-computed charged price — always trust this over local arithmetic.
  final double finalPrice;
  final String category;
  final int? publicationYear;
  final bool isPremium;
  final int downloadCount;
  final int? chaptersCount;
  final int? topicsCount;
  final AccessState? access;
  final List<Chapter> chapters;
  final DateTime? createdAt;

  /// Added recently enough to be worth flagging on a card.
  bool get isNew => isRecent(createdAt);

  /// The lapse date on the student's *own* entitlement, or null when there is
  /// nothing to lapse. Note this is absent for a book merely sold as a
  /// subscription: the API only attaches one once the book has been bought,
  /// since until then there is no date to show.
  SubscriptionAccess? get subscription => access?.subscription;

  /// The 16:9 catalog cover image uploaded from Admin Panel (`coverUrl`), falling back to hero cover.
  String get effectiveCatalogCoverUrl {
    final cover = coverUrl.trim();
    if (cover.isNotEmpty) return cover;
    return (heroCoverUrl?.trim() ?? '');
  }

  /// The 2:3 book size hero banner cover image (`heroCoverUrl`), falling back to catalog cover.
  String get effectiveHeroCoverUrl {
    final hero = heroCoverUrl?.trim();
    if (hero != null && hero.isNotEmpty) return hero;
    return coverUrl.trim();
  }

  /// The standard catalog cover image if available, falling back to hero cover.
  String get effectiveCoverUrl => effectiveCatalogCoverUrl;

  bool get isFree => finalPrice <= 0 && price <= 0 && !isPremium;
  bool get hasDiscount => discountPercent > 0 && finalPrice < price;
  bool get isUnlocked => access?.hasAccess ?? isFree;

  factory Book.fromJson(Map<String, dynamic> json) => Book(
        id: J.str(json['id']),
        title: J.str(json['title']),
        author: J.str(json['author']),
        description: J.str(json['description']),
        coverUrl: J.str(json['coverUrl']),
        heroCoverUrl: J.strOrNull(json['heroCoverUrl']),
        previewPdfUrl: J.strOrNull(json['previewPdfUrl']),
        previewAudioUrl: J.strOrNull(json['previewAudioUrl']),
        price: J.dbl(json['price']),
        discountPercent: J.intVal(json['discountPercent']),
        finalPrice: J.dbl(json['finalPrice'], J.dbl(json['price'])),
        category: J.str(json['category']),
        publicationYear: J.intOrNull(json['publicationYear']),
        isPremium: J.boolVal(json['isPremium']),
        downloadCount: J.intVal(json['downloadCount']),
        chaptersCount: J.intOrNull(json['chaptersCount']),
        topicsCount: J.intOrNull(json['topicsCount']),
        access: json['access'] is Map
            ? AccessState.fromJson(J.map(json['access']))
            : null,
        chapters: J.list(json['chapters'], Chapter.fromJson),
        createdAt: J.dateOrNull(json['createdAt']),
      );
}

/// How recently something must have been published to earn a "New" badge.
///
/// Two weeks: long enough that a student who opens the app weekly still sees
/// what arrived since their last visit, short enough that the badge keeps
/// meaning something.
const newContentWindow = Duration(days: 14);

bool isRecent(DateTime? createdAt) =>
    createdAt != null && DateTime.now().difference(createdAt) < newContentWindow;

class Chapter {
  const Chapter({
    required this.id,
    required this.bookId,
    required this.title,
    required this.orderIndex,
    this.description,
    this.textContent,
    this.youtubeUrl,
    this.audioUrl,
    this.pdfUrl,
    this.topicsCount,
    this.topics = const [],
  });

  final String id;
  final String bookId;
  final String title;
  final String? description;
  final int orderIndex;
  final String? textContent;
  final String? youtubeUrl;
  final String? audioUrl;
  final String? pdfUrl;
  final int? topicsCount;
  final List<Topic> topics;

  factory Chapter.fromJson(Map<String, dynamic> json) => Chapter(
        id: J.str(json['id']),
        bookId: J.str(json['bookId']),
        title: J.str(json['title']),
        description: J.strOrNull(json['description']),
        orderIndex: J.intVal(json['orderIndex']),
        textContent: J.strOrNull(json['textContent']),
        youtubeUrl: J.strOrNull(json['youtubeUrl']),
        audioUrl: J.strOrNull(json['audioUrl']),
        pdfUrl: J.strOrNull(json['pdfUrl']),
        topicsCount: J.intOrNull(json['topicsCount']),
        topics: J.list(json['topics'], Topic.fromJson),
      );
}

class Topic {
  const Topic({
    required this.id,
    required this.chapterId,
    required this.title,
    required this.orderIndex,
    this.description,
    this.youtubeUrl,
    this.audioUrl,
    this.pdfUrl,
    this.syncCues,
    this.subtopics = const [],
  });

  final String id;
  final String chapterId;
  final String title;
  final String? description;
  final int orderIndex;
  final String? youtubeUrl;
  final String? audioUrl;
  final String? pdfUrl;

  /// PDF↔audio timing map, when the admin panel has one for this unit.
  final PdfSyncMap? syncCues;
  final List<Subtopic> subtopics;

  factory Topic.fromJson(Map<String, dynamic> json) => Topic(
        id: J.str(json['id']),
        chapterId: J.str(json['chapterId']),
        title: J.str(json['title']),
        description: J.strOrNull(json['description']),
        orderIndex: J.intVal(json['orderIndex']),
        youtubeUrl: J.strOrNull(json['youtubeUrl']),
        audioUrl: J.strOrNull(json['audioUrl']),
        pdfUrl: J.strOrNull(json['pdfUrl']),
        syncCues: PdfSyncMap.fromDynamic(json['syncCues']),
        subtopics: J.list(json['subtopics'], Subtopic.fromJson),
      );
}

class Subtopic {
  const Subtopic({
    required this.id,
    required this.topicId,
    required this.title,
    required this.orderIndex,
    this.description,
    this.youtubeUrl,
    this.audioUrl,
    this.pdfUrl,
    this.syncCues,
  });

  final String id;
  final String topicId;
  final String title;
  final String? description;
  final int orderIndex;
  final String? youtubeUrl;
  final String? audioUrl;
  final String? pdfUrl;

  /// PDF↔audio timing map, when the admin panel has one for this unit.
  final PdfSyncMap? syncCues;

  factory Subtopic.fromJson(Map<String, dynamic> json) => Subtopic(
        id: J.str(json['id']),
        topicId: J.str(json['topicId']),
        title: J.str(json['title']),
        description: J.strOrNull(json['description']),
        orderIndex: J.intVal(json['orderIndex']),
        youtubeUrl: J.strOrNull(json['youtubeUrl']),
        audioUrl: J.strOrNull(json['audioUrl']),
        pdfUrl: J.strOrNull(json['pdfUrl']),
        syncCues: PdfSyncMap.fromDynamic(json['syncCues']),
      );
}

/// `GET /books/:id/reader` — the whole book tree in one request.
class BookReaderContent {
  const BookReaderContent({
    required this.bookId,
    required this.title,
    required this.author,
    required this.coverUrl,
    required this.category,
    required this.chapters,
  });

  final String bookId;
  final String title;
  final String author;
  final String coverUrl;
  final String category;
  final List<Chapter> chapters;

  factory BookReaderContent.fromJson(Map<String, dynamic> json) {
    final book = J.map(json['book']);
    return BookReaderContent(
      bookId: J.str(book['id']),
      title: J.str(book['title']),
      author: J.str(book['author']),
      coverUrl: J.str(book['coverUrl']),
      category: J.str(book['category']),
      chapters: J.list(json['chapters'], Chapter.fromJson),
    );
  }
}

class ReadingProgress {
  const ReadingProgress({
    required this.bookId,
    required this.progressPercent,
    this.chapterId,
    this.topicId,
    this.lastReadAt,
  });

  final String bookId;
  final String? chapterId;
  final String? topicId;
  final int progressPercent;
  final DateTime? lastReadAt;

  factory ReadingProgress.fromJson(Map<String, dynamic> json) => ReadingProgress(
        bookId: J.str(json['bookId']),
        chapterId: J.strOrNull(json['chapterId']),
        topicId: J.strOrNull(json['topicId']),
        progressPercent: J.intVal(json['progressPercent']),
        lastReadAt: J.dateOrNull(json['lastReadAt']),
      );
}
