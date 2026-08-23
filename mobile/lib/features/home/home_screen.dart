import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';
import '../../core/providers/auth_controller.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../books/widgets/book_card.dart';
import '../dashboard/dashboard_providers.dart';
import '../quizzes/widgets/quiz_card.dart';
import 'home_providers.dart';
import 'widgets/announcement_banner.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final booksAsync = ref.watch(featuredBooksProvider);
    final quizzesAsync = ref.watch(latestQuizzesProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(featuredBooksProvider);
          ref.invalidate(latestQuizzesProvider);
          ref.invalidate(activeAnnouncementsProvider);
          if (ref.read(authControllerProvider).isAuthenticated) {
            ref.invalidate(dashboardProvider);
          }
          await ref.read(featuredBooksProvider.future);
        },
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              floating: true,
              titleSpacing: 16,
              title: _Greeting(name: user?.name),
              actions: const [_NotificationsButton(), SizedBox(width: 6)],
            ),
            const SliverToBoxAdapter(child: AnnouncementBanner()),
            const SliverToBoxAdapter(child: _HeroPanel()),
            const SliverToBoxAdapter(child: SizedBox(height: 22)),
            const SliverToBoxAdapter(child: _QuickAccessGrid()),

            if (user != null) ...[
              const SliverToBoxAdapter(child: SizedBox(height: 26)),
              const SliverToBoxAdapter(child: _ContinueStudying()),
            ],

            const SliverToBoxAdapter(child: SizedBox(height: 26)),
            SliverToBoxAdapter(
              child: SectionHeader(
                title: 'E-Book catalog',
                subtitle: 'Audio narrations, notes and video classes',
                icon: Icons.auto_stories_rounded,
                actionLabel: 'See all',
                onAction: () => context.go(AppRoutes.books),
              ),
            ),
            SliverToBoxAdapter(
              child: _BooksRail(booksAsync: booksAsync),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 26)),
            SliverToBoxAdapter(
              child: SectionHeader(
                title: 'Latest question banks',
                subtitle: 'Test your retention after every chapter',
                icon: Icons.quiz_rounded,
                actionLabel: 'Quiz Hub',
                onAction: () => context.go(AppRoutes.quizzes),
              ),
            ),
            SliverToBoxAdapter(
              child: _QuizzesRail(quizzesAsync: quizzesAsync),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 26)),
            const SliverToBoxAdapter(child: _SupportBanner()),
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({this.name});

  final String? name;

  String get _partOfDay {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          name == null ? 'Welcome' : _partOfDay,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: context.palette.textMuted,
                letterSpacing: 0.3,
              ),
        ),
        Text(
          name?.split(' ').first ?? 'PSC Tips And Tricks',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w900,
                letterSpacing: -0.4,
              ),
        ),
      ],
    );
  }
}

class _NotificationsButton extends ConsumerWidget {
  const _NotificationsButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(authControllerProvider).isAuthenticated;

    return IconButton(
      tooltip: 'Notifications',
      icon: const Icon(Icons.notifications_none_rounded),
      onPressed: () => context.push(
        signedIn
            ? AppRoutes.notifications
            : '${AppRoutes.login}?redirect=${Uri.encodeComponent(AppRoutes.notifications)}',
      ),
    );
  }
}

