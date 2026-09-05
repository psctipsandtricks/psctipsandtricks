import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/responsive.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/pagination_bar.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/mock_test.dart';
import 'mock_tests_providers.dart';
import '../shell/shell_scaffold.dart';

/// Scheduled live mock tests, grouped by section or filtered by status/pricing,
/// with instant search, chip filters, and full page-based navigation.
class MockTestsScreen extends ConsumerStatefulWidget {
  const MockTestsScreen({super.key});

  @override
  ConsumerState<MockTestsScreen> createState() => _MockTestsScreenState();
}

class _MockTestsScreenState extends ConsumerState<MockTestsScreen> {
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  Timer? _debounce;
  static const int _pageSize = 10;

  @override
  void initState() {
    super.initState();
    _searchController.text = ref.read(mockTestsSearchProvider);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      ref.read(mockTestsSearchProvider.notifier).state = value.trim();
      ref.read(mockTestsPageIndexProvider.notifier).state = 1;
    });
    setState(() {});
  }

  void _onFilterSelected(String filter) {
    ref.read(mockTestsFilterProvider.notifier).state = filter;
    ref.read(mockTestsPageIndexProvider.notifier).state = 1;
  }

  void _clearFilters() {
    _searchController.clear();
    ref.read(mockTestsSearchProvider.notifier).state = '';
    ref.read(mockTestsFilterProvider.notifier).state = 'All';
    ref.read(mockTestsPageIndexProvider.notifier).state = 1;
    setState(() {});
  }

  void _goToPage(int page) {
    ref.read(mockTestsPageIndexProvider.notifier).state = page;
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  void _goToCompletedPage(int page) {
    ref.read(completedMocksPageIndexProvider.notifier).state = page;
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final search = ref.watch(mockTestsSearchProvider);
    final filter = ref.watch(mockTestsFilterProvider);
    final page = ref.watch(mockTestsPageIndexProvider);
    final isFiltered = search.isNotEmpty || filter != 'All';

    return Scaffold(
      appBar: GlassAppBar(
        title: const Text('Mock tests'),
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
                    hintText: 'Search mock tests…',
                    onChanged: _onSearchChanged,
                    onClear: () {
                      ref.read(mockTestsSearchProvider.notifier).state = '';
                      ref.read(mockTestsPageIndexProvider.notifier).state = 1;
                    },
                  ),
                ),
                FilterChipsRow(
                  options: mockTestFilterOptions,
                  selected: filter,
                  onSelected: _onFilterSelected,
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          if (isFiltered) {
            ref.invalidate(allMockTestsProvider);
          } else {
            ref.invalidate(mockTestsViewProvider);
          }
        },
        child: isFiltered ? _buildFilteredView(search, filter, page) : _buildGroupedView(),
      ),
    );
  }

  Widget _buildFilteredView(String search, String filter, int page) {
    final filteredAsync = ref.watch(filteredMockTestsProvider);

    return AsyncView(
      value: filteredAsync,
      onRetry: () => ref.invalidate(allMockTestsProvider),
      data: (items) {
        if (items.isEmpty) {
          return ListView(
            children: [
              const SizedBox(height: 60),
              EmptyView(
                icon: Icons.search_off_rounded,
                title: 'No mock tests found',
                message: search.isNotEmpty
                    ? 'No tests match "$search" with filter "$filter".'
                    : 'No tests found in "$filter" category.',
                action: OutlinedButton(
                  onPressed: _clearFilters,
                  child: const Text('Clear filters'),
                ),
              ),
            ],
          );
        }

        final totalPages = (items.length / _pageSize).ceil().clamp(1, 9999);
        final clampedPage = page.clamp(1, totalPages);
        final startIndex = (clampedPage - 1) * _pageSize;
        final pageItems = items.skip(startIndex).take(_pageSize).toList();

        return ListView(
          controller: _scrollController,
          padding: const EdgeInsets.fromLTRB(
            16,
            12,
            16,
            28 + ShellScaffold.dockExtent,
          ),
          children: [
            for (final mock in pageItems)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _MockCard(mock: mock),
              ),
            if (items.length > _pageSize)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: PaginationBar(
                  currentPage: clampedPage,
                  totalPages: totalPages,
                  totalItems: items.length,
                  itemNoun: 'tests',
                  onPageChanged: _goToPage,
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildGroupedView() {
    final viewAsync = ref.watch(mockTestsViewProvider);

    return AsyncView(
      value: viewAsync,
      onRetry: () => ref.invalidate(mockTestsViewProvider),
      data: (view) {
        if (view.isEmpty) {
          return ListView(
            children: const [
              SizedBox(height: 60),
              EmptyView(
                icon: Icons.emoji_events_rounded,
                title: 'No mock tests scheduled',
                message:
                    'Live mock tests are announced ahead of time — watch this space.',
              ),
            ],
          );
        }

        final completed = view.completed;

        return ListView(
          controller: _scrollController,
          padding: const EdgeInsets.only(
            bottom: 28 + ShellScaffold.dockExtent,
          ),
          children: [
            const SizedBox(height: 10),
            if (view.live.isNotEmpty) ...[
              const SectionHeader(
                title: 'Live now',
                subtitle: 'Join before the window closes',
                icon: Icons.bolt_rounded,
              ),
              for (final mock in view.live)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: _MockCard(mock: mock),
                ),
              const SizedBox(height: 14),
            ],
            if (view.upcoming.isNotEmpty) ...[
              const SectionHeader(
                title: 'Upcoming',
                icon: Icons.schedule_rounded,
              ),
              for (final mock in view.upcoming)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: _MockCard(mock: mock),
                ),
              const SizedBox(height: 14),
            ],
            if (completed.totalItems > 0) ...[
              const SectionHeader(
                title: 'Completed',
                subtitle: 'Check where you placed',
                icon: Icons.leaderboard_rounded,
              ),
              for (final mock in completed.items)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: _MockCard(mock: mock),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                child: PaginationBar(
                  currentPage: completed.page,
                  totalPages: completed.totalPages,
                  totalItems: completed.totalItems,
                  itemNoun: 'tests',
                  onPageChanged: _goToCompletedPage,
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}


class _MockCard extends StatelessWidget {
  const _MockCard({required this.mock});

  final MockTest mock;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final (accent, label) = switch (mock.status) {
      MockTestStatus.live => (AppColors.emerald, 'LIVE NOW'),
      MockTestStatus.upcoming => (
          AppColors.amber,
          Fmt.untilStart(mock.startsIn).toUpperCase()
        ),
      MockTestStatus.completed => (AppColors.indigo, 'COMPLETED'),
    };

    return GlassCard(
      onTap: () => context.push(AppRoutes.mockTest(mock.id)),
      highlighted: mock.isLive,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                ),
                child: Icon(Icons.emoji_events_rounded, color: accent, size: 19),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  mock.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        height: 1.3,
                      ),
                ),
              ),
              const SizedBox(width: 8),
              AppBadge(label, color: accent),
            ],
          ),
          // A premium test has to read as premium from the listing. Without
          // this the card is indistinguishable from a free one and the student
          // only meets the paywall after tapping through to it.
          if (mock.isPaid) ...[
            const SizedBox(height: 11),
            Row(
              children: [
                if (mock.isLocked)
                  AppBadge(
                    Fmt.price(mock.price),
                    color: AppColors.amber,
                    icon: Icons.lock_rounded,
                  )
                else
                  const AppBadge(
                    'UNLOCKED',
                    color: AppColors.emerald,
                    icon: Icons.lock_open_rounded,
                  ),
              ],
            ),
          ],
          const SizedBox(height: 13),
          Row(
            children: [
              Icon(Icons.event_rounded, size: 13, color: palette.textMuted),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  Fmt.dateTime(mock.scheduledAt),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
              ),
              if (mock.quiz != null) ...[
                Icon(Icons.help_outline_rounded,
                    size: 13, color: palette.textMuted),
                const SizedBox(width: 4),
                Text(
                  '${mock.quiz!.totalQuestions} Qs',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
                const SizedBox(width: 10),
                Icon(Icons.timer_outlined, size: 13, color: palette.textMuted),
                const SizedBox(width: 4),
                Text(
                  '${mock.quiz!.durationMinutes}m',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
