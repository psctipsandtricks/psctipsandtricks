import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';
import '../../core/providers/auth_controller.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../announcements/announcement_providers.dart';
import '../books/widgets/book_card.dart';
import '../dashboard/dashboard_providers.dart';
import '../notifications/notifications_screen.dart';
import '../quizzes/widgets/premium_quiz_carousel.dart';
import '../../data/models/book.dart';
import 'home_providers.dart';
import 'widgets/continue_reading_rail.dart';
import 'widgets/home_book_carousel.dart';
import 'widgets/live_mock_banner.dart';

class HomeScreen extends ConsumerStatefulWidget {

  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _entranceController;

  @override
  void initState() {
    super.initState();
    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 950),
    )..forward();
  }

  @override
  void dispose() {
    _entranceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final booksAsync = ref.watch(featuredBooksProvider);
    final quizzesAsync = ref.watch(premiumQuizzesProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(featuredBooksProvider);
          ref.invalidate(premiumQuizzesProvider);
          ref.invalidate(activeAnnouncementsProvider);
          ref.invalidate(liveMockTestProvider);
          if (ref.read(authControllerProvider).isAuthenticated) {
            ref.invalidate(dashboardProvider);
          }
          await ref.read(featuredBooksProvider.future);
        },
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          slivers: [
            SliverAppBar(
              pinned: true,
              titleSpacing: 16,
              toolbarHeight: 60,
              backgroundColor: context.palette.background,
              title: _BrandRow(name: user?.name),
              actions: const [
                _SearchButton(),
                _NotificationsButton(),
                _AvatarButton(),
                SizedBox(width: 8),
              ],
            ),
            SliverToBoxAdapter(
              child: _FadeSlide(
                animation: _entranceController,
                delay: 0.05,
                child: const _ShortcutStrip(),
              ),
            ),
            const SliverToBoxAdapter(child: LiveMockBanner()),
            const SliverToBoxAdapter(child: SizedBox(height: 8)),
            // ── 3D Scrolled Book Showcase Carousel (mirrors website) ────────
            SliverToBoxAdapter(
              child: _FadeSlide(
                animation: _entranceController,
                delay: 0.12,
                child: const HomeBookCarousel(),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 18)),
            // The rail carries its own leading gap, because a signed-in
            // student with nothing started renders nothing here and a spacer
            // out here would leave a double gap above the catalog.
            if (user != null)
              SliverToBoxAdapter(
                child: _FadeSlide(
                  animation: _entranceController,
                  delay: 0.18,
                  child: const ContinueReadingRail(),
                ),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: 26)),
            SliverToBoxAdapter(
              child: _FadeSlide(
                animation: _entranceController,
                delay: 0.28,
                child: SectionHeader(
                  title: 'E-Book catalog',
                  subtitle: 'Audio narrations, notes and video classes',
                  icon: Icons.auto_stories_rounded,
                  actionLabel: 'See all',
                  onAction: () => context.go(AppRoutes.books),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: _FadeSlide(
                animation: _entranceController,
                delay: 0.32,
                child: _BooksRail(booksAsync: booksAsync),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 26)),
            SliverToBoxAdapter(
              child: _FadeSlide(
                animation: _entranceController,
                delay: 0.38,
                child: SectionHeader(
                  title: 'Premium question banks',
                  subtitle: 'Top 10 newest question banks & test series',
                  icon: Icons.workspace_premium_rounded,
                  actionLabel: 'Quiz Hub',
                  onAction: () => context.go(AppRoutes.quizzes),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: _FadeSlide(
                animation: _entranceController,
                delay: 0.42,
                child: PremiumQuizCarousel(quizzesAsync: quizzesAsync),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 26)),
            SliverToBoxAdapter(
              child: _FadeSlide(
                animation: _entranceController,
                delay: 0.48,
                child: const _SupportBanner(),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }
}

/// Reusable staggered fade + slide entrance transition.
class _FadeSlide extends StatelessWidget {
  const _FadeSlide({
    required this.child,
    required this.animation,
    required this.delay,
  });

  static const _duration = 0.45;

  final Widget child;
  final Animation<double> animation;
  final double delay;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return child;

    final end = (delay + _duration).clamp(0.0, 1.0);
    final curved = CurvedAnimation(
      parent: animation,
      curve: Interval(delay, end, curve: Curves.easeOutCubic),
    );

    return AnimatedBuilder(
      animation: curved,
      builder: (context, c) {
        return Opacity(
          opacity: curved.value,
          child: Transform.translate(
            offset: Offset(0, (1 - curved.value) * 18),
            child: c,
          ),
        );
      },
      child: child,
    );
  }
}

/// Brand mark and greeting, in the slot the website gives its logo.
class _BrandRow extends StatelessWidget {
  const _BrandRow({this.name});

  final String? name;

  String get _partOfDay {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            gradient: AppColors.brandGradient,
            borderRadius: BorderRadius.circular(11),
            boxShadow: [
              BoxShadow(
                color: AppColors.cyan.withValues(alpha: 0.32),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.school_rounded, color: Colors.white, size: 20),
        ),
        const SizedBox(width: 11),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                name == null ? 'Welcome to' : _partOfDay,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: context.palette.textMuted,
                      letterSpacing: 0.3,
                      fontSize: 10.5,
                    ),
              ),
              Text(
                name?.split(' ').first ?? 'PSC Tips And Tricks',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.3,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Compact circular action button, sized to sit comfortably in a row of three.
class _HeaderAction extends StatelessWidget {
  const _HeaderAction({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.badgeCount = 0,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  /// Drawn as a count on the icon when above zero.
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.all(9),
          child: Badge.count(
            count: badgeCount,
            isLabelVisible: badgeCount > 0,
            // Rose rather than the app's cyan: a count of things waiting is the
            // one place on this bar that should pull the eye.
            backgroundColor: AppColors.rose,
            textColor: Colors.white,
            child: Icon(icon, size: 22, color: context.palette.textSecondary),
          ),
        ),
      ),
    );
  }
}

class _SearchButton extends StatelessWidget {
  const _SearchButton();

  @override
  Widget build(BuildContext context) {
    return _HeaderAction(
      icon: Icons.search_rounded,
      // The catalog is where the search field lives; this is a jump to it, not
      // a separate global search the API does not offer.
      tooltip: 'Search the catalog',
      onTap: () => context.go(AppRoutes.books),
    );
  }
}

class _NotificationsButton extends ConsumerWidget {
  const _NotificationsButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(authControllerProvider).isAuthenticated;
    // Only read the inbox for someone who has one: the endpoint needs a
    // session, so watching it as a guest is a guaranteed 401 on every launch.
    final unread = signedIn ? ref.watch(unreadNotificationCountProvider) : 0;

    return _HeaderAction(
      icon: unread > 0
          ? Icons.notifications_active_rounded
          : Icons.notifications_none_rounded,
      tooltip: unread > 0
          ? Fmt.count(unread, 'unread notification')
          : 'Notifications',
      badgeCount: unread,
      onTap: () => context.push(
        signedIn
            ? AppRoutes.notifications
            : '${AppRoutes.login}?redirect=${Uri.encodeComponent(AppRoutes.notifications)}',
      ),
    );
  }
}

class _AvatarButton extends ConsumerWidget {
  const _AvatarButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: InkWell(
        onTap: () => context.go(user == null ? AppRoutes.login : AppRoutes.account),
        customBorder: const CircleBorder(),
        child: user == null
            ? Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: context.palette.elevated,
                  shape: BoxShape.circle,
                  border: Border.all(color: context.palette.border),
                ),
                child: Icon(Icons.person_rounded,
                    size: 19, color: context.palette.textMuted),
              )
            : AppAvatar(
                imageUrl: user.avatarUrl,
                name: user.name,
                size: 34,
              ),
      ),
    );
  }
}

