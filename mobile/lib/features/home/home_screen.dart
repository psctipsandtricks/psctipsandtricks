import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_glass.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/responsive.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../announcements/announcement_providers.dart';
import '../books/widgets/book_card.dart';
import '../dashboard/dashboard_providers.dart';
import '../notifications/notifications_screen.dart';
import '../quizzes/widgets/premium_quiz_carousel.dart';
import '../shell/shell_scaffold.dart';
import '../social/widgets/social_media_section.dart';
import '../../data/models/book.dart';
import 'home_providers.dart';
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
      duration: const Duration(milliseconds: 900),
    )..forward();
  }

  @override
  void dispose() {
    _entranceController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(featuredBooksProvider);
    ref.invalidate(premiumQuizzesProvider);
    ref.invalidate(activeAnnouncementsProvider);
    ref.invalidate(liveMockTestsProvider);
    ref.invalidate(socialLinksProvider);
    if (ref.read(authControllerProvider).isAuthenticated) {
      ref.invalidate(dashboardProvider);
    }
    await Future.wait([
      ref.read(featuredBooksProvider.future),
      ref.read(liveMockTestsProvider.future),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final booksAsync = ref.watch(featuredBooksProvider);
    final quizzesAsync = ref.watch(premiumQuizzesProvider);
    // The hero runs under the status bar, so the icons up there have to suit
    // the artwork rather than the page background.
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: (context.palette.isDark
              ? SystemUiOverlayStyle.light
              : SystemUiOverlayStyle.dark)
          .copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: Colors.transparent,
      ),
      child: Scaffold(
        // The bar is stacked over the page rather than given a slice of it, so
        // the hero artwork runs the full height of the screen and up under the
        // status bar. Anything else leaves a band of page colour above the
        // image that no amount of blending can disguise.
        body: Stack(
          children: [
            RefreshIndicator(
              onRefresh: _refresh,
              // Clear of the bar, so the spinner is not caught behind it.
              edgeOffset: _HomeTopBar.extentFor(context),
              child: CustomScrollView(
                physics: const BouncingScrollPhysics(
                  parent: AlwaysScrollableScrollPhysics(),
                ),
                slivers: [
                  // Page above the artwork, so the bar starts on the page and
                  // only its last quarter falls across the cover.
                  SliverToBoxAdapter(
                    child: SizedBox(height: _HomeTopBar.heroTopFor(context)),
                  ),
                  SliverToBoxAdapter(
                    child: Responsive.centered(
                      maxWidth: Responsive.maxContentWidth,
                      child: HomeBookCarousel(
                        topOverlay: _HomeTopBar.heroOverlapFor(context),
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Responsive.centered(
                      maxWidth: Responsive.maxContentWidth,
                      child: const LiveMockBanner(),
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 26)),
                  SliverToBoxAdapter(
                    child: Responsive.centered(
                      maxWidth: Responsive.maxContentWidth,
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
                  ),
                  SliverToBoxAdapter(
                    child: Responsive.centered(
                      maxWidth: Responsive.maxContentWidth,
                      child: _FadeSlide(
                        animation: _entranceController,
                        delay: 0.32,
                        child: _BooksRail(booksAsync: booksAsync),
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 26)),
                  SliverToBoxAdapter(
                    child: Responsive.centered(
                      maxWidth: Responsive.maxContentWidth,
                      child: _FadeSlide(
                        animation: _entranceController,
                        delay: 0.38,
                        child: SectionHeader(
                          title: 'Premium question banks',
                          subtitle:
                              'Top 10 newest question banks & test series',
                          icon: Icons.workspace_premium_rounded,
                          actionLabel: 'Quiz Hub',
                          onAction: () => context.go(AppRoutes.quizzes),
                        ),
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Responsive.centered(
                      maxWidth: Responsive.maxContentWidth,
                      child: _FadeSlide(
                        animation: _entranceController,
                        delay: 0.42,
                        child: PremiumQuizCarousel(quizzesAsync: quizzesAsync),
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 26)),
                  SliverToBoxAdapter(
                    child: Responsive.centered(
                      maxWidth: Responsive.maxContentWidth,
                      child: _FadeSlide(
                        animation: _entranceController,
                        delay: 0.46,
                        child: const SocialMediaSection(),
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 26)),
                  SliverToBoxAdapter(
                    child: Responsive.centered(
                      maxWidth: Responsive.maxContentWidth,
                      child: _FadeSlide(
                        animation: _entranceController,
                        delay: 0.50,
                        child: const _SupportBanner(),
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(
                    child: SizedBox(height: 32 + ShellScaffold.dockExtent),
                  ),
                ],
              ),
            ),
            const Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: _HomeTopBar(),
            ),
          ],
        ),
      ),
    );
  }
}

/// The top bar: brand mark, quick actions, and the shortcut strip that takes
/// the place of the reference design's category tabs.
class _HomeTopBar extends ConsumerWidget {
  const _HomeTopBar();

  /// Toolbar plus tab strip, excluding the status bar.
  static const double contentHeight = 58 + _ShortcutStrip.height + 6;

  /// Everything the bar covers: the status bar and its two rows.
  static double extentFor(BuildContext context) =>
      MediaQuery.paddingOf(context).top + contentHeight;

  /// How far down the screen the artwork begins: starts approximately 85%
  /// down the top bar so only the bottom rounded curve overlaps the top edge.
  static double heroTopFor(BuildContext context) => extentFor(context) * 0.85;

  /// The slice of artwork that runs up behind the bar's bottom rounded curve.
  static double heroOverlapFor(BuildContext context) =>
      extentFor(context) - heroTopFor(context);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final topInset = MediaQuery.paddingOf(context).top;
    return SizedBox(
      height: extentFor(context),
      child: Stack(
        fit: StackFit.expand,
        children: [
          const GlassBarSurface(bottomRadius: 24),
          Padding(
            padding: EdgeInsets.only(top: topInset),
            child: Responsive.centered(
              maxWidth: Responsive.maxContentWidth,
              child: Column(
                children: [
                  SizedBox(
                    height: 58,
                    child: Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: Responsive.horizontalPadding(context),
                      ),
                      child: Row(
                        children: [
                          Expanded(child: _BrandRow(name: user?.name)),
                          const _SearchButton(),
                          const SizedBox(width: 8),
                          const _NotificationsButton(),
                          const SizedBox(width: 8),
                          const _AvatarButton(),
                        ],
                      ),
                    ),
                  ),
                  const _ShortcutStrip(),
                  const SizedBox(height: 6),
                ],
              ),
            ),
          ),
        ],
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
        // The logo art is a white roundel, so on a light bar it needs a plate
        // and a hairline of its own or it dissolves into the glass.
        Container(
          width: 40,
          height: 40,
          padding: const EdgeInsets.all(1.5),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: const Color(0xFF38BDF8).withValues(alpha: 0.40),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.cyan.withValues(alpha: 0.22),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: ClipOval(
            child: Image.asset(
              'assets/icon/app_logo.png',
              fit: BoxFit.contain,
            ),
          ),
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
                      color: context.palette.textSecondary,
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

class _SearchButton extends StatelessWidget {
  const _SearchButton();

  @override
  Widget build(BuildContext context) {
    return GlassIconButton(
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

    return GlassIconButton(
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

    if (user == null) {
      return GlassIconButton(
        icon: Icons.person_rounded,
        tooltip: 'Sign in',
        onTap: () => context.go(AppRoutes.login),
      );
    }

    return LiquidGlassTappable(
      onTap: () => context.go(AppRoutes.account),
      borderRadius: BorderRadius.circular(999),
      blurSigma: AppGlass.blurRaised,
      intensity: 0.85,
      elevation: 0.5,
      isCardScale: false,
      pressScale: 0.9,
      padding: const EdgeInsets.all(2),
      child: AppAvatar(
        imageUrl: user.avatarUrl,
        name: user.name,
        size: 34,
      ),
    );
  }
}

/// Shortcuts to the student surfaces that do not own a bottom-nav tab, laid out
/// as the reference design's category strip: icon over label, scrolling
/// horizontally so the row can grow past the four items a fixed grid allows
/// without shrinking each target.
class _ShortcutStrip extends StatefulWidget {
  const _ShortcutStrip();

  static const double height = 76;

  // Each tint is picked so no two tiles read as the same colour at a glance —
  // the palette only has a handful of hues, and cyan/sky and red/rose are
  // close enough that neighbouring tiles in the old assignment (Videos next
  // to PDFs, Progress far from but still echoing Orders) were hard to tell
  // apart by colour alone.
  static const _items = <_Shortcut>[
    _Shortcut(
      Icons.insights_rounded,
      'Progress',
      AppColors.cyan,
      AppRoutes.dashboard,
    ),
    // Its "LIVE" badge isn't part of this static list — `_ShortcutButtonState`
    // adds it only when a mock test is actually live right now.
    _Shortcut(
      Icons.emoji_events_rounded,
      'Mock tests',
      AppColors.amber,
      AppRoutes.mockTests,
    ),
    _Shortcut(
      Icons.forum_rounded,
      'Community',
      AppColors.indigo,
      AppRoutes.community,
    ),
    _Shortcut(
      Icons.history_rounded,
      'Attempts',
      AppColors.emerald,
      AppRoutes.quizHistory,
    ),
    _Shortcut(
      Icons.smart_display_rounded,
      'Videos',
      AppColors.red,
      AppRoutes.libraryVideos,
    ),
    _Shortcut(
      Icons.picture_as_pdf_rounded,
      'PDFs',
      AppColors.blue,
      AppRoutes.libraryPdfs,
    ),
    _Shortcut(
      Icons.receipt_long_rounded,
      'Orders',
      AppColors.gold,
      AppRoutes.orders,
    ),
  ];

  @override
  State<_ShortcutStrip> createState() => _ShortcutStripState();
}

class _ShortcutStripState extends State<_ShortcutStrip>
    with TickerProviderStateMixin {
  /// Drives the one-off entrance: each tile fades up a beat after the one to
  /// its left.
  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 720),
  );

  /// Drives subtle continuous floating and breathing micro-animations.
  late final AnimationController _idle = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2800),
  )..repeat(reverse: true);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _entrance.forward();
    });
  }

  @override
  void dispose() {
    _entrance.dispose();
    _idle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isTablet = Responsive.isTablet(context);

    if (isTablet) {
      final horizontalPad = Responsive.horizontalPadding(context);
      return SizedBox(
        height: _ShortcutStrip.height,
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: horizontalPad),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: List.generate(
              _ShortcutStrip._items.length,
              (index) => Expanded(
                child: Center(
                  child: _ShortcutButton(
                    item: _ShortcutStrip._items[index],
                    entrance: _entrance,
                    idle: _idle,
                    index: index,
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }

    return SizedBox(
      height: _ShortcutStrip.height,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 10),
        itemCount: _ShortcutStrip._items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 4),
        itemBuilder: (context, index) => _ShortcutButton(
          item: _ShortcutStrip._items[index],
          entrance: _entrance,
          idle: _idle,
          index: index,
        ),
      ),
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
    required this.idle,
    required this.index,
  });

  final _Shortcut item;

  /// The strip's shared entrance timeline; this tile animates over its own
  /// slice of it.
  final Animation<double> entrance;

  /// Looping animation for floating and glow pulse effects.
  final Animation<double> idle;

  final int index;

  @override
  ConsumerState<_ShortcutButton> createState() => _ShortcutButtonState();
}

class _ShortcutButtonState extends ConsumerState<_ShortcutButton> {
  /// How far into the strip's timeline this tile starts, and how long it takes.
  static const _stagger = 0.07;
  static const _span = 0.40;

  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  void _open() {
    HapticFeedback.lightImpact();
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
    final palette = context.palette;
    final begin = (widget.index * _stagger).clamp(0.0, 1.0 - _span);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _open,
      onTapDown: (_) => _setPressed(true),
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      child: AnimatedBuilder(
        animation: Listenable.merge([widget.entrance, widget.idle]),
        builder: (context, child) {
          if (still) return child!;

          final enterProgress =
              ((widget.entrance.value - begin) / _span).clamp(0.0, 1.0);
          final enterEased = Curves.easeOutBack.transform(enterProgress);

          // Subtle organic phase offset per item so they float harmoniously
          final idleProgress =
              (widget.idle.value + (widget.index * 0.16)) % 1.0;
          final floatOffset = math.sin(idleProgress * 2 * math.pi) * 1.5;
          final pulse = 0.5 + 0.5 * math.sin(idleProgress * 2 * math.pi);

          return Opacity(
            opacity: enterProgress,
            child: Transform.translate(
              offset: Offset(0, (1 - enterEased) * 16 + floatOffset),
              child: _buildTile(context, palette, still, pulse),
            ),
          );
        },
        child: _buildTile(context, palette, still, 0.5),
      ),
    );
  }

  Widget _buildTile(
      BuildContext context, dynamic palette, bool still, double pulse) {
    final color = widget.item.color;
    final isDark = palette.isDark as bool;

    // The Mock tests tile's badge reflects whether a mock is actually running
    // right now, rather than a permanent "LIVE" label that would say the same
    // thing whether or not that were true.
    final hasLiveMock = widget.item.route == AppRoutes.mockTests &&
        (ref.watch(liveMockTestsProvider).valueOrNull?.isNotEmpty ?? false);
    final badge = hasLiveMock ? 'LIVE' : null;

    final isTablet = Responsive.isTablet(context);
    final tileWidth = isTablet ? 86.0 : 68.0;
    final podSize = isTablet ? 48.0 : 44.0;
    final iconSize = isTablet ? 24.0 : 22.0;

    return SizedBox(
      width: tileWidth,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedScale(
            scale: _pressed && !still ? 0.88 : 1.0,
            duration: const Duration(milliseconds: 140),
            curve: Curves.easeOutBack,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Frosted Liquid Glass Pod for the Icon
                Container(
                  width: podSize,
                  height: podSize,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        color.withValues(alpha: isDark ? 0.28 : 0.18),
                        color.withValues(alpha: isDark ? 0.12 : 0.06),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(isTablet ? 16 : 15),
                    border: Border.all(
                      color: color.withValues(
                        alpha: isDark
                            ? (0.40 + (pulse * 0.14)).clamp(0.0, 1.0)
                            : (0.28 + (pulse * 0.10)).clamp(0.0, 1.0),
                      ),
                      width: 1.1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: color.withValues(
                          alpha: isDark
                              ? (0.26 + (pulse * 0.12)).clamp(0.0, 1.0)
                              : (0.16 + (pulse * 0.08)).clamp(0.0, 1.0),
                        ),
                        blurRadius: 10 + (pulse * 4),
                        spreadRadius: -1,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Icon(
                      widget.item.icon,
                      color: color,
                      size: iconSize,
                    ),
                  ),
                ),
                // Optional Live / Feature Badge
                if (badge != null)
                  Positioned(
                    top: -4,
                    right: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4.5,
                        vertical: 1.5,
                      ),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            color,
                            color.withValues(alpha: 0.85),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(6),
                        boxShadow: [
                          BoxShadow(
                            color: color.withValues(alpha: 0.45),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Text(
                        badge,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 7.5,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 5),
          Text(
            widget.item.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  fontSize: isTablet ? 11.5 : 10.5,
                  letterSpacing: -0.1,
                  color: palette.textSecondary,
                ),
          ),
        ],
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
      height: 268,
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
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
