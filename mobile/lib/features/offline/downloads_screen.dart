import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/offline.dart';
import 'download_manager.dart';
import 'offline_providers.dart';
import 'widgets/download_button.dart';
import 'widgets/offline_cover.dart';

/// Everything saved to this device, and the state of each copy.
class DownloadsScreen extends ConsumerWidget {
  const DownloadsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final books = ref.watch(offlineLibraryProvider);
    final totalSize = ref.watch(offlineLibrarySizeProvider).valueOrNull ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Downloaded books'),
        actions: [
          IconButton(
            tooltip: 'Verify access',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              await ref.read(downloadManagerProvider.notifier).revalidateStale();
              messenger.showSnackBar(
                const SnackBar(content: Text('Offline access re-checked.')),
              );
            },
          ),
        ],
      ),
      body: books.isEmpty
          ? ListView(
              children: [
                const SizedBox(height: 60),
                EmptyView(
                  icon: Icons.download_for_offline_outlined,
                  title: 'No downloads yet',
                  message:
                      'Open a book you own and tap Download to keep it on this '
                      'device for reading without a connection.',
                  action: FilledButton(
                    onPressed: () => context.go(AppRoutes.books),
                    child: const Text('Browse your books'),
                  ),
                ),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
              itemCount: books.length + 1,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                if (index == 0) {
                  return _StorageSummary(
                    count: books.length,
                    totalBytes: totalSize,
                  );
                }
                return _DownloadRow(book: books[index - 1]);
              },
            ),
    );
  }
}

class _StorageSummary extends StatelessWidget {
  const _StorageSummary({required this.count, required this.totalBytes});

  final int count;
  final int totalBytes;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: AppColors.emerald.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            ),
            child: const Icon(Icons.sd_storage_rounded,
                color: AppColors.emerald, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Fmt.count(count, 'book'),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                Text(
                  'Stored encrypted on this device',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
              ],
            ),
          ),
          Text(
            formatBytes(totalBytes),
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
          ),
        ],
      ),
    );
  }
}

class _DownloadRow extends ConsumerWidget {
  const _DownloadRow({required this.book});

  final OfflineBook book;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final progress = ref.watch(downloadProgressProvider(book.bookId));
    final manager = ref.read(downloadManagerProvider.notifier);
    final status = progress.status == OfflineStatus.none
        ? book.status
        : progress.status;
    final readable = status == OfflineStatus.ready;

    return GlassCard(
      padding: const EdgeInsets.all(12),
      // A locked copy still opens its detail screen, where the reason and the
      // way out are explained — tapping through to a dead end would be worse.
      onTap: () => context.push(AppRoutes.bookDetail(book.bookId)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Opacity(
                opacity: readable ? 1 : 0.55,
                child: OfflineCover(book: book),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    OfflineStatusChip(
                      status: status,
                      fraction: progress.fraction,
                    ),
                    const SizedBox(height: 7),
                    Text(
                      book.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            height: 1.25,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      book.author,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: palette.textMuted,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _detail(status),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (status == OfflineStatus.downloading) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress.fraction,
                minHeight: 5,
                backgroundColor: palette.elevated,
                valueColor: const AlwaysStoppedAnimation(AppColors.cyan),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: readable
                    ? GradientButton(
                        label: 'Read offline',
                        icon: Icons.auto_stories_rounded,
                        compact: true,
                        onPressed: () =>
                            context.push(AppRoutes.bookReader(book.bookId)),
                      )
                    : OutlinedButton.icon(
                        onPressed: () => context.push(
                          AppRoutes.bookDetail(book.bookId),
                        ),
                        icon: const Icon(Icons.info_outline_rounded, size: 16),
                        label: Text(_actionLabel(status)),
                      ),
              ),
              const SizedBox(width: 10),
              IconButton(
                tooltip: 'Delete download',
                icon: const Icon(Icons.delete_outline_rounded, size: 20),
                style: IconButton.styleFrom(
                  foregroundColor: AppColors.rose,
                  side: BorderSide(color: palette.border),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  ),
                  padding: const EdgeInsets.all(11),
                ),
                onPressed: () => _confirmDelete(context, manager),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _detail(OfflineStatus status) {
    switch (status) {
      case OfflineStatus.expired:
        final validTill = book.lease.validTill;
        return validTill == null
            ? 'Access ended — connect to renew'
            : 'Access ended ${Fmt.date(validTill)}';
      case OfflineStatus.needsRevalidation:
        return 'Go online once to confirm your access';
      case OfflineStatus.paused:
        return 'Paused · ${formatBytes(book.totalBytes)} saved so far';
      case OfflineStatus.downloading:
        return 'Downloading…';
      default:
        final validTill = book.lease.validTill;
        final size = formatBytes(book.totalBytes);
        return validTill == null
            ? '$size · saved ${Fmt.relative(book.downloadedAt)}'
            : '$size · valid until ${Fmt.date(validTill)}';
    }
  }

  String _actionLabel(OfflineStatus status) => switch (status) {
        OfflineStatus.expired => 'Renew access',
        OfflineStatus.needsRevalidation => 'Verify access',
        OfflineStatus.paused => 'Resume download',
        OfflineStatus.failed => 'Retry download',
        _ => 'View book',
      };

  Future<void> _confirmDelete(
    BuildContext context,
    DownloadManager manager,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete "${book.title}"?'),
        content: const Text(
          'The offline files will be removed from this device. You can download '
          'the book again while your access is valid.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.rose),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok == true) await manager.remove(book.bookId);
  }
}
