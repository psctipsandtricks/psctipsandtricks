import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/data/models/book.dart';
import 'package:psc_tips_tricks_mobile/data/models/offline.dart';

void main() {
  group('Expired book removal and access blocking', () {
    test('OfflineBook with past validTill is marked expired and unreadable', () {
      final expiredBook = OfflineBook(
        bookId: 'book-expired-1',
        title: 'PSC Hot Topics (Expired)',
        author: 'PSC Tips',
        category: 'Kerala PSC',
        coverAssetId: 'cover-1',
        readerJson: const {'title': 'PSC Hot Topics', 'chapters': []},
        assets: const [],
        lease: OfflineLease(
          grantedAt: DateTime.now().subtract(const Duration(days: 40)),
          lastVerifiedAt: DateTime.now().subtract(const Duration(days: 10)),
          validTill: DateTime.now().subtract(const Duration(hours: 1)),
        ),
        downloadedAt: DateTime.now().subtract(const Duration(days: 35)),
        complete: true,
      );

      expect(expiredBook.lease.isExpired, isTrue);
      expect(expiredBook.isReadable, isFalse);
      expect(expiredBook.status, OfflineStatus.expired);
    });

    test('OfflineBook with future validTill is active and readable', () {
      final activeBook = OfflineBook(
        bookId: 'book-active-1',
        title: 'PSC Hot Topics (Active)',
        author: 'PSC Tips',
        category: 'Kerala PSC',
        coverAssetId: 'cover-1',
        readerJson: const {'title': 'PSC Hot Topics', 'chapters': []},
        assets: const [],
        lease: OfflineLease(
          grantedAt: DateTime.now().subtract(const Duration(days: 5)),
          lastVerifiedAt: DateTime.now().subtract(const Duration(days: 1)),
          validTill: DateTime.now().add(const Duration(days: 30)),
        ),
        downloadedAt: DateTime.now().subtract(const Duration(days: 5)),
        complete: true,
      );

      expect(activeBook.lease.isExpired, isFalse);
      expect(activeBook.isReadable, isTrue);
      expect(activeBook.status, OfflineStatus.ready);
    });

    test('OfflineBook with revoked lease is marked expired and unreadable', () {
      final revokedBook = OfflineBook(
        bookId: 'book-revoked-1',
        title: 'PSC Hot Topics (Revoked)',
        author: 'PSC Tips',
        category: 'Kerala PSC',
        coverAssetId: 'cover-1',
        readerJson: const {'title': 'PSC Hot Topics', 'chapters': []},
        assets: const [],
        lease: OfflineLease(
          grantedAt: DateTime.now().subtract(const Duration(days: 5)),
          lastVerifiedAt: DateTime.now().subtract(const Duration(days: 1)),
          validTill: DateTime.now().add(const Duration(days: 30)),
          revoked: true,
        ),
        downloadedAt: DateTime.now().subtract(const Duration(days: 5)),
        complete: true,
      );

      expect(revokedBook.lease.isExpired, isTrue);
      expect(revokedBook.isReadable, isFalse);
      expect(revokedBook.status, OfflineStatus.expired);
    });

    test('Book model access state correctly identifies expired subscription', () {
      final expiredBook = Book(
        id: 'book-sub-expired',
        title: 'PSC Hot Topics',
        author: 'PSC Tips',
        description: 'Test book',
        coverUrl: 'https://example.com/cover.jpg',
        price: 499,
        discountPercent: 60,
        finalPrice: 199,
        category: 'Kerala PSC',
        isPremium: true,
        downloadCount: 0,
        access: AccessState(
          isPaid: true,
          hasAccess: false,
          price: 199,
          reason: AccessReason.paymentRequired,
          subscription: SubscriptionAccess(
            isSubscription: true,
            isExpired: true,
            validTill: DateTime.now().subtract(const Duration(days: 2)),
          ),
        ),
      );

      expect(expiredBook.isUnlocked, isFalse);
      expect(expiredBook.subscription?.isExpired, isTrue);
    });
  });
}
