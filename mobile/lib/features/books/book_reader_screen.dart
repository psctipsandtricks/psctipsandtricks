import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/network/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_glass.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/offline.dart';
import '../../data/repositories/books_repository.dart';
import '../offline/offline_providers.dart';
import '../../core/utils/orientation.dart';
import '../../core/utils/secure_screen.dart';
import '../pdfs/widgets/pdf_document_view.dart';
import '../pdfs/widgets/pdf_transition_cover.dart';
import '../videos/video_player_screen.dart';
import 'audio_resume_store.dart';
import 'books_providers.dart';
import 'full_page_audio_player_screen.dart';
import 'reader_audio_controller.dart';
import 'reader_types.dart';
import 'widgets/reader_audio_player.dart';
import 'widgets/reader_contents_drawer.dart';

// The cover moved to the PDF widgets, where the standalone viewer can share it;
// re-exported so the reader's own tests keep reaching it from here.
export '../pdfs/widgets/pdf_transition_cover.dart' show documentTransitionCoverKey;

/// How hard the page pulls towards where the narration has reached, per 60fps
/// frame. Roughly a 140ms time constant: attached to the audio, but loose
/// enough that a seek glides rather than snaps. Matches the website's reader.
const double _followEasePerFrame = 0.12;

/// Below this the page is where it should be; moving again would only jitter.
const double _followSettlePx = 0.5;

const double _frameMicros = 16667;

/// Whether the reading page should offer a way on to the next topic.
///
/// Exported so the rule can be held in place by a test: on screen it depends on
/// a native platform view reporting its page count, which no widget test has.
///
/// A student reading the notes on their own needs somewhere to go when they
/// reach the end of them. A student who is listening does not — the clip walks
/// them into the next topic when it plays out, and a button competing with that
/// would let them arrive twice.
bool readerOffersNextTopic({
  required PdfViewState? document,
  required bool hasNextTopic,
  required bool audioPlaying,
}) {
  if (!hasNextTopic || audioPlaying) return false;
  if (document == null || !document.isReady) return false;
  return document.currentPage >= document.pageCount - 1;
}

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
    this.resumeAudio = false,
  });

  final String bookId;

  /// Set by the dashboard's "Continue reading", where the intent to jump is
  /// explicit; otherwise the resume point is offered as a dismissible banner.
  final bool autoResume;

  /// Set by the detail screen's "Continue with audio": open on the narrated
  /// topic the student left, cued to the second they left it but paused —
  /// starting it is the student's call.
  final bool resumeAudio;

  @override
  ConsumerState<BookReaderScreen> createState() => _BookReaderScreenState();
}

