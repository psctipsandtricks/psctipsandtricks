import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart' as crypto;
import 'package:flutter/material.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/network/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/pdf_sync.dart';
import '../books/reader_audio_controller.dart';
import '../books/widgets/reader_audio_player.dart';

class PdfViewerArgs {
  const PdfViewerArgs({
    required this.url,
    required this.title,
    this.localPath,
    this.initialPage,
    this.syncCues,
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
  String? _localPath;
  Object? _error;
  double _downloadProgress = 0;

  int _pageCount = 0;
  int _currentPage = 0;

  /// The page this document was last left on, restored before the first render
  /// so the viewer opens there rather than jumping after the fact.
  int _resumePage = 0;

  PDFViewController? _pdf;
  /// Where the narration stood on the previous position tick, used to tell a
  /// seek apart from ordinary playback.
  int _lastPositionMs = 0;

  /// Cleared once the document has been lined up with the audio at least once.
  /// Opening the notes part-way through a clip should land on the page being
  /// narrated, even though that is usually backwards from the remembered page.
  bool _needsFirstSync = true;

  /// The page we last turned to ourselves. `onPageChanged` fires for both our
  /// own turns and the student's swipes, and this is what tells them apart.
  int? _lastAutoPage;

  /// A manual swipe stands auto page-turn down briefly, so flicking back to
  /// re-read a diagram is not immediately undone.
  DateTime _lastManualTurn = DateTime.fromMillisecondsSinceEpoch(0);

  /// Keyed by the document rather than the book: one book can carry a different
  /// PDF per topic, and each should remember its own place.
  String get _pageKey =>
      'pdf-page-${crypto.md5.convert(utf8.encode(widget.args.url))}';

  void _rememberPage(int page) {
    // Page 0 is the default anyway; not storing it keeps the prefs file from
    // accumulating an entry for every document ever opened and closed.
    final prefs = ref.read(sharedPrefsProvider);
    if (page <= 0) {
      prefs.remove(_pageKey);
    } else {
      prefs.setInt(_pageKey, page);
    }
  }

  @override
  void initState() {
    super.initState();
    _prepare();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final audio = ref.read(readerAudioProvider);
      audio.playing.addListener(_onPlayingChanged);
      audio.position.addListener(_onPositionChanged);
      _lastPositionMs = audio.position.value.inMilliseconds;
    });
  }

  @override
  void dispose() {
    final audio = ref.read(readerAudioProvider);
    audio.playing.removeListener(_onPlayingChanged);
    audio.position.removeListener(_onPositionChanged);
    super.dispose();
  }

  void _onPlayingChanged() {
    if (!mounted) return;
    // Pausing should leave the document where it is; resuming re-syncs from
    // wherever the audio now stands.
    if (ref.read(readerAudioProvider).playing.value) _syncToAudio(seeking: true);
  }

  /// Moves the document to wherever the narration currently is.
  ///
  /// Driven by the player's position rather than a timer of its own: the
  /// position notifier already ticks several times a second, and a seek shows
  /// up here the instant it happens instead of up to a second later.
  void _onPositionChanged() {
    if (!mounted) return;
    final positionMs =
        ref.read(readerAudioProvider).position.value.inMilliseconds;
    // Playback advances in small steps; anything larger is the student having
    // dragged the scrubber, which should move the page immediately and in
    // either direction.
    final jumped = (positionMs - _lastPositionMs).abs() > 1500;
    _lastPositionMs = positionMs;
    _syncToAudio(seeking: jumped || _needsFirstSync);
  }

  /// The page the narration is on, or null when nothing can be worked out yet.
  int? _targetPage() {
    if (_pageCount <= 1) return null;
    final audio = ref.read(readerAudioProvider);
    final cues = widget.args.syncCues;

    if (cues != null) {
      // An authored map wins: it knows a diagram is discussed for ninety
      // seconds, which no amount of arithmetic on the clip length does.
      final page = cues.pageAt(audio.position.value.inMilliseconds);
      return page?.clamp(0, _pageCount - 1);
    }

    // No map: pace the document by how far through the clip the audio is.
    //
    // The ratio is worked out from the position here rather than read off the
    // controller's `fraction`: this runs from the position listener, and the
    // controller sets position first and fraction a line later — so `fraction`
    // is still the previous tick's value. Playback would only lag by a tick,
    // but a seek would land on the page for wherever the audio used to be.
    final total = audio.duration.value;
    if (total == null || total.inMilliseconds <= 0) return null;
    final ratio = (audio.position.value.inMilliseconds / total.inMilliseconds)
        .clamp(0.0, 1.0);
    return (ratio * (_pageCount - 1)).round().clamp(0, _pageCount - 1);
  }

  /// [seeking] marks a deliberate jump — it may move the document backwards,
  /// and it overrides the stand-down that a manual swipe would otherwise get.
  Future<void> _syncToAudio({bool seeking = false}) async {
    if (!mounted || _pdf == null) return;
    if (!ref.read(autoScrollProvider)) return;
    if (!seeking && !ref.read(readerAudioProvider).playing.value) return;

    final target = _targetPage();
    if (target == null || target == _currentPage) return;

    if (!seeking) {
      // Yield to a student who has just paged back to re-read something.
      if (DateTime.now().difference(_lastManualTurn) <
          const Duration(seconds: 4)) {
        return;
      }
      // While simply playing, never drag the document backwards.
      if (target < _currentPage) return;
    }

    _lastAutoPage = target;
    _needsFirstSync = false;
    await _pdf?.setPage(target);
  }

