import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:psc_tips_tricks_mobile/core/network/api_client.dart';
import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/router/app_router.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/book.dart';
import 'package:psc_tips_tricks_mobile/data/repositories/books_repository.dart';
import 'package:psc_tips_tricks_mobile/features/books/audio_resume_store.dart';
import 'package:psc_tips_tricks_mobile/features/books/book_detail_screen.dart';
import 'package:psc_tips_tricks_mobile/features/books/book_reader_screen.dart';
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

/// Records what the reader asked the player for — the clip, and where in it.
class _CapturingAudio extends ReaderAudioController {
  final loads = <({String url, Duration? position, bool autoPlay})>[];

  String? get loadedUrl => loads.isEmpty ? null : loads.last.url;
  Duration? get loadedPosition => loads.isEmpty ? null : loads.last.position;
  bool? get autoPlayed => loads.isEmpty ? null : loads.last.autoPlay;

  @override
  Future<void> load(
    String url, {
    String? label,
    String? album,
    bool autoPlay = false,
    Duration? initialPosition,
  }) async {
    loads.add((url: url, position: initialPosition, autoPlay: autoPlay));
    title.value = label;
    // Standing in for the player, which reports the position it opened at.
    if (initialPosition != null) position.value = initialPosition;
    if (autoPlay) playing.value = true;
  }
}

/// The reader writes its reading position as it closes; left real that opens a
/// Dio request whose timeout outlives the test binding.
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