/// Tiles for the student surfaces that do not own a bottom-nav tab.
/// Shortcuts to the student surfaces that do not own a bottom-nav tab.
///
/// Laid out as a scrolling icon-over-label strip so the row can grow past the
/// four items a fixed grid allows without shrinking each target.
class _ShortcutStrip extends StatefulWidget {
  const _ShortcutStrip();

  static const _items = <_Shortcut>[
    _Shortcut(Icons.insights_rounded, 'Progress', AppColors.cyan, AppRoutes.dashboard),
    _Shortcut(Icons.emoji_events_rounded, 'Mock tests', AppColors.amber, AppRoutes.mockTests),
    _Shortcut(Icons.forum_rounded, 'Community', AppColors.indigo, AppRoutes.community),
    _Shortcut(Icons.history_rounded, 'Attempts', AppColors.emerald, AppRoutes.quizHistory),
    _Shortcut(Icons.smart_display_rounded, 'Videos', AppColors.red, AppRoutes.libraryVideos),
    _Shortcut(Icons.picture_as_pdf_rounded, 'PDFs', AppColors.rose, AppRoutes.libraryPdfs),
    _Shortcut(Icons.receipt_long_rounded, 'Orders', AppColors.sky, AppRoutes.orders),
  ];

  @override
  State<_ShortcutStrip> createState() => _ShortcutStripState();
}

