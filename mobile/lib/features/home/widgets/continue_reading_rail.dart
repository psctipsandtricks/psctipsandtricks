import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/section_header.dart';
import '../../../data/models/dashboard.dart';
import '../../dashboard/dashboard_providers.dart';

/// Resume rail: every book the student has started, newest read first.
///
/// A horizontal carousel rather than the single card this used to be — the
/// server sends up to twelve in-progress books and the website shows them all,
/// so picking `.first` quietly stranded every book but the most recent one.
class ContinueReadingRail extends ConsumerWidget {
  const ContinueReadingRail({super.key});

  static const _cardPadding = 12.0;
  static const _coverWidth = 46.0;
  static const _titleGap = 8.0;
  static const _barHeight = 5.0;

  /// Card width, and with it how much of the next card peeks in.
  ///
  /// A single book takes the full width — there is nothing to swipe to, and a
  /// deliberate gap beside it would just read as a rendering fault. With more
  /// than one, the card stops short so the neighbour's edge shows and the rail
  /// advertises that it scrolls. The cap keeps cards from stretching into
  /// letterboxes on a tablet, where several fit across instead.
  static double _cardWidth(double screenWidth, {required bool single}) {
    if (single) return screenWidth - 32;
    return math.min(screenWidth * 0.82, 340);
  }

  /// Height for the rail, which a horizontal list has to be told outright.
  ///
  /// The two things that can drive it are the cover art, whose height is a
  /// fixed multiple of its width, and the text column, which grows with the
  /// reader's font-size setting. The text side is measured rather than
  /// estimated: line height depends on the font's own metrics as well as on
  /// the style, and a multiplier that looks right for Inter at scale 1.0 was
  /// out by a pixel — enough to overflow the card.
  static double _railHeight(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scaler = MediaQuery.textScalerOf(context);

    final titleLine = _lineHeight(_titleStyle(context), scaler);
    final smallLine = _lineHeight(text.labelSmall, scaler);

    // Title (two lines) + resume line + gap + the progress row, whose height
    // is set by its percentage label rather than by the 5px bar.
    final textColumn =
        titleLine * 2 + smallLine + _titleGap + math.max(smallLine, _barHeight);

    // BookCover multiplies its width by the ratio, so 4/3 is the taller of the
    // two shapes a card can carry.
    const coverHeight = _coverWidth * (4 / 3);

    return _cardPadding * 2 + math.max(coverHeight, textColumn);
  }

  /// What one line of [style] actually occupies, for the given text scale.
  static double _lineHeight(TextStyle? style, TextScaler scaler) {
    final painter = TextPainter(
      // Ascender and descender both, so the measured box is a full line.
      text: TextSpan(text: 'Ag', style: style),
      textDirection: TextDirection.ltr,
      textScaler: scaler,
      maxLines: 1,
    )..layout();
    return painter.height;
  }

  static TextStyle? _titleStyle(BuildContext context) => Theme.of(context)
      .textTheme
      .bodyMedium
      ?.copyWith(fontWeight: FontWeight.w800, height: 1.25);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(dashboardProvider).valueOrNull;
    final inProgress = dashboard?.booksInProgress ?? const [];
    if (inProgress.isEmpty) return const SizedBox.shrink();

    final single = inProgress.length == 1;
    final cardWidth =
        _cardWidth(MediaQuery.sizeOf(context).width, single: single);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 26),
        SectionHeader(
          title: 'Continue reading',
          subtitle: single
              ? null
              : '${Fmt.count(inProgress.length, 'book')} in progress',
          icon: Icons.auto_stories_rounded,
          actionLabel: 'All books',
          onAction: () => context.go(AppRoutes.books),
        ),
        SizedBox(
          height: _railHeight(context),
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            // One card is not a carousel: locking the scroll stops the lone
            // full-width card from drifting under the padding.
            physics: single ? const NeverScrollableScrollPhysics() : null,
            itemCount: inProgress.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final book = inProgress[index];
              return SizedBox(
                width: cardWidth,
                child: _ContinueReadingCard(
                  key: ValueKey(book.bookId),
                  book: book,
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// One book in the resume rail.
class _ContinueReadingCard extends StatelessWidget {
  const _ContinueReadingCard({super.key, required this.book});

  final BookProgress book;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final accent = book.isCompleted ? AppColors.emerald : AppColors.cyan;

    return GlassCard(
      highlighted: !book.isCompleted,
      borderColor:
          book.isCompleted ? AppColors.emerald.withValues(alpha: 0.4) : null,
      padding: const EdgeInsets.all(ContinueReadingRail._cardPadding),
      // A finished book has no position worth resuming; it reopens from the
      // top, which is what the website's "Read Again" does too.
      onTap: () => context.push(
        AppRoutes.bookReader(book.bookId, resume: !book.isCompleted),
      ),
      child: Row(
        children: [
          BookCover(
            url: book.heroCoverUrl ?? book.coverUrl,
            width: ContinueReadingRail._coverWidth,
            aspectRatio: book.heroCoverUrl != null ? (4 / 3) : (9 / 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Flexible, not a bare Text: the rail's height is computed
                // for two title lines, and if anything ever makes that
                // estimate a pixel short the title drops a line instead of
                // painting an overflow stripe over the card.
                Flexible(
                  child: Text(
                    book.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: ContinueReadingRail._titleStyle(context),
                  ),
                ),
                Text(
                  book.isCompleted
                      ? 'Finished — read it again'
                      : book.resumeLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
                const SizedBox(height: ContinueReadingRail._titleGap),
                Row(
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(3),
                        // Deliberately not animated: cards are built and thrown
                        // away as the rail scrolls, so a tween would replay
                        // every time one came back into view.
                        child: LinearProgressIndicator(
                          value: (book.progressPercent / 100).clamp(0.0, 1.0),
                          minHeight: ContinueReadingRail._barHeight,
                          backgroundColor: palette.elevated,
                          valueColor: AlwaysStoppedAnimation(accent),
                        ),
                      ),
                    ),
                    const SizedBox(width: 9),
                    Text(
                      '${book.progressPercent}%',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: accent,
                          ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
