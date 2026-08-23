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
  final String? bookCoverUrl;
  final String? quizTitle;
  final String? razorpayPaymentId;
  final DateTime? createdAt;

  String get itemTitle => bookTitle ?? quizTitle ?? 'Purchase';
  bool get isBook => bookId != null;

  factory Order.fromJson(Map<String, dynamic> json) {
    final book = J.map(json['book']);
    final quiz = J.map(json['quiz']);
    return Order(
      id: J.str(json['id']),
      amount: J.dbl(json['amount']),
      currency: J.str(json['currency'], 'INR'),
      status: orderStatusFrom(json['status']),
      bookId: J.strOrNull(json['bookId']),
      quizId: J.strOrNull(json['quizId']),
      bookTitle: J.strOrNull(book['title']),
      bookCoverUrl: J.strOrNull(book['coverUrl']),
      quizTitle: J.strOrNull(quiz['title']),
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