class _ShortcutStripState extends State<_ShortcutStrip>
    with SingleTickerProviderStateMixin {
  /// Drives the one-off entrance: each tile fades up a beat after the one to
  /// its left. Deliberately a single pass — a strip that keeps moving is the
  /// kind of decoration a student stops seeing and starts resenting.
  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 720),
  );

  @override
  void initState() {
    super.initState();
    // After the first frame, so the stagger starts with the strip on screen
    // rather than already part-way through it.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _entrance.forward();
    });
  }

  @override
  void dispose() {
    _entrance.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 76,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _ShortcutStrip._items.length,
            separatorBuilder: (_, __) => const SizedBox(width: 4),
            itemBuilder: (context, index) => _ShortcutButton(
              item: _ShortcutStrip._items[index],
              entrance: _entrance,
              index: index,
            ),
          ),
        ),
        Divider(height: 1, thickness: 1, color: palette.border),
      ],
    );
  }
}

class _Shortcut {
  const _Shortcut(this.icon, this.label, this.color, this.route);

  final IconData icon;
  final String label;
  final Color color;
  final String route;
}

class _ShortcutButton extends ConsumerStatefulWidget {
  const _ShortcutButton({
    required this.item,
    required this.entrance,
    required this.index,
  });

  final _Shortcut item;

  /// The strip's shared entrance timeline; this tile animates over its own
  /// slice of it.
  final Animation<double> entrance;
  final int index;

  @override
  ConsumerState<_ShortcutButton> createState() => _ShortcutButtonState();
}

class _ShortcutButtonState extends ConsumerState<_ShortcutButton> {
  /// How far into the strip's timeline this tile starts, and how long it takes.
  static const _stagger = 0.08;
  static const _span = 0.42;

  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  void _open() {
    final route = widget.item.route;
    if (route.startsWith(AppRoutes.library)) {
      context.go(route);
      return;
    }

    // Protected screens require a session; bounce through login if signed out
    final signedIn = ref.read(authControllerProvider).isAuthenticated;
    context.push(
      signedIn
          ? route
          : '${AppRoutes.login}?redirect=${Uri.encodeComponent(route)}',
    );
  }

