import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../data/models/book.dart';

/// Radiant gold gradient Buy Now button with pill capsule styling and lock icon.
class BuyNowButton extends StatelessWidget {
  const BuyNowButton({
    super.key,
    this.onTap,
    this.compact = false,
  });

  final VoidCallback? onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 11 : 13,
        vertical: compact ? 5.5 : 7,
      ),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFFBBF24), // Vibrant gold
            Color(0xFFF59E0B),
            Color(0xFFD97706),
          ],
        ),
        borderRadius: BorderRadius.circular(20), // Sleek pill shape
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.35),
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF59E0B).withValues(alpha: 0.42),
            blurRadius: 9,
            offset: const Offset(0, 2.5),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A).withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.lock_rounded,
              size: compact ? 10.5 : 12,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(width: 4.5),
          Text(
            'Buy Now',
            style: TextStyle(
              color: const Color(0xFF0F172A),
              fontSize: compact ? 10.5 : 11.5,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

/// Catalog row: cover, title, author, and the price or unlocked state.
class BookCard extends StatelessWidget {
  const BookCard({super.key, required this.book, this.onTap});

  final Book book;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;

    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.all(12),
      borderRadius: AppTheme.radiusLg,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 3D Book Cover thumbnail with multi-layer shadow and spine effect
          Stack(
            children: [
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: isDark ? 0.45 : 0.15),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  child: BookCover(
                    url: book.effectiveHeroCoverUrl,
                    width: 84,
                    aspectRatio: 3 / 2,
                  ),
                ),
              ),
              // Spine shine / shadow effect overlay on left edge
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                width: 6,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: const BorderRadius.horizontal(
                      left: Radius.circular(AppTheme.radiusMd),
                    ),
                    gradient: LinearGradient(
                      colors: [
                        Colors.black.withValues(alpha: 0.35),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
              // Top-left status badge over cover
              if (book.isNew) ...[
                Positioned(
                  top: 6,
                  left: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2.5),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF10B981), Color(0xFF059669)],
                      ),
                      borderRadius: BorderRadius.circular(5),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF10B981).withValues(alpha: 0.4),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.auto_awesome_rounded, size: 9, color: Colors.white),
                        SizedBox(width: 2.5),
                        Text(
                          'NEW',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 8.5,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ] else if (book.isPremium && !book.isUnlocked) ...[
                Positioned(
                  top: 6,
                  left: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5.5, vertical: 2.5),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.78),
                      borderRadius: BorderRadius.circular(5),
                      border: Border.all(
                        color: AppColors.amber.withValues(alpha: 0.65),
                        width: 0.8,
                      ),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.lock_rounded, size: 9.5, color: AppColors.amber),
                        SizedBox(width: 2.5),
                        Text(
                          'LOCKED',
                          style: TextStyle(
                            color: AppColors.amber,
                            fontSize: 8.5,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              // Bottom overlay on cover: audio or chapter indicator
              if (book.previewAudioUrl != null || (book.chaptersCount ?? 0) > 0) ...[
                Positioned(
                  bottom: 5,
                  left: 5,
                  right: 5,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.72),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.12),
                        width: 0.5,
                      ),
                    ),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (book.previewAudioUrl != null) ...[
                            const Icon(Icons.headphones_rounded, size: 9.5, color: AppColors.cyan),
                            const SizedBox(width: 2.5),
                            const Text(
                              'Audio',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 8.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ] else if ((book.chaptersCount ?? 0) > 0) ...[
                            const Icon(Icons.layers_rounded, size: 9.5, color: AppColors.amber),
                            const SizedBox(width: 2.5),
                            Text(
                              '${book.chaptersCount} Ch',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 8.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(width: 14),
          // Content Column
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Category badge & Year
                Row(
                  children: [
                    if (book.category.isNotEmpty)
                      Flexible(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                          decoration: BoxDecoration(
                            color: AppColors.cyan.withValues(alpha: isDark ? 0.12 : 0.08),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: AppColors.cyan.withValues(alpha: isDark ? 0.3 : 0.25),
                              width: 0.8,
                            ),
                          ),
                          child: Text(
                            book.category.toUpperCase(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: isDark ? AppColors.cyan : const Color(0xFF0284C7),
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ),
                      ),
                    const Spacer(),
                    if (book.publicationYear != null)
                      Text(
                        '${book.publicationYear}',
                        style: TextStyle(
                          color: palette.textMuted,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                // Title
                Text(
                  book.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                        height: 1.25,
                        letterSpacing: -0.2,
                      ),
                ),
                const SizedBox(height: 3),
                // Author
                if (book.author.isNotEmpty)
                  Row(
                    children: [
                      Icon(
                        Icons.edit_note_rounded,
                        size: 13,
                        color: palette.textMuted,
                      ),
                      const SizedBox(width: 3),
                      Expanded(
                        child: Text(
                          book.author,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: palette.textMuted,
                                fontSize: 11.5,
                                fontWeight: FontWeight.w500,
                              ),
                        ),
                      ),
                    ],
                  ),
                const SizedBox(height: 8),
                // Price & Actions Row
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _PriceLabel(book: book),
                          if (book.subscription != null) ...[
                            const SizedBox(height: 3),
                            SubscriptionValidity(
                              subscription: book.subscription!,
                              compact: true,
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (!book.isUnlocked && book.isPremium) ...[
                      const BuyNowButton(),
                    ] else ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5.5),
                        decoration: BoxDecoration(
                          color: AppColors.cyan.withValues(alpha: isDark ? 0.12 : 0.08),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: AppColors.cyan.withValues(alpha: isDark ? 0.3 : 0.25),
                            width: 0.8,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Read',
                              style: TextStyle(
                                color: isDark ? AppColors.cyan : const Color(0xFF0284C7),
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(width: 3),
                            Icon(
                              Icons.arrow_forward_rounded,
                              size: 11.5,
                              color: isDark ? AppColors.cyan : const Color(0xFF0284C7),
                            ),
                          ],
                        ),
                      ),
                    ],
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

/// When a book is held on a subscription rather than owned outright, the date
/// that entitlement runs out.
class SubscriptionValidity extends StatelessWidget {
  const SubscriptionValidity({
    super.key,
    required this.subscription,
    this.compact = false,
  });

  final SubscriptionAccess subscription;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final validTill = subscription.validTill;
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
    final palette = context.palette;
    final isDark = palette.isDark;

    if (book.isUnlocked && book.isPremium) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.emerald.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: AppColors.emerald.withValues(alpha: 0.3),
            width: 0.8,
          ),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle_rounded, size: 11, color: AppColors.emerald),
            SizedBox(width: 3.5),
            Text(
              'OWNED',
              style: TextStyle(
                color: AppColors.emerald,
                fontSize: 10,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
      );
    }
    if (book.isFree) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.emerald.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: AppColors.emerald.withValues(alpha: 0.3),
            width: 0.8,
          ),
        ),
        child: const Text(
          'FREE',
          style: TextStyle(
            color: AppColors.emerald,
            fontSize: 10.5,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.3,
          ),
        ),
      );
    }
    return Wrap(
      spacing: 4,
      runSpacing: 2,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(
          Fmt.price(book.finalPrice),
          style: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 15,
            color: isDark ? const Color(0xFFFBBF24) : const Color(0xFFD97706),
          ),
        ),
        if (book.hasDiscount) ...[
          Text(
            Fmt.price(book.price),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: palette.textMuted,
                  fontSize: 11.5,
                  decoration: TextDecoration.lineThrough,
                  fontWeight: FontWeight.w600,
                ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 4.5, vertical: 1.5),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFF59E0B), Color(0xFFEA580C)],
              ),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '-${book.discountPercent}%',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 8.5,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Cover-forward premium card used by the home carousel (16:9 widescreen YouTube aspect ratio).
