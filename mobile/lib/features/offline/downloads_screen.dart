import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/connectivity_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../data/models/offline.dart';
import 'download_manager.dart';
import 'offline_providers.dart';
import 'widgets/download_button.dart';
import 'widgets/offline_cover.dart';
import '../shell/shell_scaffold.dart';

/// Everything saved to this device, and the state of each copy.
class DownloadsScreen extends ConsumerWidget {
  const DownloadsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOffline = ref.watch(connectivityProvider).valueOrNull == false;

    return Scaffold(
      appBar: GlassAppBar(
        title: const Text('Downloaded books'),
        automaticallyImplyLeading: !isOffline,
        leading: isOffline ? const SizedBox.shrink() : null,
        actions: [
          IconButton(
            tooltip: 'Verify access',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              // Re-checking is a server call; saying "re-checked" with no
              // connection would be a lie, and an alarming one on a screen
              // where a locked book is the thing being explained.
              if (isOffline) {
                messenger.showSnackBar(
                  const SnackBar(
                    content: Text(
                      "You're offline — connect to re-check your access.",
                    ),
                  ),
                );
                return;
              }
              final removed = await ref
                  .read(downloadManagerProvider.notifier)
                  .revalidateStale();
              messenger.showSnackBar(
                SnackBar(
                  content: Text(
                    removed.isEmpty
                        ? 'Offline access re-checked.'
                        : removed.length == 1
                            ? '"${removed.first}" was removed — your access has ended.'
                            : '${removed.length} downloads were removed — access has ended.',
                  ),
                ),
              );
            },
          ),
        ],
      ),
      body: const DownloadsList(),
    );
  }
}

/// The downloaded books themselves, without a scaffold of their own.
///
/// Shared with the Library tab, which leads with what is already on the device
/// — those are the only books that open with no network at all.
class DownloadsList extends ConsumerWidget {
  const DownloadsList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final books = ref.watch(offlineLibraryProvider);
    final totalSize = ref.watch(offlineLibrarySizeProvider).valueOrNull ?? 0;
    final isOffline = ref.watch(connectivityProvider).valueOrNull == false;

    if (books.isEmpty) {
      return _DownloadsEmptyView(isOffline: isOffline);
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(
          16, 16, 16, 24 + ShellScaffold.dockExtent),
      itemCount: books.length + 1,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        if (index == 0) {
          return Column(
            children: [
              if (isOffline) ...[
                const _OfflineBanner(),
                const SizedBox(height: 12),
              ],
              _StorageSummary(
                count: books.length,
                totalBytes: totalSize,
                onRevalidate: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  if (isOffline) {
                    messenger.showSnackBar(
                      const SnackBar(
                        content: Text("You're offline — connect to re-check your access."),
                      ),
                    );
                    return;
                  }
                  final removed = await ref
                      .read(downloadManagerProvider.notifier)
                      .revalidateStale();
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(
                        removed.isEmpty
                            ? 'Offline access re-checked.'
                            : '${removed.length} expired downloads removed.',
                      ),
                    ),
                  );
                },
              ),
            ],
          );
        }
        return _DownloadRow(book: books[index - 1], isOffline: isOffline);
      },
    );
  }
}

/// Premium empty state for the downloads vault with glowing illustration and benefit cards.
class _DownloadsEmptyView extends StatelessWidget {
  const _DownloadsEmptyView({required this.isOffline});

