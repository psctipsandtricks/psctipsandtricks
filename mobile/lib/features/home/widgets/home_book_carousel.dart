import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/state_views.dart';
import '../../../data/models/book.dart';
import '../home_providers.dart';

/// Compact 3D Coverflow Book Showcase Carousel mirroring the website's hero showcase.
///
/// Designed to be space-efficient, interactive, and visually stunning.
class HomeBookCarousel extends ConsumerStatefulWidget {
  const HomeBookCarousel({super.key});

  @override
  ConsumerState<HomeBookCarousel> createState() => _HomeBookCarouselState();
}

class _HomeBookCarouselState extends ConsumerState<HomeBookCarousel>
    with TickerProviderStateMixin {
  static const int _loopFactor = 400;
  static const Duration _autoRotateInterval = Duration(milliseconds: 4500);
  static const Duration _slideDuration = Duration(milliseconds: 650);

  PageController? _pageController;
  late final AnimationController _ambientGlowController;

  Timer? _autoRotateTimer;
  Timer? _resumeTimer;
  bool _isUserInteracting = false;
  int _activeActualIndex = 0;
  int _initialPage = 0;

  @override
  void initState() {
    super.initState();
    _ambientGlowController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _autoRotateTimer?.cancel();
    _resumeTimer?.cancel();
    _ambientGlowController.dispose();
    _pageController?.dispose();
    super.dispose();
  }

  void _startAutoRotation(int count) {
    _autoRotateTimer?.cancel();
    if (count <= 1) return;

    _autoRotateTimer = Timer.periodic(_autoRotateInterval, (_) {
      if (!mounted ||
          _pageController == null ||
          !_pageController!.hasClients ||
          _isUserInteracting) {
        return;
      }
      final currentPage = _pageController!.page?.round() ?? _initialPage;
      _pageController!.animateToPage(
        currentPage + 1,
        duration: _slideDuration,
        curve: Curves.easeInOutCubic,
      );
    });
  }

  void _stopAutoRotation() {
    _autoRotateTimer?.cancel();
    _autoRotateTimer = null;
  }

  void _onPointerDown() {
    _isUserInteracting = true;
    _stopAutoRotation();
    _resumeTimer?.cancel();
  }

  void _onPointerUp(int count) {
    _resumeTimer?.cancel();
    _resumeTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) {
        _isUserInteracting = false;
        _startAutoRotation(count);
      }
    });
  }

  void _navigateToBook(Book book) {
    context.push(AppRoutes.bookDetail(book.id));
  }

  @override
  Widget build(BuildContext context) {
    final booksAsync = ref.watch(featuredBooksProvider);

    return booksAsync.when(
      loading: () => _buildLoadingSkeleton(context),
      error: (err, _) => const SizedBox.shrink(),
      data: (allBooks) {
        // Filter books with covers
        final books = allBooks
            .where((b) =>
                (b.heroCoverUrl != null && b.heroCoverUrl!.isNotEmpty) ||
                b.coverUrl.isNotEmpty)
            .toList();

        if (books.isEmpty) {
          if (allBooks.isEmpty) return const SizedBox.shrink();
          return _buildShowcase(context, allBooks);
        }

        return _buildShowcase(context, books);
      },
    );
  }

  Widget _buildLoadingSkeleton(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Container(
        height: 280,
        decoration: BoxDecoration(
          color: context.palette.card,
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          border: Border.all(color: context.palette.border),
        ),
        child: const Center(
          child: SkeletonBox(
            width: 172,
            height: 238,
            radius: AppTheme.radiusLg,
          ),
        ),
      ),
    );
  }

  Widget _buildShowcase(BuildContext context, List<Book> books) {
    if (_pageController == null) {
      _initialPage = (books.length * _loopFactor) ~/ 2;
      _pageController = PageController(
        viewportFraction: 0.54,
        initialPage: _initialPage,
      );
      _activeActualIndex = _initialPage % books.length;
      _startAutoRotation(books.length);
    }

    final controller = _pageController!;
    final activeBook = books[_activeActualIndex.clamp(0, books.length - 1)];

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // ── 3D Coverflow Carousel Viewport (Compact Height) ────────────────
        SizedBox(
          height: 252,
          child: Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              // Dynamic Ambient Glow
              AnimatedBuilder(
                animation: _ambientGlowController,
                builder: (context, _) {
                  final glow = _ambientGlowController.value;
                  return Positioned(
                    top: 10,
                    child: Container(
                      width: 220 + (glow * 24),
                      height: 210 + (glow * 20),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            AppColors.cyan.withValues(alpha: 0.18 + (glow * 0.10)),
                            AppColors.indigo.withValues(alpha: 0.08 + (glow * 0.06)),
                            Colors.transparent,
                          ],
                          stops: const [0.0, 0.55, 1.0],
                        ),
                      ),
                    ),
                  );
                },
              ),

              // 3D PageView
              Listener(
                onPointerDown: (_) => _onPointerDown(),
                onPointerUp: (_) => _onPointerUp(books.length),
                onPointerCancel: (_) => _onPointerUp(books.length),
                child: PageView.builder(
                  controller: controller,
                  physics: const BouncingScrollPhysics(),
                  clipBehavior: Clip.none,
                  onPageChanged: (page) {
                    setState(() {
                      _activeActualIndex = page % books.length;
                    });
                  },
                  itemBuilder: (context, index) {
                    final book = books[index % books.length];

                    return AnimatedBuilder(
                      animation: controller,
                      builder: (context, child) {
                        double pageOffset = 0.0;
                        if (controller.hasClients &&
                            controller.position.hasContentDimensions) {
                          pageOffset =
                              (controller.page ?? _initialPage.toDouble()) -
                                  index;
                        } else {
                          pageOffset = (_initialPage - index).toDouble();
                        }

                        final absOffset = pageOffset.abs();
                        final isCenter = absOffset < 0.45;

                        // 3D perspective transforms
                        final scale = (1.0 - (absOffset * 0.15)).clamp(0.82, 1.0);
                        final rotationY = (pageOffset * 0.25).clamp(-0.40, 0.40);
                        final opacity = (1.0 - (absOffset * 0.38)).clamp(0.48, 1.0);
                        final translationX = pageOffset * -8.0;

                        final matrix = Matrix4.identity()
                          ..setEntry(3, 2, 0.0016) // Perspective
                          ..setTranslationRaw(translationX, 0.0, 0.0)
                          ..rotateY(rotationY)
                          ..scaleByDouble(scale, scale, 1.0, 1.0);

                        return Center(
                          child: Transform(
                            transform: matrix,
                            alignment: Alignment.center,
                            child: Opacity(
                              opacity: opacity,
                              child: GestureDetector(
                                onTap: () {
                                  if (isCenter) {
                                    _navigateToBook(book);
                                  } else {
                                    controller.animateToPage(
                                      index,
                                      duration: const Duration(milliseconds: 400),
                                      curve: Curves.easeInOutCubic,
                                    );
                                  }
                                },
                                child: _Book3DCover(
                                  book: book,
                                  isCenter: isCenter,
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 6),

        // ── Compact Active Book Info: Category, Title & Action Bar ─────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Category in amber/gold bold uppercase
              Text(
                activeBook.category.isNotEmpty
                    ? activeBook.category.toUpperCase()
                    : 'KERALA PSC',
                style: const TextStyle(
                  color: AppColors.amber,
                  fontWeight: FontWeight.w800,
                  fontSize: 10.5,
                  letterSpacing: 1.1,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 3),

              // Title (compact, max 1 line with ellipsis or 2 tight lines)
              GestureDetector(
                onTap: () => _navigateToBook(activeBook),
                child: Text(
                  activeBook.title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                        fontSize: 14.5,
                        height: 1.22,
                        letterSpacing: -0.2,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 8),

              // Unified Action & Pagination Row
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Pagination Indicator Dots
                  if (books.length > 1)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: List.generate(
                        books.length.clamp(0, 8),
                        (dotIndex) {
                          final isSelected =
                              dotIndex == (_activeActualIndex % books.length);
                          return GestureDetector(
                            onTap: () {
                              final currentPage =
                                  controller.page?.round() ?? _initialPage;
                              final currentOffset = currentPage % books.length;
                              final diff = dotIndex - currentOffset;
                              controller.animateToPage(
                                currentPage + diff,
                                duration: const Duration(milliseconds: 400),
                                curve: Curves.easeInOutCubic,
                              );
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 300),
                              curve: Curves.easeOutCubic,
                              margin: const EdgeInsets.symmetric(horizontal: 2.5),
                              width: isSelected ? 18 : 5,
                              height: 5,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(2.5),
                                gradient:
                                    isSelected ? AppColors.goldGradient : null,
                                color: isSelected
                                    ? null
                                    : context.palette.border
                                        .withValues(alpha: 0.9),
                              ),
                            ),
                          );
                        },
                      ),
                    ),

                  const SizedBox(width: 14),

                  // Compact Explore Pill Button
                  InkWell(
                    onTap: () => _navigateToBook(activeBook),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.cyan.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: AppColors.cyan.withValues(alpha: 0.35),
                          width: 1,
                        ),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Explore Book',
                            style: TextStyle(
                              color: AppColors.cyan,
                              fontWeight: FontWeight.w800,
                              fontSize: 11.5,
                              letterSpacing: 0.2,
                            ),
                          ),
                          SizedBox(width: 3),
                          Icon(
                            Icons.arrow_forward_rounded,
                            color: AppColors.cyan,
                            size: 13,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 10),

              // Super-compact trust highlights strip
              const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _TrustChip(
                    icon: Icons.headphones_rounded,
                    label: 'Audio Notes',
                    color: AppColors.cyan,
                  ),
                  _DotDivider(),
                  _TrustChip(
                    icon: Icons.layers_rounded,
                    label: 'Chapter Notes',
                    color: AppColors.amber,
                  ),
                  _DotDivider(),
                  _TrustChip(
                    icon: Icons.phone_android_rounded,
                    label: 'Offline Ready',
                    color: AppColors.emerald,
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TrustChip extends StatelessWidget {
  const _TrustChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 3.5),
        Text(
          label,
          style: TextStyle(
            color: context.palette.textSecondary,
            fontWeight: FontWeight.w600,
            fontSize: 10,
          ),
        ),
      ],
    );
  }
}

class _DotDivider extends StatelessWidget {
  const _DotDivider();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 7),
      child: Text(
        '·',
        style: TextStyle(
          color: context.palette.textMuted,
          fontSize: 12,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

/// 3D Hardcover Book widget with realistic spine lighting, depth, bevels & shadow.
class _Book3DCover extends StatelessWidget {
  const _Book3DCover({
    required this.book,
    required this.isCenter,
  });

  final Book book;
  final bool isCenter;

  @override
  Widget build(BuildContext context) {
    // Compact book dimensions: 1:1.38 ratio
    const width = 172.0;
    const height = 238.0;

    final coverUrl = book.heroCoverUrl ?? book.coverUrl;

    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          // Ambient soft drop shadow
          BoxShadow(
            color: Colors.black.withValues(alpha: isCenter ? 0.42 : 0.22),
            blurRadius: isCenter ? 22 : 12,
            offset: Offset(0, isCenter ? 12 : 6),
          ),
          if (isCenter)
            BoxShadow(
              color: AppColors.cyan.withValues(alpha: 0.16),
              blurRadius: 24,
              spreadRadius: 1,
            ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Cover Image
            AppImage(
              url: coverUrl,
              fit: BoxFit.cover,
              radius: 14,
              fallbackIcon: Icons.menu_book_rounded,
            ),

            // 3D Hardcover Spine Highlight (left side sheen gradient)
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: 16,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      Colors.black.withValues(alpha: 0.55),
                      Colors.white.withValues(alpha: 0.20),
                      Colors.transparent,
                    ],
                    stops: const [0.0, 0.22, 1.0],
                  ),
                ),
              ),
            ),

            // Right side subtle bevel shadow
            Positioned(
              right: 0,
              top: 0,
              bottom: 0,
              width: 9,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerRight,
                    end: Alignment.centerLeft,
                    colors: [
                      Colors.black.withValues(alpha: 0.35),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),

            // Bottom subtle vignette
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: 42,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.55),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),

            // Top Badge if Free or Discounted
            if (!book.isPremium)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: AppColors.emerald,
                    borderRadius: BorderRadius.circular(5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 4,
                      ),
                    ],
                  ),
                  child: const Text(
                    'FREE',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 8.5,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
              )
            else if (book.discountPercent > 0)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: AppColors.rose,
                    borderRadius: BorderRadius.circular(5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 4,
                      ),
                    ],
                  ),
                  child: Text(
                    '${book.discountPercent}% OFF',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 8.5,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ),

            // Subtle border sheen
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isCenter
                      ? Colors.white.withValues(alpha: 0.25)
                      : Colors.white.withValues(alpha: 0.12),
                  width: 1.1,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
