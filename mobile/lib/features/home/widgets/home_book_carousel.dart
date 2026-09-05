import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_image.dart';
import '../../../core/widgets/state_views.dart';
import '../../../data/models/book.dart';
import '../home_providers.dart';

/// The home screen's hero: one book at a time, its cover running edge to edge
/// under the bar, with the title, the detail line and the one action that
/// matters set beneath it on the page.
///
/// The copy sits below the artwork rather than on top of it — the covers in
/// this catalog are busy, bright and already carry their own headline text, so
/// anything laid over them fights for the same pixels. Keeping the two apart
/// means the title is legible on any cover in either theme, and it matches the
/// streaming-app pattern the design references. The cover parallaxes against
/// the swipe, so paging feels like moving a stack of physical books rather
/// than a filmstrip.
class HomeBookCarousel extends ConsumerStatefulWidget {
  const HomeBookCarousel({super.key, this.topOverlay = 0});

  /// How much of the artwork's top edge the floating bar covers.
  ///
  /// Added to the art's height rather than subtracted from it: the point of
  /// running the cover up under the bar is to fill the space above it, not to
  /// lose that much of the picture, so the part still in the clear stays the
  /// size it was designed to be.
  final double topOverlay;

  /// Height of the artwork alone, in the clear below the bar; the copy beneath
  /// sizes itself.
  ///
  /// A fixed number rather than a share of the viewport, so a cover is the same
  /// size on every phone and the hero cannot quietly grow or shrink with the
  /// device. `topOverlay` is added on top of this for the part that runs behind
  /// the bar — raising this raises what the student actually sees.
  ///
  /// Fixed height across all images so every banner maintains the exact same
  /// uniform frame, regardless of aspect ratio, dimensions, or content.
  static const double artHeight = 390;

  @override
  ConsumerState<HomeBookCarousel> createState() => _HomeBookCarouselState();
}

class _HomeBookCarouselState extends ConsumerState<HomeBookCarousel> {
  /// The page space is a long loop of the same list, so paging never hits an
  /// end and the student can keep swiping in either direction.
  static const int _loopFactor = 400;
  static const Duration _autoRotateInterval = Duration(milliseconds: 5200);
  static const Duration _slideDuration = Duration(milliseconds: 700);

  PageController? _pageController;
  Timer? _autoRotateTimer;
  Timer? _resumeTimer;
  bool _isUserInteracting = false;
  int _activeIndex = 0;
  int _initialPage = 0;

  /// Live page position, used for the parallax and the cross-fading copy.
  double _page = 0;

  @override
  void dispose() {
    _autoRotateTimer?.cancel();
    _resumeTimer?.cancel();
    _pageController?.removeListener(_onScroll);
    _pageController?.dispose();
    super.dispose();
  }

  void _onScroll() {
    final controller = _pageController;
    if (controller == null || !controller.hasClients) return;
    if (!controller.position.hasContentDimensions) return;
    final page = controller.page;
    if (page == null || page == _page) return;
    setState(() => _page = page);
  }

  void _startAutoRotation(int count) {
    _autoRotateTimer?.cancel();
    if (count <= 1) return;

    _autoRotateTimer = Timer.periodic(_autoRotateInterval, (_) {
      final controller = _pageController;
      if (!mounted ||
          controller == null ||
          !controller.hasClients ||
          _isUserInteracting) {
        return;
      }
      controller.animateToPage(
        (controller.page?.round() ?? _initialPage) + 1,
        duration: _slideDuration,
        curve: Curves.easeInOutCubic,
      );
    });
  }

  void _onPointerDown() {
    _isUserInteracting = true;
    _autoRotateTimer?.cancel();
    _autoRotateTimer = null;
    _resumeTimer?.cancel();
  }

  void _onPointerUp(int count) {
    _resumeTimer?.cancel();
    // A long pause before the rotation picks up again: nothing is more
    // annoying than the page moving under a finger that just stopped.
    _resumeTimer = Timer(const Duration(seconds: 6), () {
      if (!mounted) return;
      _isUserInteracting = false;
      _startAutoRotation(count);
    });
  }

  void _openBook(Book book) => context.push(AppRoutes.bookDetail(book.id));

