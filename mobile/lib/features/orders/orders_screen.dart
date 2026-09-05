import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/pagination_bar.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/order.dart';
import '../../data/models/paginated.dart';
import '../shell/shell_scaffold.dart';

/// What the type filter narrows the order list down to.
enum _OrderTypeFilter { all, books, quizzes }

const _typeFilterOptions = ['All', 'Books', 'Question Banks'];

_OrderTypeFilter _typeFilterFromLabel(String label) {
  switch (label) {
    case 'Books':
      return _OrderTypeFilter.books;
    case 'Question Banks':
      return _OrderTypeFilter.quizzes;
    default:
      return _OrderTypeFilter.all;
  }
}

String _labelForTypeFilter(_OrderTypeFilter filter) {
  switch (filter) {
    case _OrderTypeFilter.books:
      return 'Books';
    case _OrderTypeFilter.quizzes:
      return 'Question Banks';
    case _OrderTypeFilter.all:
      return 'All';
  }
}

/// Everything the student has bought — books and premium question banks.
///
/// Browsing plain history pages the server — a real request per page, which is
/// what earns the loading state on a page tap. The moment a search term or type
/// filter is active there is no server endpoint to ask "search across every
/// order", so the full history is fetched once and filtered/paged in memory;
/// switching pages within a search is then instant, no fetch to wait on.
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  static const _pageSize = 10;

  final _scrollController = ScrollController();
  final _searchController = TextEditingController();

  // Plain (unfiltered) browsing: one server-paginated page at a time.
  Paginated<Order>? _serverPage;
  bool _initialLoading = true;
  bool _pageLoading = false;
  Object? _pageError;

  // Search / filter mode: the whole history, fetched once and cached.
  List<Order>? _allOrders;
  bool _loadingAll = false;
  Object? _allError;

  String _search = '';
  _OrderTypeFilter _typeFilter = _OrderTypeFilter.all;
  int _filteredPageIndex = 1;

  bool get _filterActive =>
      _search.trim().isNotEmpty || _typeFilter != _OrderTypeFilter.all;

  @override
  void initState() {
    super.initState();
    _loadServerPage(1, showFullLoader: true);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _scrollToTop() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _loadServerPage(int page, {bool showFullLoader = false}) async {
    setState(() {
      if (showFullLoader) {
        _initialLoading = true;
      } else {
        _pageLoading = true;
      }
      _pageError = null;
    });
    try {
      final result = await ref
          .read(ordersRepositoryProvider)
          .fetchMyOrdersPage(page: page, limit: _pageSize);
      if (!mounted) return;
      setState(() {
        _serverPage = result;
        _initialLoading = false;
        _pageLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _pageError = e;
        _initialLoading = false;
        _pageLoading = false;
      });
    }
  }

  /// Fetches the full order history once, for search/filter to run over. A
  /// cached copy is reused across filter changes — only cleared on refresh.
  Future<void> _ensureAllOrdersLoaded() async {
    if (_allOrders != null || _loadingAll) return;
    setState(() {
      _loadingAll = true;
      _allError = null;
    });
    try {
      final all = await ref.read(ordersRepositoryProvider).fetchMyOrders();
      if (!mounted) return;
      setState(() {
        _allOrders = all;
        _loadingAll = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _allError = e;
        _loadingAll = false;
      });
    }
  }

  Future<void> _refresh() async {
    _allOrders = null;
    if (_filterActive) {
      await _ensureAllOrdersLoaded();
    } else {
      await _loadServerPage(1, showFullLoader: _serverPage == null);
    }
  }

  Future<void> _goToPage(int page) async {
    if (_filterActive) {
      if (page == _filteredPageIndex) return;
      setState(() => _filteredPageIndex = page);
      _scrollToTop();
      return;
    }
    if (_serverPage != null && page == _serverPage!.page) return;
    if (_pageLoading) return;
    await _loadServerPage(page);
    _scrollToTop();
  }

  void _onSearchChanged(String value) {
    setState(() {
      _search = value;
      _filteredPageIndex = 1;
    });
    if (_filterActive) unawaited(_ensureAllOrdersLoaded());
  }

  void _onTypeFilterChanged(String label) {
    final next = _typeFilterFromLabel(label);
    if (next == _typeFilter) return;
    setState(() {
      _typeFilter = next;
      _filteredPageIndex = 1;
    });
    if (_filterActive) {
      unawaited(_ensureAllOrdersLoaded());
    }
  }

  void _clearFilters() {
    setState(() {
      _search = '';
      _searchController.clear();
      _typeFilter = _OrderTypeFilter.all;
      _filteredPageIndex = 1;
    });
  }

  List<Order> get _matchingOrders {
    final all = _allOrders;
    if (all == null) return const [];
    final term = _search.trim().toLowerCase();
    return all.where((o) {
      final matchesType = switch (_typeFilter) {
        _OrderTypeFilter.all => true,
        _OrderTypeFilter.books => o.isBook,
        _OrderTypeFilter.quizzes => !o.isBook,
      };
      final matchesSearch = term.isEmpty ||
          o.itemTitle.toLowerCase().contains(term) ||
          (o.razorpayPaymentId?.toLowerCase().contains(term) ?? false);
      return matchesType && matchesSearch;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: GlassAppBar(
        title: const Text('My orders'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(94),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: AppSearchField(
                    controller: _searchController,
                    hintText: 'Search by book or question bank title…',
                    onChanged: _onSearchChanged,
                  ),
                ),
                const SizedBox(height: 10),
                FilterChipsRow(
                  options: _typeFilterOptions,
                  selected: _labelForTypeFilter(_typeFilter),
                  onSelected: _onTypeFilterChanged,
                ),
              ],
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: _filterActive ? _buildFilteredBody(context) : _buildServerBody(context),
      ),
    );
  }

  Widget _buildServerBody(BuildContext context) {
    if (_initialLoading) return const _OrdersListSkeleton();
    if (_pageError != null && _serverPage == null) {
      return ErrorView(
        error: _pageError!,
        onRetry: () => _loadServerPage(1, showFullLoader: true),
      );
    }

    final page = _serverPage;
    if (page == null) return const _OrdersListSkeleton();

    if (page.totalItems == 0) {
      return ListView(
        children: [
          const SizedBox(height: 60),
          EmptyView(
            icon: Icons.receipt_long_rounded,
            title: 'No purchases yet',
            message:
                'Books and premium question banks you unlock will be listed here.',
            action: FilledButton(
              onPressed: () => context.go(AppRoutes.books),
              child: const Text('Browse the catalog'),
            ),
          ),
        ],
      );
    }

    return Stack(
      children: [
        AbsorbPointer(
          absorbing: _pageLoading,
          child: ListView.separated(
            controller: _scrollController,
            padding: const EdgeInsets.fromLTRB(
                16, 14, 16, 24 + ShellScaffold.dockExtent),
            itemCount: page.items.length + 1,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              if (index == page.items.length) {
                return Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: PaginationBar(
                    currentPage: page.page,
                    totalPages: page.totalPages,
                    totalItems: page.totalItems,
                    itemNoun: 'orders',
                    onPageChanged: _goToPage,
                  ),
                );
              }
              return _OrderCard(order: page.items[index]);
            },
          ),
        ),
        if (_pageLoading) const _PageLoadingOverlay(),
      ],
    );
  }

  Widget _buildFilteredBody(BuildContext context) {
    if (_loadingAll && _allOrders == null) return const _OrdersListSkeleton();
    if (_allError != null && _allOrders == null) {
      return ErrorView(error: _allError!, onRetry: _ensureAllOrdersLoaded);
    }

    final matches = _matchingOrders;
    if (matches.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 60),
          EmptyView(
            icon: Icons.search_off_rounded,
            title: 'No matching orders',
            message: 'Try a different search term, or clear the filter.',
            action: OutlinedButton(
              onPressed: _clearFilters,
              child: const Text('Clear filters'),
            ),
          ),
        ],
      );
    }

    final totalPages = (matches.length / _pageSize).ceil().clamp(1, 1 << 30);
    final page = _filteredPageIndex.clamp(1, totalPages);
    final start = (page - 1) * _pageSize;
    final end = (start + _pageSize).clamp(0, matches.length);
    final pageItems = matches.sublist(start, end);

    return ListView.separated(
      controller: _scrollController,
      padding: const EdgeInsets.fromLTRB(
          16, 14, 16, 24 + ShellScaffold.dockExtent),
      itemCount: pageItems.length + 1,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        if (index == pageItems.length) {
          return Padding(
            padding: const EdgeInsets.only(top: 12),
            child: PaginationBar(
              currentPage: page,
              totalPages: totalPages,
              totalItems: matches.length,
              itemNoun: 'matching orders',
              onPageChanged: _goToPage,
            ),
          );
        }
        return _OrderCard(order: pageItems[index]);
      },
    );
  }
}

