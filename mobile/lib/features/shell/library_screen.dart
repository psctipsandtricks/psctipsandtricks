import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/connectivity_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/responsive.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/state_views.dart';
import '../../data/models/library.dart';
import '../offline/downloads_screen.dart';
import '../offline/offline_providers.dart';
import 'library_providers.dart';
import 'shell_scaffold.dart';

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
    final downloadCount = ref.watch(offlineLibraryProvider).length;

    ref.listen<AsyncValue<bool>>(connectivityProvider, (_, next) {
      if (next.valueOrNull == false && _tabs.index != 0) {
        _tabs.animateTo(0);
      }
    });

    return Scaffold(
      appBar: GlassAppBar(
        title: const Text('Library'),
        bottom: _LibrarySegmentedTabs(
          tabController: _tabs,
          downloadCount: downloadCount,
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

/// Floating Frosted Glass Segmented Tab Switcher with animated pill selection.
class _LibrarySegmentedTabs extends ConsumerWidget implements PreferredSizeWidget {
  const _LibrarySegmentedTabs({
    required this.tabController,
    required this.downloadCount,
  });

  final TabController tabController;
  final int downloadCount;

  @override
  Size get preferredSize => const Size.fromHeight(62);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final isOffline = ref.watch(connectivityProvider).valueOrNull == false;

    void onTabTapped(int index, String title) {
      if (isOffline && index != 0) {
        HapticFeedback.lightImpact();
        final messenger = ScaffoldMessenger.maybeOf(context);
        messenger?.hideCurrentSnackBar();
        messenger?.showSnackBar(
          SnackBar(
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            backgroundColor: const Color(0xFF0F172A),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(
                color: const Color(0xFFEF4444).withValues(alpha: 0.6),
                width: 1.2,
              ),
            ),
            content: Row(
              children: [
                const Icon(Icons.wifi_off_rounded, color: Color(0xFFEF4444), size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    '$title requires an active internet connection.',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            duration: const Duration(seconds: 2),
          ),
        );
        return;
      }
      tabController.animateTo(index);
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: Container(
        height: 50,
        padding: const EdgeInsets.all(4.5),
        decoration: BoxDecoration(
          color: palette.isDark
              ? const Color(0xFF0F1A2A).withValues(alpha: 0.85)
              : const Color(0xFFF1F5F9).withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(25),
          border: Border.all(
            color: palette.isDark
                ? Colors.white.withValues(alpha: 0.12)
                : AppColors.lightBorder,
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: palette.isDark ? 0.22 : 0.06),
              blurRadius: 12,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: AnimatedBuilder(
          animation: tabController,
          builder: (context, _) {
            final currentIndex = tabController.index;
            return Row(
              children: [
                _TabPill(
                  index: 0,
                  currentIndex: currentIndex,
                  title: 'Downloads',
                  icon: Icons.download_done_rounded,
                  accentColor: AppColors.cyan,
                  flex: downloadCount > 0 ? 12 : 10,
                  countBadge: downloadCount > 0 ? downloadCount : null,
                  onTap: () => onTabTapped(0, 'Downloads'),
                ),
                const SizedBox(width: 4),
                _TabPill(
                  index: 1,
                  currentIndex: currentIndex,
                  title: 'Videos',
                  icon: Icons.smart_display_rounded,
                  accentColor: AppColors.red,
                  isDisabled: isOffline,
                  flex: 9,
                  onTap: () => onTabTapped(1, 'Videos'),
                ),
                const SizedBox(width: 4),
                _TabPill(
                  index: 2,
                  currentIndex: currentIndex,
                  title: 'PDFs',
                  icon: Icons.picture_as_pdf_rounded,
                  accentColor: AppColors.amber,
                  isDisabled: isOffline,
                  flex: 9,
                  onTap: () => onTabTapped(2, 'Online PDFs'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _TabPill extends StatelessWidget {
  const _TabPill({
    required this.index,
    required this.currentIndex,
    required this.title,
    required this.icon,
    required this.accentColor,
    required this.onTap,
    this.flex = 1,
    this.isDisabled = false,
    this.countBadge,
  });

  final int index;
  final int currentIndex;
  final String title;
  final IconData icon;
  final Color accentColor;
  final int flex;
  final bool isDisabled;
  final VoidCallback onTap;
  final int? countBadge;

  @override
  Widget build(BuildContext context) {
    final isSelected = index == currentIndex;
    final palette = context.palette;

    return Expanded(
      flex: flex,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 200),
          opacity: isDisabled ? 0.45 : 1.0,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 7),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(21),
              gradient: isSelected
                  ? LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        accentColor.withValues(alpha: palette.isDark ? 0.28 : 0.16),
                        accentColor.withValues(alpha: palette.isDark ? 0.12 : 0.08),
                      ],
                    )
                  : null,
              border: isSelected
                  ? Border.all(
                      color: accentColor.withValues(alpha: palette.isDark ? 0.55 : 0.40),
                      width: 1.2,
                    )
                  : Border.all(color: Colors.transparent, width: 1.2),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: accentColor.withValues(alpha: palette.isDark ? 0.25 : 0.16),
                        blurRadius: 10,
                        offset: const Offset(0, 2),
                      ),
                    ]
                  : null,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  icon,
                  size: 16,
                  color: isSelected ? accentColor : palette.textMuted,
                ),
                const SizedBox(width: 4.5),
                Flexible(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                      color: isSelected
                          ? (palette.isDark ? Colors.white : accentColor)
                          : palette.textSecondary,
                      letterSpacing: -0.2,
                    ),
                  ),
                ),
                if (countBadge != null) ...[
                  const SizedBox(width: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: accentColor,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [
                        BoxShadow(
                          color: accentColor.withValues(alpha: 0.35),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: Text(
                      '$countBadge',
                      style: const TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
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
    final palette = context.palette;

    return RefreshIndicator(
      onRefresh: () async => ref.refresh(provider.future),
      child: AsyncView(
        value: examsAsync,
        onRetry: () => ref.invalidate(provider),
        data: (exams) {
          if (exams.isEmpty) {
            return ListView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
              children: [
                Center(
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: accent.withValues(alpha: 0.10),
                      border: Border.all(
                        color: accent.withValues(alpha: 0.28),
                        width: 1.2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: accent.withValues(alpha: 0.15),
                          blurRadius: 18,
                        ),
                      ],
                    ),
                    child: Center(
                      child: Icon(icon, color: accent, size: 36),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  emptyTitle,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  emptyMessage,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                        height: 1.45,
                      ),
                ),
              ],
            );
          }

          if (Responsive.isTablet(context)) {
            final cols = Responsive.gridColumns(
              context,
              tabletPortrait: 2,
              tabletLandscape: 3,
            );
            return Responsive.centered(
              maxWidth: Responsive.maxContentWidth,
              child: GridView.builder(
                padding: EdgeInsets.fromLTRB(
                  Responsive.horizontalPadding(context),
                  16,
                  Responsive.horizontalPadding(context),
                  24 + ShellScaffold.dockExtent,
                ),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: cols,
                  crossAxisSpacing: 14,
                  mainAxisSpacing: 14,
                  mainAxisExtent: 104,
                ),
                itemCount: exams.length,
                itemBuilder: (context, index) => _ExamCard(
                  exam: exams[index],
                  accent: accent,
                  icon: icon,
                  itemNoun: itemNoun,
                  routeFor: routeFor,
                ),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(
                16, 16, 16, 24 + ShellScaffold.dockExtent),
            itemCount: exams.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) => _ExamCard(
              exam: exams[index],
              accent: accent,
              icon: icon,
              itemNoun: itemNoun,
              routeFor: routeFor,
            ),
          );
        },
      ),
    );
  }
}

class _ExamCard extends StatelessWidget {
  const _ExamCard({
    required this.exam,
    required this.accent,
    required this.icon,
    required this.itemNoun,
    required this.routeFor,
  });

  final LibraryFolder exam;
  final Color accent;
  final IconData icon;
  final String itemNoun;
  final String Function(LibraryFolder exam) routeFor;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return GlassCard(
      onTap: () => context.push(routeFor(exam)),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  accent.withValues(alpha: 0.22),
                  accent.withValues(alpha: 0.08),
                ],
              ),
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(
                color: accent.withValues(alpha: 0.35),
                width: 1,
              ),
            ),
            child: Icon(icon, color: accent, size: 23),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  exam.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        height: 1.25,
                      ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    if (exam.chapterCount > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: palette.isDark
                              ? Colors.white.withValues(alpha: 0.07)
                              : Colors.black.withValues(alpha: 0.04),
                          borderRadius: BorderRadius.circular(5),
                          border: Border.all(
                            color: palette.border.withValues(alpha: 0.5),
                            width: 0.8,
                          ),
                        ),
                        child: Text(
                          Fmt.count(exam.chapterCount, 'chapter'),
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: palette.textSecondary,
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                    if (exam.itemCount > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: accent.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(5),
                          border: Border.all(
                            color: accent.withValues(alpha: 0.25),
                            width: 0.8,
                          ),
                        ),
                        child: Text(
                          Fmt.count(exam.itemCount, itemNoun),
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: accent,
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: palette.isDark
                  ? Colors.white.withValues(alpha: 0.05)
                  : Colors.black.withValues(alpha: 0.03),
            ),
            child: Icon(
              Icons.chevron_right_rounded,
              color: palette.textMuted,
              size: 18,
            ),
          ),
        ],
      ),
    );
  }
}