  @override
  Widget build(BuildContext context) {
    final booksAsync = ref.watch(featuredBooksProvider);

    return booksAsync.when(
      loading: () => _HeroSkeleton(
        artHeight: HomeBookCarousel.artHeight + widget.topOverlay,
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (allBooks) {
        if (allBooks.isEmpty) return const SizedBox.shrink();

        // Prefer the books that actually have artwork — a hero this large is
        // unforgiving of a placeholder icon.
        final withArt = allBooks
            .where((b) =>
                (b.heroCoverUrl != null && b.heroCoverUrl!.isNotEmpty) ||
                b.coverUrl.isNotEmpty)
            .toList();

        return _buildHero(context, withArt.isEmpty ? allBooks : withArt);
      },
    );
  }

  Widget _buildHero(BuildContext context, List<Book> books) {
    if (_pageController == null) {
      _initialPage = (books.length * _loopFactor) ~/ 2;
      _page = _initialPage.toDouble();
      _activeIndex = _initialPage % books.length;
      _pageController = PageController(initialPage: _initialPage)
        ..addListener(_onScroll);
      _startAutoRotation(books.length);
    }

    final controller = _pageController!;
    final activeBook = books[_activeIndex.clamp(0, books.length - 1)];
    final palette = context.palette;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: HomeBookCarousel.artHeight + widget.topOverlay,
          child: Stack(
            fit: StackFit.expand,
            children: [
              Listener(
                onPointerDown: (_) => _onPointerDown(),
                onPointerUp: (_) => _onPointerUp(books.length),
                onPointerCancel: (_) => _onPointerUp(books.length),
                child: PageView.builder(
                  controller: controller,
                  physics: const BouncingScrollPhysics(),
                  onPageChanged: (page) =>
                      setState(() => _activeIndex = page % books.length),
                  itemBuilder: (context, index) {
                    final book = books[index % books.length];
                    return _HeroSlide(
                      book: book,
                      offset: _page - index,
                      onTap: () => _openBook(book),
                    );
                  },
                ),
              ),

              // The artwork melts into the page softly.
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: 40,
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          palette.background.withValues(alpha: 0.0),
                          palette.background.withValues(alpha: 0.6),
                          palette.background,
                        ],
                        stops: const [0.0, 0.65, 1.0],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        _HeroCopy(
          book: activeBook,
          total: books.length,
          activeIndex: _activeIndex % books.length,
          onExplore: () => _openBook(activeBook),
          onDotTap: (dot) {
            final currentPage = controller.page?.round() ?? _initialPage;
            final delta = dot - (currentPage % books.length);
            controller.animateToPage(
              currentPage + delta,
              duration: const Duration(milliseconds: 420),
              curve: Curves.easeInOutCubic,
            );
          },
        ),
      ],
    );
  }
}

/// One full-bleed cover, parallaxing and dimming as it leaves the centre.
class _HeroSlide extends StatelessWidget {
  const _HeroSlide({
    required this.book,
    required this.offset,
    required this.onTap,
  });

  final Book book;

  /// Distance from the centre of the viewport, in pages.
  final double offset;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final clamped = offset.clamp(-1.5, 1.5);
    final width = MediaQuery.sizeOf(context).width;
    // The cover drifts against the swipe. The overscan has to outrun the
    // drift — a 10% shift needs more than 10% of extra width behind it, or
    // the far edge of the frame shows through part-way into the swipe.
    final shift = clamped * width * 0.10;
    final scale = 1.0 + (clamped.abs() * 0.24).clamp(0.0, 0.36);
    final dim = (clamped.abs() * 0.45).clamp(0.0, 0.55);
    final cover = book.effectiveHeroCoverUrl;

