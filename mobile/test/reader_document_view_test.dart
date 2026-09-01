import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/router/app_router.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/book.dart';
import 'package:psc_tips_tricks_mobile/features/books/book_reader_screen.dart';
import 'package:psc_tips_tricks_mobile/features/books/books_providers.dart';
import 'package:psc_tips_tricks_mobile/features/books/reader_audio_controller.dart';
import 'package:psc_tips_tricks_mobile/core/network/api_client.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:psc_tips_tricks_mobile/data/repositories/books_repository.dart';

/// The reader writes the reading position as it goes and once more on close.
/// Left real, that write opens a Dio request whose connect timeout outlives
/// the test binding, which reports it as a leaked timer.
class _SilentBooksRepository extends BooksRepository {
  _SilentBooksRepository() : super(ApiClient(tokenStore: TokenStore()));

  @override
  Future<void> saveProgress({
    required String bookId,
    String? chapterId,
    String? topicId,
    required int progressPercent,
  }) async {}
}

void main() {
  const bookId = 'b1';

  /// Topic one carries a document and narration; topic two carries neither, so
  /// the two branches of the reader are both reachable.
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
          description: 'The written notes for this topic.',
          // No narration: this suite is about the document and the layout,
          // and a real just_audio player in a widget test drags in platform
          // timers that have nothing to do with either.
          pdfUrl: 'https://cdn.test/notes.pdf',
        ),
        Topic(
          id: 't2',
          chapterId: 'c1',
          title: 'Ayyankali',
          orderIndex: 1,
          description: 'A topic with no document at all.',
        ),
      ],
    ),
  ];

  Future<ProviderContainer> pump(
    WidgetTester tester, {
    required Size size,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final audio = ReaderAudioController();
    addTearDown(audio.dispose);

    final container = ProviderContainer(overrides: [
      sharedPrefsProvider.overrideWithValue(prefs),
      booksRepositoryProvider.overrideWith((ref) => _SilentBooksRepository()),
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
    ]);
    addTearDown(container.dispose);

    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const BookReaderScreen(bookId: bookId),
      ),
    ));
    // Not pumpAndSettle: the document slot spins while it fetches, and an
    // indeterminate spinner never settles. Pumped far enough instead for the
    // fetch to fail (there is no cache directory under the test binding) and
    // the slot to come to rest on its error state.
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    return container;
  }

  group('the document is the default view', () {
    testWidgets('a topic with a PDF opens on it, with nothing to tap first',
        (tester) async {
      await pump(tester, size: const Size(400, 860));

      // The old flow put a tile on a page of notes and made the student find
      // it. The notes are what should now be one toggle away, not the document.
      expect(find.text('The written notes for this topic.'), findsNothing);
      expect(find.byTooltip('Show the written notes'), findsOneWidget);
    });

    testWidgets('the toggle swaps to the notes and back', (tester) async {
      await pump(tester, size: const Size(400, 860));

      await tester.tap(find.byTooltip('Show the written notes'));
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('The written notes for this topic.'), findsOneWidget);
      expect(find.byTooltip('Show the document'), findsOneWidget);

      await tester.tap(find.byTooltip('Show the document'));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('The written notes for this topic.'), findsNothing);
    });

    testWidgets('a topic with no document has no toggle and shows its notes',
        (tester) async {
      await pump(tester, size: const Size(400, 860));

      await tester.tap(find.text('Next topic'));
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('A topic with no document at all.'), findsOneWidget);
      expect(find.byTooltip('Show the written notes'), findsNothing);
      expect(find.byTooltip('Show the document'), findsNothing);
    });
  });

  group('portrait and landscape', () {
    testWidgets('portrait keeps the full footer and the two-line title',
        (tester) async {
      await pump(tester, size: const Size(400, 860));

      expect(find.text('Next topic'), findsOneWidget);
      expect(find.text('Back'), findsOneWidget);
      // The book title and the chapter line both fit.
      expect(find.text('Kerala History'), findsOneWidget);
      expect(find.textContaining('Chapter 1 · 1 / 2'), findsOneWidget);
      // Paging lives in the footer, so the app bar carries no arrows.
      expect(find.byTooltip('Next topic'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('landscape drops the footer and moves paging into the app bar',
        (tester) async {
      await pump(tester, size: const Size(880, 410));

      // A landscape phone has ~400dp of height; the footer's two buttons would
      // cost a fifth of it.
      expect(find.text('Next topic'), findsNothing);
      expect(find.byTooltip('Next topic'), findsOneWidget);
      expect(find.byTooltip('Previous topic'), findsOneWidget);
      // The title folds to one line — the topic, which is the useful half.
      expect(find.text('Sree Narayana Guru'), findsOneWidget);
      expect(find.textContaining('Chapter 1 · 1 / 2'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('the app bar arrows page through topics in landscape',
        (tester) async {
      await pump(tester, size: const Size(880, 410));

      expect(find.byTooltip('Previous topic'), findsOneWidget);
      await tester.tap(find.byTooltip('Next topic'));
      await tester.pump(const Duration(milliseconds: 400));

      // Topic two carries no document, so the reader falls back to its notes —
      // which is also how we know the page actually moved.
      expect(find.text('A topic with no document at all.'), findsOneWidget);
      // The compact title follows along.
      expect(find.text('Ayyankali'), findsWidgets);
    });

    testWidgets('a wide landscape phone still gets a drawer, not a pinned panel',
        (tester) async {
      await pump(tester, size: const Size(880, 410));

      // 880dp is wide enough for the tablet layout on width alone; the height
      // is what disqualifies it.
      expect(find.byTooltip('Chapters and topics'), findsOneWidget);
    });

    testWidgets('a tablet pins the contents panel open', (tester) async {
      await pump(tester, size: const Size(880, 1200));

      expect(find.byTooltip('Chapters and topics'), findsNothing);
      expect(find.text('CONTENTS'), findsOneWidget);
    });
  });
}
