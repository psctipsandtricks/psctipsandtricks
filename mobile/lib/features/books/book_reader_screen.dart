import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/state_views.dart';
import '../pdfs/pdf_viewer_screen.dart';
import '../videos/video_player_screen.dart';
import 'books_providers.dart';
import 'reader_types.dart';
import 'widgets/reader_audio_player.dart';

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

  Timer? _saveTimer;

  @override
  void dispose() {
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
  }

  void _goTo(int index, {bool scrollToTop = true}) {
    if (index < 0 || index >= _units.length) return;
    setState(() {
      _activeIndex = index;
      if (index > _maxReached) _maxReached = index;
      _showResumeBanner = false;
    });
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
    final unit = _units[_activeIndex];
    final percent = (((_maxReached + 1) / _units.length) * 100).round();

    // Fire and forget: a failed progress write must never interrupt reading.
    unawaited(
      ref
          .read(booksRepositoryProvider)
          .saveProgress(
            bookId: widget.bookId,
            chapterId: unit.chapterId,
            topicId: unit.topicId,
            progressPercent: percent.clamp(0, 100),
          )
          .catchError((_) {}),
    );
  }

  void _openContents() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _ContentsSheet(
        chapters: _chapters,
        activeIndex: _activeIndex,
        maxReached: _maxReached,
        onSelect: (index) {
          Navigator.of(context).pop();
          _goTo(index);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final contentAsync = ref.watch(bookReaderProvider(widget.bookId));
    final progressAsync = ref.watch(bookProgressProvider(widget.bookId));

    return Scaffold(
      body: AsyncView(
        value: contentAsync,
        onRetry: () => ref.invalidate(bookReaderProvider(widget.bookId)),
        loading: const _ReaderSkeleton(),
        data: (content) {
          final units = flattenChapters(content.chapters);

          // Wait for the progress row before settling on a starting unit, so
          // the reader never opens at chapter 1 and then jumps.
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

          return Column(
            children: [
              _ReaderAppBar(
                bookTitle: content.title,
                unit: unit,
                progress: percent,
                position: '${_activeIndex + 1} / ${_units.length}',
                onContents: _openContents,
              ),
              if (_showResumeBanner && _savedIndex != null)
                _ResumeBanner(
                  unitTitle: _units[_savedIndex!].title,
                  onResume: () => _goTo(_savedIndex!),
                  onDismiss: () => setState(() => _showResumeBanner = false),
                ),
              Expanded(
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
                        url: unit.audioUrl!,
                        title: unit.title,
                        autoPlay: _autoResumed && _activeIndex == _savedIndex,
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
                      PdfAttachmentTile(
                        title: 'Notes — ${unit.title}',
                        subtitle: 'Tap to read the PDF',
                        onTap: () => openPdf(
                          context,
                          url: unit.pdfUrl!,
                          title: unit.title,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              _ReaderFooter(
                canGoBack: _activeIndex > 0,
                canGoForward: _activeIndex < _units.length - 1,
                onPrev: () => _goTo(_activeIndex - 1),
                onNext: () => _goTo(_activeIndex + 1),
                isLast: _activeIndex == _units.length - 1,
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
    required this.onContents,
  });

  final String bookTitle;
  final ReadingUnit unit;
  final double progress;
  final String position;
  final VoidCallback onContents;

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
              padding: const EdgeInsets.fromLTRB(4, 6, 12, 8),
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
                          bookTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  ),
                        ),
                        Text(
                          'Chapter ${unit.chapterNumber} · $position',
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: palette.textMuted,
                                  ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Contents',
                    icon: const Icon(Icons.menu_book_rounded),
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
                  label: const Text('Previous'),
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

class _ContentsSheet extends StatelessWidget {
  const _ContentsSheet({
    required this.chapters,
    required this.activeIndex,
    required this.maxReached,
    required this.onSelect,
  });

  final List<ChapterSummary> chapters;
  final int activeIndex;
  final int maxReached;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.94,
      builder: (context, scrollController) => Column(
        children: [
          Container(
            width: 42,
            height: 4,
            margin: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: palette.border,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Row(
              children: [
                Text(
                  'Contents',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                ),
                const Spacer(),
                Text(
                  '${chapters.length} chapters',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
              itemCount: chapters.length,
              itemBuilder: (context, index) {
                final chapter = chapters[index];
                return Theme(
                  data: Theme.of(context)
                      .copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    initiallyExpanded: chapter.containsUnit(activeIndex),
                    tilePadding: const EdgeInsets.symmetric(horizontal: 12),
                    childrenPadding: const EdgeInsets.only(bottom: 8),
                    leading: Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: AppColors.cyan.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '${chapter.chapterNumber}',
                        style:
                            Theme.of(context).textTheme.labelMedium?.copyWith(
                                  color: AppColors.cyan,
                                  fontWeight: FontWeight.w800,
                                ),
                      ),
                    ),
                    title: Text(
                      chapter.title,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            height: 1.3,
                          ),
                    ),
                    subtitle: Text(
                      '${chapter.units.length} topics',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                          ),
                    ),
                    children: [
                      for (final unit in chapter.units)
                        _UnitRow(
                          unit: unit,
                          isActive: unit.unitIndex == activeIndex,
                          isRead: unit.unitIndex <= maxReached,
                          onTap: () => onSelect(unit.unitIndex),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _UnitRow extends StatelessWidget {
  const _UnitRow({
    required this.unit,
    required this.isActive,
    required this.isRead,
    required this.onTap,
  });

  final ReadingUnit unit;
  final bool isActive;
  final bool isRead;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        padding: EdgeInsets.fromLTRB(unit.isSubtopic ? 30 : 14, 10, 12, 10),
        decoration: BoxDecoration(
          color: isActive ? AppColors.cyan.withValues(alpha: 0.10) : null,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border: Border.all(
            color: isActive
                ? AppColors.cyan.withValues(alpha: 0.35)
                : Colors.transparent,
          ),
        ),
        child: Row(
          children: [
            Icon(
              isRead
                  ? Icons.check_circle_rounded
                  : Icons.radio_button_unchecked_rounded,
              size: 15,
              color: isRead ? AppColors.emerald : palette.textMuted,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                unit.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isActive ? AppColors.cyan : palette.textSecondary,
                      fontWeight:
                          isActive ? FontWeight.w700 : FontWeight.w500,
                      height: 1.35,
                    ),
              ),
            ),
            if (unit.hasAudio)
              Icon(Icons.headphones_rounded, size: 13, color: palette.textMuted),
            if (unit.hasVideo)
              Padding(
                padding: const EdgeInsets.only(left: 6),
                child: Icon(Icons.smart_display_rounded,
                    size: 13, color: palette.textMuted),
              ),
          ],
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
