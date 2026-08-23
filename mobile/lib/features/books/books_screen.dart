import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import 'books_providers.dart';
import 'widgets/book_card.dart';

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

    return Scaffold(
      appBar: AppBar(
        title: const Text('E-Books'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(104),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: AppSearchField(
                  controller: _searchController,
                  hintText: 'Search books, authors, subjects…',
                  onChanged: _onSearchChanged,
                ),
              ),
              FilterChipsRow(
                options: categories,
                selected: query.category,
                onSelected: (value) => ref
                    .read(bookQueryProvider.notifier)
                    .update((q) => q.copyWith(category: value)),
              ),
              const SizedBox(height: 12),
            ],
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

            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
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

class _BooksSkeleton extends StatelessWidget {
  const _BooksSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      itemCount: 6,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, __) => const GlassCard(
        padding: EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SkeletonBox(
              width: 76,
              height: 110,
              radius: AppTheme.radiusMd,
            ),
            SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonBox(width: 70, height: 18, radius: 6),
                  SizedBox(height: 10),
                  SkeletonBox(height: 15),
                  SizedBox(height: 7),
                  SkeletonBox(width: 150, height: 15),
                  SizedBox(height: 16),
                  SkeletonBox(width: 60, height: 16),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
