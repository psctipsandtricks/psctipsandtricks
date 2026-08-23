import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../data/models/book.dart';

/// Catalog row: cover, title, author, and the price or unlocked state.
class BookCard extends StatelessWidget {
  const BookCard({super.key, required this.book, this.onTap});

  final Book book;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              BookCover(url: book.coverUrl, width: 96),
              if (book.isPremium && !book.isUnlocked)
                Positioned(
                  top: 6,
                  left: 6,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Icon(Icons.lock_rounded,
                        size: 12, color: AppColors.amber),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (book.category.isNotEmpty)
                  AppBadge(book.category.toUpperCase()),
                const SizedBox(height: 7),
                Text(
                  book.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        height: 1.25,
                      ),
                ),
                const SizedBox(height: 3),
                Text(
                  book.author,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
                const SizedBox(height: 9),
                Row(
                  children: [
                    _PriceLabel(book: book),
                    const Spacer(),
                    if ((book.chaptersCount ?? 0) > 0)
                      _MetaChip(
                        icon: Icons.layers_rounded,
                        label: '${book.chaptersCount}',
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

class _PriceLabel extends StatelessWidget {
  const _PriceLabel({required this.book});

  final Book book;

  @override
  Widget build(BuildContext context) {
    if (book.isUnlocked && book.isPremium) {
      return const AppBadge('OWNED',
          color: AppColors.emerald, icon: Icons.check_circle_rounded);
    }
    if (book.isFree) {
      return const AppBadge('FREE', color: AppColors.emerald);
    }
    return Row(
      children: [
        Text(
          Fmt.price(book.finalPrice),
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w900,
                color: AppColors.amber,
              ),
        ),
        if (book.hasDiscount) ...[
          const SizedBox(width: 6),
          Text(
            Fmt.price(book.price),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.palette.textMuted,
                  decoration: TextDecoration.lineThrough,
                ),
          ),
        ],
      ],
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: palette.textMuted),
          const SizedBox(width: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: palette.textMuted,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

/// Compact cover-forward tile used by the home carousel (16:9 YouTube aspect ratio).
class BookTile extends StatelessWidget {
  const BookTile({super.key, required this.book, this.onTap, this.width = 160});

  final Book book;
  final VoidCallback? onTap;
  final double width;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            BookCover(url: book.coverUrl, width: width),
            const SizedBox(height: 9),
            Flexible(
              child: Text(
                book.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      height: 1.3,
                    ),
              ),
            ),
            const SizedBox(height: 3),
            Text(
              book.isFree ? 'Free' : Fmt.price(book.finalPrice),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: book.isFree ? AppColors.emerald : AppColors.amber,
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