class _BookReaderScreenState extends ConsumerState<BookReaderScreen>
    with SingleTickerProviderStateMixin {
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

  /// Set when the content came out of the offline vault.
  OfflineBook? _offline;

  /// Held in state because the drawer is attached to the Scaffold, above the
  /// async body that knows the book.
  String _bookTitle = '';

  /// How far through the open document, for the app bar's page count and for
  /// deciding whether the student has reached the end of the topic.
  PdfViewState? _pdfState;

  /// Set while one topic's document is being torn down and the next one's is
  /// rendering. The document is a native view: swapping one for another shows
  /// the old page, then a blank surface, then the new page — and the audio
  /// strip re-points at a different clip somewhere in the middle of that.
  /// Covering the swap turns the whole thing into one deliberate loading state.
  bool _switchingTopic = false;

  /// Ends the cover even if the incoming document never reports itself ready,
  /// so a document that fails to load shows its own error rather than sitting
  /// behind a spinner for ever.
  Timer? _switchTimer;

  /// Where this book's narration was left last time, read once on the way in.
  /// Non-null only while [BookReaderScreen.resumeAudio] is being honoured — it
  /// is consumed by the first [_loadUnitAudio] that matches its clip.
  AudioResumePoint? _pendingAudioResume;

  /// Whether narration has actually played this session, which is what makes a
  /// position worth writing down. Sticky once set: pausing, or folding the
  /// transport away to read on, is still the same listening session.
  ///
  /// Deliberately not "did they open the full-page player": a student who
  /// listens from the docked strip or the mini transport has listened, and
  /// "Continue with audio" is the offer to pick that up again.
  bool _listeningStarted = false;

  /// The narration url the shared player was last pointed at, so the reader
  /// does not reload the same clip on every rebuild.
  String? _loadedAudioUrl;

  /// Which topic that url belongs to, so a change of file for the same topic —
  /// the offline copy landing under a clip already streaming — can be told
  /// apart from moving to a different topic's narration.
  String? _loadedAudioUnitId;

  /// Held rather than read back in [dispose]: `ref` is already disposed by the
  /// time a ConsumerState is torn down, so reading a provider there throws.
  /// For the narration that meant it was never stopped; for the repository it
  /// meant the closing progress flush — the whole point of which is to catch
  /// the position when the reader is shut straight after a jump — threw before
  /// it ever reached the network.
  ReaderAudioController? _audio;
  BooksRepository? _books;
  SharedPreferences? _prefs;

  /// Remote media URL to the decrypted working copy on disk. Populated lazily,
  /// one unit at a time — decrypting a whole book's audio up front would cost
  /// hundreds of megabytes of cache for files the student may never open.
  final Map<String, String> _localPaths = {};

  // ── Auto-scroll ───────────────────────────────────────────────────────

  /// Eases the notes towards where the narration has reached, one frame at a
  /// time. A vsync ticker rather than a repeating timer because this paints:
  /// stepping the page every 400ms — even with each step animated — lands
  /// every correction slightly out of phase with the frames that draw it,
  /// which is what makes following the audio look like stuttering rather than
  /// gliding. Created once and started and stopped as playback comes and goes.
  Ticker? _scrollTicker;

  /// Timestamp of the previous tick, so easing is frame-rate independent.
  Duration _lastScrollTick = Duration.zero;

  /// While the student is dragging, auto-scroll stands down. Nothing is more
  /// irritating than a page that scrolls itself back while you are reading.
  DateTime _lastManualScroll = DateTime.fromMillisecondsSinceEpoch(0);

  Timer? _saveTimer;

  /// Writes the narration position down while a clip plays, so a session ended
  /// by the task switcher — where nothing gets to run on the way out — still
  /// leaves a point to come back to.
  Timer? _audioResumeTimer;

  /// Whether the system bars are currently hidden for this screen, so the
  /// request is only made when it actually changes rather than every frame.
  bool _immersive = false;

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
    // Read straight away rather than from the post-frame callback below: the
    // first build — which is where the resume point decides what page opens —
    // runs before that callback does.
    _prefs = ref.read(sharedPrefsProvider);
    if (widget.resumeAudio) {
      _pendingAudioResume = readAudioResume(_prefs!, widget.bookId);
    }
    // Drive the scroll off the shared player, so it keeps working no matter
    // which screen started playback.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Coming in to listen, the transport is the point of the screen; every
      // other way in starts folded away.
      ref
          .read(audioBarCollapsedProvider.notifier)
          .set(_pendingAudioResume == null);
      final audio = ref.read(readerAudioProvider);
      _audio = audio;
      _books = ref.read(booksRepositoryProvider);
      audio.playing.addListener(_onPlayingChanged);
      audio.onClipFinished = _onClipFinished;
      _startScrollTicker();
      _startAudioResumeTicker();
    });
  }

  @override
  void dispose() {
    restorePortraitOnly();
    if (_immersive) unawaited(exitImmersiveReading());
    unawaited(releaseSecureScreen());
    // Stopped first: disposing a ticker that is still scheduled asserts.
    _scrollTicker
      ?..stop()
      ..dispose();
    _audioResumeTimer?.cancel();
    _switchTimer?.cancel();
    _audio?.playing.removeListener(_onPlayingChanged);
    // Only ever ours to clear: the controller outlives this screen, and a
    // stale callback would walk a disposed reader through its chapters.
    if (_audio?.onClipFinished == _onClipFinished) {
      _audio?.onClipFinished = null;
    }
    // Before the stop below, which winds the position back to zero: this is the
    // point the detail screen's "Continue with audio" comes back to.
    _recordAudioResume();
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
        } else {
          _showResumeBanner = true;
        }
      }
    }

    // Coming in to carry on listening: the clip decides the page, over any
    // reading position, because it is the thing the student asked for.
    final resumeAudio = _pendingAudioResume;
    if (resumeAudio != null) {
      // Matched on the clip rather than the topic: the url is what actually
      // gets played, and a position means nothing against a different file.
      // The topic id only breaks a tie where two topics share one clip.
      var index = units.indexWhere((unit) =>
          unit.audioUrl == resumeAudio.audioUrl &&
          unit.id == resumeAudio.unitId);
      if (index < 0) {
        index =
            units.indexWhere((unit) => unit.audioUrl == resumeAudio.audioUrl);
      }
      if (index >= 0) {
        _activeIndex = index;
        _showResumeBanner = false;
        if (index > _maxReached) _maxReached = index;
      } else {
        // The clip is gone from the book — a re-published edition, or a topic
        // taken down. There is nothing to resume into.
        _pendingAudioResume = null;
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
      // Whichever transport started it — the docked strip, the mini player, the
      // full-page player or the lock screen — this book now has a listening
      // session worth offering back.
      _listeningStarted = true;
      _startScrollTicker();
    } else {
      // Stopped, not disposed: resuming picks the chase up from wherever the
      // reader now is rather than snapping to where the audio has got to.
      _scrollTicker?.stop();
      // Pausing is the clearest statement of where someone stopped listening.
      _recordAudioResume();
    }
  }

  /// Keeps the resume point roughly current while a clip plays.
  ///
  /// [dispose] catches the ordinary exit, but a session ended from the task
  /// switcher never gets to run it, and losing a half-hour of listening to that
  /// is exactly the case this feature exists for.
  void _startAudioResumeTicker() {
    _audioResumeTimer?.cancel();
    _audioResumeTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || _audio?.playing.value != true) return;
      _recordAudioResume();
    });
  }

  /// Writes down where this book's narration stands, for the detail screen's
  /// "Continue with audio". Storing a clip barely begun — or one played out —
  /// is handled by [saveAudioResume], which drops the record instead.
  void _recordAudioResume() {
    final prefs = _prefs;
    final audio = _audio;
    if (prefs == null || audio == null) return;
    // Nothing was ever played: there is no position to come back to.
    if (!_listeningStarted) return;
    if (_activeIndex >= _units.length) return;

    final unit = _units[_activeIndex];
    final url = unit.audioUrl;
    if (url == null || url.isEmpty) return;
    // Only what the player is actually holding: paging to a topic whose clip
    // has not been loaded must not record a position belonging to the last one.
    if (_loadedAudioUrl != url && _loadedAudioUrl != _localPaths[url]) return;

    unawaited(
      saveAudioResume(
        prefs,
        widget.bookId,
        AudioResumePoint(
          // Keyed by the remote url, not the decrypted working copy the offline
          // vault hands out — that path is gone by the next session.
          unitId: unit.id,
          audioUrl: url,
          title: unit.title,
          position: audio.position.value,
          duration: audio.duration.value,
        ),
      ),
    );
  }

  /// Walks the page towards the point in the topic the narration has reached.
  ///
  /// Driven by a slow ticker animating to a target rather than by jumping on
  /// every position event: the position stream fires several times a second,
  /// and jumping on each one reads as a stutter instead of a scroll.
  void _startScrollTicker() {
    final audio = ref.read(readerAudioProvider);
    if (!ref.read(autoScrollProvider) || !audio.playing.value) return;

    _scrollTicker ??= createTicker(_followNarration);
    if (_scrollTicker!.isTicking) return;
    _lastScrollTick = Duration.zero;
    _scrollTicker!.start();
  }

  /// Eases the page towards the point in the topic the narration has reached.
  ///
  /// Where the audio is and where the page is are deliberately kept apart: the
  /// first moves with playback, the second closes a fraction of the remaining
  /// gap each frame. That is what makes the page glide instead of stepping —
  /// and it means a pause simply stops the chase, leaving the reader wherever
  /// they were rather than parked at a position computed from a clock that has
  /// stopped ticking.
  void _followNarration(Duration elapsed) {
    if (!mounted) return;
    final audio = ref.read(readerAudioProvider);
    if (!ref.read(autoScrollProvider) || !audio.playing.value) {
      _scrollTicker?.stop();
      return;
    }
    if (!_scrollController.hasClients) return;

    // First frame after starting has no previous tick to measure against.
    final sinceLast = elapsed - _lastScrollTick;
    _lastScrollTick = elapsed;
    if (sinceLast <= Duration.zero) return;

    // Yield to a student who is scrolling by hand.
    if (DateTime.now().difference(_lastManualScroll) <
        const Duration(seconds: 4)) {
      return;
    }

    final max = _scrollController.position.maxScrollExtent;
    if (max <= 0) return;

    final target = max * audio.fraction.value;
    final gap = target - _scrollController.offset;
    if (gap.abs() < _followSettlePx) return;

    // Frame-rate independent, and the same rate as the website's reader, so a
    // book followed on a phone and on a laptop travels at the same speed.
    final frames = sinceLast.inMicroseconds / _frameMicros;
    final ease = 1 - math.pow(1 - _followEasePerFrame, frames);
    _scrollController.jumpTo(_scrollController.offset + gap * ease);
  }

  void _goTo(int index, {bool scrollToTop = true}) {
    if (index < 0 || index >= _units.length) return;
    final isDifferentTopic = index != _activeIndex;
    setState(() {
      _activeIndex = index;
      if (index > _maxReached) _maxReached = index;
      _showResumeBanner = false;
      _autoPlayUnitId = null;
      if (isDifferentTopic) {
        // The page count belongs to the document being left behind; keeping it
        // would offer "next topic" against the wrong document's last page.
        _pdfState = null;
        _switchingTopic = _units[index].hasPdf;
      }
    });
    if (isDifferentTopic) _armSwitchTimeout();
    _scrollTicker?.stop();
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

  /// Backstop for the topic-swap cover: the incoming document normally lifts it
  /// by reporting itself ready, but one that fails to download never will.
  void _armSwitchTimeout() {
    _switchTimer?.cancel();
    if (!_switchingTopic) return;
    _switchTimer = Timer(const Duration(milliseconds: 1200), _endTopicSwitch);
  }

  void _endTopicSwitch() {
    _switchTimer?.cancel();
    _switchTimer = null;
    if (!_switchingTopic || !mounted) return;
    setState(() => _switchingTopic = false);
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
  /// The next topic that actually carries narration, at or after [from].
  ///
  /// Walks past topics that have none rather than stopping at the first: a
  /// chapter often ends with a text-only summary, and stopping there would end
  /// the listening session a topic early.
  int? _nextAudioUnit(int from) {
    for (var i = from; i < _units.length; i++) {
      if (_units[i].hasAudio) return i;
    }
    return null;
  }

  int? _prevAudioUnit(int from) {
    for (var i = from; i >= 0; i--) {
      if (_units[i].hasAudio) return i;
    }
    return null;
  }

  void _openFullPageAudioPlayer(String bookTitle) {
    // Opening the player is itself an intent to listen, so it counts even
    // before the first frame of audio comes out — a student who opens it,
    // scrubs, and leaves has still told us where they are in the clip.
    _listeningStarted = true;
    Navigator.of(context, rootNavigator: true).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) {
          return FullPageAudioPlayerScreen(
            bookTitle: bookTitle,
            onNext: () {
              final next = _nextAudioUnit(_activeIndex + 1);
              if (next != null) _openUnitAudio(next);
            },
            onPrevious: () {
              final prev = _prevAudioUnit(_activeIndex - 1);
              if (prev != null) _openUnitAudio(prev);
            },
            hasNext: () => _nextAudioUnit(_activeIndex + 1) != null,
            hasPrevious: () => _prevAudioUnit(_activeIndex - 1) != null,
          );
        },
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          const begin = Offset(0.0, 1.0);
          const end = Offset.zero;
          const curve = Curves.easeOutCubic;
          final tween =
              Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
          return SlideTransition(
            position: animation.drive(tween),
            child: child,
          );
        },
      ),
    );
  }

  /// Continues to the next narrated topic when the current clip plays out, so
  /// a student listening with the screen off hears the chapter through rather
  /// than stopping at each topic boundary.
  void _onClipFinished() {
    if (!mounted) return;
    final next = _nextAudioUnit(_activeIndex + 1);
    if (next == null) return;
    _openUnitAudio(next);
  }

  void _openUnitAudio(int index) {
    if (index < 0 || index >= _units.length) return;
    final unit = _units[index];
    if (!unit.hasAudio) return;

    ref.read(audioBarCollapsedProvider.notifier).set(false);

    if (index == _activeIndex) {
      // Already the open page: its player is mounted with this clip loaded, so
      // rebuilding nothing and just starting it is both correct and instant.
      final audio = ref.read(readerAudioProvider);
      if (_loadedAudioUrl != unit.audioUrl) {
        _loadUnitAudio(unit);
      }
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
        _loadedAudioUnitId = null;
        unawaited(audio.stop());
      }
      return;
    }

    // Consumed here rather than in `_hydrate`: the point is only honoured once
    // the clip it belongs to is the one being loaded.
    final resume = _pendingAudioResume?.audioUrl == unit.audioUrl
        ? _pendingAudioResume
        : null;

    final url = _localPaths[unit.audioUrl] ?? unit.audioUrl!;
    if (_loadedAudioUrl == url && resume == null) return;

    // A downloaded book decrypts its copy a moment after the reader opens, so
    // the same narration changes file underneath a clip that is already
    // playing. Carry the position and playback across it — reloading from the
    // top would undo both an ordinary listen and a resume.
    final swappingFile = _loadedAudioUnitId == unit.id &&
        _loadedAudioUrl != null &&
        _loadedAudioUrl != url;

    _loadedAudioUrl = url;
    _loadedAudioUnitId = unit.id;
    if (resume != null) _pendingAudioResume = null;

    unawaited(audio.load(
      url,
      label: unit.title,
      // What the lock screen shows under the topic title.
      album: _bookTitle,
      // A resume from "Continue with audio" starts playback; reading resume does not.
      autoPlay: resume != null ||
          (swappingFile && audio.playing.value) ||
          _autoPlayUnitId == unit.id,
      initialPosition:
          resume?.position ?? (swappingFile ? audio.position.value : null),
    ));

    // Carrying on listening means the player, not the page: the student asked
    // for the thing they were last in, so open it over the reader after the
    // reader transition completes to prevent jarring conflicting route animations.
    if (resume != null) {
      void openAudioPlayer() {
        if (mounted) _openFullPageAudioPlayer(_bookTitle);
      }

      final routeAnim = ModalRoute.of(context)?.animation;
      if (routeAnim != null && !routeAnim.isCompleted) {
        late AnimationStatusListener listener;
        listener = (status) {
          if (status == AnimationStatus.completed) {
            routeAnim.removeStatusListener(listener);
            openAudioPlayer();
          }
        };
        routeAnim.addStatusListener(listener);
      } else {
        WidgetsBinding.instance.addPostFrameCallback((_) => openAudioPlayer());
      }
    }
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
        // The speaker in the contents is a request to listen, not to read with
        // narration behind the page — so it hands over the player, the same way
        // the reel icon beside it hands over the video.
        _openFullPageAudioPlayer(bookTitle);
      },
      onPlayVideo: (unit) {
        onClose?.call();
        if (unit.hasVideo) {
          openVideo(
            context,
            VideoPlayerArgs(
              youtubeUrl: unit.youtubeUrl!,
              title: unit.title,
              description: unit.description,
            ),
          );
        }
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

  /// The widest a column of body text is allowed to get before the side
  /// padding starts absorbing the rest of the screen.
  static const _maxTextColumn = 680.0;

  /// Horizontal padding for the notes, widening on a screen too wide to read
  /// straight across.
  static double _notesInset(double width) =>
      width <= _maxTextColumn ? 16 : (width - _maxTextColumn) / 2;

  /// Hides the system bars while the phone is sideways and puts them back the
  /// moment it is upright again.
  ///
  /// Called from `build` because rotation is exactly what changes the answer,
  /// and deferred a frame because setting the UI mode during a build would be
  /// a platform call in the middle of a layout pass.
  void _syncImmersive(bool wanted) {
    if (wanted == _immersive) return;
    _immersive = wanted;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(wanted ? enterImmersiveReading() : exitImmersiveReading());
    });
  }

  void _navigateBack() {
    try {
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
        return;
      }
    } catch (_) {}
    try {
      context.go(AppRoutes.bookDetail(widget.bookId));
    } catch (_) {
      try {
        Navigator.of(context).maybePop();
      } catch (_) {}
    }
  }

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
    // Including the status and navigation bars, which between them are worth
    // about a sixth of a sideways phone's height.
    _syncImmersive(isShort);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _navigateBack();
      },
      child: Scaffold(
        backgroundColor: context.palette.background,
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
      body: sourceAsync.when(
        loading: () => const _ReaderSkeleton(),
        error: (err, _) {
          final isForbidden = (err is ApiException && (err.isForbidden || err.statusCode == 403)) ||
              err.toString().toLowerCase().contains('forbidden') ||
              err.toString().toLowerCase().contains('payment');
          return Scaffold(
            appBar: GlassAppBar(
              title: const Text('Book Reader'),
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: _navigateBack,
              ),
            ),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: (isForbidden ? AppColors.amber : AppColors.rose).withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: (isForbidden ? AppColors.amber : AppColors.rose).withValues(alpha: 0.28),
                          width: 1.2,
                        ),
                      ),
                      child: Icon(
                        isForbidden ? Icons.lock_outline_rounded : Icons.error_outline_rounded,
                        color: isForbidden ? AppColors.amber : AppColors.rose,
                        size: 34,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      isForbidden ? 'Access Expired' : 'Unable to Open Reader',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      isForbidden
                          ? 'Your access to this book has ended. Renew your access to continue reading.'
                          : (err is ApiException ? err.message : 'Something went wrong while opening this book.'),
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: context.palette.textSecondary,
                            height: 1.45,
                          ),
                    ),
                    const SizedBox(height: 24),
                    GradientButton(
                      label: isForbidden ? 'View Book Details' : 'Back to Book Details',
                      icon: isForbidden ? Icons.shopping_bag_outlined : Icons.arrow_back_rounded,
                      compact: true,
                      onPressed: () => context.go(AppRoutes.bookDetail(widget.bookId)),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
        data: (source) {
          final content = source.content;
          _offline = source.offline;
          _bookTitle = content.title;
          final units = flattenChapters(content.chapters);

          // Wait for the progress row before settling on a starting unit, so
          // the reader never opens at chapter 1 and then jumps.
          //
          // Never for a book being read out of the vault, though: the resume
          // point only exists on the server, and a device with no route to it
          // does not always fail fast — a connected-but-dead network hangs
          // until the request times out, which would hold a downloaded book
          // behind a skeleton for the better part of a minute. Offline the
          // reader opens immediately and simply has no resume point.
          if (!_hydrated && progressAsync.isLoading && !source.isOffline) {
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
          // PDF opens straight onto it — no tile to find, no tap.
          final showDocument = unit.hasPdf;

          // The clip belongs to the topic, not to whichever view is drawing.
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _loadUnitAudio(unit);
          });

          // A topic with a document reads as a document: the page fills the
          // screen and the only chrome on it is the four corners — back, the
          // contents, the download, and the auto-scroll switch while there is
          // narration to follow. Everything else the reader can do lives in
          // the contents panel one tap away.
          if (showDocument) {
            return _DocumentReader(
              bookId: widget.bookId,
              isOffline: source.isOffline,
              hasAudio: unit.hasAudio,
              isSwitchingTopic: _switchingTopic,
              onExpandAudio: () => _openFullPageAudioPlayer(content.title),
              onBack: _navigateBack,
              onContents: isWide
                  ? null
                  : () => _scaffoldKey.currentState?.openDrawer(),
              autoScroll: ref.watch(autoScrollProvider),
              onToggleAutoScroll: () {
                ref.read(autoScrollProvider.notifier).toggle();
                _startScrollTicker();
              },
              documentState: _pdfState,
              hasNextTopic: _activeIndex < _units.length - 1,
              onNextTopic: () => _goTo(_activeIndex + 1),
              contents: isWide
                  ? SizedBox(
                      width: 340,
                      child: _buildContentsPanel(content.title),
                    )
                  : null,
              document: PdfDocumentView(
                // Keyed by topic so each document keeps its own place and
                // starts its own sync rather than inheriting the last topic's
                // page.
                key: ValueKey('pdf-${unit.id}'),
                url: unit.pdfUrl!,
                localPath: _localPaths[unit.pdfUrl],
                syncCues: unit.syncCues,
                onStateChanged: (state) {
                  if (!mounted) return;
                  // The incoming document has rendered: the swap is over, and
                  // whatever is on screen now is the new topic's.
                  if (state.isReady && _switchingTopic) _endTopicSwitch();
                  if (_pdfState?.currentPage == state.currentPage &&
                      _pdfState?.pageCount == state.pageCount) {
                    return;
                  }
                  setState(() => _pdfState = state);
                },
              ),
            );
          }

          final page = Column(
            children: [
              _ReaderAppBar(
                bookTitle: content.title,
                unit: unit,
                progress: percent,
                position: '${_activeIndex + 1} / ${_units.length}',
                isOffline: source.isOffline,
                onBack: _navigateBack,
                // Only meaningful where there is narration to follow.
                showAutoScroll: unit.hasAudio,
                autoScroll: ref.watch(autoScrollProvider),
                onToggleAutoScroll: () {
                  ref.read(autoScrollProvider.notifier).toggle();
                  _startScrollTicker();
                },
                onContents:
                    isWide ? null : () => _scaffoldKey.currentState?.openDrawer(),
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
                  // Sideways the page is 900dp across, and body text run to
                  // that width is a line no one can track back from. The
                  // padding grows instead, which keeps the column at a
                  // readable measure without a second scroll view around it.
                  padding: EdgeInsets.fromLTRB(
                    _notesInset(width),
                    18,
                    _notesInset(width),
                    28,
                  ),
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
                    ],
                  ),
                ),
              ),
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
    ),
  );
}
}