/// The landing panel — the app's equivalent of the website's hero.
class _HeroPanel extends StatelessWidget {
  const _HeroPanel();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.cyan.withValues(alpha: 0.16),
              AppColors.indigo.withValues(alpha: 0.10),
              AppColors.amber.withValues(alpha: 0.08),
            ],
          ),
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          border: Border.all(color: AppColors.cyan.withValues(alpha: 0.26)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const AppBadge('KERALA PSC · SSC · UPSC',
                icon: Icons.auto_awesome_rounded),
            const SizedBox(height: 14),
            Text(
              'Crack your next exam with\ninteractive study material',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                    height: 1.3,
                    letterSpacing: -0.5,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Mock tests, question banks, e-books with audio narration, and '
              'real-time rank tracking.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.palette.textSecondary,
                    height: 1.55,
                  ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: GradientButton(
                    label: 'Browse books',
                    icon: Icons.menu_book_rounded,
                    compact: true,
                    onPressed: () => context.go(AppRoutes.books),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => context.go(AppRoutes.quizzes),
                    icon: const Icon(Icons.play_arrow_rounded, size: 17),
                    label: const Text('Take a quiz'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Tiles for the student surfaces that do not own a bottom-nav tab.
class _QuickAccessGrid extends StatelessWidget {
  const _QuickAccessGrid();

  @override
  Widget build(BuildContext context) {
    const items = <(IconData, String, Color, String)>[
      (Icons.insights_rounded, 'Progress', AppColors.cyan, AppRoutes.dashboard),
      (Icons.emoji_events_rounded, 'Mock tests', AppColors.amber, AppRoutes.mockTests),
      (Icons.forum_rounded, 'Community', AppColors.indigo, AppRoutes.community),
      (Icons.history_rounded, 'My attempts', AppColors.emerald, AppRoutes.quizHistory),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: 10),
            Expanded(
              child: _QuickTile(
                icon: items[i].$1,
                label: items[i].$2,
                color: items[i].$3,
                route: items[i].$4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _QuickTile extends ConsumerWidget {
  const _QuickTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.route,
  });

  final IconData icon;
  final String label;
  final Color color;
  final String route;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
      onTap: () {
        // These four all need a session; bounce through login with a redirect
        // rather than letting the router reject the push silently.
        final signedIn = ref.read(authControllerProvider).isAuthenticated;
        context.push(
          signedIn
              ? route
              : '${AppRoutes.login}?redirect=${Uri.encodeComponent(route)}',
        );
      },
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            ),
            child: Icon(icon, color: color, size: 19),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

/// Resume rail: the book the student was last reading, if any.
class _ContinueStudying extends ConsumerWidget {
  const _ContinueStudying();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(dashboardProvider).valueOrNull;
    final inProgress = dashboard?.booksInProgress ?? const [];
    if (inProgress.isEmpty) return const SizedBox.shrink();

    final book = inProgress.first;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GlassCard(
        highlighted: true,
        onTap: () => context.push(AppRoutes.bookReader(book.bookId, resume: true)),
        child: Row(
          children: [
            BookCover(url: book.coverUrl, width: 54),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'CONTINUE READING',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.cyan,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.7,
                          fontSize: 10,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    book.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  Text(
                    book.resumeLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: context.palette.textMuted,
                        ),
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: LinearProgressIndicator(
                      value: book.progressPercent / 100,
                      minHeight: 5,
                      backgroundColor: context.palette.elevated,
                      valueColor:
                          const AlwaysStoppedAnimation(AppColors.cyan),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(
              '${book.progressPercent}%',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: AppColors.cyan,
                    fontWeight: FontWeight.w900,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BooksRail extends StatelessWidget {
  const _BooksRail({required this.booksAsync});

  final AsyncValue<List<dynamic>> booksAsync;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 180,
      child: booksAsync.when(
        skipLoadingOnRefresh: true,
        loading: () => ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: 4,
          separatorBuilder: (_, __) => const SizedBox(width: 12),
          itemBuilder: (_, __) => const SkeletonBox(
            width: 160,
            height: 160,
            radius: AppTheme.radiusMd,
          ),
        ),
        error: (error, _) =>
            ErrorView(error: error, compact: true),
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
          return ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: books.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final book = books[index];
              return BookTile(
                book: book,
                onTap: () => context.push(AppRoutes.bookDetail(book.id)),
              );
            },
          );
        },
      ),
    );
  }
}

class _QuizzesRail extends ConsumerWidget {
  const _QuizzesRail({required this.quizzesAsync});

  final AsyncValue<List<dynamic>> quizzesAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return quizzesAsync.when(
      skipLoadingOnRefresh: true,
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(horizontal: 16),
        child: Column(
          children: [
            SkeletonBox(height: 118, radius: AppTheme.radiusLg),
            SizedBox(height: 12),
            SkeletonBox(height: 118, radius: AppTheme.radiusLg),
          ],
        ),
      ),
      error: (error, _) => ErrorView(error: error, compact: true),
      data: (quizzes) {
        if (quizzes.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'No quizzes published yet.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.palette.textMuted,
                  ),
            ),
          );
        }

        final visible = quizzes.take(3).toList();
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            children: [
              for (final quiz in visible)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: QuizCard(
                    quiz: quiz,
                    onTap: () {
                      final signedIn =
                          ref.read(authControllerProvider).isAuthenticated;
                      final target = AppRoutes.quizAttempt(quiz.id);
                      context.push(
                        signedIn
                            ? target
                            : '${AppRoutes.login}?redirect=${Uri.encodeComponent(target)}',
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
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
