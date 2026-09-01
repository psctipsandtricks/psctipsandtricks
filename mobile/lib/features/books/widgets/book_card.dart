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
              BookCover(
                url: book.heroCoverUrl ?? book.coverUrl,
                width: 86,
                aspectRatio: book.heroCoverUrl != null ? (4 / 3) : (9 / 16),
              ),
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
                Row(
                  children: [
                    if (book.isNew) ...[
                      const AppBadge(
                        'NEW',
                        color: AppColors.emerald,
                        icon: Icons.auto_awesome_rounded,
                        filled: true,
                      ),
                      const SizedBox(width: 6),
                    ],
                    if (book.category.isNotEmpty)
                      Flexible(
                        child: AppBadge(book.category.toUpperCase()),
                      ),
                  ],
                ),
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
                if (book.subscription != null) ...[
                  const SizedBox(height: 6),
                  SubscriptionValidity(subscription: book.subscription!),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// When a book is held on a subscription rather than owned outright, the date
/// that entitlement runs out.
///
/// Shown on the card itself because the alternative — opening the book to find
/// out — is exactly the discovery a student should not have to make. The
/// wording and colour shift as the date approaches so a lapse is never a
/// surprise: quiet while there is time, amber inside the last week, and red
/// once it has gone.
class SubscriptionValidity extends StatelessWidget {
  const SubscriptionValidity({
    super.key,
    required this.subscription,
    this.compact = false,
  });

  final SubscriptionAccess subscription;

  /// Tightens the type for the narrower carousel tile.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final validTill = subscription.validTill;
    // A subscription the API could not date is not worth a half-empty line.
    if (validTill == null) return const SizedBox.shrink();

    final expired = subscription.isExpired;
    final color = expired
        ? AppColors.rose
        : subscription.isExpiringSoon
            ? AppColors.amber
            : context.palette.textMuted;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          expired ? Icons.event_busy_rounded : Icons.event_available_rounded,
          size: compact ? 11 : 12,
          color: color,
        ),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            '${expired ? 'Expired' : 'Valid till'} ${Fmt.date(validTill)}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontSize: compact ? 10 : 11,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      ],
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

/// Cover-forward premium card used by the home carousel (16:9 widescreen YouTube aspect ratio).
class BookTile extends StatelessWidget {
  const BookTile({
    super.key,
    required this.book,
    this.onTap,
    this.width = 240,
  });

  final Book book;
  final VoidCallback? onTap;
  final double width;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;
    final coverHeight = width * (9 / 16);

    return Container(
      width: width,
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(
          color: isDark
              ? const Color(0xFF1E293B)
              : const Color(0xFFE2E8F0),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Cover with Badges
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(AppTheme.radiusLg - 1),
                    ),
                    child: AppImage(
                      url: book.heroCoverUrl ?? book.coverUrl,
                      width: width,
                      height: coverHeight,
                      fallbackIcon: Icons.auto_stories_rounded,
                    ),
                  ),

                  // Gradient overlay on bottom of image for badge legibility
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(AppTheme.radiusLg - 1),
                        ),
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black.withValues(alpha: 0.2),
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.5),
                          ],
                          stops: const [0.0, 0.4, 1.0],
                        ),
                      ),
                    ),
                  ),

                  // Top Left: NEW / Category badge
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (book.isNew) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2.5),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF10B981), Color(0xFF059669)],
                              ),
                              borderRadius: BorderRadius.circular(6),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF10B981)
                                      .withValues(alpha: 0.4),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ],
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.auto_awesome_rounded,
                                    size: 10, color: Colors.white),
                                SizedBox(width: 3),
                                Text(
                                  'NEW',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.4,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 5),
                        ],
                        if (book.category.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2.5),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.6),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.2),
                                width: 0.8,
                              ),
                            ),
                            child: Text(
                              book.category.toUpperCase(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),

                  // Top Right: Discount / Access badge
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (book.hasDiscount)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2.5),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFF59E0B), Color(0xFFEA580C)],
                              ),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '-${book.discountPercent}%',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9.5,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          )
                        else if (book.isUnlocked && book.isPremium)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.check_circle_rounded,
                                    size: 10, color: Colors.white),
                                SizedBox(width: 3),
                                Text(
                                  'OWNED',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),

                  // Bottom Left info on image: Chapters or audio pill
                  if ((book.chaptersCount ?? 0) > 0 || book.previewAudioUrl != null)
                    Positioned(
                      bottom: 6,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.65),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.15),
                            width: 0.6,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (book.previewAudioUrl != null) ...[
                              const Icon(Icons.headphones_rounded,
                                  size: 10, color: AppColors.cyan),
                              const SizedBox(width: 3),
                              const Text(
                                'Audiobook',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ] else if ((book.chaptersCount ?? 0) > 0) ...[
                              const Icon(Icons.menu_book_rounded,
                                  size: 10, color: AppColors.amber),
                              const SizedBox(width: 3),
                              Text(
                                '${book.chaptersCount} Chapters',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                ],
              ),

              // Book Details
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      book.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                            height: 1.25,
                            letterSpacing: -0.2,
                          ),
                    ),
                    const SizedBox(height: 3),
                    if (book.author.isNotEmpty)
                      Text(
                        book.author,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: palette.textMuted,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                      ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        if (book.isFree)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: AppColors.emerald.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(
                                color: AppColors.emerald.withValues(alpha: 0.3),
                              ),
                            ),
                            child: const Text(
                              'FREE',
                              style: TextStyle(
                                color: AppColors.emerald,
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          )
                        else ...[
                          Text(
                            Fmt.price(book.finalPrice),
                            style: TextStyle(
                              color: isDark ? const Color(0xFFFBBF24) : const Color(0xFFD97706),
                              fontWeight: FontWeight.w900,
                              fontSize: 14.5,
                            ),
                          ),
                          if (book.hasDiscount) ...[
                            const SizedBox(width: 5),
                            Text(
                              Fmt.price(book.price),
                              style: TextStyle(
                                color: palette.textMuted,
                                fontSize: 11,
                                decoration: TextDecoration.lineThrough,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ],
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: AppColors.cyan.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.arrow_forward_rounded,
                            size: 13,
                            color: AppColors.cyan,
                          ),
                        ),
                      ],
                    ),
                    if (book.subscription != null) ...[
                      const SizedBox(height: 5),
                      SubscriptionValidity(
                        subscription: book.subscription!,
                        compact: true,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
