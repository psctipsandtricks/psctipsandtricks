import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// The five-tab frame every primary screen lives inside.
///
/// Designed as a modern floating capsule with ambient glow, spring scaling,
/// and tactile haptic feedback.
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
    HapticFeedback.selectionClick();
    navigationShell.goBranch(index, initialLocation: true);
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 10),
          child: Container(
            height: 64,
            decoration: BoxDecoration(
              color: palette.card.withValues(alpha: palette.isDark ? 0.94 : 0.98),
              borderRadius: BorderRadius.circular(32),
              border: Border.all(
                color: palette.isDark
                    ? AppColors.darkBorder.withValues(alpha: 0.8)
                    : palette.border,
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: palette.isDark
                      ? Colors.black.withValues(alpha: 0.5)
                      : const Color(0xFF0F172A).withValues(alpha: 0.08),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
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

    return Semantics(
      selected: selected,
      button: true,
      label: spec.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 6),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            decoration: BoxDecoration(
              gradient: selected
                  ? LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        AppColors.cyan.withValues(alpha: palette.isDark ? 0.22 : 0.14),
                        AppColors.indigo.withValues(alpha: palette.isDark ? 0.14 : 0.08),
                      ],
                    )
                  : null,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: selected
                    ? AppColors.cyan.withValues(alpha: 0.32)
                    : Colors.transparent,
                width: 1,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedScale(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOutBack,
                  scale: selected ? 1.08 : 1.0,
                  child: Icon(
                    selected ? spec.activeIcon : spec.icon,
                    size: 20,
                    color: color,
                  ),
                ),
                const SizedBox(height: 2.5),
                Text(
                  spec.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: color,
                        fontWeight:
                            selected ? FontWeight.w800 : FontWeight.w500,
                        fontSize: 10,
                        height: 1.1,
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
