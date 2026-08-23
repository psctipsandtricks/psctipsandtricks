import '../../core/network/api_client.dart';
import '../../core/utils/json.dart';
import '../models/order.dart';

class OrdersRepository {
  OrdersRepository(this._api);

  final ApiClient _api;

  Future<List<Order>> fetchMyOrders() async {
    final res = await _api.get<dynamic>('/orders/me');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => Order.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  /// Opens a payment intent. The server recomputes the price from the item and
  /// the coupon, so the returned amount — not the locally derived one — is what
  /// gets charged.
  Future<CreatedOrder> createOrder({
    String? bookId,
    String? quizId,
    required double amount,
    String? couponCode,
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/orders',
      body: {
        if (bookId != null) 'bookId': bookId,
        if (quizId != null) 'quizId': quizId,
        'amount': amount,
        if (couponCode != null && couponCode.isNotEmpty) 'couponCode': couponCode,
      },
    );
    return CreatedOrder.fromJson(res);
  }

  /// Settles the order against the signature Razorpay handed back. Returns true
  /// only when the server marked it SUCCESS — the item stays locked otherwise.
  Future<bool> verifyPayment({
    required String orderId,
    required String paymentId,
    String? razorpayOrderId,
    String? razorpaySignature,
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/orders/verify',
      body: {
        'orderId': orderId,
        'paymentId': paymentId,
        if (razorpayOrderId != null) 'razorpayOrderId': razorpayOrderId,
        if (razorpaySignature != null) 'razorpaySignature': razorpaySignature,
      },
    );
    return J.str(res['status']).toUpperCase() == 'SUCCESS';
  }

  Future<Coupon> validateCoupon(String code) async {
    final res = await _api.get<Map<String, dynamic>>(
      '/coupons/validate',
      query: {'code': code.trim().toUpperCase()},
    );
    return Coupon.fromJson(res);
  }
}
