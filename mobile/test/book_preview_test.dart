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
import 'package:psc_tips_tricks_mobile/features/books/widgets/reader_audio_player.dart';

/// The real controller, minus the platform call.
///
/// `load` reaches just_audio, which under the test binding leaves a retry
/// timer behind that outlives the test. Everything this suite asserts is about
/// which widgets the page offers, not about decoding a clip.
class _SilentAudio extends ReaderAudioController {
  String? loadedUrl;

  @override
  Future<void> load(String url, {String? label, bool autoPlay = false}) async {
    loadedUrl = url;
    title.value = label;
  }
}

void main() {
  Book book({
    required bool owned,
    String? previewPdfUrl = 'https://cdn.test/preview.pdf',
    String? previewAudioUrl = 'https://cdn.test/sample.m4a',
  }) =>
      Book(
        id: 'b1',
        title: 'Kerala History',
        author: 'PSC Tips And Tricks',
        description: 'Everything for the prelims.',
        coverUrl: '',
        price: 999,
        discountPercent: 50,
        finalPrice: 499,
        category: 'Kerala PSC',
        isPremium: true,
        downloadCount: 3,
        previewPdfUrl: previewPdfUrl,
        previewAudioUrl: previewAudioUrl,
        access: AccessState(
          isPaid: true,
          hasAccess: owned,
          price: 499,
          reason: owned ? AccessReason.purchased : AccessReason.paymentRequired,
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

  group('a locked book', () {
    testWidgets('offers both the sample pages and the sample audio',
        (tester) async {
      await pump(tester, book(owned: false));

      expect(find.text('Unlock full access'), findsOneWidget);
      expect(find.text('FREE PREVIEW'), findsOneWidget);
      expect(find.text('Read sample pages'), findsOneWidget);
      // The sample clip is playable, not just advertised — and the player is
      // pointed at the book's own preview audio.
      expect(find.byType(ReaderAudioPlayer), findsOneWidget);
      expect(
        find.byWidgetPredicate((w) =>
            w is ReaderAudioPlayer && w.url == 'https://cdn.test/sample.m4a'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows only what the book actually has', (tester) async {
      await pump(tester, book(owned: false, previewAudioUrl: null));

      expect(find.text('Read sample pages'), findsOneWidget);
      expect(find.byType(ReaderAudioPlayer), findsNothing);
    });

    testWidgets('a book with no preview at all shows no preview section',
        (tester) async {
      await pump(
        tester,
        book(owned: false, previewPdfUrl: null, previewAudioUrl: null),
      );

      expect(find.text('Unlock full access'), findsOneWidget);
      expect(find.text('FREE PREVIEW'), findsNothing);
    });
  });

  group('a purchased book', () {
    testWidgets('reads, and is not asked to pay again', (tester) async {
      await pump(tester, book(owned: true));

      expect(find.text('Start reading'), findsOneWidget);
      expect(find.text('Unlock full access'), findsNothing);
      // No price, no discount pill: it is already theirs.
      expect(find.text('50% OFF'), findsNothing);
    });

    testWidgets('is not offered a sample of something it already owns',
        (tester) async {
      await pump(tester, book(owned: true));

      expect(find.text('FREE PREVIEW'), findsNothing);
      expect(find.byType(ReaderAudioPlayer), findsNothing);
    });
  });
}
