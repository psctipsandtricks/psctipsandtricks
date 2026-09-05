import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/pdf_downloader.dart';
import '../../core/utils/responsive.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/library.dart';
import '../shell/library_providers.dart';
import 'video_player_screen.dart';
import '../shell/shell_scaffold.dart';

/// Videos of an exam or category. Supports both subfolders (chapters)
/// and direct video lessons.
class VideoListScreen extends ConsumerWidget {
  const VideoListScreen({
    super.key,
    required this.examId,
    required this.examTitle,
  });

  final String examId;
  final String examTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contentAsync = ref.watch(videoFolderContentProvider(examId));

    return Scaffold(
      appBar: GlassAppBar(
        title: Text(examTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      body: RefreshIndicator(
        onRefresh: () async =>
            ref.refresh(videoFolderContentProvider(examId).future),
        child: AsyncView(
          value: contentAsync,
          onRetry: () => ref.invalidate(videoFolderContentProvider(examId)),
          data: (content) {
            if (content.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 60),
                  EmptyView(
                    icon: Icons.smart_display_rounded,
                    title: 'No classes yet',
                    message: 'Classes for this category are being uploaded.',
                  ),
                ],
              );
            }

            final subfolders = content.subfolders;
            final directVideos = content.videos;

            return Responsive.centered(
              maxWidth: Responsive.maxContentWidth,
              child: ListView(
                padding: EdgeInsets.fromLTRB(
                  Responsive.horizontalPadding(context),
                  12,
                  Responsive.horizontalPadding(context),
                  24 + ShellScaffold.dockExtent,
                ),
                children: [
                  // 1. Subfolders / Chapters
                  if (subfolders.isNotEmpty) ...[
                    if (directVideos.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(left: 4, bottom: 8, top: 4),
                        child: Text(
                          'Chapters (${subfolders.length})',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: context.palette.textMuted,
                              ),
                        ),
                      ),
                    for (int i = 0; i < subfolders.length; i++)
                      _ChapterTile(
                        chapter: subfolders[i],
                        initiallyExpanded: i == 0 && directVideos.isEmpty,
                      ),
                  ],

                  // 2. Direct Videos
                  if (directVideos.isNotEmpty) ...[
                    if (subfolders.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(left: 4, bottom: 8, top: 12),
                        child: Text(
                          'Video Lessons (${directVideos.length})',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: context.palette.textMuted,
                              ),
                        ),
                      ),
                    Container(
                      decoration: BoxDecoration(
                        color: context.palette.card,
                        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                        border: Border.all(color: context.palette.border),
                      ),
                      padding: const EdgeInsets.all(8),
                      child: Column(
                        children: [
                          for (int i = 0; i < directVideos.length; i++) ...[
                            if (i > 0)
                              Divider(
                                height: 12,
                                color: context.palette.border.withValues(alpha: 0.5),
                              ),
                            _VideoRow(video: directVideos[i]),
                          ],
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _ChapterTile extends ConsumerWidget {
  const _ChapterTile({required this.chapter, this.initiallyExpanded = false});

  final LibraryFolder chapter;
  final bool initiallyExpanded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(color: palette.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: initiallyExpanded,
          maintainState: true,
          tilePadding: const EdgeInsets.symmetric(horizontal: 14),
          leading: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.red.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(9),
            ),
            child: const Icon(Icons.playlist_play_rounded,
                color: AppColors.red, size: 18),
          ),
          title: Text(
            chapter.title,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  height: 1.3,
                ),
          ),
          subtitle: chapter.itemCount > 0
              ? Text(
                  Fmt.count(chapter.itemCount, 'video'),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                )
              : null,
          children: [_VideoList(chapterId: chapter.id)],
        ),
      ),
    );
  }
}

class _VideoList extends ConsumerWidget {
  const _VideoList({required this.chapterId});

  final String chapterId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final videosAsync = ref.watch(chapterVideosProvider(chapterId));

    return videosAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.fromLTRB(14, 0, 14, 16),
        child: Column(
          children: [
            SkeletonBox(height: 74, radius: AppTheme.radiusMd),
            SizedBox(height: 10),
            SkeletonBox(height: 74, radius: AppTheme.radiusMd),
          ],
        ),
      ),
      error: (error, _) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: ErrorView(
          error: error,
          compact: true,
          onRetry: () => ref.invalidate(chapterVideosProvider(chapterId)),
        ),
      ),
      data: (videos) {
        if (videos.isEmpty) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
            child: Text(
              'No videos in this chapter yet.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.palette.textMuted,
                  ),
            ),
          );
        }

        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 14),
          child: Column(
            children: [
              for (final video in videos)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _VideoRow(video: video),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _VideoRow extends StatelessWidget {
  const _VideoRow({required this.video});

  final VideoItem video;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return InkWell(
      onTap: () => openVideo(
        context,
        VideoPlayerArgs(
          youtubeUrl: video.youtubeUrl,
          title: video.title,
          description: video.description,
          pdfUrl: video.pdfUrl,
          pdfFileName: video.pdfFileName,
        ),
      ),
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Row(
          children: [
            VideoThumbnail(
              thumbnailUrl: video.effectiveThumbnailUrl,
              youtubeVideoId: video.youtubeVideoId,
              youtubeUrl: video.youtubeUrl,
              width: 112,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    video.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          height: 1.3,
                        ),
                  ),
                  if (video.hasNotes) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.attach_file_rounded,
                            size: 12, color: AppColors.amber),
                        const SizedBox(width: 4),
                        Text(
                          'Notes attached',
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: AppColors.amber,
                                    fontWeight: FontWeight.w700,
                                  ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            if (video.hasNotes)
              IconButton(
                icon: const Icon(Icons.download_rounded, size: 20),
                color: AppColors.cyan,
                tooltip: 'Download notes PDF',
                visualDensity: VisualDensity.compact,
                onPressed: () => PdfDownloader.download(
                  context,
                  url: video.pdfUrl!,
                  title: video.pdfFileName ?? '${video.title} notes',
                  customFileName: video.pdfFileName,
                ),
              ),
            Icon(Icons.chevron_right_rounded, color: palette.textMuted),
          ],
        ),
      ),
    );
  }
}
