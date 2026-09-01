import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/offline.dart';
import '../../data/repositories/books_repository.dart';
import '../offline/offline_providers.dart';
import '../../core/utils/orientation.dart';
import '../../core/utils/secure_screen.dart';
import '../pdfs/pdf_viewer_screen.dart';
import '../pdfs/widgets/pdf_document_view.dart';
import '../videos/video_player_screen.dart';
import 'books_providers.dart';
import 'reader_audio_controller.dart';
import 'reader_types.dart';
import 'widgets/reader_audio_player.dart';
import 'widgets/reader_contents_drawer.dart';

/// The multimedia reader: one topic at a time, with its narration, class video
/// and notes attached.
///
/// Paging a unit at a time (rather than one long scroll, as on desktop) keeps a
/// single audio decoder and at most one video thumbnail alive no matter how
/// large the book is.
class BookReaderScreen extends ConsumerStatefulWidget {
  const BookReaderScreen({
    super.key,
    required this.bookId,
    this.autoResume = false,
  });

  final String bookId;

  /// Set by the dashboard's "Continue reading", where the intent to jump is
  /// explicit; otherwise the resume point is offered as a dismissible banner.
  final bool autoResume;

  @override
  ConsumerState<BookReaderScreen> createState() => _BookReaderScreenState();
}

class _BookReaderScreenState extends ConsumerState<BookReaderScreen> {
  final _scrollController = ScrollController();

  /// Needed because the contents button lives in a child widget, and only the
  /// Scaffold's own state can open its drawer.
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  /// Set when the student taps a speaker in the sidebar: the unit that should
  /// start playing as soon as its page is built. Cleared by [_goTo], so an
  /// autoplay never fires twice or follows them to the next topic.
  String? _autoPlayUnitId;

  List<ReadingUnit> _units = const [];
  List<ChapterSummary> _chapters = const [];

  int _activeIndex = 0;

  /// Progress is "furthest reached", never the live position — going back to
  /// re-read an earlier topic must not undo what has already been read.
  int _maxReached = 0;

  int? _savedIndex;
  bool _showResumeBanner = false;
  bool _hydrated = false;
  bool _autoResumed = false;

  /// Set when the content came out of the offline vault.
  OfflineBook? _offline;

  /// Held in state because the drawer is attached to the Scaffold, above the
  /// async body that knows the book.
  String _bookTitle = '';

  /// Set once the student deliberately asks for the notes instead of the
  /// document. Sticky across topics for the rest of the session: someone
  /// reading the written notes wants the next topic's notes too, and having
  /// the view flip back to the PDF on every Next would be maddening.
  ///
  /// Default false, which is what makes a topic's PDF the first thing on
  /// screen with nothing to tap.
  bool _preferNotes = false;

  /// How far through the open document, for the app bar's page count.
  PdfViewState? _pdfState;

  /// The narration url the shared player was last pointed at, so the reader
  /// does not reload the same clip on every rebuild.
  String? _loadedAudioUrl;

  /// Held rather than read back in [dispose]: `ref` is already disposed by the
  /// time a ConsumerState is torn down, so reading a provider there throws.
  /// For the narration that meant it was never stopped; for the repository it
  /// meant the closing progress flush — the whole point of which is to catch
  /// the position when the reader is shut straight after a jump — threw before
  /// it ever reached the network.
  ReaderAudioController? _audio;
  BooksRepository? _books;

  /// Remote media URL to the decrypted working copy on disk. Populated lazily,
  /// one unit at a time — decrypting a whole book's audio up front would cost
  /// hundreds of megabytes of cache for files the student may never open.
  final Map<String, String> _localPaths = {};

  // ── Auto-scroll ───────────────────────────────────────────────────────
  Timer? _scrollTicker;

  /// While the student is dragging, auto-scroll stands down. Nothing is more
  /// irritating than a page that scrolls itself back while you are reading.
  DateTime _lastManualScroll = DateTime.fromMillisecondsSinceEpoch(0);

  Timer? _saveTimer;

