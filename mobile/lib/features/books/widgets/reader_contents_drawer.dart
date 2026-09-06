import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../reader_types.dart';

/// The reader's contents sidebar: chapters, the topics inside them, and the
/// subtopics inside those.
///
/// Modelled on the old PSC app's reader drawer, which is the navigation
/// students already know — a collapsed list of chapters that opens onto its
/// topics, with a speaker button on anything that has narration. Two things
/// are different here: the tree is keyboard- and screen-reader-labelled, and
/// what has already been read is marked, so the sidebar doubles as a progress
/// map rather than only a jump list.
///
/// Expansion state lives in this widget rather than in the reader, so opening
/// a chapter does not rebuild the page behind the sidebar.
class ReaderContentsPanel extends StatefulWidget {
  const ReaderContentsPanel({
    super.key,
    required this.bookTitle,
    required this.chapters,
    required this.activeIndex,
    required this.maxReached,
    required this.totalUnits,
    required this.onSelect,
    required this.onPlayAudio,
    this.onPlayVideo,
    this.onClose,
  });

  final String bookTitle;
  final List<ChapterSummary> chapters;

  /// The unit currently open in the reader.
  final int activeIndex;

  /// Furthest unit reached, which is what the read ticks are drawn from.
  final int maxReached;
  final int totalUnits;

  /// Open this unit for reading.
  final ValueChanged<int> onSelect;

  /// Open this unit *and* start its narration — the sidebar's audio button.
  final ValueChanged<int> onPlayAudio;

  /// Open this unit's video player.
  final ValueChanged<ReadingUnit>? onPlayVideo;

  /// Shown as an X in the header when the panel is a drawer. Null when it is
  /// pinned open beside the page and there is nothing to close.
  final VoidCallback? onClose;

  @override
  State<ReaderContentsPanel> createState() => _ReaderContentsPanelState();
}

class _ReaderContentsPanelState extends State<ReaderContentsPanel> {
  /// Chapters and topics the student has opened. Seeded from wherever they are
  /// reading, so the sidebar opens showing the current place in context rather
  /// than fully collapsed.
  late Set<String> _openChapters;
  late Set<String> _openTopics;

  @override
  void initState() {
    super.initState();
    _openChapters = <String>{};
    _openTopics = <String>{};
    _revealActive();
  }

  @override
  void didUpdateWidget(covariant ReaderContentsPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Following a link from the page itself moves the active unit while the
    // panel is pinned open; keep the tree pointed at it.
    if (oldWidget.activeIndex != widget.activeIndex) _revealActive();
  }

  void _revealActive() {
    for (final chapter in widget.chapters) {
      if (!chapter.containsUnit(widget.activeIndex)) continue;
      _openChapters.add(chapter.chapterId);
      for (final group in chapter.topics) {
        if (group.containsUnit(widget.activeIndex)) {
          _openTopics.add(group.topic.id);
        }
      }
    }
  }