/// The reading page proper: the document, edge to edge, and nothing else but
/// the corners.
///
/// Deliberately spare. Back sits where it always does, the contents live under
/// the book icon at the bottom right, the download under the arrow at the
/// bottom left, and the narration transport docks along the foot when there is
/// a clip loaded. Auto-scroll is the one control that comes and goes: it is
/// meaningless without narration, so it appears only while something is
/// playing.
class _DocumentReader extends ConsumerStatefulWidget {
  const _DocumentReader({
    required this.bookId,
    required this.document,
    required this.isOffline,
    required this.onBack,
    required this.onContents,
    required this.autoScroll,
    required this.onToggleAutoScroll,
    this.contents,
    this.hasAudio = false,
    this.onExpandAudio,
    this.isSwitchingTopic = false,
    this.documentState,
    this.hasNextTopic = false,
    this.onNextTopic,
  });

  final String bookId;
  final Widget document;

  /// Reading out of the vault: there is nothing left to download.
  final bool isOffline;

  final VoidCallback onBack;

  /// Null on a tablet, where the contents are already pinned open alongside.
  final VoidCallback? onContents;

  final bool autoScroll;
  final VoidCallback onToggleAutoScroll;

  /// The pinned contents panel, on screens wide enough to hold one.
  final Widget? contents;

