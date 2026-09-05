import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/responsive.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../offline/offline_providers.dart';
import 'books_providers.dart';
import 'widgets/book_card.dart';
import '../shell/shell_scaffold.dart';

class BooksScreen extends ConsumerStatefulWidget {
  const BooksScreen({super.key});

  @override
  ConsumerState<BooksScreen> createState() => _BooksScreenState();
}

class _BooksScreenState extends ConsumerState<BooksScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _searchController.text = ref.read(bookQueryProvider).search;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  /// Search hits the API, so wait for a pause in typing rather than firing a
  /// request per keystroke.
  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      ref.read(bookQueryProvider.notifier).update(
            (q) => q.copyWith(search: value.trim()),
          );
    });
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final booksAsync = ref.watch(booksProvider);
    final categories = ref.watch(bookCategoriesProvider);
    final query = ref.watch(bookQueryProvider);
    final isTablet = Responsive.isTablet(context);

    return Scaffold(
      appBar: GlassAppBar(
        title: const Text('E-Books'),
        actions: [
          _DownloadsAction(),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(104),
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
                    hintText: 'Search books, authors, subjects…',
                    onChanged: _onSearchChanged,
                  ),
                ),
                FilterChipsRow(
                  options: categories,
                  selected: categories.firstWhere(
                    (c) => c.toLowerCase() == query.category.toLowerCase(),
                    orElse: () => 'All',
                  ),
                  onSelected: (value) => ref
                      .read(bookQueryProvider.notifier)
                      .update((q) => q.copyWith(category: value)),
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(booksProvider.future),
        child: AsyncView(
          value: booksAsync,
          onRetry: () => ref.invalidate(booksProvider),
          loading: const _BooksSkeleton(),
          data: (books) {
            if (books.isEmpty) {
              return ListView(
                children: [
                  const SizedBox(height: 60),
                  EmptyView(
                    icon: Icons.menu_book_rounded,
                    title: query.search.isEmpty
                        ? 'No books published yet'
                        : 'No books match "${query.search}"',
                    message: query.search.isEmpty
                        ? 'New study material is added regularly — check back soon.'
                        : 'Try a different subject or clear the search.',
                    action: query.search.isEmpty
                        ? null
                        : OutlinedButton(
                            onPressed: () {
                              _searchController.clear();
                              ref
                                  .read(bookQueryProvider.notifier)
                                  .update((q) => q.copyWith(search: ''));
                              setState(() {});
                            },
                            child: const Text('Clear search'),
                          ),
                  ),
                ],
              );
            }

            if (isTablet) {
              final cols = Responsive.gridColumns(
                context,
                tabletPortrait: 2,
                tabletLandscape: 3,
              );
              return Responsive.centered(
                maxWidth: Responsive.maxContentWidth,
                child: GridView.builder(
                  padding: EdgeInsets.fromLTRB(
                    Responsive.horizontalPadding(context),
                    8,
                    Responsive.horizontalPadding(context),
                    24 + ShellScaffold.dockExtent,
                  ),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: cols,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                    mainAxisExtent: 146,
                  ),
                  itemCount: books.length,
                  itemBuilder: (context, index) {
                    final book = books[index];
                    return BookCard(
                      book: book,
                      onTap: () => context.push(AppRoutes.bookDetail(book.id)),
                    );
                  },
                ),
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                  16, 8, 16, 24 + ShellScaffold.dockExtent),
              itemCount: books.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final book = books[index];
                return BookCard(
                  book: book,
                  onTap: () => context.push(AppRoutes.bookDetail(book.id)),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

/// Shortcut to the offline library, badged with how many books are saved.
class _DownloadsAction extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(offlineLibraryProvider).length;

    return IconButton(
      tooltip: 'Downloaded books',
      onPressed: () => context.push(AppRoutes.downloads),
      icon: Badge(
        isLabelVisible: count > 0,
        label: Text('$count'),
        backgroundColor: AppColors.cyan,
        child: const Icon(Icons.download_for_offline_outlined),
      ),
    );
  }
}

class _BooksSkeleton extends StatelessWidget {
  const _BooksSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(
          16, 8, 16, 24 + ShellScaffold.dockExtent),
      itemCount: 6,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, __) => const GlassCard(
        padding: EdgeInsets.all(12),
        borderRadius: AppTheme.radiusLg,
        child: const Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SkeletonBox(
              width: 84,
              height: 122,
              radius: AppTheme.radiusMd,
            ),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonBox(width: 80, height: 18, radius: 6),
                  SizedBox(height: 8),
                  SkeletonBox(height: 15),
                  SizedBox(height: 6),
                  SkeletonBox(width: 140, height: 14),
                  SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      SkeletonBox(width: 70, height: 18, radius: 4),
                      SkeletonBox(width: 74, height: 28, radius: 8),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
