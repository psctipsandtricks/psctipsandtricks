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
import '../../core/widgets/state_views.dart';
import '../../data/models/order.dart';

final myOrdersProvider = FutureProvider.autoDispose<List<Order>>((ref) async {
  ref.keepAlive();
  return ref.watch(ordersRepositoryProvider).fetchMyOrders();
});

/// Everything the student has bought — books and premium question banks.
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(myOrdersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(myOrdersProvider.future),
        child: AsyncView(
          value: ordersAsync,
          onRetry: () => ref.invalidate(myOrdersProvider),
          data: (orders) {
            if (orders.isEmpty) {
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

            final sorted = [...orders]..sort(
                (a, b) => (b.createdAt ?? DateTime(0))
                    .compareTo(a.createdAt ?? DateTime(0)),
              );

            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
              itemCount: sorted.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) => _OrderCard(order: sorted[index]),
            );
          },
        ),
      ),
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
                BookCover(url: order.bookCoverUrl, width: 46)
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
