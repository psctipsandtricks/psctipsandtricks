import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/book.dart';
import 'package:psc_tips_tricks_mobile/features/books/book_detail_screen.dart';
import 'package:psc_tips_tricks_mobile/features/books/books_providers.dart';
import 'package:psc_tips_tricks_mobile/features/books/reader_audio_controller.dart';

/// The real controller, minus the platform call — see `book_preview_test.dart`.
class _SilentAudio extends ReaderAudioController {
  @override
  Future<void> load(
    String url, {
    String? label,
    String? album,
    bool autoPlay = false,
    Duration? initialPosition,
  }) async {
    title.value = label;
  }
}

void main() {
  Book book({
    required bool owned,
    String? subscriptionType,
    String? subscriptionDuration,
    SubscriptionAccess? held,
  }) =>
      Book(
        id: 'b1',
        title: 'PSC Hot Topics',
        author: 'PSC Tips And Tricks',
        description: 'Everything for the prelims.',
        coverUrl: '',
        price: 499,
        discountPercent: 60,
        finalPrice: 199,
        category: 'Kerala PSC',
        isPremium: true,
        downloadCount: 26,
        subscriptionType: subscriptionType,
        subscriptionDuration: subscriptionDuration,
        access: AccessState(
          isPaid: true,
          hasAccess: owned,
          price: 199,
          reason: owned ? AccessReason.purchased : AccessReason.paymentRequired,
          subscription: held,
        ),
      );

  Future<void> pump(WidgetTester tester, Book value) async {
    tester.view.physicalSize = const Size(400, 1400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final audio = _SilentAudio();
    addTearDown(audio.dispose);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        sharedPrefsProvider.overrideWithValue(prefs),
        readerAudioProvider.overrideWithValue(audio),
        bookDetailProvider.overrideWith((ref, id) async => value),
        bookProgressProvider.overrideWith((ref, id) async => null),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const BookDetailScreen(bookId: 'b1'),
      ),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
  }

  group('what a book is being sold as', () {
    testWidgets('a one-year subscription says so, not "Lifetime access"',
        (tester) async {
      // The bug this exists for: every paid book claimed lifetime access,
      // including the ones that lapse after a year.
      await pump(tester, book(
        owned: false,
        subscriptionType: 'SUBSCRIPTION',
        subscriptionDuration: '1_YEAR',
      ));

      expect(find.text('1 year access'), findsOneWidget);
      expect(find.text('Lifetime access'), findsNothing);
    });

    testWidgets('shorter terms read the same way', (tester) async {
      await pump(tester, book(
        owned: false,
        subscriptionType: 'SUBSCRIPTION',
        subscriptionDuration: '6_MONTHS',
      ));

      expect(find.text('6 months access'), findsOneWidget);
    });

    testWidgets('a term this build does not know is still not lifetime',
        (tester) async {
      // Better a vaguer true statement than a precise false one.
      await pump(tester, book(
        owned: false,
        subscriptionType: 'SUBSCRIPTION',
        subscriptionDuration: '2_YEARS',
      ));

      expect(find.text('Limited access'), findsOneWidget);
      expect(find.text('Lifetime access'), findsNothing);
    });

    testWidgets('a book bought outright still says lifetime', (tester) async {
      await pump(tester, book(owned: false, subscriptionType: 'FULL_TIME_ACCESS'));

      expect(find.text('Lifetime access'), findsOneWidget);
    });

    testWidgets('a book with no terms stated says lifetime', (tester) async {
      // An older API build, or a row predating the field — the historical
      // meaning of "no subscription type" is a one-off purchase.
      await pump(tester, book(owned: false));

      expect(find.text('Lifetime access'), findsOneWidget);
    });
  });

  group('what the student currently holds', () {
    SubscriptionAccess active(int days) => SubscriptionAccess(
          isSubscription: true,
          isExpired: false,
          validTill: DateTime(2027, 9, 4),
          expiresInDays: days,
        );

    testWidgets('an owned subscription states the date it runs out',
        (tester) async {
      await pump(tester, book(
        owned: true,
        subscriptionType: 'SUBSCRIPTION',
        subscriptionDuration: '1_YEAR',
        held: active(300),
      ));

      expect(find.text('Valid until 4 Sep 2027'), findsOneWidget);
      expect(find.text('Start reading'), findsOneWidget);
      // Far off, so the countdown would only be noise.
      expect(find.textContaining('days left'), findsNothing);
    });

    testWidgets('the last month counts down', (tester) async {
      await pump(tester, book(
        owned: true,
        subscriptionType: 'SUBSCRIPTION',
        subscriptionDuration: '1_YEAR',
        held: active(12),
      ));

      expect(find.text('Valid until 4 Sep 2027'), findsOneWidget);
      expect(find.text('12 days left'), findsOneWidget);
    });

    testWidgets('a lapsed subscription says when it ended, and offers renewal',
        (tester) async {
      // Access is withdrawn, so the page is back to its locked state — the
      // date is what stops "Unlock full access" reading as though they never
      // paid at all.
      await pump(tester, book(
        owned: false,
        subscriptionType: 'SUBSCRIPTION',
        subscriptionDuration: '1_YEAR',
        held: SubscriptionAccess(
          isSubscription: true,
          isExpired: true,
          validTill: DateTime(2026, 9, 8),
          expiresInDays: 0,
        ),
      ));

      expect(find.text('Expired 8 Sep 2026'), findsOneWidget);
      expect(find.text('Unlock full access'), findsOneWidget);
      expect(find.text('Lifetime access'), findsNothing);
    });

    testWidgets('a book owned outright makes no promise about a date',
        (tester) async {
      await pump(tester, book(owned: true, subscriptionType: 'FULL_TIME_ACCESS'));

      expect(find.text('Start reading'), findsOneWidget);
      expect(find.textContaining('Valid until'), findsNothing);
    });
  });

  group('the model reads the terms the API already sends', () {
    test('subscription fields survive the wire', () {
      final parsed = Book.fromJson(const {
        'id': 'b1',
        'title': 'PSC Hot Topics',
        'author': 'PSC',
        'description': '',
        'coverUrl': '',
        'price': 499,
        'finalPrice': 199,
        'discountPercent': 60,
        'category': 'Kerala PSC',
        'isPremium': true,
        'downloadCount': 26,
        'subscriptionType': 'SUBSCRIPTION',
        'subscriptionDuration': '1_YEAR',
      });

      expect(parsed.isSubscriptionBook, isTrue);
      expect(parsed.subscriptionTermLabel, '1 year');
    });

    test('every term the admin panel can set has words for it', () {
      Book withDuration(String d) => Book(
            id: 'b1',
            title: '',
            author: '',
            description: '',
            coverUrl: '',
            price: 1,
            discountPercent: 0,
            finalPrice: 1,
            category: '',
            isPremium: true,
            downloadCount: 0,
            subscriptionType: 'SUBSCRIPTION',
            subscriptionDuration: d,
          );

      expect(withDuration('1_MONTH').subscriptionTermLabel, '1 month');
      expect(withDuration('3_MONTHS').subscriptionTermLabel, '3 months');
      expect(withDuration('6_MONTHS').subscriptionTermLabel, '6 months');
      expect(withDuration('1_YEAR').subscriptionTermLabel, '1 year');
    });

    test('a book that is not a subscription has no term', () {
      final parsed = Book.fromJson(const {
        'id': 'b1',
        'title': '',
        'author': '',
        'description': '',
        'coverUrl': '',
        'price': 1,
        'finalPrice': 1,
        'category': '',
        'isPremium': true,
        'subscriptionType': 'FULL_TIME_ACCESS',
      });

      expect(parsed.isSubscriptionBook, isFalse);
      expect(parsed.subscriptionTermLabel, isNull);
    });
  });
}
