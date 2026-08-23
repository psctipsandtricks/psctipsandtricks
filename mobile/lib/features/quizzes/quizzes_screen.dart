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
import 'widgets/quiz_card.dart';

/// The Quiz Hub: a folder drill-down over the question banks, with a search
/// that spans every folder at once.
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

  @override
  Widget build(BuildContext context) {
    final path = ref.watch(folderPathProvider);
    final search = ref.watch(quizSearchProvider);
    final foldersAsync = ref.watch(quizFoldersProvider);
    final quizzesAsync = ref.watch(quizzesProvider);

    final folders = foldersAsync.valueOrNull ?? const <QuizFolder>[];
    final quizzes = quizzesAsync.valueOrNull ?? const <Quiz>[];
    final isLoading = foldersAsync.isLoading || quizzesAsync.isLoading;
    final error = quizzesAsync.error ?? foldersAsync.error;

    return PopScope(
      // Inside a folder, the system back gesture should climb one level rather
      // than leave the tab.
      canPop: path.isRoot,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          ref.read(folderPathProvider.notifier).update((p) => p.pop());
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Quiz Hub'),
          actions: [
            IconButton(
              tooltip: 'My attempts',
              icon: const Icon(Icons.history_rounded),
              onPressed: () => context.push(AppRoutes.quizHistory),
            ),
          ],
          bottom: PreferredSize(
            preferredSize: Size.fromHeight(path.isRoot ? 64 : 98),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: AppSearchField(
                    controller: _searchController,
                    hintText: 'Search every question bank…',
                    onChanged: _onSearchChanged,
                  ),
                ),
                if (!path.isRoot)
                  _Breadcrumbs(
                    path: path,
                    onTap: (index) => ref
                        .read(folderPathProvider.notifier)
                        .update((p) => index < 0 ? FolderPath.root : p.popTo(index)),
                  ),
              ],
            ),
          ),
        ),
        body: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(quizFoldersProvider);
            await ref.read(quizzesProvider.future);
          },
          child: Builder(
            builder: (context) {
              if (error != null && folders.isEmpty && quizzes.isEmpty) {
                return ErrorView(
                  error: error,
                  onRetry: () {
                    ref.invalidate(quizFoldersProvider);
                    ref.invalidate(quizzesProvider);
                  },
                );
              }
              if (isLoading && folders.isEmpty && quizzes.isEmpty) {
                return const ListSkeleton(count: 6, height: 118);
              }
              if (folders.isEmpty && quizzes.isEmpty) {
                return ListView(
                  children: [
                    const SizedBox(height: 60),
                    EmptyView(
                      icon: Icons.quiz_rounded,
                      title: search.isNotEmpty
                          ? 'No quizzes match "$search"'
                          : 'Nothing here yet',
                      message: search.isNotEmpty
                          ? 'Try a different subject or topic.'
                          : 'New question banks are published regularly.',
                    ),
                  ],
                );
              }

              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  if (folders.isNotEmpty) ...[
                    const SectionHeader(
                      title: 'Folders',
                      icon: Icons.folder_open_rounded,
                      padding: EdgeInsets.fromLTRB(0, 0, 0, 10),
                    ),
                    for (final folder in folders)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: QuizFolderCard(
                          folder: folder,
                          onTap: () => ref
                              .read(folderPathProvider.notifier)
                              .update((p) => p.push(folder)),
                        ),
                      ),
                    const SizedBox(height: 14),
                  ],
                  if (quizzes.isNotEmpty) ...[
                    SectionHeader(
                      title: search.isNotEmpty ? 'Search results' : 'Question banks',
                      icon: Icons.playlist_add_check_rounded,
                      padding: const EdgeInsets.fromLTRB(0, 0, 0, 10),
                    ),
                    for (final quiz in quizzes)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: QuizCard(
                          quiz: quiz,
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
  const _Breadcrumbs({required this.path, required this.onTap});

  final FolderPath path;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return SizedBox(
      height: 34,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        children: [
          _Crumb(
            label: 'All',
            icon: Icons.home_rounded,
            onTap: () => onTap(-1),
          ),
          for (var i = 0; i < path.segments.length; i++) ...[
            Icon(Icons.chevron_right_rounded, size: 15, color: palette.textMuted),
            _Crumb(
              label: path.segments[i].name,
              isLast: i == path.segments.length - 1,
              onTap: () => onTap(i),
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
              Icon(icon, size: 13, color: palette.textMuted),
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
