import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/theme/app_colors.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/book.dart';
import 'package:psc_tips_tricks_mobile/features/books/widgets/book_card.dart';

void main() {
  Book book({SubscriptionAccess? subscription, bool owned = true}) => Book(
        id: 'b1',
        title: 'Kerala History',
        author: 'PSC Tips And Tricks',
        description: 'Everything for the prelims.',
        coverUrl: '',
        price: 999,
        discountPercent: 0,
        finalPrice: 999,
        category: 'Kerala PSC',
        isPremium: true,
        downloadCount: 3,
        chaptersCount: 12,
        access: AccessState(
          isPaid: true,
          hasAccess: owned,
          price: 999,
          reason: owned ? AccessReason.purchased : AccessReason.paymentRequired,
          subscription: subscription,
        ),
      );

  SubscriptionAccess lapsing(int inDays) => SubscriptionAccess(
        isSubscription: true,
        isExpired: inDays <= 0,
        validTill: DateTime(2026, 10, 12),
        expiresInDays: inDays <= 0 ? 0 : inDays,
      );

  Future<void> pump(
    WidgetTester tester,
    Widget card, {
    Size size = const Size(420, 900),
    double textScale = 1.0,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light(),
      home: MediaQuery(
        data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
        child: Scaffold(body: Center(child: card)),
      ),
    ));
    await tester.pump();
  }

  /// The colour the line actually renders in — what tells a student at a glance
  /// how much runway is left.
  Color lineColour(WidgetTester tester) =>
      tester.widget<Text>(find.textContaining(RegExp('Valid till|Expired'))).style!.color!;

  group('a book held on a subscription', () {
    testWidgets('the card states when access runs out', (tester) async {
      await pump(tester, BookCard(book: book(subscription: lapsing(60))));

      expect(find.text('Valid till 12 Oct 2026'), findsOneWidget);
    });

    testWidgets('with time left the date is stated quietly', (tester) async {
      await pump(tester, BookCard(book: book(subscription: lapsing(60))));

      expect(lineColour(tester), AppTheme.light().extension<AppPalette>()!.textMuted);
    });

    testWidgets('inside the last week it turns amber', (tester) async {
      await pump(tester, BookCard(book: book(subscription: lapsing(3))));

      expect(find.text('Valid till 12 Oct 2026'), findsOneWidget);
      expect(lineColour(tester), AppColors.amber);
    });

    testWidgets('once lapsed it says so, in red', (tester) async {
      await pump(
        tester,
        BookCard(book: book(subscription: lapsing(0), owned: false)),
      );

      expect(find.text('Expired 12 Oct 2026'), findsOneWidget);
      expect(find.textContaining('Valid till'), findsNothing);
      expect(lineColour(tester), AppColors.rose);
    });

    testWidgets('the home carousel tile carries the same date', (tester) async {
      await pump(tester, BookTile(book: book(subscription: lapsing(60))));

      expect(find.text('Valid till 12 Oct 2026'), findsOneWidget);
    });
  });

  group('a book that does not lapse', () {
    testWidgets('a book owned outright gets no validity line', (tester) async {
      await pump(tester, BookCard(book: book()));

      expect(find.textContaining('Valid till'), findsNothing);
      expect(find.textContaining('Expired'), findsNothing);
      // The card still says what it always said.
      expect(find.text('OWNED'), findsOneWidget);
    });

    testWidgets('nor does an unpurchased book on the shelf', (tester) async {
      await pump(tester, BookCard(book: book(owned: false)));

      expect(find.textContaining('Valid till'), findsNothing);
    });

    testWidgets('a subscription with no date stays silent rather than half-empty',
        (tester) async {
      await pump(
        tester,
        BookCard(
          book: book(
            subscription: const SubscriptionAccess(
              isSubscription: true,
              isExpired: false,
            ),
          ),
        ),
      );

      expect(find.textContaining('Valid till'), findsNothing);
      expect(find.textContaining('—'), findsNothing);
    });
  });

  group('an extra line has to fit the cards that were already tight', () {
    testWidgets('both cards survive the largest text sizes', (tester) async {
      for (final scale in [1.0, 1.3, 1.6, 2.0]) {
        await pump(
          tester,
          BookCard(book: book(subscription: lapsing(3))),
          textScale: scale,
        );
        expect(tester.takeException(), isNull, reason: 'BookCard at $scale');

        await pump(
          tester,
          BookTile(book: book(subscription: lapsing(3))),
          textScale: scale,
        );
        expect(tester.takeException(), isNull, reason: 'BookTile at $scale');
      }
    });

    testWidgets('a narrow phone still fits the date', (tester) async {
      await pump(
        tester,
        BookCard(book: book(subscription: lapsing(60))),
        size: const Size(320, 640),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('Valid till 12 Oct 2026'), findsOneWidget);
    });
  });

  testWidgets('the date survives the trip from the API payload',
      (tester) async {
    // Field-for-field what `redactBookList` in book-access.service.ts emits, so
    // a rename on either side fails here rather than silently blanking the card.
    final parsed = Book.fromJson({
      'id': 'b1',
      'title': 'Kerala History',
      'author': 'PSC Tips And Tricks',
      'description': 'Everything for the prelims.',
      'coverUrl': '',
      'price': 999,
      'discountPercent': 0,
      'finalPrice': 999,
      'category': 'Kerala PSC',
      'isPremium': true,
      'downloadCount': 3,
      'access': {
        'isPaid': true,
        'hasAccess': true,
        'price': 999,
        'reason': 'PURCHASED',
        'subscription': {
          'isSubscription': true,
          'validTill': '2026-10-12T00:00:00.000Z',
          'isExpired': false,
          'expiresInDays': 41,
        },
      },
    });

    await pump(tester, BookCard(book: parsed));

    expect(find.textContaining('Valid till'), findsOneWidget);
  });
}
