import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/data/models/library.dart';
import 'package:psc_tips_tricks_mobile/features/shell/library_providers.dart';
import 'package:psc_tips_tricks_mobile/features/videos/video_list_screen.dart';
import 'package:psc_tips_tricks_mobile/features/videos/video_player_screen.dart';

VideoItem _video(String id, String title) => VideoItem(
      id: id,
      chapterId: 'chap-1',
      title: title,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      youtubeVideoId: 'dQw4w9WgXcQ',
      thumbnailUrl: '',
      orderIndex: 0,
      pdfUrl: 'https://cdn.test/notes.pdf',
      pdfFileName: '$title notes.pdf',
    );

const _folder = LibraryFolder(
  id: 'f1',
  title: 'VFA 50 DAYS CHALLENGE',
  orderIndex: 0,
);

/// Fixed pumps rather than `pumpAndSettle`: the rows carry network thumbnails,
/// and settling on those never returns in a test.
Future<void> _settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  testWidgets('tapping a class in the library opens its video page',
      (tester) async {
    final content = VideoFolderContent(
      folder: _folder,
      videos: [_video('v1', 'DAY 1'), _video('v2', 'DAY 2')],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          videoFolderContentProvider('f1').overrideWith((ref) async => content),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const VideoListScreen(
            examId: 'f1',
            examTitle: 'VFA 50 DAYS CHALLENGE',
          ),
        ),
      ),
    );
    await _settle(tester);

    await tester.tap(find.text('DAY 1'));
    await _settle(tester);

    expect(find.byType(VideoPlayerScreen), findsOneWidget);
    expect(find.text('Watch on YouTube'), findsOneWidget);
  });

  testWidgets('the video page opens above the shell, not inside its branch',
      (tester) async {
    // The library sits in a `StatefulShellRoute` branch whose Navigator belongs
    // to go_router. A route pushed onto that Navigator imperatively is not one
    // go_router knows about, which is what stopped the player appearing at all;
    // the player has to go on the root navigator, the way the notes viewer
    // beside it always has.
    final content = VideoFolderContent(
      folder: _folder,
      videos: [_video('v1', 'DAY 1')],
    );

    final router = GoRouter(
      initialLocation: '/library',
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (context, state, shell) => Scaffold(
            extendBody: true,
            body: shell,
            bottomNavigationBar: const SizedBox(height: 60),
          ),
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/library',
                  builder: (context, state) =>
                      const Scaffold(body: Center(child: Text('Library'))),
                  routes: [
                    GoRoute(
                      path: 'videos/:examId',
                      builder: (context, state) => VideoListScreen(
                        examId: state.pathParameters['examId']!,
                        examTitle: 'VFA 50 DAYS CHALLENGE',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          videoFolderContentProvider('f1').overrideWith((ref) async => content),
        ],
        child: MaterialApp.router(
          theme: AppTheme.light(),
          routerConfig: router,
        ),
      ),
    );
    await _settle(tester);

    router.push('/library/videos/f1?title=VFA%2050%20DAYS%20CHALLENGE');
    await _settle(tester);
    expect(find.text('DAY 1'), findsOneWidget);

    await tester.tap(find.text('DAY 1'));
    await _settle(tester);

    expect(find.byType(VideoPlayerScreen), findsOneWidget,
        reason: 'the tap must reach a visible video page');

    final playerContext = tester.element(find.byType(VideoPlayerScreen));
    expect(
      Navigator.of(playerContext),
      same(Navigator.of(playerContext, rootNavigator: true)),
      reason: 'the player must sit on the root navigator, above the shell',
    );
  });
}
