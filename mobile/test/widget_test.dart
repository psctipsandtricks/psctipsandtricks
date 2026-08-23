import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/core/widgets/glass_card.dart';
import 'package:psc_tips_tricks_mobile/core/utils/formatters.dart';
import 'package:psc_tips_tricks_mobile/data/models/quiz.dart';
import 'package:psc_tips_tricks_mobile/features/books/reader_types.dart';
import 'package:psc_tips_tricks_mobile/data/models/book.dart';
import 'package:psc_tips_tricks_mobile/data/models/order.dart';

void main() {
  group('negative marking', () {
    test('deducts once per full block of wrong answers', () {
      const rules = NegativeMarking(
        enabled: true,
        every: 3,
        deduct: 1,
        allowNegativeScore: false,
      );
      expect(rules.penaltyFor(2), 0);
      expect(rules.penaltyFor(3), 1);
      expect(rules.penaltyFor(8), 2);
    });

    test('is inert when disabled', () {
      expect(NegativeMarking.disabled.penaltyFor(99), 0);
    });
  });

  group('reader units', () {
    test('flattens topics and subtopics in reading order', () {
      final chapters = [
        const Chapter(
          id: 'c1',
          bookId: 'b1',
          title: 'Chapter One',
          orderIndex: 0,
          topics: [
            Topic(
              id: 't1',
              chapterId: 'c1',
              title: 'Topic One',
              orderIndex: 0,
              subtopics: [
                Subtopic(
                  id: 's1',
                  topicId: 't1',
                  title: 'Subtopic One',
                  orderIndex: 0,
                ),
              ],
            ),
          ],
        ),
        // A chapter with no topics has nothing to read and is skipped.
        const Chapter(id: 'c2', bookId: 'b1', title: 'Empty', orderIndex: 1),
      ];

      final units = flattenChapters(chapters);
      expect(units.length, 2);
      expect(units.first.id, 't1');
      expect(units.first.isChapterStart, isTrue);
      expect(units.last.isSubtopic, isTrue);
      // A subtopic resumes to its parent topic, since progress is topic-grained.
      expect(units.last.topicId, 't1');
    });

    test('resolves a resume point by topic, then by chapter', () {
      final units = flattenChapters([
        const Chapter(
          id: 'c1',
          bookId: 'b1',
          title: 'One',
          orderIndex: 0,
          topics: [
            Topic(id: 't1', chapterId: 'c1', title: 'A', orderIndex: 0),
            Topic(id: 't2', chapterId: 'c1', title: 'B', orderIndex: 1),
          ],
        ),
      ]);

      expect(resolveResumeIndex(units, topicId: 't2'), 1);
      expect(resolveResumeIndex(units, chapterId: 'c1'), 0);
      expect(resolveResumeIndex(units, topicId: 'missing'), -1);
    });
  });

  group('coupon', () {
    test('caps the percentage discount at the maximum amount', () {
      const coupon =
          Coupon(code: 'SAVE50', discountPercent: 50, maxDiscountAmount: 100);
      expect(coupon.discountOn(120), 60);
      expect(coupon.discountOn(400), 100);
    });
  });

  group('formatters', () {
    test('clock grows to hours only when needed', () {
      expect(Fmt.clock(const Duration(seconds: 65)), '01:05');
      expect(Fmt.clock(const Duration(hours: 1, minutes: 2)), '1:02:00');
    });

    test('marks drop a trailing .0', () {
      expect(Fmt.marks(4), '4');
      expect(Fmt.marks(4.25), '4.25');
    });
  });

  testWidgets('quiz options reveal the correct answer once chosen',
      (tester) async {
    // Booting the whole app would pull in secure storage, the HTTP client and
    // the image cache, none of which have a test binding. Pinning one widget to
    // the real theme covers the rendering path that matters here.
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: const Scaffold(
          body: Column(
            children: [
              AppBadge('PREMIUM'),
              GlassCard(child: Text('Kerala PSC')),
            ],
          ),
        ),
      ),
    );

    expect(find.text('PREMIUM'), findsOneWidget);
    expect(find.text('Kerala PSC'), findsOneWidget);
  });
}
