import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/library.dart';
import '../shell/library_providers.dart';
import 'pdf_viewer_screen.dart';

/// Chapters of one PDF exam, each expanding to its documents.
class PdfDocumentsScreen extends ConsumerWidget {
  const PdfDocumentsScreen({
    super.key,
    required this.examId,
    required this.examTitle,
  });

  final String examId;
  final String examTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chaptersAsync = ref.watch(pdfChaptersProvider(examId));

    return Scaffold(
      appBar: AppBar(
        title: Text(examTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(pdfChaptersProvider(examId).future),
        child: AsyncView(
          value: chaptersAsync,
          onRetry: () => ref.invalidate(pdfChaptersProvider(examId)),
          data: (chapters) {
            if (chapters.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 60),
                  EmptyView(
                    icon: Icons.picture_as_pdf_rounded,
                    title: 'No chapters yet',
                    message: 'Study material for this exam is being prepared.',
                  ),
                ],
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
              itemCount: chapters.length,
              itemBuilder: (context, index) => _ChapterTile(
                chapter: chapters[index],
                initiallyExpanded: index == 0,
              ),
            );
          },
        ),
      ),
    );
  }
}

class _ChapterTile extends StatelessWidget {
  const _ChapterTile({required this.chapter, this.initiallyExpanded = false});

  final LibraryFolder chapter;
  final bool initiallyExpanded;

  @override
  Widget build(BuildContext context) {
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
              color: AppColors.amber.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(9),
            ),
            child: const Icon(Icons.folder_copy_rounded,
                color: AppColors.amber, size: 18),
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
                  Fmt.count(chapter.itemCount, 'document'),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                )
              : null,
          children: [_DocumentList(chapterId: chapter.id)],
        ),
      ),
    );
  }
}

class _DocumentList extends ConsumerWidget {
  const _DocumentList({required this.chapterId});

  final String chapterId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docsAsync = ref.watch(chapterDocumentsProvider(chapterId));

    return docsAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.fromLTRB(14, 0, 14, 16),
        child: Column(
          children: [
            SkeletonBox(height: 56, radius: AppTheme.radiusMd),
            SizedBox(height: 10),
            SkeletonBox(height: 56, radius: AppTheme.radiusMd),
          ],
        ),
      ),
      error: (error, _) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: ErrorView(
          error: error,
          compact: true,
          onRetry: () => ref.invalidate(chapterDocumentsProvider(chapterId)),
        ),
      ),
      data: (documents) {
        final readable = documents.where((d) => d.isReadable).toList();
        if (readable.isEmpty) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
            child: Text(
              'No documents in this chapter yet.',
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
              for (final document in readable)
                Padding(
                  padding: const EdgeInsets.only(bottom: 9),
                  child: PdfAttachmentTile(
                    title: document.title,
                    subtitle: [
                      if (document.readableSize.isNotEmpty) document.readableSize,
                      if ((document.description ?? '').isNotEmpty)
                        document.description!,
                    ].join(' · '),
                    onTap: () => openPdf(
                      context,
                      url: document.fileUrl!,
                      title: document.title,
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