  void _toggle(Set<String> open, String id) {
    setState(() => open.contains(id) ? open.remove(id) : open.add(id));
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Material(
      color: palette.card,
      child: SafeArea(
        right: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Header(
              bookTitle: widget.bookTitle,
              read: widget.totalUnits == 0
                  ? 0
                  : (widget.maxReached + 1).clamp(0, widget.totalUnits),
              total: widget.totalUnits,
              chapters: widget.chapters.length,
              onClose: widget.onClose,
            ),
            Expanded(
              child: widget.chapters.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'This book has no chapters yet.',
                          textAlign: TextAlign.center,
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: palette.textMuted),
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.only(top: 6, bottom: 24),
                      itemCount: widget.chapters.length,
                      itemBuilder: (context, index) =>
                          _buildChapter(widget.chapters[index]),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChapter(ChapterSummary chapter) {
    final isOpen = _openChapters.contains(chapter.chapterId);
    final holdsActive = chapter.containsUnit(widget.activeIndex);
    // A chapter counts as finished once the reader has been past its last unit.
    final isDone = widget.maxReached >= chapter.unitEnd;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ChapterRow(
          chapter: chapter,
          isOpen: isOpen,
          holdsActive: holdsActive,
          isDone: isDone,
          onTap: () => _toggle(_openChapters, chapter.chapterId),
        ),
        if (isOpen)
          for (final group in chapter.topics) ..._buildTopic(group),
      ],
    );
  }

  List<Widget> _buildTopic(TopicGroup group) {
    final topic = group.topic;
    final isOpen = _openTopics.contains(topic.id);

    return [
      _UnitRow(
        unit: topic,
        depth: 1,
        isActive: topic.unitIndex == widget.activeIndex,
        isRead: topic.unitIndex <= widget.maxReached,
        // The chevron only appears when there is something underneath.
        isExpandable: group.hasSubtopics,
        isExpanded: isOpen,
        onToggleExpand: () => _toggle(_openTopics, topic.id),
        onTap: () => widget.onSelect(topic.unitIndex),
        onPlayAudio:
            topic.hasAudio ? () => widget.onPlayAudio(topic.unitIndex) : null,
        onPlayVideo: topic.hasVideo && widget.onPlayVideo != null
            ? () => widget.onPlayVideo!(topic)
            : null,
      ),
      if (isOpen)
        for (final subtopic in group.subtopics)
          _UnitRow(
            unit: subtopic,
            depth: 2,
            isActive: subtopic.unitIndex == widget.activeIndex,
            isRead: subtopic.unitIndex <= widget.maxReached,
            isExpandable: false,
            isExpanded: false,
            onToggleExpand: null,
            onTap: () => widget.onSelect(subtopic.unitIndex),
            onPlayAudio: subtopic.hasAudio
                ? () => widget.onPlayAudio(subtopic.unitIndex)
                : null,
            onPlayVideo: subtopic.hasVideo && widget.onPlayVideo != null
                ? () => widget.onPlayVideo!(subtopic)
                : null,
          ),
    ];
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.bookTitle,
    required this.read,
    required this.total,
    required this.chapters,
    required this.onClose,
  });

  final String bookTitle;
  final int read;
  final int total;
  final int chapters;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final fraction = total == 0 ? 0.0 : (read / total).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 10, 14),
      decoration: BoxDecoration(
        color: palette.elevated,
        border: Border(bottom: BorderSide(color: palette.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'CONTENTS',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: AppColors.cyan,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.8,
                            fontSize: 9.5,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      bookTitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w900,
                            height: 1.25,
                          ),
                    ),
                  ],
                ),
              ),
              if (onClose != null)
                IconButton(
                  tooltip: 'Close contents',
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.close_rounded, size: 20),
                  onPressed: onClose,
                ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 4,
              backgroundColor: palette.border,
              valueColor: const AlwaysStoppedAnimation(AppColors.cyan),
            ),
          ),
          const SizedBox(height: 7),
          Text(
            '$read of $total topics · $chapters ${chapters == 1 ? 'chapter' : 'chapters'}',
            style: Theme.of(context)
                .textTheme
                .labelSmall
                ?.copyWith(color: palette.textMuted),
          ),
        ],
      ),
    );
  }
}

class _ChapterRow extends StatelessWidget {
  const _ChapterRow({
    required this.chapter,
    required this.isOpen,
    required this.holdsActive,
    required this.isDone,
    required this.onTap,
  });

