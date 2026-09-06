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
import 'package:psc_tips_tricks_mobile/features/books/book_reader_screen.dart';
import 'package:psc_tips_tricks_mobile/features/books/books_providers.dart';
import 'package:psc_tips_tricks_mobile/features/books/reader_audio_controller.dart';

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

/// The real controller with the platform call taken out, so `playing` and
/// `fraction` can be driven by hand the way playback would drive them.
class _FakeAudio extends ReaderAudioController {
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
  const bookId = 'b1';

  /// Long enough that the notes actually have somewhere to scroll to.
  final body = List.generate(
    120,
    (i) => 'Paragraph $i of the written notes for this topic, long enough to '
        'wrap across several lines on a phone.',
  ).join('\n\n');

  late final List<Chapter> chapters = [
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
          description: body,
          audioUrl: 'https://cdn.test/narration.mp3',
        ),
      ],
    ),
  ];

  Future<_FakeAudio> pumpReader(WidgetTester tester) async {
    tester.view.physicalSize = const Size(400, 860);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    // Following is off until a reader asks for it, so these tests — which are
    // about *how* it follows once asked — turn it on the way the toggle does.
    await prefs.setBool('reader_auto_scroll', true);
    final audio = _FakeAudio();
    addTearDown(audio.dispose);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        sharedPrefsProvider.overrideWithValue(prefs),
        readerAudioProvider.overrideWithValue(audio),
        booksRepositoryProvider.overrideWith((ref) => _SilentBooks()),
        routerProvider.overrideWith((ref) => GoRouter(routes: [
              GoRoute(path: '/', builder: (_, __) => const SizedBox.shrink()),
            ])),
        readerSourceProvider.overrideWith(
          (ref, id) async => ReaderSource(
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
        home: const BookReaderScreen(bookId: bookId),
      ),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    return audio;
  }

  double offsetOf(WidgetTester tester) {
    final scrollable = tester.widget<Scrollable>(
      find.byType(Scrollable).first,
    );
    return scrollable.controller!.offset;
  }

  /// Advances real frames, which is what drives the follow ticker.
  Future<void> pumpFrames(WidgetTester tester, int frames) async {
    for (var i = 0; i < frames; i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
  }

  group('whether it follows at all', () {
    Future<ProviderContainer> containerWith(Map<String, Object> stored) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      for (final entry in stored.entries) {
        await prefs.setBool(entry.key, entry.value as bool);
      }
      final container = ProviderContainer(
        overrides: [sharedPrefsProvider.overrideWithValue(prefs)],
      );
      addTearDown(container.dispose);
      return container;
    }

    test('a reader who has never chosen gets a page that stays put', () async {
      // A page that starts moving on its own the moment narration begins takes
      // the reading position away before anyone asked for that.
      final container = await containerWith({});
      expect(container.read(autoScrollProvider), isFalse);
    });

    test('a reader who turned it on keeps it on', () async {
      final container = await containerWith({'reader_auto_scroll': true});
      expect(container.read(autoScrollProvider), isTrue);
    });
  });

  testWidgets('the page eases towards the narration rather than jumping to it',
      (tester) async {
    final audio = await pumpReader(tester);
    expect(offsetOf(tester), 0);

    // Narration is a third of the way through the topic.
    audio.fraction.value = 0.33;
    audio.playing.value = true;
    await tester.pump();

    // One frame closes a fraction of the gap, not the whole of it: gliding is
    // the entire point, and a single-frame arrival is the jump this replaced.
    await pumpFrames(tester, 1);
    final afterOneFrame = offsetOf(tester);
    expect(afterOneFrame, greaterThan(0));

    await pumpFrames(tester, 60);
    final afterASecond = offsetOf(tester);
    expect(
      afterASecond,
      greaterThan(afterOneFrame * 2),
      reason: 'a second of frames should carry it well past the first step',
    );
  });

  testWidgets('pausing stops the page where it is', (tester) async {
    final audio = await pumpReader(tester);

    audio.fraction.value = 0.5;
    audio.playing.value = true;
    await tester.pump();
    await pumpFrames(tester, 10);

    final atPause = offsetOf(tester);
    expect(atPause, greaterThan(0));

    audio.playing.value = false;
    await tester.pump();
    await pumpFrames(tester, 60);

    expect(
      offsetOf(tester),
      atPause,
      reason: 'a stopped clip must not keep dragging the page along',
    );
  });

  testWidgets('resuming carries on from where the reader is', (tester) async {
    final audio = await pumpReader(tester);

    audio.fraction.value = 0.5;
    audio.playing.value = true;
    await tester.pump();
    await pumpFrames(tester, 10);
    audio.playing.value = false;
    await tester.pump();
    await pumpFrames(tester, 30);

    final atPause = offsetOf(tester);

    audio.playing.value = true;
    await tester.pump();
    await pumpFrames(tester, 30);

    // Moving again, and onward from the paused position rather than restarting.
    expect(offsetOf(tester), greaterThan(atPause));
  });

  testWidgets('a clip that is not playing never moves the page', (tester) async {
    final audio = await pumpReader(tester);

    audio.fraction.value = 0.8;
    await tester.pump();
    await pumpFrames(tester, 60);

    expect(offsetOf(tester), 0);
  });
}