    return GestureDetector(
      onTap: onTap,
      child: ClipRect(
        child: Stack(
          fit: StackFit.expand,
          children: [
            Transform.translate(
              offset: Offset(shift, 0),
              child: Transform.scale(
                scale: scale,
                child: AppImage(
                  url: cover,
                  fit: BoxFit.cover,
                  // Centred, not top-aligned. The bar now sits over the top of
                  // this frame, so keeping the top of the cover would park the
                  // part worth seeing behind the glass; anchoring the middle
                  // puts it in the clear.
                  alignment: Alignment.center,
                  fallbackIcon: Icons.menu_book_rounded,
                ),
              ),
            ),
            if (dim > 0)
              Positioned.fill(
                child: ColoredBox(
                  color: context.palette.background.withValues(alpha: dim),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Title, detail line, the primary action and the pagination dots — the compact
/// block that sits on the page beneath the artwork.
class _HeroCopy extends StatelessWidget {
  const _HeroCopy({
    required this.book,
    required this.total,
    required this.activeIndex,
    required this.onExplore,
    required this.onDotTap,
  });

  final Book book;
  final int total;
  final int activeIndex;
  final VoidCallback onExplore;
  final ValueChanged<int> onDotTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final meta = <String>[
      if (book.category.isNotEmpty) book.category,
      if (book.chaptersCount != null && book.chaptersCount! > 0)
        Fmt.count(book.chaptersCount!, 'chapter'),
      if (book.isFree) 'Free' else Fmt.price(book.finalPrice),
    ];

    final hasFlags = book.isFree || book.hasDiscount || book.isNew;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 2),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row 1: Compact Badges + Category/Chapter/Price metadata inline
          Row(
            children: [
              if (hasFlags) ...[
                _HeroFlags(book: book),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: Text(
                  meta.join('  •  '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                        letterSpacing: 0.1,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),

          // Row 2: Book Title strictly on a single line with ellipsis
          GestureDetector(
            onTap: onExplore,
            child: Text(
              book.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.35,
                    height: 1.2,
                    fontSize: 18,
                  ),
            ),
          ),
          const SizedBox(height: 10),

          // Row 3: Compact primary action button + pagination indicator dots
          Row(
            children: [
              _CompactActionButton(
                label: book.isUnlocked ? 'Read now' : 'Explore book',
                icon: book.isUnlocked
                    ? Icons.menu_book_rounded
                    : Icons.auto_stories_rounded,
                onPressed: onExplore,
              ),
              const Spacer(),
              if (total > 1)
                _HeroDots(
                  total: total,
                  activeIndex: activeIndex,
                  onDotTap: onDotTap,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Sleek, compact action button for the hero banner.
class _CompactActionButton extends StatelessWidget {
  const _CompactActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 36,
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: AppColors.cyan.withValues(alpha: 0.28),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 16, color: Colors.white),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HeroDots extends StatelessWidget {
  const _HeroDots({
    required this.total,
    required this.activeIndex,
    required this.onDotTap,
  });

  final int total;
  final int activeIndex;
  final ValueChanged<int> onDotTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(total.clamp(0, 8), (dot) {
        final selected = dot == activeIndex;
        return GestureDetector(
          onTap: () => onDotTap(dot),
          behavior: HitTestBehavior.opaque,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2.5, vertical: 6),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeOutCubic,
              width: selected ? 16 : 5,
              height: 5,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2.5),
                gradient: selected ? AppColors.brandGradient : null,
                color:
                    selected ? null : palette.textMuted.withValues(alpha: 0.35),
              ),
            ),
          ),
        );
      }),
    );
  }
}

/// Free / discount / new compact badges.
class _HeroFlags extends StatelessWidget {
  const _HeroFlags({required this.book});

  final Book book;

  @override
  Widget build(BuildContext context) {
    final flags = <Widget>[
      if (book.isFree)
        const _HeroFlag(label: 'FREE', color: AppColors.emerald)
      else if (book.hasDiscount)
        _HeroFlag(
          label: '${book.discountPercent}% OFF',
          color: AppColors.rose,
        ),
      if (book.isNew) const _HeroFlag(label: 'NEW', color: AppColors.amber),
    ];
    if (flags.isEmpty) return const SizedBox.shrink();

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < flags.length; i++) ...[
          if (i > 0) const SizedBox(width: 5),
          flags[i],
        ],
      ],
    );
  }
}

class _HeroFlag extends StatelessWidget {
  const _HeroFlag({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: 9.5,
              letterSpacing: 0.4,
            ),
      ),
    );
  }
}

class _HeroSkeleton extends StatelessWidget {
  const _HeroSkeleton({required this.artHeight});

  final double artHeight;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SkeletonBox(width: double.infinity, height: artHeight, radius: 0),
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SkeletonBox(width: 240, height: 20, radius: AppTheme.radiusSm),
              SizedBox(height: 9),
              SkeletonBox(width: 150, height: 12, radius: AppTheme.radiusSm),
              SizedBox(height: 16),
              SkeletonBox(width: 148, height: 38, radius: AppTheme.radiusMd),
            ],
          ),
        ),
      ],
    );
  }
}
