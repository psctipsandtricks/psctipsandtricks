import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/liquid_glass.dart';
import '../../../data/models/book.dart';
import '../../../data/models/offline.dart';
import '../offline_providers.dart';

/// The offline control on a book's detail screen.
///
/// Only ever rendered for a book the API says the student currently has access
/// to; the server is asked again when the button is pressed, so this is a
/// convenience gate rather than the security one.
class BookDownloadPanel extends ConsumerWidget {
  const BookDownloadPanel({super.key, required this.book});

  final Book book;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = ref.watch(downloadProgressProvider(book.id));
    final offline = ref.watch(offlineBookProvider(book.id));
    final manager = ref.read(downloadManagerProvider.notifier);

    switch (progress.status) {
      case OfflineStatus.downloading:
        return _Downloading(
          progress: progress,
          onPause: () => manager.pause(book.id),
        );

      case OfflineStatus.paused:
        return _Panel(
          icon: Icons.pause_circle_outline_rounded,
          color: AppColors.amber,
          title: 'Download paused',
          subtitle: progress.totalAssets > 0
              ? '${progress.completedAssets} of ${progress.totalAssets} files saved · resumes where it stopped'
              : 'Resumes where it stopped',
          primaryLabel: 'Resume',
          primaryIcon: Icons.play_arrow_rounded,
          onPrimary: () => manager.download(book),
          onDelete: () => _confirmDelete(context, ref),
        );

      case OfflineStatus.ready:
        return _Panel(
          icon: Icons.offline_pin_rounded,
          color: AppColors.emerald,
          title: 'Available offline',
          subtitle: _readySubtitle(offline),
          primaryLabel: 'Remove download',
          primaryIcon: Icons.delete_outline_rounded,
          onPrimary: () => _confirmDelete(context, ref),
          subdued: true,
        );

      case OfflineStatus.needsRevalidation:
        return _Panel(
          icon: Icons.wifi_tethering_rounded,
          color: AppColors.amber,
          title: 'Connect to keep reading offline',
          subtitle:
              'It has been a while since we checked your access. Go online once to unlock this copy again.',
          primaryLabel: 'Verify now',
          primaryIcon: Icons.refresh_rounded,
          onPrimary: () => _revalidate(context, ref),
          onDelete: () => _confirmDelete(context, ref),
        );

      case OfflineStatus.expired:
        return _Panel(
          icon: Icons.lock_clock_rounded,
          color: AppColors.rose,
          title: 'Offline access expired',
          subtitle: offline?.lease.validTill != null
              ? 'Your access ended on ${Fmt.date(offline!.lease.validTill)}. Renew to read this book again.'
              : 'Your access to this book has ended. Renew to read it again.',
          primaryLabel: 'Check again',
          primaryIcon: Icons.refresh_rounded,
          onPrimary: () => _revalidate(context, ref),
          onDelete: () => _confirmDelete(context, ref),
        );

      case OfflineStatus.failed:
        return _Panel(
          icon: Icons.error_outline_rounded,
          color: AppColors.rose,
          title: 'Download failed',
          subtitle: progress.error ?? 'Something interrupted the download.',
          primaryLabel: 'Try again',
          primaryIcon: Icons.refresh_rounded,
          onPrimary: () => manager.download(book),
          onDelete: () => _confirmDelete(context, ref),
        );

      case OfflineStatus.none:
        return _Panel(
          icon: Icons.download_for_offline_outlined,
          color: AppColors.cyan,
          title: 'Read offline',
          subtitle:
              'Save the chapters, audio lessons and notes to this device. Video classes still stream.',
          primaryLabel: 'Download',
          primaryIcon: Icons.download_rounded,
          onPrimary: () => manager.download(book),
        );
    }
  }

  String _readySubtitle(OfflineBook? offline) {
    if (offline == null) return 'Saved to this device.';
    final size = formatBytes(offline.totalBytes);
    final validTill = offline.lease.validTill;
    if (validTill != null) {
      return '$size on this device · access valid until ${Fmt.date(validTill)}';
    }
    return '$size on this device · ready to read without a connection';
  }

  Future<void> _revalidate(BuildContext context, WidgetRef ref) async {
    final status =
        await ref.read(downloadManagerProvider.notifier).revalidate(book.id);
    if (!context.mounted) return;

    final message = switch (status) {
      OfflineStatus.ready => 'Access confirmed — this book is ready offline.',
      OfflineStatus.expired =>
        'Your access to this book has ended. Renew to read it again.',
      _ => 'Could not reach the server. Check your connection and try again.',
    };
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final ok = await showGlassConfirm(
      context,
      title: 'Remove offline copy?',
      message: 'The files will be deleted from this device. You can download '
          'the book again at any time while your access is valid.',
      cancelLabel: 'Keep',
      confirmLabel: 'Remove',
      destructive: true,
    );
    if (!ok) return;
    await ref.read(downloadManagerProvider.notifier).remove(book.id);
  }
}

