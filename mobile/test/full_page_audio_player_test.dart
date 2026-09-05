import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:psc_tips_tricks_mobile/features/books/full_page_audio_player_screen.dart';
import 'package:psc_tips_tricks_mobile/features/books/widgets/reader_audio_player.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Widget buildTestWidget({required Widget child, List<Override> overrides = const []}) {
    return ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        home: child,
      ),
    );
  }

  testWidgets('ReaderTabletAudioPlayer renders Expand button and triggers onExpand on tap',
      (tester) async {
    var expanded = false;

    await tester.pumpWidget(
      buildTestWidget(
        child: Scaffold(
          body: ReaderTabletAudioPlayer(
            onExpand: () => expanded = true,
          ),
        ),
      ),
    );

    // Expand button with open_in_full_rounded icon is present
    final expandButton = find.byIcon(Icons.open_in_full_rounded);
    expect(expandButton, findsOneWidget);

    // Tapping the Expand button triggers onExpand callback
    await tester.tap(expandButton);
    await tester.pumpAndSettle();
    expect(expanded, isTrue);
  });

  testWidgets('Tapping title in ReaderTabletAudioPlayer also triggers onExpand',
      (tester) async {
    var expanded = false;

    await tester.pumpWidget(
      buildTestWidget(
        child: Scaffold(
          body: ReaderTabletAudioPlayer(
            onExpand: () => expanded = true,
          ),
        ),
      ),
    );

    final titleFinder = find.text('Audio Lesson');
    expect(titleFinder, findsOneWidget);

    await tester.tap(titleFinder);
    await tester.pumpAndSettle();
    expect(expanded, isTrue);
  });

  testWidgets(
      'FullPageAudioPlayerScreen renders all UI elements and pops on minimize button tap',
      (tester) async {
    var nextTapped = false;
    var prevTapped = false;

    await tester.pumpWidget(
      buildTestWidget(
        child: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => FullPageAudioPlayerScreen(
                        bookTitle: 'PSC Tips Guide',
                        onNext: () => nextTapped = true,
                        onPrevious: () => prevTapped = true,
                        hasNext: () => true,
                        hasPrevious: () => true,
                      ),
                    ),
                  );
                },
                child: const Text('Open Player'),
              ),
            ),
          ),
        ),
      ),
    );

    // Tap to open full page audio screen
    await tester.tap(find.text('Open Player'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    // Verify Full-Page Audio Screen elements:
    // 1. Back / Minimize arrow
    final minimizeButton = find.byIcon(Icons.keyboard_arrow_down_rounded);
    expect(minimizeButton, findsOneWidget);

    // 2. Playback transport controls
    expect(find.byIcon(Icons.replay_10_rounded), findsOneWidget);
    expect(find.byIcon(Icons.skip_previous_rounded), findsOneWidget);
    expect(find.byIcon(Icons.skip_next_rounded), findsOneWidget);
    expect(find.byIcon(Icons.forward_10_rounded), findsOneWidget);

    // 3. Play / Pause icons (center transport)
    expect(find.byIcon(Icons.play_arrow_rounded), findsOneWidget);

    // 4. Speed selector chips
    expect(find.text('1x'), findsOneWidget);

    // Test next/prev taps
    await tester.tap(find.byIcon(Icons.skip_next_rounded));
    expect(nextTapped, isTrue);

    await tester.tap(find.byIcon(Icons.skip_previous_rounded));
    expect(prevTapped, isTrue);

    // 5. Test Minimize button returns to previous page
    await tester.tap(minimizeButton);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    // Verified back on the previous screen!
    expect(find.text('Open Player'), findsOneWidget);
    expect(find.byIcon(Icons.keyboard_arrow_down_rounded), findsNothing);
  });
}