  @override
  void initState() {
    super.initState();
    // A book page is a fixed shape and a landscape phone fits one at a
    // readable size, so the reader is one of the two screens that leaves the
    // app-wide portrait lock. Restored in dispose.
    allowAllOrientations();
    // Book content is the paid product: block screenshots and screen recording
    // for as long as it is on screen, including the full-screen document viewer
    // opened from here, which shares this window. Released in dispose.
    unawaited(requestSecureScreen());
    // Drive the scroll off the shared player, so it keeps working no matter
    // which screen started playback.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final audio = ref.read(readerAudioProvider);
      _audio = audio;
      _books = ref.read(booksRepositoryProvider);
      audio.playing.addListener(_onPlayingChanged);
      _startScrollTicker();
    });
  }

  @override
  void dispose() {
    restorePortraitOnly();
    unawaited(releaseSecureScreen());
    _scrollTicker?.cancel();
    _audio?.playing.removeListener(_onPlayingChanged);
    // Narration should not follow the student out of the book.
    if (_audio != null) unawaited(_audio!.stop());
    _releaseWorkingCopies();
    _saveTimer?.cancel();
    // Flush whatever the debounce is still holding, so closing the reader right
    // after a jump does not lose that position.
    _flushProgress();
    _scrollController.dispose();
    super.dispose();
  }

  /// Runs once, when both the content and the saved progress row have landed.
  void _hydrate(List<ReadingUnit> units, dynamic progress) {
    if (_hydrated || units.isEmpty) return;
    _hydrated = true;

    _units = units;
    _chapters = buildChapterSummaries(units);

    if (progress != null) {
      final resumeIndex = resolveResumeIndex(
        units,
        topicId: progress.topicId as String?,
        chapterId: progress.chapterId as String?,
      );
      if (resumeIndex > 0) {
        _savedIndex = resumeIndex;
        _maxReached = resumeIndex;
        if (widget.autoResume) {
          _activeIndex = resumeIndex;
          _autoResumed = true;
        } else {
          _showResumeBanner = true;
        }
      }
    }

    // The unit the reader opens on needs its media decrypted too — navigating
    // is not the only way to arrive at one.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _units.isNotEmpty) {
        unawaited(_resolveLocalAssets(_units[_activeIndex]));
      }
    });
  }

  /// Drops the decrypted copies this screen made, so plaintext does not outlive
  /// the reading session.
  void _releaseWorkingCopies() {
    final offline = _offline;
    if (offline == null || _localPaths.isEmpty) return;
    final repo = ref.read(offlineRepositoryProvider);
    for (final url in _localPaths.keys) {
      final asset = offline.assetForUrl(url);
      if (asset != null) unawaited(repo.closeAsset(asset));
    }
    _localPaths.clear();
  }

  /// Decrypts the media the active unit needs into the private cache.
  Future<void> _resolveLocalAssets(ReadingUnit unit) async {
    final offline = _offline;
    if (offline == null) return;

    for (final url in [unit.audioUrl, unit.pdfUrl]) {
      if (url == null || url.isEmpty || _localPaths.containsKey(url)) continue;
      final asset = offline.assetForUrl(url);
      if (asset == null) continue;
      final file = await ref
          .read(offlineRepositoryProvider)
          .openAsset(offline.bookId, asset);
      if (file != null && mounted) {
        setState(() => _localPaths[url] = file.path);
      }
    }
  }

  void _onPlayingChanged() {
    if (!mounted) return;
    if (ref.read(readerAudioProvider).playing.value) {
      _startScrollTicker();
    } else {
      _scrollTicker?.cancel();
      _scrollTicker = null;
    }
  }

  /// Walks the page towards the point in the topic the narration has reached.
  ///
  /// Driven by a slow ticker animating to a target rather than by jumping on
  /// every position event: the position stream fires several times a second,
  /// and jumping on each one reads as a stutter instead of a scroll.
  void _startScrollTicker() {
    _scrollTicker?.cancel();
    final audio = ref.read(readerAudioProvider);
    if (!ref.read(autoScrollProvider) || !audio.playing.value) return;

    const interval = Duration(milliseconds: 400);
    _scrollTicker = Timer.periodic(interval, (_) {
      if (!mounted) return;
      if (!ref.read(autoScrollProvider) || !audio.playing.value) return;
      if (!_scrollController.hasClients) return;

      // Yield to a student who is scrolling by hand.
      if (DateTime.now().difference(_lastManualScroll) <
          const Duration(seconds: 4)) {
        return;
      }

      final max = _scrollController.position.maxScrollExtent;
      if (max <= 0) return;

      final target = max * audio.fraction.value;
      // Only ever move forward, and only when the gap is worth animating.
      if (target - _scrollController.offset < 1) return;

      _scrollController.animateTo(
        target,
        duration: interval,
        curve: Curves.linear,
      );
    });
  }

  void _goTo(int index, {bool scrollToTop = true}) {
    if (index < 0 || index >= _units.length) return;
    setState(() {
      _activeIndex = index;
      if (index > _maxReached) _maxReached = index;
      _showResumeBanner = false;
      _autoPlayUnitId = null;
    });
    _scrollTicker?.cancel();
    _scrollTicker = null;
    unawaited(_resolveLocalAssets(_units[index]));
    if (scrollToTop && _scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
      );
    }
    _scheduleProgressSave();
  }

  /// Reading is a burst of taps; coalesce them into one write.
  void _scheduleProgressSave() {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 1200), _flushProgress);
  }

  void _flushProgress() {
    if (_units.isEmpty) return;
    final books = _books;
    if (books == null) return;
    final unit = _units[_activeIndex];
    final percent = (((_maxReached + 1) / _units.length) * 100).round();

    // Fire and forget: a failed progress write must never interrupt reading.
    unawaited(
      books
          .saveProgress(
            bookId: widget.bookId,
            chapterId: unit.chapterId,
            topicId: unit.topicId,
            progressPercent: percent.clamp(0, 100),
          )
          .catchError((_) {}),
    );
  }

  /// Opens a unit from the sidebar and starts its narration.
  ///
  /// The old app's speaker button did exactly this — jump there and play — and
  /// it is the reason the sidebar is worth opening at all for an audio-first
  /// student. Playback itself is left to the page's own player so there is
  /// still only ever one set of transport controls on screen.
  void _openUnitAudio(int index) {
    if (index < 0 || index >= _units.length) return;
    final unit = _units[index];
    if (!unit.hasAudio) return;

    if (index == _activeIndex) {
      // Already the open page: its player is mounted with this clip loaded, so
      // rebuilding nothing and just starting it is both correct and instant.
      final audio = ref.read(readerAudioProvider);
      if (!audio.playing.value) audio.togglePlay();
      return;
    }

    _goTo(index);
    setState(() => _autoPlayUnitId = unit.id);
  }

  /// Points the shared player at the open topic's narration.
  ///
  /// Done here rather than inside the player widget because the document view
  /// shows only the mini transport, which displays what is loaded but never
  /// loads anything — so with the player widget owning the source, narration
  /// would be silent for exactly the view that most needs it.
  void _loadUnitAudio(ReadingUnit unit) {
    final audio = ref.read(readerAudioProvider);

    if (!unit.hasAudio) {
      if (_loadedAudioUrl != null) {
        _loadedAudioUrl = null;
        unawaited(audio.stop());
      }
      return;
    }

    final url = _localPaths[unit.audioUrl] ?? unit.audioUrl!;
    if (_loadedAudioUrl == url) return;
    _loadedAudioUrl = url;
    unawaited(audio.load(
      url,
      label: unit.title,
      autoPlay: _autoPlayUnitId == unit.id ||
          (_autoResumed && _activeIndex == _savedIndex),
    ));
  }

  Widget _buildContentsPanel(String bookTitle, {VoidCallback? onClose}) {
    return ReaderContentsPanel(
      bookTitle: bookTitle,
      chapters: _chapters,
      activeIndex: _activeIndex,
      maxReached: _maxReached,
      totalUnits: _units.length,
      onSelect: (index) {
        onClose?.call();
        _goTo(index);
      },
      onPlayAudio: (index) {
        onClose?.call();
        _openUnitAudio(index);
      },
      onClose: onClose,
    );
  }

  /// Below this the sidebar is a drawer; at or above it there is room to pin it
  /// open beside the page, which is what a tablet or a large foldable wants.
  static const _pinnedSidebarBreakpoint = 840.0;

  /// Paired with the width above so a landscape phone is not mistaken for a
  /// tablet: both are wide, only one has the height to spare.
  static const _tabletMinHeight = 600.0;

  /// Under this there is no room for anything but the page and its controls.
  static const _shortViewportHeight = 520.0;

  @override
  Widget build(BuildContext context) {
    final sourceAsync = ref.watch(readerSourceProvider(widget.bookId));
    final progressAsync = ref.watch(bookProgressProvider(widget.bookId));

    final size = MediaQuery.sizeOf(context);
    final width = size.width;
    // A phone turned sideways is wide but very short. Pinning a 340dp panel
    // there would leave the page a sliver, so the sidebar stays a drawer
    // unless the screen is a genuine tablet — wide *and* tall.
    final isWide =
        width >= _pinnedSidebarBreakpoint && size.height >= _tabletMinHeight;
    // Landscape on a phone: everything optional gives up its height so the
    // page keeps as much as possible.
    final isShort = size.height < _shortViewportHeight;

    return Scaffold(
      key: _scaffoldKey,
      // No drawer when the panel is already pinned open — two copies of the
      // contents, one hidden behind an edge swipe, would be worse than one.
      drawer: isWide
          ? null
          : Drawer(
              // Narrow enough on a small phone to leave the page visible
              // behind it, so the sidebar reads as a layer over the book.
              width: width * 0.86 > 340 ? 340 : width * 0.86,
              // Built through a Builder, not inline: the chapter tree is
              // assembled further down this same build pass, inside the async
              // body, so anything read here directly would be a frame stale —
              // which on the first build means an empty drawer that never
              // refills. The closure defers the read until the drawer opens.
              child: Builder(
                builder: (drawerContext) => _buildContentsPanel(
                  _bookTitle,
                  onClose: () => Navigator.of(drawerContext).maybePop(),
                ),
              ),
            ),
      body: AsyncView(
        value: sourceAsync,
        onRetry: () => ref.invalidate(readerSourceProvider(widget.bookId)),
        loading: const _ReaderSkeleton(),
        data: (source) {
          final content = source.content;
          _offline = source.offline;
          _bookTitle = content.title;
          final units = flattenChapters(content.chapters);

          // Wait for the progress row before settling on a starting unit, so
          // the reader never opens at chapter 1 and then jumps. Offline that
          // request will fail rather than hang, and hydration proceeds without
          // a resume point.
          if (!_hydrated && progressAsync.isLoading) {
            return const _ReaderSkeleton();
          }
          _hydrate(units, progressAsync.valueOrNull);

          if (_units.isEmpty) {
            return Scaffold(
              appBar: AppBar(title: Text(content.title)),
              body: const EmptyView(
                icon: Icons.menu_book_rounded,
                title: 'No chapters yet',
                message:
                    'This book has no readable topics published at the moment.',
              ),
            );
          }

          final unit = _units[_activeIndex];
          final percent = ((_maxReached + 1) / _units.length).clamp(0.0, 1.0);

          // The document is the reader's default face. A topic that carries a
          // PDF opens straight onto it — no tile to find, no tap — and the
          // written notes are one toggle away.
          final showDocument = unit.hasPdf && !_preferNotes;

          // The clip belongs to the topic, not to whichever view is drawing.
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _loadUnitAudio(unit);
          });

          final page = Column(
            children: [
              _ReaderAppBar(
                bookTitle: content.title,
                unit: unit,
                progress: percent,
                position: '${_activeIndex + 1} / ${_units.length}',
                isOffline: source.isOffline,
                // Only meaningful where there is narration to follow.
                showAutoScroll: unit.hasAudio,
                autoScroll: ref.watch(autoScrollProvider),
                onToggleAutoScroll: () {
                  ref.read(autoScrollProvider.notifier).toggle();
                  _startScrollTicker();
                },
                onContents:
                    isWide ? null : () => _scaffoldKey.currentState?.openDrawer(),
                showingDocument: showDocument,
                onToggleView: unit.hasPdf
                    ? () => setState(() {
                          _preferNotes = !_preferNotes;
                          _pdfState = null;
                        })
                    : null,
                pageLabel: showDocument && _pdfState != null && _pdfState!.isReady
                    ? 'p.${_pdfState!.currentPage + 1}/${_pdfState!.pageCount}'
                    : null,
                isCompact: isShort,
                onPrev: _activeIndex > 0 ? () => _goTo(_activeIndex - 1) : null,
                onNext: _activeIndex < _units.length - 1
                    ? () => _goTo(_activeIndex + 1)
                    : null,
              ),
              // Hidden in landscape, where the banner would cost a third of
              // what is left for the page itself.
              if (_showResumeBanner && _savedIndex != null && !isShort)
                _ResumeBanner(
                  unitTitle: _units[_savedIndex!].title,
                  onResume: () => _goTo(_savedIndex!),
                  onDismiss: () => setState(() => _showResumeBanner = false),
                ),
              if (showDocument)
                Expanded(
                  child: PdfDocumentView(
                    // Keyed by topic so each document keeps its own place and
                    // starts its own sync rather than inheriting the last
                    // topic's page.
                    key: ValueKey('pdf-${unit.id}'),
                    url: unit.pdfUrl!,
                    localPath: _localPaths[unit.pdfUrl],
                    syncCues: unit.syncCues,
                    onStateChanged: (state) {
                      if (!mounted) return;
                      if (_pdfState?.currentPage == state.currentPage &&
                          _pdfState?.pageCount == state.pageCount) {
                        return;
                      }
                      setState(() => _pdfState = state);
                    },
                  ),
                )
              else
              Expanded(
                child: NotificationListener<ScrollNotification>(
                  onNotification: (notification) {
                    // Only a real drag counts — the ticker's own animateTo
                    // also emits scroll notifications, and treating those as
                    // manual input would switch auto-scroll off instantly.
                    if (notification is ScrollStartNotification &&
                        notification.dragDetails != null) {
                      _lastManualScroll = DateTime.now();
                    } else if (notification is ScrollUpdateNotification &&
                        notification.dragDetails != null) {
                      _lastManualScroll = DateTime.now();
                    }
                    return false;
                  },
                  child: ListView(
                  controller: _scrollController,
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
                  children: [
                    if (unit.isChapterStart) ...[
                      _ChapterDivider(
                        number: unit.chapterNumber,
                        title: unit.chapterTitle,
                      ),
                      const SizedBox(height: 20),
                    ],
                    Row(
                      children: [
                        AppBadge(
                          unit.isSubtopic
                              ? 'SUBTOPIC ${unit.chapterNumber}.${unit.topicNumber}'
                              : 'TOPIC ${unit.chapterNumber}.${unit.topicNumber}',
                        ),
                        const Spacer(),
                        if (unit.hasAudio)
                          const Icon(Icons.headphones_rounded,
                              size: 15, color: AppColors.cyan),
                        if (unit.hasVideo)
                          const Padding(
                            padding: EdgeInsets.only(left: 8),
                            child: Icon(Icons.smart_display_rounded,
                                size: 15, color: AppColors.red),
                          ),
                        if (unit.hasPdf)
                          const Padding(
                            padding: EdgeInsets.only(left: 8),
                            child: Icon(Icons.picture_as_pdf_rounded,
                                size: 15, color: AppColors.amber),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      unit.title,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w900,
                            height: 1.25,
                            letterSpacing: -0.4,
                          ),
                    ),
                    const SizedBox(height: 18),

                    if (unit.hasAudio) ...[
                      ReaderAudioPlayer(
                        // Keying by unit id gives each topic a fresh player
                        // rather than inheriting the previous clip's position.
                        key: ValueKey('audio-${unit.id}'),
                        url: _localPaths[unit.audioUrl] ?? unit.audioUrl!,
                        title: unit.title,
                        // The reader loads the clip; this is the transport
                        // for it, not a second owner of the source.
                        autoLoad: false,
                      ),
                      const SizedBox(height: 16),
                    ],

                    if (unit.hasVideo) ...[
                      ReaderVideoCard(
                        youtubeUrl: unit.youtubeUrl!,
                        onPlay: () => openVideo(
                          context,
                          VideoPlayerArgs(
                            youtubeUrl: unit.youtubeUrl!,
                            title: unit.title,
                          ),
                        ),
                      ),
                      if (source.isOffline) ...[
                        const SizedBox(height: 8),
                        const _OfflineNotice(
                          message:
                              'Video classes stream from YouTube, so this one '
                              'needs a connection.',
                        ),
                      ],
                      const SizedBox(height: 16),
                    ],

                    if (unit.hasBody)
                      SelectableText(
                        unit.description!.trim(),
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              height: 1.75,
                              fontSize: 16,
                              color: context.palette.textPrimary
                                  .withValues(alpha: 0.92),
                            ),
                      )
                    else if (!unit.hasMedia)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 20),
                        child: Text(
                          'Notes for this topic are being prepared.',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: context.palette.textMuted,
                                fontStyle: FontStyle.italic,
                              ),
                        ),
                      ),

                    if (unit.hasPdf) ...[
                      const SizedBox(height: 20),
                      Builder(
                        builder: (context) {
                          final resumePage = rememberedPdfPage(
                            ref.read(sharedPrefsProvider),
                            unit.pdfUrl!,
                          );
                          final offlineNote =
                              _localPaths.containsKey(unit.pdfUrl)
                                  ? 'Saved on this device'
                                  : 'Tap to read the PDF';
                          return PdfAttachmentTile(
                            title: 'Document — ${unit.title}',
                            subtitle: resumePage > 0
                                ? 'Continue on page ${resumePage + 1}'
                                : offlineNote,
                            // Switches this page back to the document rather
                            // than stacking another screen on top of it: the
                            // document is a view of the topic, not a detour
                            // the student has to press back out of.
                            onTap: () => setState(() => _preferNotes = false),
                          );
                        },
                      ),
                    ],
                  ],
                  ),
                ),
              ),
              // The document fills the screen, so the narration transport
              // sits with the page controls — the same shape the full-screen
              // document viewer uses. It draws nothing when no clip is loaded.
              if (showDocument) const ReaderMiniPlayer(),
              // A landscape phone has roughly 400dp of height; a full footer
              // would take a fifth of it for two buttons that now live in the
              // app bar instead.
              if (!isShort)
                _ReaderFooter(
                  canGoBack: _activeIndex > 0,
                  canGoForward: _activeIndex < _units.length - 1,
                  onPrev: () => _goTo(_activeIndex - 1),
                  onNext: () => _goTo(_activeIndex + 1),
                  isLast: _activeIndex == _units.length - 1,
                ),
            ],
          );

          if (!isWide) return page;

          // Tablet and foldable: the contents sit permanently alongside the
          // page, so moving between topics costs no gesture at all. The text
          // column is capped rather than allowed to fill the rest of a wide
          // screen — a 900px line length is unreadable.
          return Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(width: 340, child: _buildContentsPanel(content.title)),
              VerticalDivider(width: 1, color: context.palette.border),
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 760),
                    child: page,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ReaderAppBar extends StatelessWidget {
  const _ReaderAppBar({
    required this.bookTitle,
    required this.unit,
    required this.progress,
    required this.position,
    required this.isOffline,
    required this.showAutoScroll,
    required this.autoScroll,
    required this.onToggleAutoScroll,
    required this.onContents,
    required this.showingDocument,
    required this.onToggleView,
    required this.pageLabel,
    required this.isCompact,
    required this.onPrev,
    required this.onNext,
  });

  final String bookTitle;
  final ReadingUnit unit;
  final double progress;
  final String position;
  final bool isOffline;
  final bool showAutoScroll;
  final bool autoScroll;
  final VoidCallback onToggleAutoScroll;

  /// Null when the contents panel is pinned open beside the page and there is
  /// nothing to open.
  final VoidCallback? onContents;

  /// True while the topic's PDF is the thing on screen.
  final bool showingDocument;

  /// Swaps between the document and the written notes. Null on a topic that
  /// has no document, where there is nothing to swap to.
  final VoidCallback? onToggleView;

  /// e.g. `p.3/12`, appended to the subtitle while a document is open.
  final String? pageLabel;

  /// Landscape on a phone: every row costs the page, so the second line of the
  /// title folds away into the first and the footer's job moves up here.
  final bool isCompact;

  /// Only wired while [isCompact] — otherwise paging lives in the footer.
  /// Null at either end of the book.
  final VoidCallback? onPrev;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Material(
      color: palette.card,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(4, isCompact ? 2 : 6, 12,
                  isCompact ? 2 : 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_rounded),
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isCompact ? unit.title : bookTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  ),
                        ),
                        if (!isCompact)
                          Text(
                            'Chapter ${unit.chapterNumber} · $position'
                            '${pageLabel == null ? '' : ' · $pageLabel'}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(color: palette.textMuted),
                          ),
                      ],
                    ),
                  ),
                  if (isOffline)
                    Padding(
                      padding: const EdgeInsets.only(right: 4),
                      child: Tooltip(
                        message: 'Reading the copy saved on this device',
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: AppColors.emerald.withValues(alpha: 0.13),
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusSm),
                          ),
                          child: const Icon(Icons.offline_pin_rounded,
                              size: 16, color: AppColors.emerald),
                        ),
                      ),
                    ),
                  if (showAutoScroll)
                    Tooltip(
                      message: autoScroll
                          ? showingDocument
                              ? 'Pages turn with the audio — tap to turn off'
                              : 'Auto-scroll on — follows the audio'
                          : showingDocument
                              ? 'Auto page-turn off'
                              : 'Auto-scroll off',
                      child: InkWell(
                        onTap: onToggleAutoScroll,
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                        child: Container(
                          margin: const EdgeInsets.only(right: 4),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 9, vertical: 6),
                          decoration: BoxDecoration(
                            color: autoScroll
                                ? AppColors.cyan.withValues(alpha: 0.14)
                                : palette.elevated,
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusSm),
                            border: Border.all(
                              color: autoScroll
                                  ? AppColors.cyan.withValues(alpha: 0.4)
                                  : palette.border,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                autoScroll
                                    ? Icons.swipe_vertical_rounded
                                    : Icons.do_not_touch_outlined,
                                size: 15,
                                color: autoScroll
                                    ? AppColors.cyan
                                    : palette.textMuted,
                              ),
                              const SizedBox(width: 5),
                              Text(
                                autoScroll ? 'AUTO' : 'OFF',
                                style: Theme.of(context)
                                    .textTheme
                                    .labelSmall
                                    ?.copyWith(
                                      color: autoScroll
                                          ? AppColors.cyan
                                          : palette.textMuted,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 9.5,
                                    ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  // In landscape the footer is gone, so the page controls sit
                  // here instead of leaving the student stranded on one topic.
                  if (isCompact) ...[
                    IconButton(
                      tooltip: 'Previous topic',
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.chevron_left_rounded),
                      onPressed: onPrev,
                    ),
                    IconButton(
                      tooltip: 'Next topic',
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.chevron_right_rounded),
                      onPressed: onNext,
                    ),
                  ],
                  if (onToggleView != null)
                    IconButton(
                      tooltip: showingDocument
                          ? 'Show the written notes'
                          : 'Show the document',
                      visualDensity: VisualDensity.compact,
                      icon: Icon(
                        showingDocument
                            ? Icons.article_rounded
                            : Icons.picture_as_pdf_rounded,
                        color: showingDocument
                            ? palette.textSecondary
                            : AppColors.rose,
                      ),
                      onPressed: onToggleView,
                    ),
                  if (onContents != null)
                    IconButton(
                      tooltip: 'Chapters and topics',
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.menu_rounded),
                      onPressed: onContents,
                    ),
                ],
              ),
            ),
            SizedBox(
              height: 3,
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: palette.elevated,
                valueColor: const AlwaysStoppedAnimation(AppColors.cyan),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Explains something the offline copy cannot provide, in place of failing
/// silently when the student taps it.
class _OfflineNotice extends StatelessWidget {
  const _OfflineNotice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: AppColors.amber.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border.all(color: AppColors.amber.withValues(alpha: 0.26)),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, size: 14, color: AppColors.amber),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
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

class _ChapterDivider extends StatelessWidget {
  const _ChapterDivider({required this.number, required this.title});

  final int number;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.cyan.withValues(alpha: 0.14),
            AppColors.indigo.withValues(alpha: 0.08),
          ],
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(color: AppColors.cyan.withValues(alpha: 0.28)),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              gradient: AppColors.brandGradient,
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            ),
            alignment: Alignment.center,
            child: Text(
              '$number',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 16,
              ),
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'CHAPTER $number',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AppColors.cyan,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                        fontSize: 10,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        height: 1.25,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ResumeBanner extends StatelessWidget {
  const _ResumeBanner({
    required this.unitTitle,
    required this.onResume,
    required this.onDismiss,
  });

  final String unitTitle;
  final VoidCallback onResume;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.fromLTRB(14, 11, 8, 11),
      decoration: BoxDecoration(
        color: AppColors.cyan.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppColors.cyan.withValues(alpha: 0.32)),
      ),
      child: Row(
        children: [
          const Icon(Icons.bookmark_rounded, size: 18, color: AppColors.cyan),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Pick up where you left off',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                Text(
                  unitTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: context.palette.textMuted,
                      ),
                ),
              ],
            ),
          ),
          TextButton(onPressed: onResume, child: const Text('Resume')),
          IconButton(
            icon: const Icon(Icons.close_rounded, size: 17),
            onPressed: onDismiss,
          ),
        ],
      ),
    );
  }
}

