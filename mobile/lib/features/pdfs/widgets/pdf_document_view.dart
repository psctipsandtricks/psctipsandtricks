import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart' as crypto;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
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
import '../annotations/pdf_annotation_layer.dart';
import '../annotations/pdf_highlight.dart';
import '../annotations/pdf_highlight_store.dart';
import 'pdf_auto_scroll.dart';

/// Where a document is up to — what a host needs to draw a page indicator.
class PdfViewState {
  const PdfViewState({required this.currentPage, required this.pageCount});

  final int currentPage;
  final int pageCount;

  bool get isReady => pageCount > 0;
}

class PdfDocumentView extends ConsumerStatefulWidget {
  const PdfDocumentView({
    super.key,
    required this.url,
    this.localPath,
    this.initialPage,
    this.syncCues,
    this.onStateChanged,
    this.annotationTool = PdfAnnotationTool.none,
    this.userId,
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

  /// The marker or eraser the student is holding, if either.
  final PdfAnnotationTool annotationTool;

  /// Whose highlights to show. Null means nobody is signed in, so none are
  /// loaded and none are saved — marks belong to a person, not a device.
  final String? userId;

  @override
  ConsumerState<PdfDocumentView> createState() => PdfDocumentViewState();
}

/// Public so a host can hold a [GlobalKey] to it and call [syncNow].
class PdfDocumentViewState extends ConsumerState<PdfDocumentView>
    with SingleTickerProviderStateMixin {
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

  /// Eases the document towards the narration, one frame at a time.
  ///
  /// A vsync ticker rather than a repeating timer because this paints: nudging
  /// the page on a 600ms beat moved it in visible hops of a few lines, which is
  /// not how a document scrolls. Driven per frame it glides.
  Ticker? _followTicker;

  /// Timestamp of the previous tick, so the easing is frame-rate independent.
  Duration _lastFollowTick = Duration.zero;

  /// A step is in flight. Every step reads the document's position, decides
  /// where to move it, and writes it back — all over a method channel, so two
  /// overlapping steps both act on the same stale reading and fight each other.
  /// That fight is what a flickering document looks like.
  bool _stepping = false;

  /// A seek that arrived while a step was in flight, to be honoured as soon as
  /// it lands. Dropping it would leave the document a page behind until the
  /// next tick.
  bool _resyncQueued = false;

  /// The size the document is drawn at, from the layout — needed to place a
  /// scroll offset and to centre what is being narrated in it.
  Size? _viewportSize;

  /// Landscape fits a whole page to the screen, which leaves nothing to scroll
  /// within a page; portrait fits the width and leaves the rest to scroll.
  bool _isLandscape = false;

  /// A page's height divided by its width, in PDF points. One platform call
  /// per document: the ratio does not change with zoom or rotation, so every
  /// on-screen size is derived from it rather than asked for again.
  double? _pageAspect;

  /// The last zoom the viewer reported, from `onDraw`. Live, unlike a
  /// `getScale()` result, which is a round trip old by the time it lands.
  double _scale = 1;

  /// Where the document currently sits behind the annotation layer, republished
  /// on every `onDraw` — which the viewer emits on each scroll and zoom.
  ///
  /// A notifier rather than widget state, and the painter's own `repaint`
  /// listenable: writing it repaints the marker layer directly, skipping the
  /// build and layout passes a `setState` would schedule. That is a whole frame
  /// of latency removed, and it is what stops the highlights visibly trailing
  /// the page they are drawn on while it scrolls.
  final _viewport = ValueNotifier<PdfViewport?>(null);

  /// This student's marks on this document, oldest first.
  List<PdfHighlight> _highlights = const [];

  /// The store is held rather than read back in [dispose]: a stroke finished a
  /// moment before leaving still has to reach disk, and `ref` is gone by then.
  final _highlightStore = PdfHighlightStore();

  /// Keyed by the document rather than the book: one book can carry a different
  /// PDF per topic, and each should remember its own place.
  String get _pageKey => pdfPageKey(widget.url);

  @override
  void initState() {
    super.initState();
    _prepare();
    unawaited(_loadHighlights());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final audio = ref.read(readerAudioProvider);
      _audio = audio;
      audio.playing.addListener(_onPlayingChanged);
      audio.position.addListener(_onPositionChanged);
      _lastPositionMs = audio.position.value.inMilliseconds;
      // Opening the notes on a clip that is already running has to pick the
      // chase up too, not only a clip started from here.
      if (audio.playing.value) _startAutoScroll();
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
      // Geometry belongs to the document that is going away.
      _pageAspect = null;
      _viewport.value = null;
      _scale = 1;
      _highlights = const [];
      _prepare();
      unawaited(_loadHighlights());
    } else if (oldWidget.userId != widget.userId) {
      // A different student is looking at the same document — theirs are the
      // only marks that may appear.
      _highlights = const [];
      unawaited(_loadHighlights());
    }
  }

  /// Puts the student's marks on the page: the cached copy first so the page is
  /// never blank while the network answers, then the server's, which is the
  /// record and the thing the website reads too.
  Future<void> _loadHighlights() async {
    final userId = widget.userId;
    if (userId == null || userId.isEmpty) return;
    final url = widget.url;

    bool stillWanted() =>
        mounted && widget.url == url && widget.userId == userId;

    final cached = await _highlightStore.load(userId, url);
    if (!stillWanted()) return;
    if (cached.isNotEmpty) setState(() => _highlights = cached);

    try {
      final fresh = await ref.read(pdfHighlightsRepositoryProvider).fetch(url);
      if (!stillWanted()) return;
      setState(() => _highlights = fresh);
      unawaited(_highlightStore.save(userId, url, fresh));
    } catch (_) {
      // Offline, or the request failed. The cached marks are already on screen
      // and stay there; new ones queue in the cache until the next load
      // succeeds. Nothing here is worth interrupting a reader for.
    }
  }

  /// Keeps the offline copy in step with what is on screen. Fire and forget:
  /// nothing is waiting on the disk, and the stroke is already painted.
  void _cacheHighlights() {
    final userId = widget.userId;
    if (userId == null || userId.isEmpty) return;
    unawaited(_highlightStore.save(userId, widget.url, List.of(_highlights)));
  }

  /// The stroke appears the instant it is drawn and is saved behind it.
  ///
  /// The server assigns the id, so the local one is a placeholder swapped for
  /// the real thing when the save lands — without that the eraser would later
  /// quote an id the server has never heard of.
  Future<void> _addHighlight(PdfHighlight highlight) async {
    setState(() => _highlights = [..._highlights, highlight]);
    _cacheHighlights();

    final url = widget.url;
    try {
      final saved = await ref
          .read(pdfHighlightsRepositoryProvider)
          .create(url, highlight);
      if (saved == null || !mounted || widget.url != url) return;
      setState(() {
        _highlights = [
          for (final h in _highlights) h.id == highlight.id ? saved : h,
        ];
      });
      _cacheHighlights();
    } catch (_) {
      // The mark stays on the page and in the cache. It is not on the website
      // until it syncs, which the next successful load will not undo — the
      // cached copy is merged in ahead of the fetch.
    }
  }

  Future<void> _eraseHighlights(Set<String> ids) async {
    if (ids.isEmpty) return;
    setState(() {
      _highlights = [
        for (final h in _highlights)
          if (!ids.contains(h.id)) h,
      ];
    });
    _cacheHighlights();

    try {
      await ref.read(pdfHighlightsRepositoryProvider).erase(ids.toList());
    } catch (_) {
      // Gone locally, still on the server. A later load will bring it back
      // rather than silently losing the erase — which is the safer way round
      // for something that cannot be undone.
    }
  }

  @override
  void dispose() {
    // Stopped before disposing: a ticker still scheduled asserts on teardown.
    _followTicker
      ?..stop()
      ..dispose();
    _viewport.dispose();
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
    if (ref.read(readerAudioProvider).playing.value) {
      _syncToAudio(seeking: true);
      _startAutoScroll();
    } else {
      _stopAutoScroll();
    }
  }

  /// Catches a seek the moment it happens.
  ///
  /// Ordinary playback is left to [_startAutoScroll]'s timer — the position
  /// notifier ticks several times a second, and driving the document off every
  /// one of those is what made it flicker. A drag of the scrubber, though,
  /// should move the page at once and in either direction, so it is handled
  /// here rather than waiting for the next step.
  void _onPositionChanged() {
    if (!mounted) return;
    final positionMs =
        ref.read(readerAudioProvider).position.value.inMilliseconds;
    final jumped = (positionMs - _lastPositionMs).abs() > 1500;
    _lastPositionMs = positionMs;
    if (jumped || _needsFirstSync) _syncToAudio(seeking: true);
  }

  /// Where the narration wants the document, or null when nothing can be
  /// worked out yet — a single-page document, or a clip with no map whose
  /// length the player has not reported.
  PdfScrollTarget? _scrollTarget() {
    if (_pageCount <= 1) return null;
    final audio = ref.read(readerAudioProvider);
    // The position is read here rather than off the controller's `fraction`:
    // the controller sets position first and fraction a line later, so
    // `fraction` is still the previous tick's value. Playback would only lag by
    // a tick, but a seek would land on the page the audio used to be at.
    return resolvePdfScrollTarget(
      positionMs: audio.position.value.inMilliseconds,
      pageCount: _pageCount,
      clipDuration: audio.duration.value,
      cues: widget.syncCues,
    );
  }

  /// Runs the chase while there is narration playing to chase.
  ///
  /// A timer of its own rather than the position listener: the document is a
  /// native view reached over a method channel, and stepping it several times a
  /// second — which is the rate positions arrive at — floods that channel and
  /// shows up as the flickering it is meant to prevent. One deliberate step
  /// every [kPdfStepInterval] is both smoother to watch and far cheaper.
  void _startAutoScroll() {
    _followTicker ??= createTicker(_onFollowTick);
    if (_followTicker!.isTicking) return;
    _lastFollowTick = Duration.zero;
    _followTicker!.start();
  }

  void _stopAutoScroll() {
    _followTicker?.stop();
  }

  void _onFollowTick(Duration elapsed) {
    if (!mounted) return;
    // The first frame after starting has no previous tick to measure against.
    final since = elapsed - _lastFollowTick;
    _lastFollowTick = elapsed;
    if (since <= Duration.zero) return;
    unawaited(_syncToAudio(elapsed: since));
  }

  /// Places the annotation layer before the student has scrolled.
  ///
  /// `onDraw` only fires once the document moves, so without this a page opened
  /// and read without scrolling would show no highlights at all until the first
  /// swipe.
  Future<void> _seedViewport() async {
    final pdf = _pdf;
    if (pdf == null) return;
    final width = _viewportSize?.width ?? 0;
    if (width <= 0) return;

    final aspect = await _ensurePageAspect();
    if (aspect == null || !mounted || _pdf == null) return;

    try {
      final position = await pdf.getPosition();
      final scale = await pdf.getScale();
      if (!mounted) return;
      _scale = scale <= 0 ? 1 : scale;
      final pageWidth = width * _scale;
      _viewport.value = PdfViewport(
        offset: position,
        scale: _scale,
        pageHeight: pageWidth * aspect,
        pageWidth: pageWidth,
      );
    } catch (_) {
      // Not ready yet. The first `onDraw` will place the layer instead.
    }
  }

  /// The page's aspect ratio, asked for once per document.
  Future<double?> _ensurePageAspect() async {
    final cached = _pageAspect;
    if (cached != null) return cached;

    final pdf = _pdf;
    if (pdf == null) return null;
    try {
      final size = await pdf.getCurrentPageSize();
      if (size.width <= 0 || size.height <= 0) return null;
      return _pageAspect = size.height / size.width;
    } catch (_) {
      // The native view is not ready, or reported something unusable. Page
      // turns need no geometry, so the caller falls back to those.
      return null;
    }
  }

  /// How tall one page is drawn right now, at the current width and zoom.
  Future<double?> _pageHeightOnScreen() async {
    final viewportWidth = _viewportSize?.width ?? 0;
    if (viewportWidth <= 0) return null;
    final aspect = await _ensurePageAspect();
    if (aspect == null) return null;
    return pdfPageHeightOnScreen(
      pageWidthPoints: 1,
      pageHeightPoints: aspect,
      viewportWidthPx: viewportWidth,
      zoom: _scale,
    );
  }

  /// [seeking] marks a deliberate jump — it may move the document backwards,
  /// and it overrides the stand-down that a manual swipe would otherwise get.
  Future<void> _syncToAudio({bool seeking = false, Duration? elapsed}) async {
    if (!mounted || _pdf == null) return;
    // A page that walks itself down while somebody is drawing on it is
    // unusable: the stroke lands somewhere the student was not pointing. The
    // chase resumes the moment they put the tool down.
    if (widget.annotationTool != PdfAnnotationTool.none) return;
    if (!ref.read(autoScrollProvider)) return;
    if (!seeking && !ref.read(readerAudioProvider).playing.value) return;

    if (_stepping) {
      _resyncQueued = _resyncQueued || seeking;
      return;
    }
    _stepping = true;
    try {
      await _step(seeking: seeking, elapsed: elapsed);
    } finally {
      _stepping = false;
    }
    if (_resyncQueued && mounted) {
      _resyncQueued = false;
      await _syncToAudio(seeking: true);
    }
  }

  /// One move of the chase, run under [_syncToAudio]'s re-entrancy guard.
  Future<void> _step({required bool seeking, Duration? elapsed}) async {
    final target = _scrollTarget();
    if (target == null) return;

    if (!seeking) {
      // Yield to a student who has just paged back to re-read something.
      if (DateTime.now().difference(_lastManualTurn) <
          const Duration(seconds: 4)) {
        return;
      }
      // While simply playing, never drag the document backwards.
      if (target.page < _currentPage) return;
    }

    // Landscape fits a whole page to the screen, so there is nothing to scroll
    // within one and a page turn is the only move available. Portrait fits the
    // width, which is what leaves room to creep down a page.
    final canScrollWithinPage = !_isLandscape;
    final pageHeight = canScrollWithinPage ? await _pageHeightOnScreen() : null;
    final viewportHeight = _viewportSize?.height ?? 0;
    if (!mounted || _pdf == null) return;

    if (pageHeight == null || viewportHeight <= 0) {
      await _turnToPage(target.page, seeking: seeking);
      return;
    }

    final wanted = pdfCenteringOffset(
      target: target,
      pageHeightPx: pageHeight,
      viewportHeightPx: viewportHeight,
      pageCount: _pageCount,
    );

    // Read from the last `onDraw` rather than asking the platform: `onDraw`
    // already arrives on every frame the document moves, and a `getPosition`
    // per frame would double the channel traffic to learn something we were
    // just told. A frame-stale value is harmless here — the easing converges.
    final current = _viewport.value?.offset.dy;
    if (current == null) {
      await _turnToPage(target.page, seeking: seeking);
      return;
    }

    // Too far to creep: a seek, a topic just opened part-way through its clip,
    // or the student swiped away and the stand-down has expired. Turn the page
    // outright and let the next steps take up the slack.
    if ((wanted - current).abs() > pageHeight) {
      await _turnToPage(target.page, seeking: true);
      return;
    }

    final next = pdfNextScrollOffset(
      current: current,
      target: wanted,
      // A seek has no previous frame to measure from and should arrive at once
      // rather than easing in from wherever the page happened to be.
      elapsed: seeking
          ? const Duration(milliseconds: 1000)
          : (elapsed ?? const Duration(microseconds: 16667)),
    );
    if (next == null) {
      _needsFirstSync = false;
      return;
    }

    _needsFirstSync = false;
    // Our own move, not the student's: `onPageChanged` fires for both, and
    // treating this one as a swipe would stand auto-scroll down every step.
    _lastAutoPage = target.page;
    try {
      await _pdf!.setPosition(Offset(0, next));
    } catch (_) {
      // A view torn down mid-step. Nothing to recover: the next tick re-reads
      // the position from whatever view replaced it.
    }
  }

  Future<void> _turnToPage(int page, {required bool seeking}) async {
    if (page == _currentPage) {
      _needsFirstSync = false;
      return;
    }
    if (!seeking && page < _currentPage) return;
    _lastAutoPage = page;
    _needsFirstSync = false;
    await _pdf?.setPage(page);
  }

  /// Catches the document up with the narration on demand — what the AUTO
  /// toggle calls when it is switched back on.
  void syncNow() {
    unawaited(_syncToAudio(seeking: true));
    // Switched on mid-clip: the stepper only starts when playback starts, so
    // without this the document would catch up once and then sit still.
    if (mounted && ref.read(readerAudioProvider).playing.value) {
      _startAutoScroll();
    }
  }

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
      if (mounted) setState(() => _localPath = local);
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

      if (mounted) {
        setState(() => _localPath = file.path);
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } catch (e) {
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

    final isLandscape =
        MediaQuery.orientationOf(context) == Orientation.landscape;
    final isDark = context.palette.isDark;
    final bgColor = context.palette.background;

    return LayoutBuilder(
      builder: (context, constraints) {
        // Measured rather than taken from MediaQuery: on a tablet the contents
        // panel is pinned alongside, so the document is narrower than the
        // window — and its width is what a page is fitted to.
        final size = Size(constraints.maxWidth, constraints.maxHeight);
        if (_viewportSize != size || _isLandscape != isLandscape) {
          _viewportSize = size;
          _isLandscape = isLandscape;
          // A page is fitted to the width, so a different width redraws every
          // page at a different size — and the annotation layer's transform
          // with it.
          _viewport.value = null;
          WidgetsBinding.instance
              .addPostFrameCallback((_) => unawaited(_seedViewport()));
        }
        return _buildViewer(isLandscape: isLandscape, isDark: isDark, bgColor: bgColor);
      },
    );
  }

  Widget _buildViewer({
    required bool isLandscape,
    required bool isDark,
    required Color bgColor,
  }) {
    return Container(
      color: bgColor,
      child: Stack(
        fit: StackFit.expand,
        children: [
          _pdfView(isLandscape: isLandscape, isDark: isDark, bgColor: bgColor),
          // Above the native view, which is the only place a Flutter surface
          // can draw on top of one. Transparent to touches until the student
          // picks up a tool.
          PdfAnnotationLayer(
            tool: widget.annotationTool,
            viewport: _viewport,
            pageCount: _pageCount,
            highlights: _highlights,
            onHighlightAdded: (h) => unawaited(_addHighlight(h)),
            onHighlightsErased: (ids) => unawaited(_eraseHighlights(ids)),
          ),
        ],
      ),
    );
  }

  Widget _pdfView({
    required bool isLandscape,
    required bool isDark,
    required Color bgColor,
  }) {
    return PDFView(
        key: ValueKey('$_localPath-$isLandscape-$isDark'),
        filePath: _localPath!,
        enableSwipe: true,
        swipeHorizontal: false,
        autoSpacing: false,
        pageFling: false,
        pageSnap: false,
        fitEachPage: true,
        fitPolicy: isLandscape ? FitPolicy.BOTH : FitPolicy.WIDTH,
        defaultPage: _currentPage > 0 ? _currentPage : _resumePage,
        nightMode: isDark,
        backgroundColor: bgColor,
        onViewCreated: (controller) {
          _pdf = controller;
        },
        onRender: (pages) {
          if (!mounted) return;
          final isFirstRender = _renderedDocument != _localPath;
          _renderedDocument = _localPath;
          setState(() => _pageCount = pages ?? 0);
          _publish();
          unawaited(_seedViewport());
          if (isFirstRender) _syncToAudio(seeking: true);
        },
        onPageChanged: (page, total) {
          if (!mounted) return;
          final next = page ?? 0;
          if (_lastAutoPage != next) _lastManualTurn = DateTime.now();
          setState(() => _currentPage = next);
          _publish();
          _rememberPage(next);
        },
        onError: (e) {
          if (mounted) {
            setState(
              () => _error = const ApiException('This document could not be rendered.'),
            );
          }
        },
        onPageError: (page, e) {
          debugPrint('PDFView error on page $page: $e');
        },
        // Emitted on every scroll and zoom, which is what lets the marker layer
        // stay glued to the page rather than floating over it. The offsets are
        // negative going down on both platforms.
        onDraw: (xOffset, yOffset, scale) {
          if (!mounted) return;
          _scale = scale <= 0 ? 1 : scale;
          final width = _viewportSize?.width ?? 0;
          final aspect = _pageAspect;
          if (width <= 0 || aspect == null) {
            // The aspect arrives one platform call after the first render;
            // ask for it now so the next frame can place the strokes.
            unawaited(_ensurePageAspect());
            return;
          }
          final pageWidth = width * _scale;
          final next = PdfViewport(
            offset: Offset(xOffset, yOffset),
            scale: _scale,
            pageHeight: pageWidth * aspect,
            pageWidth: pageWidth,
          );
          final previous = _viewport.value;
          if (previous?.offset == next.offset && previous?.scale == next.scale) {
            return;
          }
          // Written straight to the notifier: the marker layer listens to it and
          // repaints on the spot, in the same frame the scroll was reported.
          _viewport.value = next;
        },
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
