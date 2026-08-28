import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// The five-tab frame every primary screen lives inside.
///
/// The bar is a floating capsule rather than a full-width strip: it reads as an
/// overlay on top of the page instead of a slab bolted to the bottom edge, and
/// the active tab carries a lighter lozenge so the current section is legible
/// at a glance without relying on colour alone.
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
    // Home always lands on the landing page. The other tabs only reset when
    // re-tapped while already active, which is the usual bottom-bar behaviour —
    // switching away from Books mid-scroll and back should return you there,
    // but "Home" should always mean home.
    const homeIndex = 0;
    navigationShell.goBranch(
      index,
      initialLocation:
          index == homeIndex || index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 6, 14, 10),
          child: Container(
            height: 66,
            decoration: BoxDecoration(
              color: palette.card,
              borderRadius: BorderRadius.circular(33),
              border: Border.all(color: palette.border),
              boxShadow: [
                BoxShadow(
                  color: palette.isDark
                      ? Colors.black.withValues(alpha: 0.55)
                      : const Color(0xFF0F172A).withValues(alpha: 0.13),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
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
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 7),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            decoration: BoxDecoration(
              // The lozenge is a lifted surface with a cyan wash rather than a
              // saturated fill — at five tabs a solid block would shout.
              gradient: selected
                  ? LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        AppColors.cyan.withValues(alpha: palette.isDark ? 0.22 : 0.16),
                        AppColors.indigo.withValues(alpha: palette.isDark ? 0.16 : 0.10),
                      ],
                    )
                  : null,
              borderRadius: BorderRadius.circular(26),
              border: Border.all(
                color: selected
                    ? AppColors.cyan.withValues(alpha: 0.34)
                    : Colors.transparent,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedScale(
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOutBack,
                  scale: selected ? 1.06 : 1,
                  child: Icon(
                    selected ? spec.activeIcon : spec.icon,
                    size: 21,
                    color: color,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  spec.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: color,
                        fontWeight:
                            selected ? FontWeight.w800 : FontWeight.w500,
                        fontSize: 10.5,
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
