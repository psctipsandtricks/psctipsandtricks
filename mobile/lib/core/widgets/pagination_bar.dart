import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// Numbered page controls — `‹ 1 … 4 [5] 6 … 12 ›` — for the server-paginated
/// lists (orders, quiz attempts, completed mock tests).
///
/// Renders nothing when there is only one page. First, last and the pages
/// either side of the current one are always shown; the rest collapse to an
/// ellipsis.
class PaginationBar extends StatelessWidget {
  const PaginationBar({
    super.key,
    required this.currentPage,
    required this.totalPages,
    required this.onPageChanged,
    this.totalItems,
    this.itemNoun = 'items',
  });

  final int currentPage;
  final int totalPages;
  final ValueChanged<int> onPageChanged;

  /// When given, a "· N items" caption is shown under the controls.
  final int? totalItems;
  final String itemNoun;

  List<int?> _pageWindow(int current) {
    // null marks an ellipsis gap.
    if (totalPages <= 7) {
      return [for (var p = 1; p <= totalPages; p++) p];
    }
    final pages = <int?>{1};
    for (var p = current - 1; p <= current + 1; p++) {
      if (p >= 1 && p <= totalPages) pages.add(p);
    }
    pages.add(totalPages);
    final sorted = pages.whereType<int>().toList()..sort();

    final out = <int?>[];
    for (var i = 0; i < sorted.length; i++) {
      out.add(sorted[i]);
      if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) out.add(null);
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    if (totalPages <= 1) return const SizedBox.shrink();
    final palette = context.palette;
    final current = currentPage.clamp(1, totalPages);

    return Column(
      children: [
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 6,
          runSpacing: 6,
          children: [
            _ArrowButton(
              icon: Icons.chevron_left_rounded,
              enabled: current > 1,
              onTap: () => onPageChanged(current - 1),
            ),
            for (final page in _pageWindow(current))
              if (page == null)
                _Ellipsis(color: palette.textMuted)
              else
                _PageChip(
                  page: page,
                  selected: page == current,
                  onTap: page == current ? null : () => onPageChanged(page),
                ),
            _ArrowButton(
              icon: Icons.chevron_right_rounded,
              enabled: current < totalPages,
              onTap: () => onPageChanged(current + 1),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          totalItems == null
              ? 'Page $current of $totalPages'
              : 'Page $current of $totalPages · $totalItems $itemNoun',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: palette.textMuted,
                fontWeight: FontWeight.w600,
              ),
        ),
      ],
    );
  }
}

class _PageChip extends StatelessWidget {
  const _PageChip({required this.page, required this.selected, this.onTap});

  final int page;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    // IntrinsicWidth stops the chip from stretching to fill the row: a
    // Container with only a *minimum* width constraint plus `alignment` wraps
    // its child in an Align, and Align expands to fill any bounded (i.e. not
    // infinite) width it's offered — which is exactly what Wrap hands each
    // chip. Pre-sizing to the natural content width here keeps that width
    // finite-and-tight by the time it reaches the Align, so it hugs the digit
    // instead of stretching across the whole bar.
    return IntrinsicWidth(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            constraints: const BoxConstraints(minWidth: 38, minHeight: 38),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              gradient: selected ? AppColors.brandGradient : null,
              color: selected ? null : palette.card,
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              border: Border.all(
                color: selected
                    ? Colors.transparent
                    : palette.border,
              ),
            ),
            child: Text(
              '$page',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: selected ? Colors.white : palette.textSecondary,
                  ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ArrowButton extends StatelessWidget {
  const _ArrowButton({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        child: Container(
          width: 38,
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: palette.card,
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            border: Border.all(color: palette.border),
          ),
          child: Icon(
            icon,
            size: 20,
            color: enabled ? palette.textSecondary : palette.textMuted.withValues(alpha: 0.4),
          ),
        ),
      ),
    );
  }
}

class _Ellipsis extends StatelessWidget {
  const _Ellipsis({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 22,
      height: 38,
      child: Center(
        child: Text(
          '…',
          style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 16),
        ),
      ),
    );
  }
}
