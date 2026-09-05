import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../data/models/quiz.dart';
import '../../books/widgets/book_card.dart';

/// Quiz card designed to match the Home Page Book Card (BookTile) style,
/// layout, spacing, image presentation, typography, badges, and border radius.
class QuizCard extends StatelessWidget {
  const QuizCard({
    super.key,
    required this.quiz,
    this.onTap,
    this.width = 240,
  });

  final Quiz quiz;
  final VoidCallback? onTap;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;
    final coverHeight = (width != null && width!.isFinite && width! > 0)
        ? (width! * (9 / 16)).clamp(115.0, 180.0)
        : 145.0;

    final categoryName = (quiz.category != null && quiz.category!.isNotEmpty)
        ? quiz.category!
        : ((quiz.folderName != null &&
                quiz.folderName!.isNotEmpty &&
                quiz.folderName!.toLowerCase() != 'root' &&
                quiz.folderName!.toLowerCase() != 'root / no folder')
            ? quiz.folderName!
            : 'KERALA PSC');

    final subtitleText = (quiz.topic != null && quiz.topic!.isNotEmpty)
        ? quiz.topic!
        : ((quiz.folderName != null &&
                quiz.folderName!.isNotEmpty &&
                quiz.folderName!.toLowerCase() != 'root' &&
                quiz.folderName!.toLowerCase() != 'root / no folder')
            ? quiz.folderName!
            : 'PSC Tips and Tricks');

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
                    child: SizedBox(
                      width: width ?? double.infinity,
                      height: coverHeight,
                      child: quiz.imageUrl != null && quiz.imageUrl!.isNotEmpty
                          ? AppImage(
                              url: quiz.imageUrl,
                              width: width ?? double.infinity,
                              height: coverHeight,
                              fallbackIcon: quiz.isLiveMock
                                  ? Icons.emoji_events_rounded
                                  : Icons.quiz_rounded,
                            )
                          : _QuizCoverPlaceholder(
                              quiz: quiz,
                              category: categoryName,
                              height: coverHeight,
                            ),
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
                        if (quiz.isNew) ...[
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
                            categoryName.toUpperCase(),
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
                        if (quiz.isLiveMock)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2.5),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFF59E0B), Color(0xFFEA580C)],
                              ),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.bolt_rounded,
                                    size: 10, color: Colors.white),
                                SizedBox(width: 3),
                                Text(
                                  'LIVE MOCK',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ],
                            ),
                          )
                        else if (quiz.isPaid)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2.5),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFF59E0B), Color(0xFFEA580C)],
                              ),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              '-50%',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 9.5,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          )
                        else
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'FREE',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 9.5,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),

                  // Bottom Left info on image: Questions count pill (matching Chapters pill)
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
                          const Icon(Icons.quiz_rounded,
                              size: 10, color: AppColors.amber),
                          const SizedBox(width: 3),
                          Text(
                            '${quiz.totalQuestions} Questions',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),

              // Quiz Details with fixed slot heights for perfect horizontal alignment
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
                        quiz.title,
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
                    // Fixed 1-line topic slot (16px)
                    SizedBox(
                      height: 16,
                      child: Text(
                        subtitleText,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: palette.textMuted,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Price & Actions Row - Always pinned at the exact same horizontal baseline!
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        if (!quiz.isPaid)
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
                        else ...[
                          Text(
                            Fmt.price(quiz.price),
                            style: TextStyle(
                              color: isDark
                                  ? const Color(0xFFFBBF24)
                                  : const Color(0xFFD97706),
                              fontWeight: FontWeight.w900,
                              fontSize: 14.5,
                            ),
                          ),
                          if (quiz.price > 0) ...[
                            const SizedBox(width: 5),
                            Text(
                              Fmt.price(quiz.price * 2),
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
                        if (quiz.isPaid && quiz.isLocked)
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
                                  'Start',
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

/// Rich graphical cover fallback for quizzes without a custom uploaded image.
class _QuizCoverPlaceholder extends StatelessWidget {
  const _QuizCoverPlaceholder({
    required this.quiz,
    required this.category,
    required this.height,
  });

  final Quiz quiz;
  final String category;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Color(0xFF0F172A),
            Color(0xFF1E293B),
            Color(0xFF1E1B4B),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Background graphic watermark
          Positioned(
            right: -10,
            bottom: -10,
            child: Icon(
              Icons.quiz_rounded,
              size: 84,
              color: Colors.white.withValues(alpha: 0.05),
            ),
          ),
          // Center emblem
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.amber.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.amber.withValues(alpha: 0.35),
                      width: 1,
                    ),
                  ),
                  child: Icon(
                    quiz.isLiveMock
                        ? Icons.bolt_rounded
                        : Icons.workspace_premium_rounded,
                    size: 22,
                    color: AppColors.amber,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  category.toUpperCase(),
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Folder row in the quiz hub drill-down.
class QuizFolderCard extends StatelessWidget {
  const QuizFolderCard({
    super.key,
    required this.folder,
    this.quizCount,
    this.subFolderCount,
    this.accentColor,
    this.onTap,
  });

  final QuizFolder folder;
  final int? quizCount;
  final int? subFolderCount;
  final Color? accentColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final activeQuizCount = quizCount ?? folder.quizCount;
    final activeSubCount = subFolderCount ?? folder.subFolderCount;
    final color = accentColor ?? AppColors.indigo;

    final parts = <String>[
      if (activeSubCount > 0)
        Fmt.count(activeSubCount, 'folder'),
      if (activeQuizCount > 0)
        Fmt.count(activeQuizCount, 'quiz', 'quizzes'),
    ];

    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      borderColor: color.withValues(alpha: 0.25),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            ),
            child: Icon(Icons.folder_rounded, color: color, size: 20),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  folder.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                if (parts.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    parts.join(' · '),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: palette.textMuted,
                        ),
                  ),
                ],
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: palette.textMuted),
        ],
      ),
    );
  }
}