void main() {
  const bookId = 'b1';

  const book = Book(
    id: bookId,
    title: 'Kerala History',
    author: 'PSC Tips And Tricks',
    description: 'Everything for the prelims.',
    coverUrl: '',
    price: 0,
    finalPrice: 0,
    category: 'Kerala PSC',
    isPremium: false,
    discountPercent: 0,
    downloadCount: 3,
    access: AccessState(
      isPaid: false,
      hasAccess: true,
      price: 0,
      reason: AccessReason.free,
    ),
  );

  /// The narrated topic in the book below, left a third of the way in.
  AudioResumePoint point({
    Duration position = const Duration(minutes: 12, seconds: 34),
    Duration? duration = const Duration(minutes: 40),
    String unitId = 't2',
    String audioUrl = 'https://cdn.test/sree-narayana-guru.mp3',
  }) =>
      AudioResumePoint(
        unitId: unitId,
        audioUrl: audioUrl,
        title: 'Sree Narayana Guru',
        position: position,
        duration: duration,
      );

  Future<SharedPreferences> freshPrefs() async {
    SharedPreferences.setMockInitialValues({});
    return SharedPreferences.getInstance();
  }

  group('what is worth coming back to', () {
    test('a clip left part-way through is remembered', () async {
      final prefs = await freshPrefs();
      await saveAudioResume(prefs, bookId, point());

      final stored = readAudioResume(prefs, bookId);
      expect(stored, isNotNull);
      expect(stored!.unitId, 't2');
      expect(stored.audioUrl, 'https://cdn.test/sree-narayana-guru.mp3');
      expect(stored.title, 'Sree Narayana Guru');
      expect(stored.position, const Duration(minutes: 12, seconds: 34));
      expect(stored.duration, const Duration(minutes: 40));
    });

    test('a clip barely started is not — and clears an older point', () async {
      final prefs = await freshPrefs();
      await saveAudioResume(prefs, bookId, point());

      // Tapping play and immediately leaving is not a listening session.
      await saveAudioResume(
        prefs,
        bookId,
        point(position: const Duration(seconds: 2)),
      );

      expect(readAudioResume(prefs, bookId), isNull);
    });

    test('a clip played out is not: there is nothing left of it', () async {
      final prefs = await freshPrefs();
      await saveAudioResume(
        prefs,
        bookId,
        point(position: const Duration(minutes: 39, seconds: 58)),
      );

      expect(readAudioResume(prefs, bookId), isNull);
    });

    test('a clip of unknown length is still remembered', () async {
      // The player reports a duration a moment after the source loads; a
      // position taken before then must not be thrown away.
      final prefs = await freshPrefs();
      await saveAudioResume(prefs, bookId, point(duration: null));

      final stored = readAudioResume(prefs, bookId);
      expect(stored, isNotNull);
      expect(stored!.duration, isNull);
    });

    test('nothing listened to reads back as nothing', () async {
      expect(readAudioResume(await freshPrefs(), bookId), isNull);
    });
  });

  group('the detail page offers it back', () {
    /// What the reader route was opened with, captured where the reader itself
    /// reads it — which is the thing that has to be right.
    Map<String, String>? readerQuery;

    setUp(() => readerQuery = null);

    /// Boots the detail page behind a real router, so tapping the card is
    /// tested against the navigation it actually has to drive.
    Future<GoRouter> pump(
      WidgetTester tester, {
      AudioResumePoint? listenedTo,
    }) async {
      tester.view.physicalSize = const Size(400, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final prefs = await freshPrefs();
      if (listenedTo != null) {
        await saveAudioResume(prefs, bookId, listenedTo);
      }
      final audio = _SilentAudio();
      addTearDown(audio.dispose);

      final router = GoRouter(
        initialLocation: '/books/$bookId',
        routes: [
          GoRoute(
            path: '/books',
            builder: (context, state) =>
                const Scaffold(body: Text('books library')),
            routes: [
              GoRoute(
                path: ':id',
                builder: (context, state) =>
                    BookDetailScreen(bookId: state.pathParameters['id']!),
                routes: [
                  GoRoute(
                    path: 'read',
                    builder: (context, state) {
                      readerQuery = state.uri.queryParameters;
                      return const Scaffold(body: Text('the reader'));
                    },
                  ),
                ],
              ),
            ],
          ),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(ProviderScope(
        overrides: [
          sharedPrefsProvider.overrideWithValue(prefs),
          readerAudioProvider.overrideWithValue(audio),
          bookDetailProvider.overrideWith((ref, id) async => book),
          bookProgressProvider.overrideWith((ref, id) async => null),
        ],
        child: MaterialApp.router(
          theme: AppTheme.light(),
          routerConfig: router,
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      return router;
    }

    testWidgets('nothing listened to, nothing offered', (tester) async {
      await pump(tester);

      expect(find.text('Continue with audio'), findsNothing);
    });

    testWidgets('a part-heard clip is offered by name and position',
        (tester) async {
      await pump(tester, listenedTo: point());

      expect(find.text('Continue with audio'), findsOneWidget);
      // Which clip, and where it stands — enough to recognise it before tapping.
      expect(find.text('Sree Narayana Guru · 12:34'), findsOneWidget);
    });

    testWidgets('a clip started inside the reader is offered on the way back',
        (tester) async {
      // The regression this guards: the page reads the point once, so leaving
      // by any route into the reader — not just the audio card — has to look
      // again on the way back, or the offer never appears.
      final router = await pump(tester);
      expect(find.text('Continue with audio'), findsNothing);

      await tester.tap(find.text('Start reading'));
      await tester.pumpAndSettle();
      await saveAudioResume(
        // Stands in for the reader recording as it closes.
        await SharedPreferences.getInstance(),
        bookId,
        point(),
      );
      router.pop();
      await tester.pumpAndSettle();

      expect(find.text('Continue with audio'), findsOneWidget);
    });

    testWidgets('tapping it opens the reader asking for the narration',
        (tester) async {
      await pump(tester, listenedTo: point());

      await tester.tap(find.text('Continue with audio'));
      await tester.pumpAndSettle();

      expect(find.text('the reader'), findsOneWidget);
      // The flag the reader reads to page to the clip and pick it back up —
      // and not the reading-position resume, which opens somewhere else.
      expect(readerQuery?['audio'], '1');
      expect(readerQuery?.containsKey('resume'), isFalse);
    });
  });

  group('the reader picks it back up', () {
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
            title: 'Ayyankali',
            orderIndex: 0,
            description: 'The first topic, with no narration.',
          ),
          Topic(
            id: 't2',
            chapterId: 'c1',
            title: 'Sree Narayana Guru',
            orderIndex: 1,
            description: 'The narrated one.',
            audioUrl: 'https://cdn.test/sree-narayana-guru.mp3',
          ),
        ],
      ),
    ];

    Future<(_CapturingAudio, SharedPreferences)> pumpReader(
      WidgetTester tester, {
      required bool resumeAudio,
      AudioResumePoint? listenedTo,
      // Wide enough that the test font — every glyph the same width — does not
      // overflow rows that fit perfectly well on a real phone.
      Size size = const Size(400, 900),
    }) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final prefs = await freshPrefs();
      if (listenedTo != null) {
        await saveAudioResume(prefs, bookId, listenedTo);
      }
      final audio = _CapturingAudio();
      addTearDown(audio.dispose);

      await tester.pumpWidget(ProviderScope(
        overrides: [
          sharedPrefsProvider.overrideWithValue(prefs),
          readerAudioProvider.overrideWithValue(audio),
          booksRepositoryProvider.overrideWith((ref) => _SilentBooks()),
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
        child: MaterialApp(
          theme: AppTheme.light(),
          home: BookReaderScreen(bookId: bookId, resumeAudio: resumeAudio),
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      return (audio, prefs);
    }

    testWidgets('opens on the narrated topic, playing from where it stopped',
        (tester) async {
      final (audio, _) = await pumpReader(
        tester,
        resumeAudio: true,
        listenedTo: point(),
      );

      // Not topic one, which is where the book would otherwise open.
      expect(find.text('Sree Narayana Guru'), findsWidgets);
      expect(audio.loadedUrl, 'https://cdn.test/sree-narayana-guru.mp3');
      expect(audio.loadedPosition, const Duration(minutes: 12, seconds: 34));
      // Pinned to what `_loadUnitAudio` actually does. Note that the doc
      // comment on `BookReaderScreen.resumeAudio` currently claims the
      // opposite — that the clip is cued but left paused — so if that is the
      // intent, this expectation is the thing to flip.
      expect(audio.autoPlayed, isTrue);
    });

    testWidgets('opened any other way, it starts nothing', (tester) async {
      final (audio, _) = await pumpReader(
        tester,
        resumeAudio: false,
        listenedTo: point(),
      );

      // The point is still on disk — it is only spent when asked for.
      expect(find.text('Ayyankali'), findsWidgets);
      expect(audio.autoPlayed, isNot(isTrue));
      expect(audio.loadedPosition, isNull);
    });

    testWidgets('resuming lands in the audio player, not just the page',
        (tester) async {
      await pumpReader(
        tester,
        resumeAudio: true,
        listenedTo: point(),
        size: const Size(760, 1400),
      );
      // Not pumpAndSettle: the player's artwork pulses on a loop and never
      // comes to rest.
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));

      // The screen the student was last in is the one they are handed back.
      expect(find.text('AUDIO LESSON'), findsOneWidget);
    });

    testWidgets('the speaker in the contents hands over the player too',
        (tester) async {
      // Under the 840dp tablet breakpoint, so the contents are a drawer as on
      // a phone — but wide enough for the test font not to overflow the
      // player's speed chips.
      final (audio, _) = await pumpReader(
        tester,
        resumeAudio: false,
        size: const Size(600, 1000),
      );

      await tester.tap(find.byTooltip('Chapters and topics'));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.byTooltip('Play audio').first);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('AUDIO LESSON'), findsOneWidget);
      expect(audio.loadedUrl, 'https://cdn.test/sree-narayana-guru.mp3');
    });

    testWidgets('narration heard from the page alone is not offered back',
        (tester) async {
      // Playing a topic's clip from the reader's own strip is reading, not a
      // listening session — only the audio player earns a point to come back
      // to, which is what keeps the card off a book nobody listened to.
      final (audio, prefs) = await pumpReader(tester, resumeAudio: false);

      await tester.tap(find.byTooltip('Chapters and topics'));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.text('Sree Narayana Guru').last);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));

      // The clip is loaded and running, just never opened full screen.
      expect(audio.loadedUrl, 'https://cdn.test/sree-narayana-guru.mp3');
      audio.duration.value = const Duration(minutes: 40);
      audio.position.value = const Duration(minutes: 20);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 100));

      expect(readAudioResume(prefs, bookId), isNull);
    });

    testWidgets('leaving the reader writes down where the clip stands',
        (tester) async {
      final (audio, prefs) = await pumpReader(
        tester,
        resumeAudio: true,
        listenedTo: point(),
      );

      // Listened on a while, then closed the book.
      audio.duration.value = const Duration(minutes: 40);
      audio.position.value = const Duration(minutes: 20, seconds: 5);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 100));

      final stored = readAudioResume(prefs, bookId);
      expect(stored, isNotNull);
      expect(stored!.unitId, 't2');
      expect(stored.position, const Duration(minutes: 20, seconds: 5));
    });

    testWidgets('a clip heard to the end leaves nothing to come back to',
        (tester) async {
      final (audio, prefs) = await pumpReader(
        tester,
        resumeAudio: true,
        listenedTo: point(),
      );

      audio.duration.value = const Duration(minutes: 40);
      audio.position.value = const Duration(minutes: 40);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 100));

      expect(readAudioResume(prefs, bookId), isNull);
    });
  });

  group('the route carries the request', () {
    test('audio and reading resume are independent flags', () {
      expect(AppRoutes.bookReader(bookId), '/books/$bookId/read');
      expect(
        AppRoutes.bookReader(bookId, resume: true),
        '/books/$bookId/read?resume=1',
      );
      expect(
        AppRoutes.bookReader(bookId, audio: true),
        '/books/$bookId/read?audio=1',
      );
      expect(
        AppRoutes.bookReader(bookId, resume: true, audio: true),
        '/books/$bookId/read?resume=1&audio=1',
      );
    });
  });
}
