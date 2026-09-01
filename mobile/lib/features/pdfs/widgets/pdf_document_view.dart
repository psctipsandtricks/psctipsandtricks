import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart' as crypto;
import 'package:flutter/material.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/state_views.dart';
import '../../../data/models/pdf_sync.dart';
import '../../books/reader_audio_controller.dart';

/// Where a document is up to — what a host needs to draw a page indicator.
class PdfViewState {
  const PdfViewState({required this.currentPage, required this.pageCount});

  final int currentPage;
  final int pageCount;

  bool get isReady => pageCount > 0;
}

/// A scrolling PDF, with its download, its remembered place, and its
/// follow-the-narration behaviour.
///
/// Extracted from the full-screen viewer so the reader can show the same
/// document inline. Both surfaces then behave identically — same continuous
/// vertical scroll, same resume point, same auto page-turn — rather than the
/// reader growing a second, subtly different implementation.
class PdfDocumentView extends ConsumerStatefulWidget {
  const PdfDocumentView({
    super.key,
    required this.url,
    this.localPath,
    this.initialPage,
    this.syncCues,
    this.onStateChanged,
  });

  final String url;

  /// Set when the document is already decrypted on disk, from the offline
  /// vault. When present the network is not touched at all.
  final String? localPath;

  /// Forces a starting page, overriding the remembered one.
  final int? initialPage;

  /// The unit's PDF↔audio timing map. With one, pages follow the narration
  /// exactly as authored; without one, the document is paced by how far
  /// through the clip the audio is.
  final PdfSyncMap? syncCues;

  final ValueChanged<PdfViewState>? onStateChanged;

  @override
  ConsumerState<PdfDocumentView> createState() => PdfDocumentViewState();
}

/// Public so a host can hold a [GlobalKey] to it and call [syncNow].
class PdfDocumentViewState extends ConsumerState<PdfDocumentView> {
  String? _localPath;
  Object? _error;
  double _downloadProgress = 0;

  int _pageCount = 0;
  int _currentPage = 0;

  /// The page this document was last left on, restored before the first render
  /// so the viewer opens there rather than jumping after the fact.
  int _resumePage = 0;

  PDFViewController? _pdf;

  /// Held rather than read back in [dispose]: `ref` is already disposed by the
  /// time a ConsumerState is torn down, so reading the provider there throws
  /// and the listeners are never detached.
  ReaderAudioController? _audio;

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

  /// The document the native view has already rendered once.
  ///
  /// Rotating rebuilds that view — the fit policy is fixed when it is created —
  /// and its `onRender` fires again. Without this the second render is treated
  /// as a first one and the page is dragged back to wherever the narration
  /// stands, which for an unplayed clip is page one. Turning the phone would
  /// then lose the student's place every time.
  String? _renderedDocument;

  /// Keyed by the document rather than the book: one book can carry a different
  /// PDF per topic, and each should remember its own place.
  String get _pageKey => pdfPageKey(widget.url);

