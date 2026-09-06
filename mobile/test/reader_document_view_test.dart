import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
    ReaderAudioController? audio,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final player = audio ?? ReaderAudioController();
    if (audio == null) addTearDown(player.dispose);

    final container = ProviderContainer(overrides: [
      sharedPrefsProvider.overrideWithValue(prefs),
      booksRepositoryProvider.overrideWith((ref) => _SilentBooksRepository()),
      readerAudioProvider.overrideWithValue(player),
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

  /// Opens the contents drawer from the reading page's book button.
  Future<void> openContents(WidgetTester tester) async {
    await tester.tap(find.byTooltip('Chapters and topics'));
    // Long enough for the drawer to finish sliding in: tapping a row that is
    // still travelling lands outside it.
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));
  }

  group('opening the reader', () {
    testWidgets('the document is covered while the page is still travelling',
        (tester) async {
      // The regression this exists for: the document is a native platform
      // view, which does not travel with the Flutter layer during a page
      // transition — sliding one in tears and ghosts. It gets covered for the
      // length of the animation, and this has already been lost once.
      tester.view.physicalSize = const Size(400, 860);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final player = ReaderAudioController();
      addTearDown(player.dispose);

      final container = ProviderContainer(overrides: [
        sharedPrefsProvider.overrideWithValue(prefs),
        booksRepositoryProvider.overrideWith((ref) => _SilentBooksRepository()),
        readerAudioProvider.overrideWithValue(player),
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

      final navigatorKey = GlobalKey<NavigatorState>();
      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.light(),
          navigatorKey: navigatorKey,
          home: const Scaffold(body: Text('the book page')),
        ),
      ));

      // Pushed rather than used as `home`: a first route has no transition to
      // glitch during, which is exactly the case that would pass vacuously.
      navigatorKey.currentState!.push(
        MaterialPageRoute<void>(
          builder: (_) => const BookReaderScreen(bookId: bookId),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 120));

      expect(
        find.byKey(documentTransitionCoverKey),
        findsOneWidget,
        reason: 'mid-transition the platform view must not be on show',
      );

      // Past the end of the route animation the real document is handed back.
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byKey(documentTransitionCoverKey), findsNothing);
    });
  });

  group('the document is the default — and only — view', () {
    testWidgets('a topic with a PDF opens on it, with nothing to tap first',
        (tester) async {
      await pump(tester, size: const Size(400, 860));

      // The old flow put a tile on a page of notes and made the student find
      // it, with a toggle back and forth. That toggle is gone: a topic with a
      // PDF shows only the document, even though this one also carries notes.
      expect(find.text('The written notes for this topic.'), findsNothing);
      expect(find.byTooltip('Show the written notes'), findsNothing);
      expect(find.byTooltip('Show the document'), findsNothing);
    });

    testWidgets('a topic with no document has no toggle and shows its notes',
        (tester) async {
      await pump(tester, size: const Size(400, 860));

      // The document page carries no paging of its own; moving between topics
      // is what the contents panel is for.
      await openContents(tester);
      await tester.tap(find.text('Ayyankali').last);
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('A topic with no document at all.'), findsOneWidget);
      expect(find.byTooltip('Show the written notes'), findsNothing);
      expect(find.byTooltip('Show the document'), findsNothing);
    });
  });

  group('portrait and landscape', () {
    testWidgets('the document page is bare: no footer, no title bar',
        (tester) async {
      await pump(tester, size: const Size(400, 860));

      // The page is the document. Everything the reader can do sits in the
      // corners or behind the contents button, so none of the old chrome is
      // over the page taking height from it.
      expect(find.text('Next topic'), findsNothing);
      expect(find.text('Back'), findsNothing);
      expect(find.text('Kerala History'), findsNothing);
      expect(find.textContaining('Chapter 1 · 1 / 2'), findsNothing);
      expect(find.byTooltip('Next topic'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('the corners carry the whole of the reading page',
        (tester) async {
      await pump(tester, size: const Size(400, 860));

      expect(find.byTooltip('Back'), findsOneWidget);
      expect(find.byTooltip('Chapters and topics'), findsOneWidget);
      // The document is this topic's only view, even though it also has
      // notes — there is no toggle to offer.
      expect(find.byTooltip('Show the written notes'), findsNothing);
      // Nothing is playing, so auto-scroll has nothing to follow and stays out
      // of the way.
      expect(find.byTooltip('Follow the audio'), findsNothing);
      expect(find.byTooltip('Pages follow the audio — tap to stop'),
          findsNothing);
    });

    testWidgets('auto-scroll comes and goes with the narration',
        (tester) async {
      final audio = ReaderAudioController();
      addTearDown(audio.dispose);
      await pump(tester, size: const Size(400, 860), audio: audio);

      // Nothing playing: the switch has nothing to follow and is not built.
      // It wears its off label, since following starts off until asked for.
      expect(find.byTooltip('Follow the audio'), findsNothing);

      audio.playing.value = true;
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byTooltip('Follow the audio'), findsOneWidget);

      audio.playing.value = false;
      // Two frames: the first runs the switcher's transition out, the second
      // is where the outgoing child actually leaves the tree.
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byTooltip('Follow the audio'), findsNothing);
    });

    testWidgets('it arrives switched off, offering rather than imposing',
        (tester) async {
      final audio = ReaderAudioController();
      addTearDown(audio.dispose);
      await pump(tester, size: const Size(400, 860), audio: audio);

      audio.playing.value = true;
      await tester.pump(const Duration(milliseconds: 400));

      // Playing narration puts the control on screen but leaves the page
      // still: following is offered, not imposed.
      expect(find.byTooltip('Follow the audio'), findsOneWidget);
      expect(find.byTooltip('Pages follow the audio — tap to stop'),
          findsNothing);
    });

    testWidgets('landscape is the same bare page', (tester) async {
      await pump(tester, size: const Size(880, 410));

      expect(find.text('Next topic'), findsNothing);
      expect(find.byTooltip('Next topic'), findsNothing);
      expect(find.textContaining('Chapter 1 · 1 / 2'), findsNothing);
      expect(find.byTooltip('Chapters and topics'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('the contents panel pages through topics', (tester) async {
      await pump(tester, size: const Size(880, 410));

      await openContents(tester);
      await tester.tap(find.text('Ayyankali').last);
      await tester.pump(const Duration(milliseconds: 400));

      // Topic two carries no document, so the reader falls back to its notes —
      // which is also how we know the page actually moved.
      expect(find.text('A topic with no document at all.'), findsOneWidget);
    });

    testWidgets('a wide landscape phone still gets a drawer, not a pinned panel',
        (tester) async {
      await pump(tester, size: const Size(880, 410));

      // 880dp is wide enough for the tablet layout on width alone; the height
      // is what disqualifies it.
      expect(find.byTooltip('Chapters and topics'), findsOneWidget);
    });

    testWidgets('sideways the notes keep a readable line length',
        (tester) async {
      await pump(tester, size: const Size(880, 410));
      // Topic one carries a PDF and only ever shows its document, so the
      // notes page is reached through the other topic instead.
      await openContents(tester);
      await tester.tap(find.text('Ayyankali').last);
      await tester.pump(const Duration(milliseconds: 400));

      final sideways =
          tester.getSize(find.text('A topic with no document at all.')).width;
      // Body text run across the full 880dp is a line no one can track back
      // from, so the side padding absorbs the difference instead.
      expect(sideways, lessThanOrEqualTo(680));
      expect(sideways, greaterThan(400));
    });

    testWidgets('upright the notes still span the screen', (tester) async {
      await pump(tester, size: const Size(400, 860));
      await openContents(tester);
      await tester.tap(find.text('Ayyankali').last);
      await tester.pump(const Duration(milliseconds: 400));

      // A phone held upright is already narrower than a readable measure, so
      // nothing is taken off it.
      expect(
        tester.getSize(find.text('A topic with no document at all.')).width,
        400 - 32,
      );
    });

    testWidgets('sideways the system bars get out of the way', (tester) async {
      final modes = <String>[];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'SystemChrome.setEnabledSystemUIMode') {
            modes.add('${call.arguments}');
          }
          return null;
        },
      );
      addTearDown(() => tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null));

      await pump(tester, size: const Size(880, 410));
      // The status and navigation bars are worth about a sixth of a sideways
      // phone's height, spent on a clock.
      expect(modes, contains('SystemUiMode.immersiveSticky'));

      modes.clear();
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      // And closing the reader hands them straight back.
      expect(modes, contains('SystemUiMode.edgeToEdge'));
    });

    testWidgets('upright the reader leaves the system bars alone',
        (tester) async {
      final modes = <String>[];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'SystemChrome.setEnabledSystemUIMode') {
            modes.add('${call.arguments}');
          }
          return null;
        },
      );
      addTearDown(() => tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null));

      await pump(tester, size: const Size(400, 860));
      expect(modes, isEmpty);
    });

    testWidgets('a tablet pins the contents panel open', (tester) async {
      await pump(tester, size: const Size(880, 1200));

      expect(find.byTooltip('Chapters and topics'), findsNothing);
      expect(find.text('CONTENTS'), findsOneWidget);
    });
  });
}
