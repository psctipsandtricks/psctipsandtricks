import '../../core/utils/json.dart';

enum OrderStatus { pending, success, failed, refunded }

OrderStatus orderStatusFrom(dynamic v) {
  switch (J.str(v).toUpperCase()) {
    case 'SUCCESS':
      return OrderStatus.success;
    case 'FAILED':
      return OrderStatus.failed;
    case 'REFUNDED':
      return OrderStatus.refunded;
    default:
      return OrderStatus.pending;
  }
}

class Order {
  const Order({
    required this.id,
    required this.amount,
    required this.currency,
    required this.status,
    this.bookId,
    this.quizId,
    this.bookTitle,
    this.bookCoverUrl,
    this.bookHeroCoverUrl,
    this.quizTitle,
    this.razorpayPaymentId,
    this.createdAt,
  });

  final String id;
  final double amount;
  final String currency;
  final OrderStatus status;
  final String? bookId;
  final String? quizId;
  final String? bookTitle;

  /// The 16:9 catalog cover (`book.coverUrl`).
  final String? bookCoverUrl;

  /// The 3:4 book-size hero cover uploaded from the Admin Panel (`book.heroCoverUrl`).
  final String? bookHeroCoverUrl;
  final String? quizTitle;
  final String? razorpayPaymentId;
  final DateTime? createdAt;

  String get itemTitle {
    final bt = bookTitle?.trim();
    if (bt != null && bt.isNotEmpty) return bt;
    final qt = quizTitle?.trim();
    if (qt != null && qt.isNotEmpty) return qt;
    if (isBook) return 'E-Book (Unavailable)';
    if (quizId != null && quizId!.trim().isNotEmpty) return 'Question Bank (Unavailable)';
    return 'Purchased Product (Unavailable)';
  }
  bool get isBook => bookId != null;

  /// Prefer the 3:4 hero cover for book artwork, falling back to the catalog cover.
  String? get bookArtworkUrl {
    final hero = bookHeroCoverUrl?.trim();
    if (hero != null && hero.isNotEmpty) return hero;
    final cover = bookCoverUrl?.trim();
    if (cover != null && cover.isNotEmpty) return cover;
    return null;
  }

  factory Order.fromJson(Map<String, dynamic> json) {
    final book = J.map(json['book']);
    final quiz = J.map(json['quiz']);
    return Order(
      id: J.str(json['id']),
      amount: J.dbl(json['amount']),
      currency: J.str(json['currency'], 'INR'),
      status: orderStatusFrom(json['status']),
      bookId: J.strOrNull(json['bookId']) ?? J.strOrNull(book['id']),
      quizId: J.strOrNull(json['quizId']) ?? J.strOrNull(quiz['id']),
      bookTitle: J.strOrNull(book['title']) ?? J.strOrNull(json['bookTitle']),
      bookCoverUrl: J.strOrNull(book['coverUrl']) ?? J.strOrNull(json['bookCoverUrl']),
      bookHeroCoverUrl: J.strOrNull(book['heroCoverUrl']) ?? J.strOrNull(json['bookHeroCoverUrl']),
      quizTitle: J.strOrNull(quiz['title']) ?? J.strOrNull(json['quizTitle']),
      razorpayPaymentId: J.strOrNull(json['razorpayPaymentId']),
      createdAt: J.dateOrNull(json['createdAt']),
    );
  }
}

/// `POST /orders` — the payment intent the server created for this purchase.
class CreatedOrder {
  const CreatedOrder({
    required this.id,
    required this.amount,
    required this.currency,
    this.razorpayOrderId,
    this.keyId,
    this.isSimulated = false,
  });

  final String id;
  final double amount;
  final String currency;
  final String? razorpayOrderId;
  final String? keyId;

  /// True when the server has no live Razorpay credentials and issued a
  /// stand-in order. The checkout sheet settles these without opening Razorpay.
  final bool isSimulated;

  factory CreatedOrder.fromJson(Map<String, dynamic> json) {
    final rzpOrderId = J.strOrNull(json['razorpayOrderId']);
    return CreatedOrder(
      id: J.str(json['id']),
      amount: J.dbl(json['amount']),
      currency: J.str(json['currency'], 'INR'),
      razorpayOrderId: rzpOrderId,
      keyId: J.strOrNull(json['keyId']),
      isSimulated: J.boolVal(json['isSimulated']) ||
          (rzpOrderId?.startsWith('order_sim_') ?? false),
    );
  }
}

class Coupon {
  const Coupon({
    required this.code,
    required this.discountPercent,
    required this.maxDiscountAmount,
  });

  final String code;
  final int discountPercent;
  final double maxDiscountAmount;

  /// Percentage off, capped at `maxDiscountAmount` — mirrors the server rule in
  /// `orders.service.ts`, so the total shown is the amount actually charged.
  double discountOn(double basePrice) {
    final raw = basePrice * discountPercent / 100;
    return raw < maxDiscountAmount ? raw : maxDiscountAmount;
  }

  factory Coupon.fromJson(Map<String, dynamic> json) => Coupon(
        code: J.str(json['code']).toUpperCase(),
        discountPercent: J.intVal(json['discountPercent']),
        maxDiscountAmount: J.dbl(json['maxDiscountAmount']),
      );
}