  final ChapterSummary chapter;
  final bool isOpen;
  final bool holdsActive;
  final bool isDone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Semantics(
      button: true,
      expanded: isOpen,
      label: 'Chapter ${chapter.chapterNumber}, ${chapter.title}',
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.fromLTRB(10, 11, 12, 11),
          decoration: BoxDecoration(
            color: holdsActive ? AppColors.cyan.withValues(alpha: 0.06) : null,
            border: Border(
              left: BorderSide(
                width: 3,
                color: holdsActive ? AppColors.cyan : Colors.transparent,
              ),
            ),
          ),
          child: Row(
            children: [
              AnimatedRotation(
                turns: isOpen ? 0.25 : 0,
                duration: const Duration(milliseconds: 180),
                child: Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: holdsActive ? AppColors.cyan : palette.textMuted,
                ),
              ),
              const SizedBox(width: 4),
              Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isDone
                      ? AppColors.emerald.withValues(alpha: 0.14)
                      : AppColors.cyan.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(7),
                ),
                child: isDone
                    ? const Icon(Icons.check_rounded,
                        size: 15, color: AppColors.emerald)
                    : Text(
                        '${chapter.chapterNumber}',
                        style:
                            Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: AppColors.cyan,
                                  fontWeight: FontWeight.w900,
                                ),
                      ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      chapter.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            height: 1.3,
                            color: holdsActive
                                ? AppColors.cyan
                                : palette.textPrimary,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${chapter.topics.length} '
                      '${chapter.topics.length == 1 ? 'topic' : 'topics'}',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                            fontSize: 10,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One topic or subtopic line: tap the label to read it, tap the speaker to
/// hear it.
class _UnitRow extends StatelessWidget {
  const _UnitRow({
    required this.unit,
    required this.depth,
    required this.isActive,
    required this.isRead,
    required this.isExpandable,
    required this.isExpanded,
    required this.onToggleExpand,
    required this.onTap,
    required this.onPlayAudio,
    this.onPlayVideo,
  });

  final ReadingUnit unit;

  /// 1 for a topic, 2 for a subtopic. Only affects the left inset.
  final int depth;
  final bool isActive;
  final bool isRead;
  final bool isExpandable;
  final bool isExpanded;
  final VoidCallback? onToggleExpand;
  final VoidCallback onTap;

  /// Null when this unit has no narration, which is also what hides the button.
  final VoidCallback? onPlayAudio;

  /// Null when this unit has no video lesson, which is also what hides the button.
  final VoidCallback? onPlayVideo;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Container(
      margin: EdgeInsets.fromLTRB(depth == 1 ? 14 : 30, 1, 10, 1),
      decoration: BoxDecoration(
        color: isActive ? AppColors.cyan.withValues(alpha: 0.11) : null,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border.all(
          color: isActive
              ? AppColors.cyan.withValues(alpha: 0.38)
              : Colors.transparent,
        ),
      ),
      child: Row(
        children: [
          // The expand chevron is its own target so that tapping the title
          // opens the topic for reading instead of merely unfolding it — the
          // two actions were conflated in the old app and it made subtopics
          // hard to reach.
          if (isExpandable)
            Tooltip(
              message: isExpanded ? 'Hide subtopics' : 'Show subtopics',
              child: InkWell(
                onTap: onToggleExpand,
                customBorder: const CircleBorder(),
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: AnimatedRotation(
                    turns: isExpanded ? 0.25 : 0,
                    duration: const Duration(milliseconds: 180),
                    child: Icon(Icons.chevron_right_rounded,
                        size: 17, color: palette.textMuted),
                  ),
                ),
              ),
            )
          else
            const SizedBox(width: 8),
          Expanded(
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  children: [
                    Icon(
                      isRead
                          ? Icons.check_circle_rounded
                          : Icons.radio_button_unchecked_rounded,
                      size: 14,
                      color: isRead ? AppColors.emerald : palette.textMuted,
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Text(
                        unit.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style:
                            Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: isActive
                                      ? AppColors.cyan
                                      : palette.textSecondary,
                                  fontWeight: isActive
                                      ? FontWeight.w800
                                      : FontWeight.w500,
                                  height: 1.35,
                                ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (onPlayVideo != null) _VideoButton(onTap: onPlayVideo!),
          if (onPlayAudio != null) _AudioButton(onTap: onPlayAudio!),
        ],
      ),
    );
  }
}

/// The video button on a row with a video lesson.
class _VideoButton extends StatelessWidget {
  const _VideoButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Watch video',
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          child: Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.red.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.smart_display_rounded,
              size: 16,
              color: AppColors.red,
            ),
          ),
        ),
      ),
    );
  }
}

/// The speaker on a row with narration. Deliberately a full 40dp target rather
/// than the 16dp icon the old app used — it sits inches from the row's own tap
/// target and the two must not be a coin toss under a thumb.
class _AudioButton extends StatelessWidget {
  const _AudioButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Play audio',
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          child: Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.cyan.withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.volume_up_rounded,
                size: 16, color: AppColors.cyan),
          ),
        ),
      ),
    );
  }
}