  @override
  Widget build(BuildContext context) {
    // Anyone who has asked the system to stop animations gets the tiles as
    // they always were: in place, and still under the finger.
    final still = MediaQuery.disableAnimationsOf(context);
    final begin = (widget.index * _stagger).clamp(0.0, 1.0 - _span);

    return InkWell(
      onTap: _open,
      onTapDown: (_) => _setPressed(true),
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: AnimatedBuilder(
        animation: widget.entrance,
        builder: (context, child) {
          if (still) return child!;
          final progress =
              ((widget.entrance.value - begin) / _span).clamp(0.0, 1.0);
          final eased = Curves.easeOutCubic.transform(progress);
          return Opacity(
            opacity: eased,
            // Rises into place rather than sliding sideways: a horizontal
            // entrance on a horizontally scrolling strip reads as a scroll.
            child: Transform.translate(
              offset: Offset(0, (1 - eased) * 14),
              child: child,
            ),
          );
        },
        child: SizedBox(
          width: 72,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Only the icon tile answers the touch — scaling the label too
              // makes the whole strip feel rubbery.
              AnimatedScale(
                scale: _pressed && !still ? 0.90 : 1.0,
                duration: const Duration(milliseconds: 130),
                curve: Curves.easeOut,
                child: Container(
                  padding: const EdgeInsets.all(9),
                  decoration: BoxDecoration(
                    color: widget.item.color.withValues(alpha: 0.13),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(widget.item.icon,
                      color: widget.item.color, size: 20),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                widget.item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      fontSize: 10.5,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BooksRail extends StatefulWidget {
  const _BooksRail({required this.booksAsync});

  final AsyncValue<List<Book>> booksAsync;

  @override
  State<_BooksRail> createState() => _BooksRailState();
}

class _BooksRailState extends State<_BooksRail> {
  final ScrollController _scrollController = ScrollController();
  Timer? _autoScrollTimer;
  Timer? _resumeTimer;
  bool _isInteracting = false;

  @override
  void initState() {
    super.initState();
    _checkAndStartAutoScroll();
  }

  @override
  void didUpdateWidget(covariant _BooksRail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.booksAsync != oldWidget.booksAsync) {
      _checkAndStartAutoScroll();
    }
  }

  void _checkAndStartAutoScroll() {
    widget.booksAsync.whenData((books) {
      if (books.length > 1) {
        _startAutoScroll();
      } else {
        _stopAutoScroll();
      }
    });
  }

  void _startAutoScroll() {
    _autoScrollTimer?.cancel();
    _autoScrollTimer = Timer.periodic(const Duration(milliseconds: 3200), (_) {
      if (!mounted || !_scrollController.hasClients || _isInteracting) return;

      final maxScroll = _scrollController.position.maxScrollExtent;
      final currentScroll = _scrollController.offset;
      const step = 240.0 + 14.0; // card width + separator

      if (currentScroll >= maxScroll - 8) {
        _scrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 1100),
          curve: Curves.easeInOutCubic,
        );
      } else {
        final next = (currentScroll + step).clamp(0.0, maxScroll);
        _scrollController.animateTo(
          next,
          duration: const Duration(milliseconds: 750),
          curve: Curves.easeInOutCubic,
        );
      }
    });
  }

  void _stopAutoScroll() {
    _autoScrollTimer?.cancel();
    _autoScrollTimer = null;
    _resumeTimer?.cancel();
    _resumeTimer = null;
  }

  void _onPointerDown() {
    _isInteracting = true;
    _autoScrollTimer?.cancel();
    _resumeTimer?.cancel();
  }

  void _onPointerUp() {
    _resumeTimer?.cancel();
    _resumeTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) {
        _isInteracting = false;
        _startAutoScroll();
      }
    });
  }

  @override
  void dispose() {
    _stopAutoScroll();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 246,
      child: widget.booksAsync.when(
        skipLoadingOnRefresh: true,
        loading: () => ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: 3,
          separatorBuilder: (_, __) => const SizedBox(width: 14),
          itemBuilder: (_, __) => const SkeletonBox(
            width: 240,
            height: 240,
            radius: AppTheme.radiusLg,
          ),
        ),
        error: (error, _) => ErrorView(error: error, compact: true),
        data: (books) {
          if (books.isEmpty) {
            return Center(
              child: Text(
                'No books published yet.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: context.palette.textMuted,
                    ),
              ),
            );
          }
          return Listener(
            onPointerDown: (_) => _onPointerDown(),
            onPointerUp: (_) => _onPointerUp(),
            onPointerCancel: (_) => _onPointerUp(),
            child: NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification is ScrollStartNotification ||
                    notification is UserScrollNotification) {
                  _onPointerDown();
                } else if (notification is ScrollEndNotification) {
                  _onPointerUp();
                }
                return false;
              },
              child: ListView.separated(
                controller: _scrollController,
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                itemCount: books.length,
                separatorBuilder: (_, __) => const SizedBox(width: 14),
                itemBuilder: (context, index) {
                  final book = books[index];
                  return BookTile(
                    book: book,
                    width: 240,
                    onTap: () => context.push(AppRoutes.bookDetail(book.id)),
                  );
                },
              ),
            ),
          );
        },
      ),
    );
  }
}



class _SupportBanner extends StatelessWidget {
  const _SupportBanner();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GlassCard(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.emerald.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.support_agent_rounded,
                  color: AppColors.emerald, size: 24),
            ),
            const SizedBox(height: 14),
            Text(
              'Need guidance?',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 6),
            Text(
              'Message our student support team for book recommendations and '
              'syllabus guidance.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.palette.textSecondary,
                    height: 1.55,
                  ),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () => launchUrl(
                Uri.parse(AppConfig.supportWhatsApp),
                mode: LaunchMode.externalApplication,
              ),
              icon: const Icon(Icons.chat_rounded,
                  size: 17, color: AppColors.emerald),
              label: const Text('WhatsApp ${AppConfig.supportPhone}'),
            ),
          ],
        ),
      ),
    );
  }
}