///
/// Designed with fixed-height title & metadata containers so all buttons align
/// on the exact same horizontal baseline across the entire carousel.
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
                      url: book.effectiveCatalogCoverUrl,
                      width: width,
                      height: coverHeight,
                      fit: BoxFit.cover,
                      alignment: Alignment.center,
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
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFFEA580C)
                                      .withValues(alpha: 0.35),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ],
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

              // Book Details with fixed slot heights for perfect horizontal alignment across all carousel cards
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Fixed 2-line title slot (34px)
                    SizedBox(
                      height: 34,
                      child: Text(
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
                    ),
                    const SizedBox(height: 3),
                    // Fixed 1-line author slot (16px)
                    SizedBox(
                      height: 16,
                      child: book.author.isNotEmpty
                          ? Text(
                              book.author,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: palette.textMuted,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                  ),
                            )
                          : const SizedBox.shrink(),
                    ),
                    const SizedBox(height: 8),
                    // Price & Actions Row - Always pinned at the exact same horizontal baseline!
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (book.isFree)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 2),
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
                              else
                                Wrap(
                                  spacing: 4,
                                  runSpacing: 2,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    Text(
                                      Fmt.price(book.finalPrice),
                                      style: TextStyle(
                                        color: isDark ? const Color(0xFFFBBF24) : const Color(0xFFD97706),
                                        fontWeight: FontWeight.w900,
                                        fontSize: 14,
                                      ),
                                    ),
                                    if (book.hasDiscount) ...[
                                      Text(
                                        Fmt.price(book.price),
                                        style: TextStyle(
                                          color: palette.textMuted,
                                          fontSize: 10.5,
                                          decoration: TextDecoration.lineThrough,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              if (book.subscription != null) ...[
                                const SizedBox(height: 2),
                                SubscriptionValidity(
                                  subscription: book.subscription!,
                                  compact: true,
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        if (!book.isUnlocked && book.isPremium)
                          const BuyNowButton(compact: true)
                        else
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 9, vertical: 4.5),
                            decoration: BoxDecoration(
                              color: AppColors.cyan.withValues(alpha: isDark ? 0.12 : 0.08),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: AppColors.cyan.withValues(alpha: isDark ? 0.3 : 0.25),
                                width: 0.8,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Read',
                                  style: TextStyle(
                                    color: isDark ? AppColors.cyan : const Color(0xFF0284C7),
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(width: 2.5),
                                Icon(
                                  Icons.arrow_forward_rounded,
                                  size: 11,
                                  color: isDark ? AppColors.cyan : const Color(0xFF0284C7),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
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
