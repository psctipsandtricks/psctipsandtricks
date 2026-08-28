import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/data/models/mock_test.dart';

/// The lock on a live mock test is decided by the server and only reflected by
/// the app, so what matters here is that every shape the API can send maps to
/// the right verdict — a missed one lets an unpaid student into a paid sitting.
void main() {
  Map<String, dynamic> payload(Map<String, dynamic>? access) => {
        'id': 'mt1',
        'title': 'Kerala PSC Full Mock',
        'quizId': 'q1',
        'scheduledAt': '2026-09-01T10:00:00.000Z',
        'status': 'LIVE',
        'quiz': {'id': 'q1', 'title': 'Paper', 'price': 199, 'isPremium': true},
        if (access != null) 'access': access,
      };

  test('a paid test the student has not bought is locked', () {
    final mock = MockTest.fromJson(payload({
      'isPaid': true,
      'hasAccess': false,
      'price': 199,
      'reason': 'PAYMENT_REQUIRED',
    }));

    expect(mock.isPaid, isTrue);
    expect(mock.isLocked, isTrue);
    expect(mock.price, 199);
    expect(mock.access!.needsPayment, isTrue);
  });

  test('a signed-out visitor is sent to log in, not straight to payment', () {
    final mock = MockTest.fromJson(payload({
      'isPaid': true,
      'hasAccess': false,
      'price': 199,
      'reason': 'LOGIN_REQUIRED',
    }));

    expect(mock.isLocked, isTrue);
    expect(mock.access!.needsLogin, isTrue);
    expect(mock.access!.needsPayment, isFalse);
  });

  test('a settled purchase unlocks the test', () {
    final mock = MockTest.fromJson(payload({
      'isPaid': true,
      'hasAccess': true,
      'price': 199,
      'reason': 'PURCHASED',
    }));

    expect(mock.isPaid, isTrue);
    expect(mock.isLocked, isFalse);
  });

  test('a free test is never locked', () {
    final mock = MockTest.fromJson({
      ...payload({'isPaid': false, 'hasAccess': true, 'price': 0, 'reason': 'FREE'}),
      'quiz': {'id': 'q1', 'title': 'Paper', 'price': 0},
    });

    expect(mock.isPaid, isFalse);
    expect(mock.isLocked, isFalse);
    expect(mock.price, 0);
  });

  test('a payload with no access verdict is treated as open', () {
    // An app build newer than the API it is talking to must not lock students
    // out of free tests; the server still refuses join/submit either way.
    final mock = MockTest.fromJson(payload(null));

    expect(mock.access, isNull);
    expect(mock.isLocked, isFalse);
    // The quiz itself still reports that it is sold, so the card can say so.
    expect(mock.isPaid, isTrue);
    expect(mock.price, 199);
  });
}
