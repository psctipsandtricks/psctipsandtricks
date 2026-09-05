import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/auth_controller.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/responsive.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/quiz.dart';
import 'quizzes_providers.dart';
import 'widgets/premium_quiz_carousel.dart';
import 'widgets/quiz_card.dart';
import 'widgets/quiz_category_card.dart';
import '../shell/shell_scaffold.dart';

/// The Quiz Hub: displays the top 10 newest premium quiz carousel, followed by
/// the two primary categories (Free Quiz & Premium Quiz), with full folder drill-down.
class QuizzesScreen extends ConsumerStatefulWidget {
  const QuizzesScreen({super.key});

  @override
  ConsumerState<QuizzesScreen> createState() => _QuizzesScreenState();
}

class _QuizzesScreenState extends ConsumerState<QuizzesScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _searchController.text = ref.read(quizSearchProvider);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      ref.read(quizSearchProvider.notifier).state = value.trim();
    });
    setState(() {});
  }

  void _popNavigation() {
    final search = ref.read(quizSearchProvider);
    if (search.isNotEmpty) {
      _searchController.clear();
      ref.read(quizSearchProvider.notifier).state = '';
      return;
    }
    final path = ref.read(folderPathProvider);
    if (!path.isRoot) {
      ref.read(folderPathProvider.notifier).update((p) => p.pop());
    } else {
      ref.read(quizAccessTierProvider.notifier).state = null;
    }
  }

  void _openQuiz(Quiz quiz) {
    final signedIn = ref.read(authControllerProvider).isAuthenticated;
    final target = AppRoutes.quizAttempt(quiz.id);
    if (!signedIn && quiz.isPaid) {
      context.push('${AppRoutes.login}?redirect=${Uri.encodeComponent(target)}');
      return;
    }
    context.push(target);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(quizSearchProvider, (prev, next) {
      if (next.isEmpty && _searchController.text.isNotEmpty) {
        _searchController.clear();
      }
    });

    final tier = ref.watch(quizAccessTierProvider);
    final path = ref.watch(folderPathProvider);
    final search = ref.watch(quizSearchProvider);
    final isSearching = search.isNotEmpty;
    final isTablet = Responsive.isTablet(context);

    final quizzesAsync = ref.watch(quizzesProvider);
    final foldersAsync = ref.watch(quizFoldersProvider);
    final allQuizzes = ref.watch(publishedQuizzesProvider).valueOrNull ?? [];
    final allFolders = ref.watch(allQuizFoldersProvider).valueOrNull ?? [];

    final freeCount = allQuizzes.where((q) => !q.isPaid).length;
    final premiumCount = allQuizzes.where((q) => q.isPaid).length;

    final folders = foldersAsync.valueOrNull ?? [];
    final quizzes = quizzesAsync.valueOrNull ?? [];

    final isRootHome = tier == null && path.isRoot && search.isEmpty;

    return PopScope(
      canPop: isRootHome && !isSearching,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _popNavigation();
      },
      child: Scaffold(
        appBar: GlassAppBar(
          title: Text(
            tier == null
                ? 'Quiz Hub'
                : (tier == QuizAccessTier.premium
                    ? 'Premium Quizzes'
                    : 'Free Quizzes'),
          ),
          leading: !isRootHome || isSearching
              ? IconButton(
                  icon: const Icon(Icons.arrow_back_rounded),
                  onPressed: _popNavigation,
                )
              : null,
          actions: [
            IconButton(
              tooltip: 'My attempts',
              icon: const Icon(Icons.history_rounded),
              onPressed: () => context.push(AppRoutes.quizHistory),
            ),
          ],
          bottom: PreferredSize(
            preferredSize: Size.fromHeight(isRootHome ? 64 : 98),
            child: Responsive.centered(
              maxWidth: Responsive.maxContentWidth,
              child: Column(
                children: [
                  Padding(
                    padding: EdgeInsets.fromLTRB(
                      Responsive.horizontalPadding(context),
                      0,
                      Responsive.horizontalPadding(context),
                      12,
                    ),
                    child: AppSearchField(
                      controller: _searchController,
                      hintText: 'Search all question banks…',
                      onChanged: _onSearchChanged,
                    ),
                  ),
                  if (!isRootHome && !isSearching)
                    _Breadcrumbs(
                      tier: tier,
                      path: path,
                      onTapAll: () {
                        ref.read(quizAccessTierProvider.notifier).state = null;
                        ref.read(folderPathProvider.notifier).state = FolderPath.root;
                      },
                      onTapTier: () {
                        ref.read(folderPathProvider.notifier).state = FolderPath.root;
                      },
                      onTapFolder: (index) {
                        ref
                            .read(folderPathProvider.notifier)
                            .update((p) => p.popTo(index));
                      },
                    ),
                ],
              ),
            ),
          ),
        ),
        body: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(publishedQuizzesProvider);
            ref.invalidate(allQuizFoldersProvider);
            ref.invalidate(premiumCarouselQuizzesProvider);
            ref.invalidate(quizFoldersProvider);
            await ref.read(quizzesProvider.future);
          },
          child: Builder(
            builder: (context) {
              // Active search results
              if (isSearching) {
                if (quizzesAsync.isLoading) {
                  return const ListSkeleton(count: 6, height: 118);
                }
                if (quizzes.isEmpty) {
                  return ListView(
                    children: const [
                      SizedBox(height: 60),
                      EmptyView(
                        icon: Icons.search_off_rounded,
                        title: 'No quizzes found',
                        message: 'Try adjusting your search terms.',
                      ),
                    ],
                  );
                }
                return Responsive.centered(
                  maxWidth: Responsive.maxContentWidth,
                  child: ListView.separated(
                    padding: EdgeInsets.fromLTRB(
                      Responsive.horizontalPadding(context),
                      8,
                      Responsive.horizontalPadding(context),
                      24 + ShellScaffold.dockExtent,
                    ),
                    itemCount: quizzes.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final quiz = quizzes[index];
                      return QuizCard(
                        quiz: quiz,
                        width: double.infinity,
                        onTap: () => _openQuiz(quiz),
                      );
                    },
                  ),
                );
              }

              // Top level (Categories & Carousel)
              if (tier == null) {
                return Responsive.centered(
                  maxWidth: Responsive.maxContentWidth,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(
                        0, 8, 0, 24 + ShellScaffold.dockExtent),
                    children: [
                      // Premium Quiz Carousel
                      Padding(
                        padding: EdgeInsets.fromLTRB(
                          Responsive.horizontalPadding(context),
                          0,
                          Responsive.horizontalPadding(context),
                          12,
                        ),
                        child: SectionHeader(
                          title: 'Premium Quizzes',
                          subtitle: 'Top 10 newest question banks',
                          icon: Icons.workspace_premium_rounded,
                          actionLabel: 'View all',
                          onAction: () => ref
                              .read(quizAccessTierProvider.notifier)
                              .state = QuizAccessTier.premium,
                        ),
                      ),
                      const PremiumQuizCarousel(),
                      const SizedBox(height: 24),

                      // Main Categories
                      Padding(
                        padding: EdgeInsets.fromLTRB(
                          Responsive.horizontalPadding(context),
                          0,
                          Responsive.horizontalPadding(context),
                          12,
                        ),
                        child: const SectionHeader(
                          title: 'Question Bank Categories',
                          subtitle: 'Explore question banks by access level',
                          icon: Icons.folder_open_rounded,
                        ),
                      ),
                      if (isTablet)
                        Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: Responsive.horizontalPadding(context),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: QuizCategoryCard(
                                  type: QuizCategoryType.free,
                                  count: freeCount,
                                  onTap: () => ref
                                      .read(quizAccessTierProvider.notifier)
                                      .state = QuizAccessTier.free,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: QuizCategoryCard(
                                  type: QuizCategoryType.premium,
                                  count: premiumCount,
                                  onTap: () => ref
                                      .read(quizAccessTierProvider.notifier)
                                      .state = QuizAccessTier.premium,
                                ),
                              ),
                            ],
                          ),
                        )
                      else ...[
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: QuizCategoryCard(
                            type: QuizCategoryType.free,
                            count: freeCount,
                            onTap: () => ref
                                .read(quizAccessTierProvider.notifier)
                                .state = QuizAccessTier.free,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: QuizCategoryCard(
                            type: QuizCategoryType.premium,
                            count: premiumCount,
                            onTap: () => ref
                                .read(quizAccessTierProvider.notifier)
                                .state = QuizAccessTier.premium,
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              }

              // Drill-down level (Tier selected: folders & quizzes)
              if (foldersAsync.isLoading && folders.isEmpty && quizzes.isEmpty) {
                return const ListSkeleton(count: 6, height: 118);
              }

              if (folders.isEmpty && quizzes.isEmpty) {
                return ListView(
                  children: [
                    const SizedBox(height: 60),
                    EmptyView(
                      icon: Icons.folder_off_rounded,
                      title: 'No quizzes found',
                      message: tier == QuizAccessTier.premium
                          ? 'No premium quizzes published in this folder yet.'
                          : 'No free quizzes published in this folder yet.',
                    ),
                  ],
                );
              }

              final tierAccent = tier == QuizAccessTier.premium
                  ? AppColors.amber
                  : AppColors.emerald;

              return Responsive.centered(
                maxWidth: Responsive.maxContentWidth,
                child: ListView(
                  padding: EdgeInsets.fromLTRB(
                    Responsive.horizontalPadding(context),
                    8,
                    Responsive.horizontalPadding(context),
                    24 + ShellScaffold.dockExtent,
                  ),
                children: [
                  if (folders.isNotEmpty) ...[
                    SectionHeader(
                      title: path.isRoot
                          ? 'Folders'
                          : 'Sub-folders in "${path.current?.name}"',
                      icon: Icons.folder_open_rounded,
                      padding: const EdgeInsets.fromLTRB(0, 0, 0, 10),
                    ),
                    for (final folder in folders)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: QuizFolderCard(
                          folder: folder,
                          accentColor: tierAccent,
                          quizCount: computeFolderQuizCount(
                            folderName: folder.name,
                            quizzes: allQuizzes,
                            allFolders: allFolders,
                            tier: tier,
                          ),
                          onTap: () => ref
                              .read(folderPathProvider.notifier)
                              .update((p) => p.push(folder)),
                        ),
                      ),
                    const SizedBox(height: 14),
                  ],
                  if (quizzes.isNotEmpty) ...[
                    SectionHeader(
                      title: path.isRoot
                          ? 'General Quizzes'
                          : 'Quizzes in "${path.current?.name}"',
                      icon: Icons.playlist_add_check_rounded,
                      padding: const EdgeInsets.fromLTRB(0, 0, 0, 10),
                    ),
                    for (final quiz in quizzes)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: QuizCard(
                          quiz: quiz,
                          width: double.infinity,
                          onTap: () => _openQuiz(quiz),
                        ),
                      ),
                  ],
                ],
              ),
            );
            },
          ),
        ),
      ),
    );
  }
}

