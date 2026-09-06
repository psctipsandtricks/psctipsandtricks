import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/book.dart';
import 'package:psc_tips_tricks_mobile/features/books/reader_types.dart';
import 'package:psc_tips_tricks_mobile/features/books/widgets/reader_contents_drawer.dart';

void main() {
  // Two chapters. The first topic has two subtopics and narration; the second
  // topic has neither, so the tree exercises both shapes of row.
  final chapters = [
    const Chapter(
      id: 'c1',
      bookId: 'b1',
      title: 'Kerala Renaissance',
      orderIndex: 0,
      topics: [
        Topic(
          id: 't1',
          chapterId: 'c1',
          title: 'Sree Narayana Guru',
          orderIndex: 0,
          audioUrl: 'https://cdn.test/t1.mp3',
          youtubeUrl: 'https://youtube.com/watch?v=12345',
          pdfUrl: 'https://cdn.test/t1.pdf',
          subtopics: [
            Subtopic(
              id: 's1',
              topicId: 't1',
              title: 'Aruvippuram Movement',
              orderIndex: 0,
              audioUrl: 'https://cdn.test/s1.mp3',
            ),
            Subtopic(
              id: 's2',
              topicId: 't1',
              title: 'SNDP Yogam',
              orderIndex: 1,
            ),
          ],
        ),
        Topic(
          id: 't2',
          chapterId: 'c1',
          title: 'Ayyankali',
          orderIndex: 1,
        ),
      ],
    ),
    const Chapter(
      id: 'c2',
      bookId: 'b1',
      title: 'Modern Kerala',
      orderIndex: 1,
      topics: [
        Topic(id: 't3', chapterId: 'c2', title: 'Formation of the State',
            orderIndex: 0),
      ],
    ),
  ];

  final units = flattenChapters(chapters);
  final summaries = buildChapterSummaries(units);

  Future<void> pump(
    WidgetTester tester, {
    int activeIndex = 0,
    int maxReached = 0,
    void Function(int)? onSelect,
    void Function(int)? onPlayAudio,
    void Function(ReadingUnit)? onPlayVideo,
  }) async {
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: ReaderContentsPanel(
          bookTitle: 'Kerala History',
          chapters: summaries,
          activeIndex: activeIndex,
          maxReached: maxReached,
          totalUnits: units.length,
          onSelect: onSelect ?? (_) {},
          onPlayAudio: onPlayAudio ?? (_) {},
          onPlayVideo: onPlayVideo,
        ),
      ),
    ));
    await tester.pumpAndSettle();
  }

  group('contents tree', () {
    test('groups subtopics under the topic they belong to', () {
      expect(summaries.length, 2);
      final first = summaries.first;
      expect(first.topics.length, 2, reason: 'two topics, not four units');
      expect(first.topics.first.topic.id, 't1');
      expect(
        first.topics.first.subtopics.map((s) => s.id),
        ['s1', 's2'],
      );
      expect(first.topics.last.hasSubtopics, isFalse);
      expect(first.topics.first.hasAudioAnywhere, isTrue);
      expect(first.topics.last.hasAudioAnywhere, isFalse);
    });

    testWidgets('opens on the chapter and topic being read', (tester) async {
      // Unit 1 is the first subtopic, so both its chapter and its topic have
      // to be unfolded for it to be visible at all.
      await pump(tester, activeIndex: 1);

      expect(find.text('Kerala Renaissance'), findsOneWidget);
      expect(find.text('Sree Narayana Guru'), findsOneWidget);
      expect(find.text('Aruvippuram Movement'), findsOneWidget);
      // The other chapter stays collapsed.
      expect(find.text('Formation of the State'), findsNothing);
    });

    testWidgets('a chapter unfolds to its topics, a topic to its subtopics',
        (tester) async {
      await pump(tester, activeIndex: 4);

      // Chapter one is collapsed: the reader is in chapter two.
      expect(find.text('Sree Narayana Guru'), findsNothing);

      await tester.tap(find.text('Kerala Renaissance'));
      await tester.pumpAndSettle();
      expect(find.text('Sree Narayana Guru'), findsOneWidget);
      expect(find.text('Ayyankali'), findsOneWidget);
      // Subtopics stay folded until their own topic is opened.
      expect(find.text('SNDP Yogam'), findsNothing);

      // The chevron opens the topic; the title would open it for reading.
      expect(find.byTooltip('Show subtopics'), findsOneWidget,
          reason: 'only the topic that has subtopics offers the chevron');
      await tester.tap(find.byTooltip('Show subtopics'));
      await tester.pumpAndSettle();
      expect(find.text('SNDP Yogam'), findsOneWidget);
    });
  });

  group('selection', () {
    testWidgets('tapping a topic asks the reader to open it', (tester) async {
      int? selected;
      await pump(tester, onSelect: (index) => selected = index);

      await tester.tap(find.text('Ayyankali'));
      await tester.pumpAndSettle();
      expect(selected, 3, reason: 'Ayyankali is the fourth unit');
    });

    testWidgets('tapping a subtopic opens that subtopic, not its parent',
        (tester) async {
      int? selected;
      await pump(tester, activeIndex: 1, onSelect: (index) => selected = index);

      await tester.tap(find.text('SNDP Yogam'));
      await tester.pumpAndSettle();
      expect(selected, 2);
    });
  });

  group('audio', () {
    testWidgets('only units with narration get a speaker', (tester) async {
      await pump(tester, activeIndex: 1);

      // t1 and s1 have audio; s2 and t2 do not.
      expect(find.byTooltip('Play audio'), findsNWidgets(2));
    });

    testWidgets('the speaker plays that unit, not the one being read',
        (tester) async {
      int? played;
      int? selected;
      await pump(
        tester,
        activeIndex: 1,
        onSelect: (index) => selected = index,
        onPlayAudio: (index) => played = index,
      );

      // The second speaker belongs to the subtopic 'Aruvippuram Movement'.
      await tester.tap(find.byTooltip('Play audio').last);
      await tester.pumpAndSettle();

      expect(played, 1);
      // Playing is its own action — it must not also fire a plain selection.
      expect(selected, isNull);
    });
  });

  group('video and media icons', () {
    testWidgets('units with video get a video button and tapping it triggers onPlayVideo',
        (tester) async {
      ReadingUnit? playedVideo;
      await pump(
        tester,
        activeIndex: 0,
        onPlayVideo: (unit) => playedVideo = unit,
      );

      expect(find.byTooltip('Watch video'), findsOneWidget);
      await tester.tap(find.byTooltip('Watch video'));
      await tester.pumpAndSettle();

      expect(playedVideo, isNotNull);
      expect(playedVideo?.title, 'Sree Narayana Guru');
    });

    testWidgets('PDF icons are completely removed from topic rows', (tester) async {
      await pump(tester, activeIndex: 0);

      expect(find.byIcon(Icons.picture_as_pdf_rounded), findsNothing);
    });
  });

  group('progress', () {
    testWidgets('read units are ticked and the header counts them',
        (tester) async {
      await pump(tester, activeIndex: 3, maxReached: 3);

      expect(find.text('4 of 5 topics · 2 chapters'), findsOneWidget);
      // Both visible units of the open chapter are read and ticked; the two
      // subtopics are folded away under a topic that is not expanded, and a
      // finished chapter carries a check in place of its number.
      expect(find.byIcon(Icons.check_circle_rounded), findsNWidgets(2));
      expect(find.byIcon(Icons.check_rounded), findsOneWidget);
    });
  });

  group('layout', () {
    testWidgets('lays out on a narrow phone without overflowing',
        (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await pump(tester, activeIndex: 1);
      expect(tester.takeException(), isNull);
    });

    testWidgets('survives the largest text scale', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await pump(tester, activeIndex: 1);
      expect(tester.takeException(), isNull);
    });
  });
}