/// A short, deliberately unobtrusive loading state for switching between
/// already-known server pages — the list underneath stays visible (dimmed)
/// rather than being replaced by a full-screen skeleton.
class _PageLoadingOverlay extends StatelessWidget {
  const _PageLoadingOverlay();

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Positioned.fill(
      child: IgnorePointer(
        child: ColoredBox(
          color: palette.background.withValues(alpha: 0.72),
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: palette.card,
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                border: Border.all(color: palette.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.18),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Loading page…',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: palette.textSecondary,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OrdersListSkeleton extends StatelessWidget {
  const _OrdersListSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
      children: const [
        SkeletonBox(height: 92, radius: AppTheme.radiusMd),
        SizedBox(height: 12),
        SkeletonBox(height: 92, radius: AppTheme.radiusMd),
        SizedBox(height: 12),
        SkeletonBox(height: 92, radius: AppTheme.radiusMd),
        SizedBox(height: 12),
        SkeletonBox(height: 92, radius: AppTheme.radiusMd),
      ],
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});

  final Order order;

  (Color, String, IconData) get _status {
    switch (order.status) {
      case OrderStatus.success:
        return (AppColors.emerald, 'PAID', Icons.check_circle_rounded);
      case OrderStatus.pending:
        return (AppColors.amber, 'PENDING', Icons.hourglass_top_rounded);
      case OrderStatus.failed:
        return (AppColors.rose, 'FAILED', Icons.cancel_rounded);
      case OrderStatus.refunded:
        return (AppColors.indigo, 'REFUNDED', Icons.undo_rounded);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final status = _status;
    final unlocked = order.status == OrderStatus.success;

    return GlassCard(
      onTap: unlocked && order.isBook
          ? () => context.push(AppRoutes.bookDetail(order.bookId!))
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (order.isBook)
                BookCover(
                  url: order.bookArtworkUrl,
                  width: 46,
                  aspectRatio: 3 / 2,
                )
              else
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: AppColors.amber.withValues(alpha: 0.13),
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  child: const Icon(Icons.workspace_premium_rounded,
                      color: AppColors.amber, size: 21),
                ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.itemTitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            height: 1.3,
                          ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      Fmt.dateTime(order.createdAt),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                Fmt.amount(order.amount),
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              AppBadge(status.$2, color: status.$1, icon: status.$3),
              const Spacer(),
              if (order.razorpayPaymentId != null)
                Flexible(
                  child: Text(
                    order.razorpayPaymentId!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: palette.textMuted,
                          fontSize: 10,
                        ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
