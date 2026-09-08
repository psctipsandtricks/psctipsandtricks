import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/features/books/reader_audio_controller.dart';
import 'package:psc_tips_tricks_mobile/features/pdfs/pdf_viewer_screen.dart';
import 'package:psc_tips_tricks_mobile/features/pdfs/widgets/pdf_transition_cover.dart';

void main() {
  testWidgets('the document is covered while the viewer is travelling',
      (tester) async {
    // The regression this exists for: the document is a native platform view,
    // which does not travel with the Flutter layer during a page transition —
    // sliding one in tears, ghosts, or shows the screen underneath through it.
    // The reader has been covered for a while; this screen was not.
    tester.view.physicalSize = const Size(400, 860);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final audio = ReaderAudioController();
    addTearDown(audio.dispose);

    final navigatorKey = GlobalKey<NavigatorState>();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        sharedPrefsProvider.overrideWithValue(prefs),
        readerAudioProvider.overrideWithValue(audio),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        navigatorKey: navigatorKey,
        home: const Scaffold(body: Text('the topic')),
      ),
    ));

    // Pushed rather than used as `home`: a first route has no transition to
    // glitch during, which is exactly the case that would pass vacuously.
    navigatorKey.currentState!.push(
      MaterialPageRoute<void>(
        builder: (_) => const PdfViewerScreen(
          args: PdfViewerArgs(
            url: 'https://cdn.test/notes.pdf',
            title: 'Sree Narayana Guru',
            minimal: true,
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 120));

    expect(
      find.byKey(documentTransitionCoverKey),
      findsOneWidget,
      reason: 'mid-transition the platform view must not be on show',
    );

    // Past the end of the route animation the document slot is handed back.
    // Not pumpAndSettle: the slot spins while it fetches, and an indeterminate
    // spinner never settles.
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump(const Duration(seconds: 1));
    expect(find.byKey(documentTransitionCoverKey), findsNothing);

    // And again on the way out, which is the half that was reported as broken.
    navigatorKey.currentState!.pop();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 80));
    expect(find.byKey(documentTransitionCoverKey), findsOneWidget);

    await tester.pump(const Duration(seconds: 1));
  });
}
