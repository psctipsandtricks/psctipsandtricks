import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/auth_controller.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/book.dart';
import '../checkout/purchase_sheet.dart';
import '../offline/widgets/download_button.dart';
import 'books_providers.dart';

class BookDetailScreen extends ConsumerWidget {
  const BookDetailScreen({super.key, required this.bookId});

  final String bookId;

  Future<void> _buy(BuildContext context, WidgetRef ref, Book book) async {
    final signedIn = ref.read(authControllerProvider).isAuthenticated;
    if (!signedIn) {
      context.push(
        '${AppRoutes.login}?redirect=${Uri.encodeComponent(AppRoutes.bookDetail(book.id))}',
      );
      return;
    }

    final purchased = await showPurchaseSheet(
      context,
      target: PurchaseTarget.book(
        id: book.id,
        title: book.title,
        price: book.finalPrice,
        imageUrl: book.coverUrl,
      ),
    );
    if (!purchased || !context.mounted) return;

    // The purchase changes the access verdict on both the detail record and the
    // catalog row, so drop both.
    ref.invalidate(bookDetailProvider(book.id));
    ref.invalidate(booksProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Unlocked — happy studying!')),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookAsync = ref.watch(bookDetailProvider(bookId));
    final progress = ref.watch(bookProgressProvider(bookId)).valueOrNull;

    return Scaffold(
      body: AsyncView(
        value: bookAsync,
        onRetry: () => ref.invalidate(bookDetailProvider(bookId)),
        loading: const _DetailSkeleton(),
        data: (book) => CustomScrollView(
          slivers: [
            _CoverHeader(book: book),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (book.category.isNotEmpty)
                          AppBadge(book.category.toUpperCase()),
                        const SizedBox(width: 8),
                        if (book.isPremium)
                          const AppBadge(
                            'PREMIUM',
                            color: AppColors.amber,
                            icon: Icons.workspace_premium_rounded,
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      book.title,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w900,
                            height: 1.2,
                            letterSpacing: -0.5,
                          ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'by ${book.author}'
                      '${book.publicationYear != null ? ' · ${book.publicationYear}' : ''}',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: context.palette.textSecondary,
                          ),
                    ),
                    const SizedBox(height: 18),
                    _StatsStrip(book: book),
                    const SizedBox(height: 20),

                    if (progress != null && progress.progressPercent > 0) ...[
                      _ResumeCard(bookId: book.id, progress: progress),
                      const SizedBox(height: 16),
                    ],

                    _PrimaryAction(
                      book: book,
                      onBuy: () => _buy(context, ref, book),
                    ),

                    // Offered only once the API says this student currently has
                    // access; the download call re-checks server-side anyway.
                    if (book.isUnlocked) ...[
                      const SizedBox(height: 14),
                      BookDownloadPanel(book: book),
                    ],
                    const SizedBox(height: 24),

                    if (book.description.trim().isNotEmpty) ...[
                      Text(
                        'About this book',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 9),
                      Text(
                        book.description,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: context.palette.textSecondary,
                              height: 1.6,
                            ),
                      ),
                      const SizedBox(height: 24),
                    ],

                    if (book.chapters.isNotEmpty) ...[
                      Text(
                        'Contents',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 12),
                      ...book.chapters.asMap().entries.map(
                            (entry) => Padding(
                              padding: const EdgeInsets.only(bottom: 9),
                              child: _ChapterRow(
                                index: entry.key + 1,
                                chapter: entry.value,
                              ),
                            ),
                          ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CoverHeader extends StatelessWidget {
  const _CoverHeader({required this.book});

  final Book book;

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 260,
      pinned: true,
      stretch: true,
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(
          fit: StackFit.expand,
          children: [
            AppImage(
              url: book.heroCoverUrl ?? book.coverUrl,
              fit: BoxFit.cover,
              fallbackIcon: Icons.menu_book_rounded,
            ),
            // Scrim so the pinned title and back button stay legible over any
            // cover art.
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.45),
                    Colors.black.withValues(alpha: 0.15),
                    context.palette.background,
                  ],
                  stops: const [0, 0.45, 1],
                ),
              ),
            ),
            Positioned(
              bottom: 18,
              left: 16,
              child: Hero(
                tag: 'book-cover-${book.id}',
                child: Material(
                  color: Colors.transparent,
                  elevation: 10,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  child: BookCover(url: book.coverUrl, width: 96),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatsStrip extends StatelessWidget {
  const _StatsStrip({required this.book});

  final Book book;

  @override
  Widget build(BuildContext context) {
    final items = <(IconData, String, String)>[
      (Icons.layers_rounded, '${book.chaptersCount ?? book.chapters.length}', 'Chapters'),
      if ((book.topicsCount ?? 0) > 0)
        (Icons.topic_rounded, '${book.topicsCount}', 'Topics'),
      (Icons.download_rounded, '${book.downloadCount}', 'Reads'),
    ];

    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0)
              SizedBox(
                height: 32,
                child: VerticalDivider(color: context.palette.border, width: 1),
              ),
            Expanded(
              child: Column(
                children: [
                  Icon(items[i].$1, size: 17, color: AppColors.cyan),
                  const SizedBox(height: 5),
                  Text(
                    items[i].$2,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                  Text(
                    items[i].$3,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: context.palette.textMuted,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PrimaryAction extends StatelessWidget {
  const _PrimaryAction({required this.book, required this.onBuy});

  final Book book;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    if (book.isUnlocked) {
      return GradientButton(
        label: 'Start reading',
        icon: Icons.auto_stories_rounded,
        onPressed: () => context.push(AppRoutes.bookReader(book.id)),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text(
              Fmt.price(book.finalPrice),
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: AppColors.amber,
                  ),
            ),
            if (book.hasDiscount) ...[
              const SizedBox(width: 10),
              Text(
                Fmt.price(book.price),
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: context.palette.textMuted,
                      decoration: TextDecoration.lineThrough,
                    ),
              ),
              const SizedBox(width: 8),
              AppBadge('${book.discountPercent}% OFF',
                  color: AppColors.emerald),
            ],
          ],
        ),
        const SizedBox(height: 14),
        GradientButton(
          label: 'Unlock full access',
          icon: Icons.lock_open_rounded,
          gradient: AppColors.goldGradient,
          onPressed: onBuy,
        ),
        if (book.previewPdfUrl != null) ...[
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => context.push(AppRoutes.bookReader(book.id)),
            icon: const Icon(Icons.visibility_outlined, size: 18),
            label: const Text('Read free preview'),
          ),
        ],
      ],
    );
  }
}

class _ResumeCard extends StatelessWidget {
  const _ResumeCard({required this.bookId, required this.progress});

  final String bookId;
  final ReadingProgress progress;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      highlighted: true,
      onTap: () => context.push(AppRoutes.bookReader(bookId, resume: true)),
      child: Row(
        children: [
          SizedBox(
            width: 42,
            height: 42,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CircularProgressIndicator(
                  value: progress.progressPercent / 100,
                  strokeWidth: 4,
                  backgroundColor: context.palette.elevated,
                ),
                Text(
                  '${progress.progressPercent}',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Continue reading',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                Text(
                  'Last opened ${Fmt.relative(progress.lastReadAt)}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: context.palette.textMuted,
                      ),
                ),
              ],
            ),
          ),
          const Icon(Icons.play_circle_fill_rounded,
              color: AppColors.cyan, size: 30),
        ],
      ),
    );
  }
}

class _ChapterRow extends StatelessWidget {
  const _ChapterRow({required this.index, required this.chapter});

  final int index;
  final Chapter chapter;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: AppColors.cyan.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            alignment: Alignment.center,
            child: Text(
              '$index',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: AppColors.cyan,
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              chapter.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    height: 1.3,
                  ),
            ),
          ),
          if ((chapter.topicsCount ?? chapter.topics.length) > 0)
            Text(
              '${chapter.topicsCount ?? chapter.topics.length}',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: palette.textMuted,
                  ),
            ),
        ],
      ),
    );
  }
}

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        SkeletonBox(height: 220, radius: AppTheme.radiusLg),
        SizedBox(height: 20),
        SkeletonBox(width: 90, height: 20, radius: 6),
        SizedBox(height: 14),
        SkeletonBox(height: 26),
        SizedBox(height: 10),
        SkeletonBox(width: 180, height: 16),
        SizedBox(height: 24),
        SkeletonBox(height: 74, radius: AppTheme.radiusLg),
        SizedBox(height: 20),
        SkeletonBox(height: 50, radius: AppTheme.radiusMd),
      ],
    );
  }
}
