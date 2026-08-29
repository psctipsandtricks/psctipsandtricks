import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/library.dart';
import '../offline/downloads_screen.dart';
import 'library_providers.dart';

/// The study library: YouTube classes and downloadable PDFs, each browsed
/// Exam → Chapter → item, exactly as on the website.
class LibraryScreen extends ConsumerStatefulWidget {
  const LibraryScreen({super.key, this.initialIndex = 0});

  final int initialIndex;

  @override
  ConsumerState<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends ConsumerState<LibraryScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(
    length: 3,
    vsync: this,
    initialIndex: widget.initialIndex.clamp(0, 2),
  );

  @override
  void didUpdateWidget(covariant LibraryScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialIndex != widget.initialIndex) {
      _tabs.animateTo(widget.initialIndex.clamp(0, 2));
    }
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Library'),
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabAlignment: TabAlignment.center,
          tabs: const [
            Tab(icon: Icon(Icons.download_done_rounded, size: 19), text: 'Downloads'),
            Tab(icon: Icon(Icons.smart_display_outlined, size: 19), text: 'Videos'),
            Tab(icon: Icon(Icons.picture_as_pdf_outlined, size: 19), text: 'PDFs'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          const DownloadsList(),
          _ExamGrid(
            provider: videoExamsProvider,
            accent: AppColors.red,
            icon: Icons.smart_display_rounded,
            itemNoun: 'video',
            emptyTitle: 'No video classes yet',
            emptyMessage:
                'Recorded classes are added regularly — check back soon.',
            routeFor: (exam) =>
                '${AppRoutes.library}/videos/${exam.id}?title=${Uri.encodeComponent(exam.title)}',
          ),
          _ExamGrid(
            provider: pdfExamsProvider,
            accent: AppColors.amber,
            icon: Icons.picture_as_pdf_rounded,
            itemNoun: 'document',
            emptyTitle: 'No study PDFs yet',
            emptyMessage: 'Notes and previous papers will appear here.',
            routeFor: (exam) =>
                '${AppRoutes.library}/pdfs/${exam.id}?title=${Uri.encodeComponent(exam.title)}',
          ),
        ],
      ),
    );
  }
}

class _ExamGrid extends ConsumerWidget {
  const _ExamGrid({
    required this.provider,
    required this.accent,
    required this.icon,
    required this.itemNoun,
    required this.emptyTitle,
    required this.emptyMessage,
    required this.routeFor,
  });

  final AutoDisposeFutureProvider<List<LibraryFolder>> provider;
  final Color accent;
  final IconData icon;
  final String itemNoun;
  final String emptyTitle;
  final String emptyMessage;
  final String Function(LibraryFolder exam) routeFor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final examsAsync = ref.watch(provider);

    return RefreshIndicator(
      onRefresh: () async => ref.refresh(provider.future),
      child: AsyncView(
        value: examsAsync,
        onRetry: () => ref.invalidate(provider),
        data: (exams) {
          if (exams.isEmpty) {
            return ListView(
              children: [
                const SizedBox(height: 60),
                EmptyView(
                  icon: icon,
                  title: emptyTitle,
                  message: emptyMessage,
                ),
              ],
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            itemCount: exams.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final exam = exams[index];
              final parts = <String>[
                if (exam.chapterCount > 0)
                  Fmt.count(exam.chapterCount, 'chapter'),
                if (exam.itemCount > 0) Fmt.count(exam.itemCount, itemNoun),
              ];

              return GlassCard(
                onTap: () => context.push(routeFor(exam)),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      ),
                      child: Icon(icon, color: accent, size: 21),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            exam.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  height: 1.3,
                                ),
                          ),
                          if (parts.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 3),
                              child: Text(
                                parts.join(' · '),
                                style: Theme.of(context)
                                    .textTheme
                                    .labelSmall
                                    ?.copyWith(color: context.palette.textMuted),
                              ),
                            ),
                        ],
                      ),
                    ),
                    Icon(Icons.chevron_right_rounded,
                        color: context.palette.textMuted),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}
