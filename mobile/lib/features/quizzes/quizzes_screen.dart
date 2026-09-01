import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/auth_controller.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/quiz.dart';
import 'quizzes_providers.dart';
import 'widgets/premium_quiz_carousel.dart';
import 'widgets/quiz_card.dart';
import 'widgets/quiz_category_card.dart';

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
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      ref.read(quizSearchProvider.notifier).state = value.trim();
    });
    setState(() {});
  }

  void _openQuiz(Quiz quiz) {
    final signedIn = ref.read(authControllerProvider).isAuthenticated;
    final target = AppRoutes.quizAttempt(quiz.id);
    if (!signedIn) {
      context.push('${AppRoutes.login}?redirect=${Uri.encodeComponent(target)}');
      return;
    }
    context.push(target);
  }

  void _popNavigation() {
    final path = ref.read(folderPathProvider);
    if (!path.isRoot) {
      ref.read(folderPathProvider.notifier).update((p) => p.pop());
    } else {
      ref.read(quizAccessTierProvider.notifier).state = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tier = ref.watch(quizAccessTierProvider);
    final path = ref.watch(folderPathProvider);
    final search = ref.watch(quizSearchProvider);

    final publishedAsync = ref.watch(publishedQuizzesProvider);
    final allFoldersAsync = ref.watch(allQuizFoldersProvider);
    final foldersAsync = ref.watch(quizFoldersProvider);
    final quizzesAsync = ref.watch(quizzesProvider);

    final allQuizzes = publishedAsync.valueOrNull ?? const <Quiz>[];
    final allFolders = allFoldersAsync.valueOrNull ?? const <QuizFolder>[];
    final folders = foldersAsync.valueOrNull ?? const <QuizFolder>[];
    final quizzes = quizzesAsync.valueOrNull ?? const <Quiz>[];

    final freeCount = allQuizzes.where((q) => !q.isPaid).length;
    final premiumCount = allQuizzes.where((q) => q.isPaid).length;

    final isRootHome = tier == null && path.isRoot && search.isEmpty;
    final isSearching = search.isNotEmpty;

    return PopScope(
      canPop: isRootHome,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          if (isSearching) {
            _searchController.clear();
            ref.read(quizSearchProvider.notifier).state = '';
          } else {
            _popNavigation();
          }
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            tier == null
                ? 'Quiz Hub'
                : (tier == QuizAccessTier.premium
                    ? 'Premium Quizzes'
                    : 'Free Quizzes'),
          ),
          leading: !isRootHome
              ? IconButton(
                  icon: const Icon(Icons.arrow_back_rounded),
                  onPressed: () {
                    if (isSearching) {
                      _searchController.clear();
                      ref.read(quizSearchProvider.notifier).state = '';
                    } else {
                      _popNavigation();
                    }
                  },
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
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
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
                    children: [
                      const SizedBox(height: 60),
                      EmptyView(
                        icon: Icons.search_off_rounded,
                        title: 'No quizzes match "$search"',
                        message: 'Try a different keyword or topic.',
                      ),
                    ],
                  );
                }
                return ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  children: [
                    SectionHeader(
                      title: 'Search results',
                      subtitle: '${quizzes.length} matches found',
                      icon: Icons.search_rounded,
                      padding: const EdgeInsets.fromLTRB(0, 0, 0, 12),
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
                );
              }

              // Top level (Categories & Carousel)
              if (tier == null) {
                return ListView(
                  padding: const EdgeInsets.fromLTRB(0, 8, 0, 24),
                  children: [
                    // Premium Quiz Carousel
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
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
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: SectionHeader(
                        title: 'Question Bank Categories',
                        subtitle: 'Explore question banks by access level',
                        icon: Icons.folder_open_rounded,
                      ),
                    ),
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

              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
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