  final bool isOffline;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 32 + ShellScaffold.dockExtent),
      children: [
        const SizedBox(height: 12),
        // Luminous Hero Illustration
        Center(
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Ambient soft glow
              Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      (isOffline ? AppColors.amber : AppColors.cyan)
                          .withValues(alpha: palette.isDark ? 0.24 : 0.14),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
              // Outer glass ring
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: (isOffline ? AppColors.amber : AppColors.cyan)
                      .withValues(alpha: 0.08),
                  border: Border.all(
                    color: (isOffline ? AppColors.amber : AppColors.cyan)
                        .withValues(alpha: 0.28),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: (isOffline ? AppColors.amber : AppColors.cyan)
                          .withValues(alpha: 0.18),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: Center(
                  child: Container(
                    width: 70,
                    height: 70,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: palette.isDark
                            ? [
                                const Color(0xFF132842),
                                const Color(0xFF091424),
                              ]
                            : [
                                Colors.white,
                                const Color(0xFFE2E8F0),
                              ],
                      ),
                      border: Border.all(
                        color: (isOffline ? AppColors.amber : AppColors.cyan)
                            .withValues(alpha: 0.4),
                        width: 1,
                      ),
                    ),
                    child: Icon(
                      isOffline
                          ? Icons.cloud_off_rounded
                          : Icons.cloud_download_rounded,
                      size: 34,
                      color: isOffline ? AppColors.amber : AppColors.cyan,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Title & Description
        Text(
          isOffline ? "You're Offline" : 'Your Offline Study Vault',
          textAlign: TextAlign.center,
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w900,
            letterSpacing: -0.4,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          isOffline
              ? 'Connect to the internet to download PSC books, chapter notes, and video materials for offline reading.'
              : 'Keep your books and study notes saved on this device to study anytime with zero mobile data.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: palette.textSecondary,
            height: 1.45,
            fontSize: 13.5,
          ),
        ),
        const SizedBox(height: 24),

        // Frosted Glass Benefits Card
        const GlassCard(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Column(
            children: [
              _BenefitRow(
                icon: Icons.bolt_rounded,
                iconColor: AppColors.cyan,
                title: 'Zero Data Needed',
                subtitle: 'Instant reading with no buffering or network lag',
              ),
              Padding(
                padding: EdgeInsets.symmetric(vertical: 10),
                child: Divider(height: 1, thickness: 0.6),
              ),
              _BenefitRow(
                icon: Icons.headphones_rounded,
                iconColor: AppColors.indigo,
                title: 'Offline Audio Lessons',
                subtitle: 'Listen to chapter summaries anywhere on the go',
              ),
              Padding(
                padding: EdgeInsets.symmetric(vertical: 10),
                child: Divider(height: 1, thickness: 0.6),
              ),
              _BenefitRow(
                icon: Icons.lock_outline_rounded,
                iconColor: AppColors.emerald,
                title: 'Encrypted & Fast',
                subtitle: 'Direct local access with ultra-fast page flips',
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Action CTA
        if (!isOffline)
          GradientButton(
            label: 'Browse PSC Books',
            icon: Icons.auto_stories_rounded,
            onPressed: () => context.go(AppRoutes.books),
          )
        else
          Center(
            child: OutlinedButton.icon(
              onPressed: () => context.go(AppRoutes.books),
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Try Reconnecting'),
            ),
          ),
      ],
    );
  }
}

class _BenefitRow extends StatelessWidget {
  const _BenefitRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            border: Border.all(
              color: iconColor.withValues(alpha: 0.25),
              width: 0.8,
            ),
          ),
          child: Icon(icon, color: iconColor, size: 18),
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.1,
                    ),
              ),
              const SizedBox(height: 1),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: palette.textMuted,
                      height: 1.3,
                      fontSize: 11.5,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Standing notice while the device has no network, so a locked or missing
/// book reads as "no connection" rather than "something is broken".
class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.amber.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(color: AppColors.amber.withValues(alpha: 0.30)),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, size: 18, color: AppColors.amber),
          const SizedBox(width: 11),
          Expanded(
            child: Text(
              "You're offline. Books saved here are ready to read.",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.palette.textSecondary,
                    height: 1.4,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StorageSummary extends StatelessWidget {
  const _StorageSummary({
    required this.count,
    required this.totalBytes,
    this.onRevalidate,
  });

  final int count;
  final int totalBytes;
  final VoidCallback? onRevalidate;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.emerald.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(
                color: AppColors.emerald.withValues(alpha: 0.3),
                width: 1,
              ),
            ),
            child: const Icon(Icons.sd_storage_rounded,
                color: AppColors.emerald, size: 20),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      Fmt.count(count, 'book'),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: AppColors.emerald.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'Ready',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.emerald,
                              fontWeight: FontWeight.w800,
                              fontSize: 10,
                            ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  'Encrypted offline vault',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatBytes(totalBytes),
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
              ),
              if (onRevalidate != null)
                GestureDetector(
                  onTap: onRevalidate,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      'Re-verify',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: AppColors.cyan,
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                          ),
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

class _DownloadRow extends ConsumerWidget {
  const _DownloadRow({required this.book, required this.isOffline});

  final OfflineBook book;
  final bool isOffline;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final progress = ref.watch(downloadProgressProvider(book.bookId));
    final manager = ref.read(downloadManagerProvider.notifier);
    final status = progress.status == OfflineStatus.none
        ? book.status
        : progress.status;
    final readable = status == OfflineStatus.ready && !book.lease.isExpired;

    return GlassCard(
      padding: const EdgeInsets.all(12),
      // A readable copy opens straight into the reader — that is the whole
      // point of the row, and offline it is the only destination that works
      // at all. Anything else goes to the detail screen, where the reason and
      // the way out are explained, unless there is no connection to load it
      // with; then the row says so instead of dead-ending on a retry button.
      onTap: () {
        if (book.lease.isExpired) {
          manager.remove(book.bookId);
          _openDetail(context);
        } else if (readable) {
          context.push(AppRoutes.bookReader(book.bookId));
        } else {
          _openDetail(context);
        }
      },
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
                      _detail(status, progress.receivedBytes),
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
                        onPressed: () {
                          if (book.lease.isExpired) {
                            manager.remove(book.bookId);
                          }
                          _openDetail(context);
                        },
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

  /// The book's detail screen, which is where every fix for a paused, expired
  /// or unverified copy lives. It is loaded from the server, so offline it is
  /// replaced by an explanation rather than a spinner that never resolves.
  void _openDetail(BuildContext context) {
    if (isOffline) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "You're offline. Connect to the internet to finish or renew "
            'this download.',
          ),
        ),
      );
      return;
    }
    context.push(AppRoutes.bookDetail(book.bookId));
  }

  String _detail(OfflineStatus status, int savedBytes) {
    switch (status) {
      case OfflineStatus.expired:
        final validTill = book.lease.validTill;
        return validTill == null
            ? 'Access ended — connect to renew'
            : 'Access ended ${Fmt.date(validTill)}';
      case OfflineStatus.needsRevalidation:
        return 'Go online once to confirm your access';
      case OfflineStatus.paused:
        return 'Paused · ${formatBytes(savedBytes)} saved so far';
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
    final ok = await showGlassConfirm(
      context,
      title: 'Delete "${book.title}"?',
      message: 'The offline files will be removed from this device. You can '
          'download the book again while your access is valid.',
      cancelLabel: 'Keep',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (ok) await manager.remove(book.bookId);
  }
}
