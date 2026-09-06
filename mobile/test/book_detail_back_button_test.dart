import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/book.dart';
import 'package:psc_tips_tricks_mobile/features/books/book_detail_screen.dart';
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

void main() {
  const book = Book(
    id: 'b1',
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

  /// Boots the detail page behind a real router, so the back button is tested
  /// against the navigation it actually has to drive.
  Future<GoRouter> pump(
    WidgetTester tester, {
    required String initialLocation,
  }) async {
    tester.view.physicalSize = const Size(400, 1400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final audio = _SilentAudio();
    addTearDown(audio.dispose);

    final router = GoRouter(
      initialLocation: initialLocation,
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

  Finder backArrow() => find.byIcon(Icons.arrow_back_rounded);

  testWidgets('the cover header offers a back button', (tester) async {
    await pump(tester, initialLocation: '/books/b1');

    expect(backArrow(), findsOneWidget);
  });

  testWidgets('the arrow is light, so it does not vanish into the cover scrim',
      (tester) async {
    await pump(tester, initialLocation: '/books/b1');

    // The regression: the app-bar theme paints icons near-black, which is the
    // one colour that cannot be seen against this header's darkened cover.
    final icon = tester.widget<Icon>(backArrow());
    final resolved = icon.color ??
        IconTheme.of(tester.element(backArrow())).color;
    expect(resolved, Colors.white);
  });

  testWidgets('tapping it goes back to the page underneath', (tester) async {
    final router = await pump(tester, initialLocation: '/books');
    router.push('/books/b1');
    await tester.pumpAndSettle();
    expect(find.text('Kerala History'), findsOneWidget);

    await tester.tap(backArrow());
    await tester.pumpAndSettle();

    expect(find.text('books library'), findsOneWidget);
  });

  testWidgets('opened cold from a deep link, it still leads somewhere',
      (tester) async {
    // Nothing to pop here: without the fallback the tap would strand the
    // student on a blank route.
    await pump(tester, initialLocation: '/books/b1');

    await tester.tap(backArrow());
    await tester.pumpAndSettle();

    expect(find.text('books library'), findsOneWidget);
  });
}
