import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// The five-tab frame every primary screen lives inside.
///
/// Each branch keeps its own navigator, so switching tabs preserves scroll
/// position and any pushed detail screen — tapping away from a book mid-scroll
/// and back returns exactly where the student was.
class ShellScaffold extends StatelessWidget {
  const ShellScaffold({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _destinations = <_TabSpec>[
    _TabSpec('Home', Icons.home_outlined, Icons.home_rounded),
    _TabSpec('Books', Icons.menu_book_outlined, Icons.menu_book_rounded),
    _TabSpec('Quizzes', Icons.quiz_outlined, Icons.quiz_rounded),
    _TabSpec('Library', Icons.video_library_outlined, Icons.video_library_rounded),
    _TabSpec('Me', Icons.person_outline_rounded, Icons.person_rounded),
  ];

  void _onTap(int index) {
    // Re-tapping the active tab pops that branch back to its root, which is
    // what a student expects from a bottom bar.
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          color: palette.card,
          border: Border(top: BorderSide(color: palette.border)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 62,
            child: Row(
              children: [
                for (var i = 0; i < _destinations.length; i++)
                  Expanded(
                    child: _TabButton(
                      spec: _destinations[i],
                      selected: navigationShell.currentIndex == i,
                      onTap: () => _onTap(i),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TabSpec {
  const _TabSpec(this.label, this.icon, this.activeIcon);
  final String label;
  final IconData icon;
  final IconData activeIcon;
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.spec,
    required this.selected,
    required this.onTap,
  });

  final _TabSpec spec;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final color = selected ? AppColors.cyan : palette.textMuted;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // A short accent bar rather than a pill: it reads at a glance without
          // crowding five labels into a narrow bar.
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            height: 3,
            width: selected ? 22 : 0,
            decoration: BoxDecoration(
              gradient: AppColors.brandGradient,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(height: 6),
          Icon(selected ? spec.activeIcon : spec.icon, size: 23, color: color),
          const SizedBox(height: 3),
          Text(
            spec.label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  fontSize: 11,
                ),
          ),
        ],
      ),
    );
  }
}