class _Downloading extends StatelessWidget {
  const _Downloading({required this.progress, required this.onPause});

  final DownloadProgress progress;
  final VoidCallback onPause;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final fraction = progress.fraction;

    return GlassCard(
      borderColor: AppColors.cyan.withValues(alpha: 0.4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: AppColors.cyan.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                ),
                child: const Icon(Icons.downloading_rounded,
                    color: AppColors.cyan, size: 19),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Downloading…',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    Text(
                      progress.totalAssets > 0
                          ? 'File ${progress.completedAssets + 1} of ${progress.totalAssets} · ${formatBytes(progress.receivedBytes)}'
                          : 'Preparing…',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                          ),
                    ),
                  ],
                ),
              ),
              if (fraction != null)
                Text(
                  '${(fraction * 100).round()}%',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: AppColors.cyan,
                      ),
                ),
            ],
          ),
          const SizedBox(height: 13),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 6,
              backgroundColor: palette.elevated,
              valueColor: const AlwaysStoppedAnimation(AppColors.cyan),
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onPause,
            icon: const Icon(Icons.pause_rounded, size: 17),
            label: const Text('Pause'),
          ),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.primaryLabel,
    required this.primaryIcon,
    required this.onPrimary,
    this.onDelete,
    this.subdued = false,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final String primaryLabel;
  final IconData primaryIcon;
  final VoidCallback onPrimary;
  final VoidCallback? onDelete;

  /// Renders the action as a quiet outline rather than a gradient — used for
  /// "remove", which should not compete with the reading button above it.
  final bool subdued;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return GlassCard(
      borderColor: color.withValues(alpha: 0.38),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                ),
                child: Icon(icon, color: color, size: 19),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: palette.textSecondary,
                            height: 1.45,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: subdued
                    ? OutlinedButton.icon(
                        onPressed: onPrimary,
                        icon: Icon(primaryIcon, size: 17),
                        label: Text(primaryLabel),
                      )
                    : GradientButton(
                        label: primaryLabel,
                        icon: primaryIcon,
                        compact: true,
                        gradient: color == AppColors.cyan
                            ? AppColors.brandGradient
                            : LinearGradient(
                                colors: [color, color.withValues(alpha: 0.75)],
                              ),
                        onPressed: onPrimary,
                      ),
              ),
              if (onDelete != null) ...[
                const SizedBox(width: 10),
                IconButton(
                  tooltip: 'Remove offline copy',
                  onPressed: onDelete,
                  icon: const Icon(Icons.delete_outline_rounded, size: 20),
                  style: IconButton.styleFrom(
                    foregroundColor: AppColors.rose,
                    side: BorderSide(color: palette.border),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    ),
                    padding: const EdgeInsets.all(12),
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

/// Small chip for list rows — the Downloads screen and the catalog.
class OfflineStatusChip extends StatelessWidget {
  const OfflineStatusChip({super.key, required this.status, this.fraction});

  final OfflineStatus status;
  final double? fraction;

  @override
  Widget build(BuildContext context) {
    final (color, label, icon) = switch (status) {
      OfflineStatus.ready => (
          AppColors.emerald,
          'DOWNLOADED',
          Icons.offline_pin_rounded
        ),
      OfflineStatus.downloading => (
          AppColors.cyan,
          fraction == null
              ? 'DOWNLOADING'
              : 'DOWNLOADING ${(fraction! * 100).round()}%',
          Icons.downloading_rounded
        ),
      OfflineStatus.paused => (
          AppColors.amber,
          'PAUSED',
          Icons.pause_circle_outline_rounded
        ),
      OfflineStatus.expired => (
          AppColors.rose,
          'ACCESS EXPIRED',
          Icons.lock_clock_rounded
        ),
      OfflineStatus.needsRevalidation => (
          AppColors.amber,
          'VERIFY ACCESS',
          Icons.wifi_tethering_rounded
        ),
      OfflineStatus.failed => (
          AppColors.rose,
          'FAILED',
          Icons.error_outline_rounded
        ),
      OfflineStatus.none => (AppColors.cyan, 'NOT SAVED', Icons.cloud_outlined),
    };

    return AppBadge(label, color: color, icon: icon);
  }
}