  Future<void> _prepare() async {
    setState(() {
      _error = null;
      _downloadProgress = 0;
      _resumePage = widget.args.initialPage ??
          ref.read(sharedPrefsProvider).getInt(_pageKey) ??
          0;
    });

    // An offline copy is already decrypted on disk; render it directly.
    final local = widget.args.localPath;
    if (local != null && File(local).existsSync()) {
      setState(() => _localPath = local);
      return;
    }

    try {
      final dir = await getApplicationCacheDirectory();
      final pdfDir = Directory('${dir.path}/pdfs');
      if (!pdfDir.existsSync()) pdfDir.createSync(recursive: true);

      // Hash the URL so two documents with the same file name never collide,
      // and so the same document always resolves to the same cached file.
      final name = crypto.md5.convert(widget.args.url.codeUnits).toString();
      final file = File('${pdfDir.path}/$name.pdf');

      if (!file.existsSync() || file.lengthSync() == 0) {
        await ref.read(apiClientProvider).download(
          widget.args.url,
          file.path,
          onProgress: (received, total) {
            if (total > 0 && mounted) {
              setState(() => _downloadProgress = received / total);
            }
          },
        );
      }

      if (mounted) setState(() => _localPath = file.path);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } catch (_) {
      if (mounted) {
        setState(() => _error =
            const ApiException('Could not open this document. Please try again.'));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.palette.background,
      appBar: AppBar(
        title: Text(
          widget.args.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          // Watches the loaded clip rather than reading `hasAudio` once: the
          // narration can finish loading, fail, or be swapped for another
          // topic's while this screen is open.
          ValueListenableBuilder<String?>(
            valueListenable: ref.read(readerAudioProvider).title,
            builder: (context, loaded, _) => loaded == null
                ? const SizedBox.shrink()
                : _AutoTurnChip(
                    enabled: ref.watch(autoScrollProvider),
                    onTap: () {
                      ref.read(autoScrollProvider.notifier).toggle();
                      // Switching it back on should catch the document up
                      // rather than wait for the next page boundary.
                      _syncToAudio(seeking: true);
                    },
                  ),
          ),
          if (_pageCount > 0)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: context.palette.elevated,
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  child: Text(
                    '${_currentPage + 1} / $_pageCount',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: _buildBody(),
      // The reader's own transport is two screens back once the notes are open;
      // this keeps the narration controllable from where the student is.
      bottomNavigationBar: const ReaderMiniPlayer(),
    );
  }

  Widget _buildBody() {
    if (_error != null) {
      return ErrorView(error: _error!, onRetry: _prepare);
    }
    if (_localPath == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 46,
              height: 46,
              child: CircularProgressIndicator(
                value: _downloadProgress > 0 ? _downloadProgress : null,
                strokeWidth: 3,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              _downloadProgress > 0
                  ? 'Loading document… ${(_downloadProgress * 100).round()}%'
                  : 'Loading document…',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: context.palette.textSecondary,
                  ),
            ),
          ],
        ),
      );
    }

    return PDFView(
      filePath: _localPath!,
      swipeHorizontal: false,
      // autoSpacing pads every page out to the full viewport height, which on a
      // tall phone leaves a screen-sized blank band between pages. Off, pages
      // butt directly against each other.
      autoSpacing: false,
      pageFling: false,
      pageSnap: false,
      fitEachPage: true,
      fitPolicy: FitPolicy.WIDTH,
      defaultPage: _resumePage,
      nightMode: context.palette.isDark,
      backgroundColor: context.palette.background,
      onViewCreated: (controller) => _pdf = controller,
      onRender: (pages) {
        setState(() => _pageCount = pages ?? 0);
        // Now that the page count is known, put the document where the audio
        // already is rather than waiting for the next page boundary.
        _syncToAudio(seeking: true);
      },
      onPageChanged: (page, _) {
        final next = page ?? 0;
        // Anything we did not turn to ourselves was the student swiping.
        if (_lastAutoPage != next) _lastManualTurn = DateTime.now();
        setState(() => _currentPage = next);
        _rememberPage(next);
      },
      onError: (_) => setState(
        () => _error = const ApiException('This document could not be rendered.'),
      ),
    );
  }
}

/// Toggles whether the document follows the narration.
class _AutoTurnChip extends StatelessWidget {
  const _AutoTurnChip({required this.enabled, required this.onTap});

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

/// The page [url] was last left on, or 0 if it has not been opened before.
///
/// Exposed so a caller can say "continue on page N" before the viewer is even
/// built — the reader uses it to label its notes tile.
int rememberedPdfPage(SharedPreferences prefs, String url) =>
    prefs.getInt('pdf-page-${crypto.md5.convert(utf8.encode(url))}') ?? 0;

/// Opens [url] in the full-screen PDF viewer.
Future<void> openPdf(
  BuildContext context, {
  required String url,
  required String title,
  String? localPath,
  int? initialPage,
  PdfSyncMap? syncCues,
}) {
  return Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => PdfViewerScreen(
        args: PdfViewerArgs(
          url: url,
          title: title,
          localPath: localPath,
          initialPage: initialPage,
          syncCues: syncCues,
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
  });

  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: palette.elevated,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(color: palette.border),
        ),
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
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                          ),
                    ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: palette.textMuted),
          ],
        ),
      ),
    );
  }
}