class _Breadcrumbs extends StatelessWidget {
  const _Breadcrumbs({
    required this.tier,
    required this.path,
    required this.onTapAll,
    required this.onTapTier,
    required this.onTapFolder,
  });

  final QuizAccessTier? tier;
  final FolderPath path;
  final VoidCallback onTapAll;
  final VoidCallback onTapTier;
  final ValueChanged<int> onTapFolder;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isTierLast = path.isRoot;

    final tierLabel = tier == QuizAccessTier.premium
        ? 'Premium Quiz'
        : (tier == QuizAccessTier.free ? 'Free Quiz' : null);

    return SizedBox(
      height: 34,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        children: [
          _Crumb(
            label: 'All',
            icon: Icons.home_rounded,
            onTap: onTapAll,
          ),
          if (tierLabel != null) ...[
            Icon(Icons.chevron_right_rounded, size: 15, color: palette.textMuted),
            _Crumb(
              label: tierLabel,
              isLast: isTierLast,
              icon: tier == QuizAccessTier.premium
                  ? Icons.workspace_premium_rounded
                  : Icons.lock_open_rounded,
              onTap: onTapTier,
            ),
          ],
          for (var i = 0; i < path.segments.length; i++) ...[
            Icon(Icons.chevron_right_rounded, size: 15, color: palette.textMuted),
            _Crumb(
              label: path.segments[i].name,
              isLast: i == path.segments.length - 1,
              onTap: () => onTapFolder(i),
            ),
          ],
        ],
      ),
    );
  }
}

class _Crumb extends StatelessWidget {
  const _Crumb({
    required this.label,
    required this.onTap,
    this.icon,
    this.isLast = false,
  });

  final String label;
  final VoidCallback onTap;
  final IconData? icon;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return InkWell(
      onTap: isLast ? null : onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Row(
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 13,
                color: isLast ? AppColors.cyan : palette.textMuted,
              ),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: isLast ? AppColors.cyan : palette.textSecondary,
                    fontWeight: isLast ? FontWeight.w800 : FontWeight.w500,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

