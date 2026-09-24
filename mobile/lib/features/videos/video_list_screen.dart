import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/responsive.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/library.dart';
import '../pdfs/pdf_viewer_screen.dart';
import '../shell/library_providers.dart';
import 'video_player_screen.dart';
import '../shell/shell_scaffold.dart';

/// Videos of an exam or category.
/// Implements a natural step-by-step folder navigation flow where tapping a chapter/folder
/// opens that folder's contents on a new screen.
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
            final subfolders =
                content.subfolders.where((f) => f.hasContent).toList();
            final directVideos = content.videos;

            if (subfolders.isEmpty && directVideos.isEmpty) {
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

            return Responsive.centered(
              maxWidth: Responsive.maxContentWidth,
              child: ListView(
                padding: EdgeInsets.fromLTRB(
                  Responsive.horizontalPadding(context),
                  14,
                  Responsive.horizontalPadding(context),
                  24 + ShellScaffold.dockExtent,
                ),
                children: [
                  // 1. Subfolders / Chapters (Step-by-step navigation)
                  if (subfolders.isNotEmpty) ...[
                    for (final folder in subfolders)
                      _VideoFolderCard(folder: folder),
                  ],

                  // 2. Direct Videos belonging to this specific folder
                  if (directVideos.isNotEmpty) ...[
                    if (subfolders.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Padding(
                        padding: const EdgeInsets.only(left: 4, bottom: 8),
                        child: Text(
                          'Video Lessons (${directVideos.length})',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: context.palette.textMuted,
                              ),
                        ),
                      ),
                    ],
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

/// Clean, modern video folder tile that navigates into the folder upon click.
class _VideoFolderCard extends StatelessWidget {
  const _VideoFolderCard({required this.folder});

  final LibraryFolder folder;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(color: palette.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: palette.isDark ? 0.2 : 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            context.push(
              '${AppRoutes.library}/videos/${folder.id}?title=${Uri.encodeComponent(folder.title)}',
            );
          },
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(9),
                  decoration: BoxDecoration(
                    color: AppColors.red.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.folder_rounded,
                    color: AppColors.red,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        folder.title,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                              fontSize: 14.5,
                              height: 1.25,
                            ),
                      ),
                      if (folder.itemCount > 0) ...[
                        const SizedBox(height: 3),
                        Text(
                          Fmt.count(folder.itemCount, 'video'),
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: palette.textMuted,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                        ),
                      ],
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: palette.textMuted.withValues(alpha: 0.7),
                  size: 22,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _VideoRow extends StatelessWidget {
  const _VideoRow({required this.video});

  final VideoItem video;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        onTap: () => openVideo(
          context,
          VideoPlayerArgs(
            youtubeUrl: video.youtubeUrl,
            title: video.title,
            description: video.description,
            pdfUrl: video.pdfUrl,
            pdfFileName: video.pdfFileName,
            thumbnailUrl: video.effectiveThumbnailUrl,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.red.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.play_arrow_rounded,
                  color: AppColors.red,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      video.title,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            fontSize: 13.5,
                          ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (video.hasNotes) ...[
                      const SizedBox(height: 3),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => openPdf(
                          context,
                          url: video.pdfUrl!,
                          title: video.pdfFileName ?? 'Class notes',
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.attach_file_rounded,
                              size: 13,
                              color: AppColors.amber,
                            ),
                            const SizedBox(width: 2),
                            Text(
                              video.pdfFileName ?? 'Notes',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    color: AppColors.amber,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: Colors.grey,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