  @override
  void initState() {
    super.initState();
    _prepare();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final audio = ref.read(readerAudioProvider);
      _audio = audio;
      audio.playing.addListener(_onPlayingChanged);
      audio.position.addListener(_onPositionChanged);
      _lastPositionMs = audio.position.value.inMilliseconds;
    });
  }

  @override
  void didUpdateWidget(covariant PdfDocumentView oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Paging to another topic swaps the document underneath this widget when
    // the reader keeps it mounted.
    if (oldWidget.url != widget.url || oldWidget.localPath != widget.localPath) {
      _pdf = null;
      _pageCount = 0;
      _currentPage = 0;
      _needsFirstSync = true;
      _renderedDocument = null;
      _localPath = null;
      _prepare();
    }
  }

  @override
  void dispose() {
    _audio?.playing.removeListener(_onPlayingChanged);
    _audio?.position.removeListener(_onPositionChanged);
    super.dispose();
  }

  void _publish() {
    widget.onStateChanged
        ?.call(PdfViewState(currentPage: _currentPage, pageCount: _pageCount));
  }

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
    final cues = widget.syncCues;

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

  /// Catches the document up with the narration on demand — what the AUTO
  /// toggle calls when it is switched back on.
  void syncNow() => _syncToAudio(seeking: true);

  Future<void> _prepare() async {
    setState(() {
      _error = null;
      _downloadProgress = 0;
      _resumePage = widget.initialPage ??
          ref.read(sharedPrefsProvider).getInt(_pageKey) ??
          0;
    });

    // An offline copy is already decrypted on disk; render it directly.
    final local = widget.localPath;
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
      final name = crypto.md5.convert(widget.url.codeUnits).toString();
      final file = File('${pdfDir.path}/$name.pdf');

      if (!file.existsSync() || file.lengthSync() == 0) {
        await ref.read(apiClientProvider).download(
          widget.url,
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

    // Portrait and landscape want genuinely different documents.
    //
    // Portrait: fit the page to the width so it fills the screen edge to edge,
    // and let the whole document scroll as one continuous column — the reading
    // posture people actually use on a phone.
    //
    // Landscape: a page fitted to a 900dp width would stand about 1300dp tall,
    // so the student would see a sixth of it. Fitting the whole page instead,
    // one per screen with a snap, is the reason to turn the phone at all.
    final isLandscape =
        MediaQuery.orientationOf(context) == Orientation.landscape;

    return PDFView(
      // A new key rebuilds the platform view. Needed both for a new document —
      // it would otherwise keep rendering the old file — and on rotation,
      // since the fit policy is fixed when the native view is created.
      key: ValueKey('$_localPath-$isLandscape'),
      filePath: _localPath!,
      swipeHorizontal: false,
      // autoSpacing pads every page out to the full viewport height. In
      // portrait that leaves a screen-sized blank band between pages; in
      // landscape it is exactly what gives each page its own screen.
      autoSpacing: isLandscape,
      pageFling: isLandscape,
      pageSnap: isLandscape,
      fitEachPage: true,
      fitPolicy: isLandscape ? FitPolicy.BOTH : FitPolicy.WIDTH,
      // On a rotation the view is rebuilt from scratch, so the page has to be
      // handed back or the student is returned to the top of the document.
      defaultPage: _currentPage > 0 ? _currentPage : _resumePage,
      nightMode: context.palette.isDark,
      backgroundColor: context.palette.background,
      onViewCreated: (controller) => _pdf = controller,
      onRender: (pages) {
        final isFirstRender = _renderedDocument != _localPath;
        _renderedDocument = _localPath;
        setState(() => _pageCount = pages ?? 0);
        _publish();
        // Now that the page count is known, put the document where the audio
        // already is rather than waiting for the next page boundary — but only
        // when this document is genuinely new, not on a re-render.
        if (isFirstRender) _syncToAudio(seeking: true);
      },
      onPageChanged: (page, _) {
        final next = page ?? 0;
        // Anything we did not turn to ourselves was the student swiping.
        if (_lastAutoPage != next) _lastManualTurn = DateTime.now();
        setState(() => _currentPage = next);
        _publish();
        _rememberPage(next);
      },
      onError: (_) => setState(
        () => _error = const ApiException('This document could not be rendered.'),
      ),
    );
  }
}

/// The prefs key holding the page [url] was last left on.
String pdfPageKey(String url) =>
    'pdf-page-${crypto.md5.convert(utf8.encode(url))}';

/// The page [url] was last left on, or 0 if it has not been opened before.
///
/// Exposed so a caller can say "continue on page N" before the viewer is even
/// built — the reader uses it to label its notes tile.
int rememberedPdfPage(SharedPreferences prefs, String url) =>
    prefs.getInt(pdfPageKey(url)) ?? 0;
