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
import '../shell/library_providers.dart';
import 'pdf_viewer_screen.dart';
import '../shell/shell_scaffold.dart';

/// Documents of a PDF exam or category.
/// Implements a natural step-by-step folder navigation flow where tapping a folder
/// opens that folder's contents on a new screen.
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
    final contentAsync = ref.watch(pdfFolderContentProvider(examId));

    return Scaffold(
      appBar: GlassAppBar(
        title: Text(examTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      body: RefreshIndicator(
        onRefresh: () async =>
            ref.refresh(pdfFolderContentProvider(examId).future),
        child: AsyncView(
          value: contentAsync,
          onRetry: () => ref.invalidate(pdfFolderContentProvider(examId)),
          data: (content) {
            final subfolders =
                content.subfolders.where((f) => f.hasContent).toList();
            final directDocuments =
                content.documents.where((d) => d.isReadable).toList();

            if (subfolders.isEmpty && directDocuments.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 60),
                  EmptyView(
                    icon: Icons.picture_as_pdf_rounded,
                    title: 'No study PDFs yet',
                    message: 'Study material for this category is being prepared.',
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
                  // 1. Subfolders (Step-by-step navigation flow)
                  if (subfolders.isNotEmpty) ...[
                    for (final folder in subfolders)
                      _FolderCard(folder: folder),
                  ],

                  // 2. Direct Documents belonging to this specific folder
                  if (directDocuments.isNotEmpty) ...[
                    if (subfolders.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Padding(
                        padding: const EdgeInsets.only(left: 4, bottom: 8),
                        child: Text(
                          'Study Materials (${directDocuments.length})',
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
                      padding: const EdgeInsets.all(10),
                      child: Column(
                        children: [
                          for (int i = 0; i < directDocuments.length; i++)
                            Padding(
                              padding: EdgeInsets.only(
                                bottom: i < directDocuments.length - 1 ? 9 : 0,
                              ),
                              child: PdfAttachmentTile(
                                title: directDocuments[i].title,
                                subtitle: [
                                  if (directDocuments[i].readableSize.isNotEmpty)
                                    directDocuments[i].readableSize,
                                  if ((directDocuments[i].description ?? '')
                                      .isNotEmpty)
                                    directDocuments[i].description!,
                                ].join(' · '),
                                onTap: () => openPdf(
                                  context,
                                  url: directDocuments[i].fileUrl!,
                                  title: directDocuments[i].title,
                                  minimal: true,
                                ),
                              ),
                            ),
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

/// Clean, modern folder tile that navigates into the folder upon click.
class _FolderCard extends StatelessWidget {
  const _FolderCard({required this.folder});

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
              '${AppRoutes.library}/pdfs/${folder.id}?title=${Uri.encodeComponent(folder.title)}',
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
                    color: AppColors.amber.withValues(alpha: 0.13),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.folder_rounded,
                    color: AppColors.amber,
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
                          Fmt.count(folder.itemCount, 'document'),
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
