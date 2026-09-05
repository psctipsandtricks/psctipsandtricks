import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

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

/// Below this a viewport is too short to show a whole page at a size anyone
/// could read, so the document scrolls fitted to the width instead. Matches the
/// reader's own tablet threshold: both are asking "is this wide screen a tablet
/// or a phone lying on its side?".
const _wholePageMinHeight = 600.0;

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
  Uint8List? _pdfBytes;
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
      _pdfBytes = null;
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
      try {
        final bytes = await File(local).readAsBytes();
        if (mounted) {
          setState(() {
            _localPath = local;
            _pdfBytes = bytes;
          });
        }
      } catch (e) {
        debugPrint('===> Error reading local PDF bytes: $e');
        if (mounted) setState(() => _localPath = local);
      }
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
      debugPrint('===> PDF prepare: url=${widget.url}, target file=${file.path}, exists=${file.existsSync()}, size=${file.existsSync() ? file.lengthSync() : 0}');

      if (!file.existsSync() || file.lengthSync() == 0) {
        debugPrint('===> PDF downloading from ${widget.url}...');
        await ref.read(apiClientProvider).download(
          widget.url,
          file.path,
          onProgress: (received, total) {
            if (total > 0 && mounted) {
              setState(() => _downloadProgress = received / total);
            }
          },
        );
        debugPrint('===> PDF download finished! size=${file.lengthSync()}');
      }

      final bytes = await file.readAsBytes();
      if (mounted) {
        debugPrint('===> Setting _localPath=${file.path} and _pdfBytes=${bytes.length}');
        setState(() {
          _localPath = file.path;
          _pdfBytes = bytes;
        });
      }
    } on ApiException catch (e) {
      debugPrint('===> PDF download ApiException: $e');
      if (mounted) setState(() => _error = e);
    } catch (e, st) {
      debugPrint('===> PDF download error: $e\n$st');
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
    if (_localPath == null || _pdfBytes == null) {
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

    // Two genuinely different documents, chosen by how much height there is
    // to put a page into — not by orientation alone.
    //
    // Fit-the-width, scrolling as one continuous column, is the default and
    // the posture people actually read in on a phone: the page spans the
    // screen edge to edge, so turning the phone sideways *magnifies* the text
    // instead of shrinking it.
    //
    // Fit-the-whole-page, one per screen with a snap, only pays off where
    // there is real height to fit a page into. A landscape phone has around
    // 411dp, and a whole A4 page inside what is left of that after the app bar
    // and the transport comes out barely 200dp wide — a stamp, which is what
    // this screen used to show. A landscape tablet or a large foldable does
    // have the height, and there a page per screen is the point of the extra
    // room.
    // Measured off the box this actually gets rather than off the screen: the
    // reader hands it what is left under the app bar and over the transport,
    // and on a tablet only the column beside the pinned contents.
    return LayoutBuilder(builder: (context, constraints) {
      final screen = MediaQuery.sizeOf(context);
      final width =
          constraints.maxWidth.isFinite ? constraints.maxWidth : screen.width;
      final height = constraints.maxHeight.isFinite
          ? constraints.maxHeight
          : screen.height;
      final wholePage = width > height && height >= _wholePageMinHeight;

      return PDFView(
        key: ValueKey('$_localPath-${_pdfBytes?.length}-${width.round()}'),
        filePath: _localPath,
        pdfData: _pdfBytes,
        enableSwipe: true,
        swipeHorizontal: false,
        autoSpacing: false,
        pageFling: false,
        pageSnap: false,
        fitEachPage: false,
        fitPolicy: FitPolicy.WIDTH,
        defaultPage: _currentPage > 0 ? _currentPage : _resumePage,
        nightMode: false,
        backgroundColor: Colors.white,
        onViewCreated: (controller) {
          debugPrint('===> PDFView onViewCreated called');
          _pdf = controller;
        },
        onRender: (pages) {
          debugPrint('===> PDFView onRender called with pages: $pages');
          final isFirstRender = _renderedDocument != _localPath;
          _renderedDocument = _localPath;
          setState(() => _pageCount = pages ?? 0);
          _publish();
          if (isFirstRender) _syncToAudio(seeking: true);
        },
        onPageChanged: (page, total) {
          debugPrint('===> PDFView onPageChanged: $page / $total');
          final next = page ?? 0;
          if (_lastAutoPage != next) _lastManualTurn = DateTime.now();
          setState(() => _currentPage = next);
          _publish();
          _rememberPage(next);
        },
        onError: (e) {
          debugPrint('===> PDFView onError: $e');
          setState(
            () => _error = const ApiException('This document could not be rendered.'),
          );
        },
        onPageError: (page, e) {
          debugPrint('===> PDFView onPageError on page $page: $e');
        },
      );
    });
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