  final bool hasAudio;
  final VoidCallback? onExpandAudio;

  /// One topic's document is being swapped for the next one's.
  final bool isSwitchingTopic;

  /// How far through the open document the student is — what says whether they
  /// have reached the end of the notes. See [readerOffersNextTopic].
  final PdfViewState? documentState;

  final bool hasNextTopic;

  /// Moves on. Shown only when [readerOffersNextTopic] says so.
  final VoidCallback? onNextTopic;

  @override
  ConsumerState<_DocumentReader> createState() => _DocumentReaderState();
}

class _DocumentReaderState extends ConsumerState<_DocumentReader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _expandController;
  late final Animation<double> _expandAnimation;

  @override
  void initState() {
    super.initState();
    final initialCollapsed = ref.read(audioBarCollapsedProvider);
    _expandController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
      value: initialCollapsed ? 0.0 : 1.0,
    );
    _expandAnimation = CurvedAnimation(
      parent: _expandController,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );
  }

  @override
  void dispose() {
    _expandController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<bool>(audioBarCollapsedProvider, (previous, collapsed) {
      if (collapsed) {
        _expandController.reverse();
      } else {
        _expandController.forward();
      }
    });

    final audio = ref.read(readerAudioProvider);
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final isExpanded = !ref.watch(audioBarCollapsedProvider);

    // Drives the cover below. flutter_pdfview draws through a native platform
    // view, and a native surface does not travel with the Flutter layer during
    // a page transition — sliding one in tears, ghosts, or shows the screen
    // underneath through it. Covering it for the length of the animation costs
    // a plain page and removes the whole class of glitch.
    final route = ModalRoute.of(context);
    final routeAnimation = route?.animation;
    // The same problem in the other direction: pushing the full-page player
    // over the reader, and popping it again, slides *this* route under another
    // one. The document has to be covered for that too, or the glitch simply
    // moves from opening the book to leaving the player.
    final coveringAnimation = route?.secondaryAnimation;

    final reader = AnimatedBuilder(
      animation: _expandAnimation,
      child: ColoredBox(
        color: context.palette.background,
        child: widget.document,
      ),
      builder: (context, documentChild) {
        final bottomOffset = _expandAnimation.value * 76.0;
        final bottomMargin = bottomInset > 0 ? bottomInset + 8 : 16.0;

        // Rebuilt on the loaded clip, not read once: moving to a topic with no
        // narration stops the player a frame after this build, and a strip that
        // only re-read its title when something else happened to rebuild was
        // left on screen showing the previous topic's clip.
        return ValueListenableBuilder<String?>(
          valueListenable: audio.title,
          builder: (context, loadedClipTitle, _) {
            final showAudio = widget.hasAudio || loadedClipTitle != null;

            return Stack(
              fit: StackFit.expand,
              children: [
                // Full-page document viewer
                documentChild!,

                // The cover, over the document and under the controls: those are
                // ordinary Flutter widgets and animate perfectly well.
                PdfTransitionCover(
                  routeAnimation: routeAnimation,
                  coveringAnimation: coveringAnimation,
                  isLoading: widget.isSwitchingTopic,
                  loadingLabel: 'Loading next topic…',
                ),

                // Back button in the top corner.
                Positioned(
                  top: topInset + 8,
                  left: 8,
                  child: _ReaderCornerButton(
                    icon: Icons.arrow_back_ios_new_rounded,
                    tooltip: 'Back',
                    onTap: widget.onBack,
                  ),
                ),

                // Bottom left: the download, until the book is on the device.
                if (!widget.isOffline)
                  Positioned(
                    left: 20,
                    bottom: 20 + bottomOffset,
                    child: _ReaderDownloadCorner(bookId: widget.bookId),
                  ),

                // Bottom right: Book/Chapter icon, and Audio button below it!
                Positioned(
                  right: 20,
                  bottom: 20 + bottomOffset,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      ValueListenableBuilder<bool>(
                        valueListenable: audio.playing,
                        builder: (context, playing, _) => AnimatedSwitcher(
                          duration: const Duration(milliseconds: 220),
                          switchInCurve: Curves.easeOutCubic,
                          transitionBuilder: (child, animation) => FadeTransition(
                            opacity: animation,
                            child: ScaleTransition(scale: animation, child: child),
                          ),
                          child: !playing
                              ? const SizedBox.shrink()
                              : Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: _ReaderCornerButton(
                                    icon: widget.autoScroll
                                        ? Icons.swipe_vertical_rounded
                                        : Icons.do_not_touch_outlined,
                                    tooltip: widget.autoScroll
                                        ? 'Pages follow the audio — tap to stop'
                                        : 'Follow the audio',
                                    onTap: widget.onToggleAutoScroll,
                                    accent: widget.autoScroll,
                                  ),
                                ),
                        ),
                      ),
                      if (widget.onContents != null)
                        FloatingActionButton(
                          heroTag: null,
                          onPressed: widget.onContents,
                          backgroundColor: context.palette.card,
                          foregroundColor: AppColors.cyan,
                          elevation: 3,
                          tooltip: 'Chapters and topics',
                          child: const Icon(Icons.menu_book_rounded, size: 22),
                        ),
                      if (showAudio) ...[
                        if (widget.onContents != null) const SizedBox(height: 12),
                        FloatingActionButton(
                          heroTag: null,
                          onPressed: () {
                            ref.read(audioBarCollapsedProvider.notifier).toggle();
                          },
                          backgroundColor:
                              isExpanded ? AppColors.cyan : context.palette.card,
                          foregroundColor:
                              isExpanded ? Colors.white : AppColors.cyan,
                          elevation: 3,
                          tooltip:
                              isExpanded ? 'Hide audio player' : 'Audio player',
                          child: ValueListenableBuilder<bool>(
                            valueListenable: audio.playing,
                            builder: (context, playing, _) => Icon(
                              playing
                                  ? Icons.graphic_eq_rounded
                                  : Icons.headphones_rounded,
                              size: 22,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                // Tablet-style Audio player expanding horizontally from left to right!
                if (showAudio && _expandAnimation.value > 0.0)
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: bottomMargin,
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 680),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(18),
                            child: SizeTransition(
                              axis: Axis.horizontal,
                              axisAlignment: -1.0, // expands from left to right!
                              sizeFactor: _expandAnimation,
                              child: FadeTransition(
                                opacity: _expandAnimation,
                                child: ReaderTabletAudioPlayer(
                                  onClose: () => ref
                                      .read(audioBarCollapsedProvider.notifier)
                                      .set(true),
                                  onExpand: widget.onExpandAudio,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),

                // Reading without narration, at the end of the notes: the way on to
                // the next topic. With a clip playing it stays out of the way —
                // the audio walks the student on by itself when it plays out.
                if (widget.onNextTopic != null)
                  ValueListenableBuilder<bool>(
                    valueListenable: audio.playing,
                    builder: (context, playing, _) {
                      final offer = readerOffersNextTopic(
                        document: widget.documentState,
                        hasNextTopic: widget.hasNextTopic,
                        audioPlaying: playing,
                      );
                      if (!offer) return const SizedBox.shrink();
                      return Positioned(
                        left: 0,
                        right: 0,
                        bottom: bottomMargin + 12 + bottomOffset,
                        child: Center(
                          child: _NextTopicButton(onPressed: widget.onNextTopic!),
                        ),
                      );
                    },
                  ),
              ],
            );
          },
        );
      },
    );

    final panel = widget.contents;
    if (panel == null) return reader;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        panel,
        VerticalDivider(width: 1, color: context.palette.border),
        Expanded(child: reader),
      ],
    );
  }
}

/// The way on to the next topic for a student reading without narration.
class _NextTopicButton extends StatelessWidget {
  const _NextTopicButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.cyan,
      borderRadius: BorderRadius.circular(24),
      elevation: 4,
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onPressed,
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 18, vertical: 11),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Next topic',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                ),
              ),
              SizedBox(width: 7),
              Icon(Icons.arrow_forward_rounded, size: 17, color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }
}

