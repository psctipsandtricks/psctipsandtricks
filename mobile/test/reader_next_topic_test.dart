import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:psc_tips_tricks_mobile/core/network/api_client.dart';
import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/router/app_router.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:psc_tips_tricks_mobile/data/models/book.dart';
import 'package:psc_tips_tricks_mobile/data/repositories/books_repository.dart';
import 'package:psc_tips_tricks_mobile/features/books/book_reader_screen.dart';
import 'package:psc_tips_tricks_mobile/features/books/books_providers.dart';
import 'package:psc_tips_tricks_mobile/features/books/reader_audio_controller.dart';
import 'package:psc_tips_tricks_mobile/features/pdfs/widgets/pdf_document_view.dart';

/// The reader writes its position as it closes; left real that opens a Dio
/// request whose timeout outlives the test binding.
class _SilentBooks extends BooksRepository {
  _SilentBooks() : super(ApiClient(tokenStore: TokenStore()));

  @override
  Future<void> saveProgress({
    required String bookId,
    String? chapterId,
    String? topicId,
    required int progressPercent,
  }) async {}
}

/// The real controller with the platform call taken out, so `playing` can be
/// driven by hand.
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
    if (autoPlay) playing.value = true;
  }
}

void main() {
  const bookId = 'b1';

  group('offering the next topic', () {
    // The button itself hangs off a native platform view reporting its page
    // count, which no widget test has — so the rule that decides it is held
    // here, and the wiring is exercised by the reader test below.
    const lastPage = PdfViewState(currentPage: 4, pageCount: 5);
    const midDocument = PdfViewState(currentPage: 2, pageCount: 5);

    test('at the end of the notes, with a topic to go to', () {
      expect(
        readerOffersNextTopic(
          document: lastPage,
          hasNextTopic: true,
          audioPlaying: false,
        ),
        isTrue,
      );
    });

    test('not part-way through the notes', () {
      expect(
        readerOffersNextTopic(
          document: midDocument,
          hasNextTopic: true,
          audioPlaying: false,
        ),
        isFalse,
      );
    });

    test('never while narration is playing', () {
      // The clip walks the student into the next topic when it plays out; a
      // button competing with that would let them arrive twice.
      expect(
        readerOffersNextTopic(
          document: lastPage,
          hasNextTopic: true,
          audioPlaying: true,
        ),
        isFalse,
      );
    });

    test('not on the last topic of the book', () {
      expect(
        readerOffersNextTopic(
          document: lastPage,
          hasNextTopic: false,
          audioPlaying: false,
        ),
        isFalse,
      );
    });

    test('not before the document has reported itself', () {
      expect(
        readerOffersNextTopic(
          document: null,
          hasNextTopic: true,
          audioPlaying: false,
        ),
        isFalse,
      );
      // A document mid-swap: a page count of zero is "not loaded", not "one
      // page long and already finished".
      expect(
        readerOffersNextTopic(
          document: const PdfViewState(currentPage: 0, pageCount: 0),
          hasNextTopic: true,
          audioPlaying: false,
        ),
        isFalse,
      );
    });

    test('a single-page document is finished on its only page', () {
      expect(
        readerOffersNextTopic(
          document: const PdfViewState(currentPage: 0, pageCount: 1),
          hasNextTopic: true,
          audioPlaying: false,
        ),
        isTrue,
      );
    });
  });

  group('moving between two documents', () {
    /// Both topics carry a PDF, so paging between them is the native-view swap
    /// this covers — the case where the old page, a blank surface and the new
    /// page used to flash past in sequence.
    const chapters = [
      Chapter(
        id: 'c1',
        bookId: bookId,
        title: 'Kerala Renaissance',
        orderIndex: 0,
        topics: [
          Topic(
            id: 't1',
            chapterId: 'c1',
            title: 'Sree Narayana Guru',
            orderIndex: 0,
            description: 'Notes one.',
            pdfUrl: 'https://cdn.test/one.pdf',
          ),
          Topic(
            id: 't2',
            chapterId: 'c1',
            title: 'Ayyankali',
            orderIndex: 1,
            description: 'Notes two.',
            pdfUrl: 'https://cdn.test/two.pdf',
          ),
        ],
      ),
    ];

    Future<void> pump(WidgetTester tester) async {
      tester.view.physicalSize = const Size(400, 860);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final audio = _SilentAudio();
      addTearDown(audio.dispose);

      await tester.pumpWidget(ProviderScope(
        overrides: [
          sharedPrefsProvider.overrideWithValue(prefs),
          booksRepositoryProvider.overrideWith((ref) => _SilentBooks()),
          readerAudioProvider.overrideWithValue(audio),
          routerProvider.overrideWith((ref) => GoRouter(routes: [
                GoRoute(path: '/', builder: (_, __) => const SizedBox.shrink()),
              ])),
          readerSourceProvider.overrideWith(
            (ref, id) async => const ReaderSource(
              content: BookReaderContent(
                bookId: bookId,
                title: 'Kerala History',
                author: 'PSC',
                coverUrl: '',
                category: 'Kerala PSC',
                chapters: chapters,
              ),
            ),
          ),
          bookProgressProvider.overrideWith((ref, id) async => null),
        ],
        child: const MaterialApp(
          home: BookReaderScreen(bookId: bookId),
        ),
      ));
      // Not pumpAndSettle: the document slot spins while it fetches, and an
      // indeterminate spinner never settles. Pumped far enough instead for the
      // fetch to fail — there is no cache directory under the test binding.
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
    }

    testWidgets('the swap is covered, and the cover lifts again',
        (tester) async {
      await pump(tester);
      // Nothing is travelling and no swap is in flight, so the document is on
      // show.
      expect(find.byKey(documentTransitionCoverKey), findsNothing);

      await tester.tap(find.byTooltip('Chapters and topics'));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.text('Ayyankali').last);
      await tester.pump(const Duration(milliseconds: 200));

      expect(
        find.byKey(documentTransitionCoverKey),
        findsOneWidget,
        reason: 'the native view is being swapped; it must not be on show',
      );
      expect(find.text('Loading next topic…'), findsOneWidget);

      // The incoming document never renders under the test binding, so the
      // backstop is what lifts the cover — without it a failed document would
      // sit behind a spinner instead of showing its own error.
      await tester.pump(const Duration(milliseconds: 1400));
      expect(find.byKey(documentTransitionCoverKey), findsNothing);
      expect(find.text('Loading next topic…'), findsNothing);
    });

    testWidgets('no Next button while the document has not reported itself',
        (tester) async {
      await pump(tester);

      // The page count is unknown here, so there is no "end of the notes" to
      // have reached — and the reading page stays bare.
      expect(find.text('Next topic'), findsNothing);
    });
  });
}
