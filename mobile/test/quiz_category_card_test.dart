import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/features/quizzes/widgets/quiz_category_card.dart';

void main() {
  Future<int> pump(
    WidgetTester tester, {
    QuizCategoryType type = QuizCategoryType.premium,
    int count = 2,
    Size size = const Size(400, 800),
    double textScale = 1.0,
    bool dark = false,
    VoidCallback? onTap,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    tester.platformDispatcher.textScaleFactorTestValue = textScale;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    var taps = 0;
    await tester.pumpWidget(MaterialApp(
      theme: dark ? AppTheme.dark() : AppTheme.light(),
      home: Scaffold(
        body: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: QuizCategoryCard(
            type: type,
            count: count,
            onTap: onTap ?? () => taps++,
          ),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    return taps;
  }

  group('content', () {
    testWidgets('names the category and how much is in it', (tester) async {
      await pump(tester, type: QuizCategoryType.free, count: 7);

      expect(find.text('Free Quiz'), findsOneWidget);
      expect(find.text('7 Quizzes'), findsOneWidget);
      expect(find.textContaining('Practice free question banks'), findsOneWidget);
    });

    testWidgets('a single quiz is not "1 Quizzes"', (tester) async {
      await pump(tester, count: 1);
      expect(find.text('1 Quiz'), findsOneWidget);
    });

    testWidgets('the whole card is one button for a screen reader',
        (tester) async {
      final handle = tester.ensureSemantics();
      await pump(tester, type: QuizCategoryType.free, count: 7);

      final node = tester.getSemantics(find.byType(QuizCategoryCard));
      expect(node.label, 'Free Quiz, 7 Quizzes');
      // ignore: deprecated_member_use
      expect(node.hasFlag(SemanticsFlag.isButton), isTrue);
      // The card collapses to one node, so that node has to carry the action
      // itself — otherwise it can be announced but never activated.
      expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);
      handle.dispose();
    });

    testWidgets('tapping anywhere on the card opens the category',
        (tester) async {
      var tapped = false;
      await pump(tester, onTap: () => tapped = true);

      await tester.tap(find.text('Premium Quiz'));
      await tester.pumpAndSettle();
      expect(tapped, isTrue);
    });
  });

  group('layout', () {
    // The regression this card was rewritten for: at the largest text size the
    // app allows, a fixed title-plus-count row ran 262px off a small screen.
    testWidgets('survives the largest text size on the narrowest phone',
        (tester) async {
      await pump(
        tester,
        size: const Size(320, 640),
        textScale: 1.3,
      );

      expect(tester.takeException(), isNull);
      expect(find.text('Premium Quiz'), findsOneWidget);
      expect(find.text('2 Quizzes'), findsOneWidget);
    });

    testWidgets('a long count still fits beside the title at normal size',
        (tester) async {
      await pump(tester, size: const Size(360, 800), count: 1284);

      expect(tester.takeException(), isNull);
      expect(find.text('1284 Quizzes'), findsOneWidget);
    });

    testWidgets('lays out in dark mode too', (tester) async {
      await pump(tester, dark: true, size: const Size(320, 640), textScale: 1.3);
      expect(tester.takeException(), isNull);
    });

    testWidgets('both categories fit stacked on one narrow screen',
        (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                QuizCategoryCard(
                  type: QuizCategoryType.free,
                  count: 7,
                  onTap: () {},
                ),
                const SizedBox(height: 12),
                QuizCategoryCard(
                  type: QuizCategoryType.premium,
                  count: 2,
                  onTap: () {},
                ),
              ],
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
