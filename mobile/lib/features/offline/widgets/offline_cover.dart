import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/offline.dart';
import '../offline_providers.dart';

/// A downloaded book's cover, read back out of the encrypted vault.
///
/// Decryption is asynchronous, so the widget paints a neutral placeholder first
/// and swaps the image in — the alternative, blocking the list build on file
/// IO, would stutter the Downloads screen on every scroll.
class OfflineCover extends ConsumerStatefulWidget {
  const OfflineCover({super.key, required this.book, this.width = 62});

  final OfflineBook book;
  final double width;

  @override
  ConsumerState<OfflineCover> createState() => _OfflineCoverState();
}

class _OfflineCoverState extends ConsumerState<OfflineCover> {
  File? _file;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant OfflineCover oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.book.coverAssetId != widget.book.coverAssetId) _load();
  }

  Future<void> _load() async {
    final asset = widget.book.assets.cast<OfflineAsset?>().firstWhere(
          (a) => a?.id == widget.book.coverAssetId && a!.complete,
          orElse: () => null,
        );
    if (asset == null) return;

    final file = await ref.read(offlineRepositoryProvider).openAsset(
          widget.book.bookId,
          asset,
        );
    if (mounted) setState(() => _file = file);
  }

  @override
  Widget build(BuildContext context) {
    final height = widget.width * 1.45;
    final radius = BorderRadius.circular(AppTheme.radiusMd);
    final file = _file;

    return ClipRRect(
      borderRadius: radius,
      child: SizedBox(
        width: widget.width,
        height: height,
        child: file == null
            ? DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: AppColors.brandGradient,
                ),
                child: Icon(
                  Icons.menu_book_rounded,
                  color: Colors.white.withValues(alpha: 0.75),
                  size: widget.width * 0.4,
                ),
              )
            : Image.file(
                file,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) =>
                    ColoredBox(color: context.palette.elevated),
              ),
      ),
    );
  }
}
