import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:psc_tips_tricks_mobile/core/network/api_client.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/router/app_router.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/book.dart';
import 'package:psc_tips_tricks_mobile/data/repositories/books_repository.dart';
import 'package:psc_tips_tricks_mobile/features/books/book_reader_screen.dart';
import 'package:psc_tips_tricks_mobile/features/books/books_providers.dart';
import 'package:psc_tips_tricks_mobile/features/books/reader_audio_controller.dart';
import 'package:psc_tips_tricks_mobile/features/books/widgets/reader_audio_player.dart';
import 'package:psc_tips_tricks_mobile/features/pdfs/widgets/pdf_document_view.dart';

class _SilentBooksRepo extends BooksRepository {
  _SilentBooksRepo() : super(ApiClient(tokenStore: TokenStore()));

  @override
  Future<void> saveProgress({
    required String bookId,
    String? chapterId,
    String? topicId,
    required int progressPercent,
  }) async {}
}

class _TestAudioController extends ReaderAudioController {
  @override
  Future<void> load(
    String url, {
    String? label,
    String? album,
    bool autoPlay = false,
    Duration? initialPosition,
  }) async {
    title.value = label;
    loading.value = false;
  }
}

void main() {
  const bookId = 'b_audio_test';

  const chapters = [
    Chapter(
      id: 'c1',
      bookId: bookId,
      title: 'Kerala History',
      orderIndex: 0,
      topics: [
        Topic(
          id: 't_audio',
          chapterId: 'c1',
          title: 'Narration and PDF',
          orderIndex: 0,
          description: 'Topic with narration and PDF.',
          pdfUrl: 'https://cdn.test/lesson.pdf',
          audioUrl: 'https://cdn.test/lesson.mp3',
        ),
      ],
    ),
  ];

  Future<_TestAudioController> pumpReader(
    WidgetTester tester, {
    required Size size,
    bool startCollapsed = true,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    SharedPreferences.setMockInitialValues({
      'reader_audio_bar_collapsed': startCollapsed,
    });
    final prefs = await SharedPreferences.getInstance();

    final player = _TestAudioController();
    addTearDown(player.dispose);

    final container = ProviderContainer(overrides: [
      sharedPrefsProvider.overrideWithValue(prefs),
      booksRepositoryProvider.overrideWith((ref) => _SilentBooksRepo()),
      readerAudioProvider.overrideWithValue(player),
      routerProvider.overrideWith((ref) => GoRouter(routes: [
            GoRoute(path: '/', builder: (_, __) => const SizedBox.shrink()),
          ])),
      readerSourceProvider.overrideWith(
        (ref, id) async => const ReaderSource(
          content: BookReaderContent(
            bookId: bookId,
            title: 'Audio Book Reader',
            author: 'PSC',
            coverUrl: '',
            category: 'PSC',
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

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    return player;
  }

  testWidgets(
      'displays PDF in full-page view and places Audio button below Book/Chapter icon',
      (tester) async {
    const screenSize = Size(400, 800);
    await pumpReader(tester, size: screenSize);

    // 1. PDF document view takes full screen size (full-page view)
    final pdfFinder = find.byType(PdfDocumentView);
    expect(pdfFinder, findsOneWidget);
    final pdfSize = tester.getSize(pdfFinder);
    expect(pdfSize.width, equals(screenSize.width));
    expect(pdfSize.height, equals(screenSize.height));

    // 2. Book/Chapter icon and Audio button are both present
    final contentsFinder = find.byTooltip('Chapters and topics');
    final audioBtnFinder = find.byTooltip('Audio player');
    expect(contentsFinder, findsOneWidget);
    expect(audioBtnFinder, findsOneWidget);

    // 3. Audio button is positioned below the Book/Chapter icon
    final contentsCenter = tester.getCenter(contentsFinder);
    final audioCenter = tester.getCenter(audioBtnFinder);

    expect(audioCenter.dy, greaterThan(contentsCenter.dy),
        reason: 'Audio button must be placed below the Book/Chapter icon');
    // Both should be aligned near the right margin
    expect((audioCenter.dx - contentsCenter.dx).abs(), lessThan(10.0));
  });

  testWidgets(
      'tapping Audio button expands tablet-style audio player from left to right with proper margins',
      (tester) async {
    const screenSize = Size(400, 800);
    final audio = await pumpReader(tester, size: screenSize, startCollapsed: true);

    audio.title.value = 'Narration and PDF';
    audio.duration.value = const Duration(minutes: 10);
    audio.position.value = const Duration(minutes: 1);
    audio.loading.value = false;
    await tester.pump();

    // Initially collapsed: ReaderTabletAudioPlayer is not expanded
    expect(find.byType(ReaderTabletAudioPlayer), findsNothing);

    // Tap Audio button
    await tester.tap(find.byTooltip('Audio player'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    // Audio player is now expanded
    final playerFinder = find.byType(ReaderTabletAudioPlayer);
    expect(playerFinder, findsOneWidget);

    // Verify proper margins: MUST NOT touch screen edges
    final playerRect = tester.getRect(playerFinder);
    expect(playerRect.left, greaterThanOrEqualTo(16.0),
        reason: 'Player must not touch left screen edge');
    expect(playerRect.right, lessThanOrEqualTo(screenSize.width - 16.0),
        reason: 'Player must not touch right screen edge');
    expect(playerRect.bottom, lessThanOrEqualTo(screenSize.height - 16.0),
        reason: 'Player must not touch bottom screen edge');

    // Controls inside tablet audio player
    expect(find.byIcon(Icons.play_arrow_rounded), findsOneWidget);
    expect(find.byTooltip('Back 10 seconds'), findsOneWidget);
    expect(find.byTooltip('Forward 10 seconds'), findsOneWidget);
    expect(find.byTooltip('Hide audio player'), findsWidgets);

    // Tap hide/close button
    await tester.tap(find.byTooltip('Hide audio player').first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    // Player is collapsed again
    expect(find.byType(ReaderTabletAudioPlayer), findsNothing);
  });
}
