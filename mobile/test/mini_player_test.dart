import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:shared_preferences/shared_preferences.dart';

import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/features/books/reader_audio_controller.dart';
import 'package:psc_tips_tricks_mobile/features/books/widgets/reader_audio_player.dart';

void main() {
  late SharedPreferences prefs;

  setUp(() async {
    SharedPreferences.setMockInitialValues(
        {'reader_audio_bar_collapsed': false});
    prefs = await SharedPreferences.getInstance();
  });

  testWidgets('the mini player is silent until a clip is loaded',
      (tester) async {
    final audio = ReaderAudioController();
    addTearDown(audio.dispose);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        sharedPrefsProvider.overrideWithValue(prefs),
        readerAudioProvider.overrideWithValue(audio),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const Scaffold(bottomNavigationBar: ReaderMiniPlayer()),
      ),
    ));
    await tester.pump();
    expect(find.byType(LinearProgressIndicator), findsNothing);

    // A topic's narration arrives while the notes are open.
    audio.title.value = 'Kerala Renaissance';
    audio.duration.value = const Duration(minutes: 14);
    audio.position.value = const Duration(seconds: 72);
    await tester.pump();

    expect(find.text('Kerala Renaissance'), findsOneWidget);
    expect(find.text('01:12 / 14:00'), findsOneWidget);
    expect(find.byIcon(Icons.play_arrow_rounded), findsOneWidget);
    expect(find.byTooltip('Back 10 seconds'), findsOneWidget);
    expect(find.byTooltip('Forward 10 seconds'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('sideways it folds into a single row', (tester) async {
    final audio = ReaderAudioController();
    addTearDown(audio.dispose);
    audio.title.value = 'Kerala Renaissance';
    audio.duration.value = const Duration(minutes: 14);
    audio.position.value = const Duration(seconds: 72);

    Future<double> heightAt(Size size) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(ProviderScope(
        overrides: [
          sharedPrefsProvider.overrideWithValue(prefs),
          readerAudioProvider.overrideWithValue(audio),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(bottomNavigationBar: ReaderMiniPlayer()),
        ),
      ));
      await tester.pump();
      return tester.getSize(find.byType(ReaderMiniPlayer)).height;
    }

    final portrait = await heightAt(const Size(400, 860));
    final landscape = await heightAt(const Size(880, 410));

    // The transport used to cost a quarter of a sideways phone's height: a
    // 48dp slider row on top of a 52dp control row. One row instead.
    expect(landscape, lessThan(64));
    expect(landscape, lessThan(portrait));

    // Set after the first frame: the controller republishes a zero position
    // when it attaches to the player, which would otherwise overwrite this.
    audio.position.value = const Duration(seconds: 72);
    await tester.pump();

    // Nothing is dropped to get there — the scrubber is still draggable and
    // the clock still reads.
    expect(find.byType(Slider), findsOneWidget);
    expect(find.text('01:12 / 14:00'), findsOneWidget);
    expect(find.text('Kerala Renaissance'), findsOneWidget);
    expect(find.byTooltip('Back 10 seconds'), findsOneWidget);
    expect(find.byTooltip('Forward 10 seconds'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('it follows the shared controller into the playing state',
      (tester) async {
    final audio = ReaderAudioController();
    addTearDown(audio.dispose);
    audio.title.value = 'Indian Constitution';

    await tester.pumpWidget(ProviderScope(
      overrides: [
        sharedPrefsProvider.overrideWithValue(prefs),
        readerAudioProvider.overrideWithValue(audio),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const Scaffold(bottomNavigationBar: ReaderMiniPlayer()),
      ),
    ));
    await tester.pump();

    audio.playing.value = true;
    await tester.pump();
    expect(find.byIcon(Icons.pause_rounded), findsOneWidget);

    audio.failed.value = true;
    await tester.pump();
    expect(find.text('Narration could not be loaded.'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });
}