/// One of the reading page's floating controls: a translucent disc that reads
/// on a white page and on a dark one, because a PDF can be either.
class _ReaderCornerButton extends StatelessWidget {
  const _ReaderCornerButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.accent = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  /// Marks the control as on, for the toggles.
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Tooltip(
      message: tooltip,
      child: Material(
        color: accent
            ? AppColors.cyan.withValues(alpha: 0.92)
            : palette.card.withValues(alpha: 0.82),
        shape: const CircleBorder(),
        elevation: 2,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: SizedBox(
            width: 42,
            height: 42,
            child: Icon(
              icon,
              size: 19,
              color: accent ? Colors.white : palette.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}

/// The download control in the corner of the reading page.
///
/// Present only while there is something to download: once the book is on the
/// device the corner is empty, which is the whole of the affordance's state —
/// no tick, no label, nothing to read.
class _ReaderDownloadCorner extends ConsumerWidget {
  const _ReaderDownloadCorner({required this.bookId});

  final String bookId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = ref.watch(downloadProgressProvider(bookId));
    final palette = context.palette;

    switch (progress.status) {
      case OfflineStatus.ready:
      case OfflineStatus.needsRevalidation:
      case OfflineStatus.expired:
        return const SizedBox.shrink();

      case OfflineStatus.downloading:
        // Null while the manifest is still being counted — an indeterminate
        // spinner says "working on it" better than a 0% that sits there.
        final fraction = progress.fraction;
        return Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: palette.card.withValues(alpha: 0.82),
            shape: BoxShape.circle,
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 30,
                height: 30,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  value: (fraction ?? 0) > 0 ? fraction : null,
                  color: AppColors.cyan,
                  backgroundColor: palette.border,
                ),
              ),
              Text(
                fraction == null ? '' : '${(fraction * 100).round()}',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      color: palette.textSecondary,
                    ),
              ),
            ],
          ),
        );

      case OfflineStatus.none:
      case OfflineStatus.paused:
      case OfflineStatus.failed:
        return _ReaderCornerButton(
          icon: progress.status == OfflineStatus.paused
              ? Icons.download_rounded
              : Icons.download_rounded,
          tooltip: progress.status == OfflineStatus.paused
              ? 'Resume the download'
              : 'Save this book to read offline',
          onTap: () async {
            final book = await ref.read(bookDetailProvider(bookId).future);
            if (!context.mounted) return;
            ref.read(downloadManagerProvider.notifier).download(book);
          },
        );
    }
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
    required this.isCompact,
    required this.onPrev,
    required this.onNext,
    this.onBack,
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

  /// Landscape on a phone: every row costs the page, so the second line of the
  /// title folds away into the first and the footer's job moves up here.
  final bool isCompact;

  /// Only wired while [isCompact] — otherwise paging lives in the footer.
  /// Null at either end of the book.
  final VoidCallback? onPrev;
  final VoidCallback? onNext;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    // The reader's own bar, on the same glass as every other bar in the app.
    // Square-cut, because it spans the page rather than floating on it.
    return LiquidGlass(
      borderRadius: BorderRadius.zero,
      blurSigma: AppGlass.blurBar,
      // Denser than a floating pane: the page beneath is body text, and a
      // chapter title competing with the words under it is unreadable.
      intensity: 1.5,
      elevation: 0.4,
      isCardScale: false,
      child: Material(
        type: MaterialType.transparency,
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
                      // A default IconButton is 48dp square and sets the
                      // height of the whole bar on its own.
                      visualDensity:
                          isCompact ? VisualDensity.compact : null,
                      onPressed: onBack ??
                          () {
                            try {
                              if (Navigator.of(context).canPop()) {
                                Navigator.of(context).pop();
                                return;
                              }
                            } catch (_) {}
                            try {
                              context.go(AppRoutes.books);
                            } catch (_) {
                              try {
                                Navigator.of(context).maybePop();
                              } catch (_) {}
                            }
                          },
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
                              'Chapter ${unit.chapterNumber} · $position',
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
                            ? 'Auto-scroll on — follows the audio'
                            : 'Auto-scroll off',
                        child: InkWell(
                          onTap: onToggleAutoScroll,
                          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                          child: Container(
                            margin: const EdgeInsets.only(right: 4),
                            padding: EdgeInsets.symmetric(
                                horizontal: 9, vertical: isCompact ? 4 : 6),
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
                      : () {
                          try {
                            if (Navigator.of(context).canPop()) {
                              Navigator.of(context).pop();
                              return;
                            }
                          } catch (_) {}
                          try {
                            context.go(AppRoutes.books);
                          } catch (_) {
                            try {
                              Navigator.of(context).maybePop();
                            } catch (_) {}
                          }
                        },
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