class _ReaderFooter extends StatelessWidget {
  const _ReaderFooter({
    required this.canGoBack,
    required this.canGoForward,
    required this.onPrev,
    required this.onNext,
    required this.isLast,
  });

  final bool canGoBack;
  final bool canGoForward;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Material(
      color: palette.card,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: canGoBack ? onPrev : null,
                  icon: const Icon(Icons.chevron_left_rounded, size: 20),
                  // "Previous" wraps in the third of the bar this button gets;
                  // the arrow already carries the direction.
                  label: const Text('Back'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: GradientButton(
                  label: isLast ? 'Finish book' : 'Next topic',
                  icon: isLast
                      ? Icons.check_circle_rounded
                      : Icons.chevron_right_rounded,
                  onPressed: canGoForward
                      ? onNext
                      : () => Navigator.of(context).maybePop(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReaderSkeleton extends StatelessWidget {
  const _ReaderSkeleton();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          SkeletonBox(height: 46, radius: AppTheme.radiusMd),
          SizedBox(height: 24),
          SkeletonBox(width: 110, height: 20, radius: 6),
          SizedBox(height: 14),
          SkeletonBox(height: 28),
          SizedBox(height: 22),
          SkeletonBox(height: 96, radius: AppTheme.radiusLg),
          SizedBox(height: 22),
          SkeletonBox(height: 16),
          SizedBox(height: 9),
          SkeletonBox(height: 16),
          SizedBox(height: 9),
          SkeletonBox(width: 220, height: 16),
        ],
      ),
    );
  }
}
