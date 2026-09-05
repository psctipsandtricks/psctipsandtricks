import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/pdf_downloader.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../data/models/pdf_sync.dart';
import '../books/reader_audio_controller.dart';
import '../books/widgets/reader_audio_player.dart';
import '../../core/utils/orientation.dart';
import 'widgets/pdf_document_view.dart';

class PdfViewerArgs {
  const PdfViewerArgs({
    required this.url,
    required this.title,
    this.localPath,
    this.initialPage,
    this.syncCues,
    this.minimal = false,
  });

  final String url;
  final String title;

  /// Set when the document is already on disk — a decrypted copy from the
  /// offline vault. When present the network is not touched at all.
  final String? localPath;

  /// Forces a starting page, overriding the remembered one. Used when the
  /// caller already knows where the student should land.
  final int? initialPage;

  /// The unit's PDF↔audio timing map. With one, pages follow the narration
  /// exactly as authored; without one, the document is paced by how far
  /// through the clip the audio is.
  final PdfSyncMap? syncCues;

  /// True for a standalone sample/preview PDF, which has no narration to
  /// follow and nothing of the student's own to download or resume — just the
  /// pages. Hides the download button, auto-turn chip, page counter, and the
  /// audio mini-player, leaving the document and a way back.
  final bool minimal;
}

/// Renders a remote PDF with the platform viewer.
///
/// The native view needs a local file, so the document is streamed to the app's
/// cache first. That download doubles as the cache: reopening the same PDF is
/// instant and works offline.
class PdfViewerScreen extends ConsumerStatefulWidget {
  const PdfViewerScreen({super.key, required this.args});

  final PdfViewerArgs args;

  @override
  ConsumerState<PdfViewerScreen> createState() => _PdfViewerScreenState();
}

class _PdfViewerScreenState extends ConsumerState<PdfViewerScreen> {
  /// Lets the AUTO chip tell the document to catch up the moment it is
  /// switched back on, rather than waiting for the next page boundary.
  final _documentKey = GlobalKey<PdfDocumentViewState>();

  PdfViewState _state = const PdfViewState(currentPage: 0, pageCount: 0);

  @override
  void initState() {
    super.initState();
    // Reading a document is the one place a wider view genuinely helps: a
    // landscape phone fits a whole page at a readable size. Portrait-only is
    // restored on the way out, since the rest of the app is laid out for it.
    allowAllOrientations();
  }

  @override
  void dispose() {
    restorePortraitOnly();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final minimal = widget.args.minimal;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: GlassAppBar(
        title: Text(
          widget.args.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: minimal
            ? null
            : [
                IconButton(
                  icon: const Icon(Icons.download_rounded),
                  tooltip: 'Download PDF',
                  onPressed: () => PdfDownloader.download(
                    context,
                    url: widget.args.url,
                    title: widget.args.title,
                  ),
                ),
                // Watches the loaded clip rather than reading `hasAudio` once:
                // the narration can finish loading, fail, or be swapped for
                // another topic's while this screen is open.
                ValueListenableBuilder<String?>(
                  valueListenable: ref.read(readerAudioProvider).title,
                  builder: (context, loaded, _) => loaded == null
                      ? const SizedBox.shrink()
                      : AutoTurnChip(
                          enabled: ref.watch(autoScrollProvider),
                          onTap: () {
                            ref.read(autoScrollProvider.notifier).toggle();
                            // Switching it back on should catch the document
                            // up rather than wait for the next page boundary.
                            _documentKey.currentState?.syncNow();
                          },
                        ),
                ),
                if (_state.isReady)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: context.palette.elevated,
                          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                        ),
                        child: Text(
                          '${_state.currentPage + 1} / ${_state.pageCount}',
                          style: Theme.of(context)
                              .textTheme
                              .labelSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ),
              ],
      ),
      body: SafeArea(
        child: PdfDocumentView(
          key: _documentKey,
          url: widget.args.url,
          localPath: widget.args.localPath,
          initialPage: widget.args.initialPage,
          syncCues: widget.args.syncCues,
          onStateChanged: (state) => setState(() => _state = state),
        ),
      ),
      // The reader's own transport is two screens back once the notes are
      // open; this keeps the narration controllable from where the student
      // is. A sample preview has no narration of its own to control.
      bottomNavigationBar: minimal ? null : const ReaderMiniPlayer(),
    );
  }
}

/// Toggles whether the document follows the narration.
class AutoTurnChip extends StatelessWidget {
  const AutoTurnChip({super.key, required this.enabled, required this.onTap});

  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Center(
      child: Tooltip(
        message: enabled
            ? 'Pages follow the audio — tap to turn off'
            : 'Auto page-turn off',
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          child: Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
            decoration: BoxDecoration(
              color: enabled
                  ? AppColors.cyan.withValues(alpha: 0.14)
                  : palette.elevated,
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              border: Border.all(
                color: enabled
                    ? AppColors.cyan.withValues(alpha: 0.4)
                    : palette.border,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  enabled
                      ? Icons.auto_stories_rounded
                      : Icons.do_not_touch_outlined,
                  size: 15,
                  color: enabled ? AppColors.cyan : palette.textMuted,
                ),
                const SizedBox(width: 5),
                Text(
                  enabled ? 'AUTO' : 'OFF',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: enabled ? AppColors.cyan : palette.textMuted,
                        fontWeight: FontWeight.w800,
                        fontSize: 9.5,
                      ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Opens [url] in the full-screen PDF viewer.
Future<void> openPdf(
  BuildContext context, {
  required String url,
  required String title,
  String? localPath,
  int? initialPage,
  PdfSyncMap? syncCues,
  bool minimal = false,
}) {
  return Navigator.of(context, rootNavigator: true).push(
    MaterialPageRoute(
      builder: (_) => PdfViewerScreen(
        args: PdfViewerArgs(
          url: url,
          title: title,
          localPath: localPath,
          initialPage: initialPage,
          syncCues: syncCues,
          minimal: minimal,
        ),
      ),
    ),
  );
}

/// A tappable row advertising an attached PDF.
class PdfAttachmentTile extends StatelessWidget {
  const PdfAttachmentTile({
    super.key,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.onDownload,
  });

  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final VoidCallback? onDownload;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Container(
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: palette.border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.rose.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.picture_as_pdf_rounded,
                      color: AppColors.rose, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      if (subtitle != null && subtitle!.isNotEmpty)
                        Text(
                          subtitle!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: palette.textMuted,
                              ),
                        ),
                    ],
                  ),
                ),
                if (onDownload != null) ...[
                  const SizedBox(width: 6),
                  IconButton(
                    icon: const Icon(Icons.download_rounded, size: 21),
                    color: AppColors.cyan,
                    tooltip: 'Download PDF',
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsets.all(6),
                    constraints: const BoxConstraints(),
                    onPressed: onDownload,
                  ),
                ] else ...[
                  const SizedBox(width: 6),
                  Icon(Icons.chevron_right_rounded, color: palette.textMuted),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
