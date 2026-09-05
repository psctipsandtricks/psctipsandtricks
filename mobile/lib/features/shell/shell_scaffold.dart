import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/connectivity_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_glass.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/liquid_glass.dart';
import '../quizzes/quizzes_providers.dart';

/// The five-tab frame every primary screen lives inside.
///
/// A floating Liquid Glass dock: the page scrolls underneath it rather than
/// stopping above it, so the bar is always refracting real content. The
/// selected tab is marked by a single pill that slides between slots instead of
/// each tab fading its own background in and out — one moving object reads as
/// one control.
///
/// The dock also gets out of the way: reading down a page drops it off the
/// bottom of the screen, and the first flick back up brings it in. Watching
/// scroll notifications from here rather than from each screen means every
/// scrollable inside the shell — the tabs and everything pushed on top of them
/// — behaves the same way without knowing the dock exists.
class ShellScaffold extends ConsumerStatefulWidget {
  const ShellScaffold({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  /// Height of the dock plus the gap under it. Tab screens leave this much
  /// clear at the end of their scroll so the last row is never trapped
  /// beneath the glass while it is showing.
  static const double dockExtent = 78;

  @override
  ConsumerState<ShellScaffold> createState() => _ShellScaffoldState();
}

class _ShellScaffoldState extends ConsumerState<ShellScaffold> {
  static const _destinations = <_TabSpec>[
    _TabSpec('Home', Icons.home_outlined, Icons.home_rounded),
    _TabSpec('Books', Icons.menu_book_outlined, Icons.menu_book_rounded),
    _TabSpec('Quizzes', Icons.quiz_outlined, Icons.quiz_rounded),
    _TabSpec(
        'Library', Icons.video_library_outlined, Icons.video_library_rounded),
    _TabSpec('Me', Icons.person_outline_rounded, Icons.person_rounded),
  ];

  @override
  void didUpdateWidget(covariant ShellScaffold oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.navigationShell.currentIndex !=
        widget.navigationShell.currentIndex) {
      _resetQuizModuleState();
    }
  }

  void _resetQuizModuleState() {
    ref.read(quizAccessTierProvider.notifier).state = null;
    ref.read(folderPathProvider.notifier).state = FolderPath.root;
    ref.read(quizSearchProvider.notifier).state = '';
  }

  void _onTap(int index) {
    final isOffline = ref.read(connectivityProvider).valueOrNull == false;
    // Index 3 is Library (offline downloads vault).
    // All other tabs (0: Home, 1: Books, 2: Quizzes, 4: Me) require internet.
    if (isOffline && index != 3) {
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
                  '${_destinations[index].label} requires an active internet connection.',
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

    HapticFeedback.selectionClick();
    if (index == 2 || widget.navigationShell.currentIndex == 2) {
      _resetQuizModuleState();
    }
    widget.navigationShell.goBranch(index, initialLocation: true);
  }

  /// Handles the Android system Back button (and predictive-back gesture) when
  /// it reaches the shell — i.e. the current tab has no page pushed on top of
  /// it, so there is nothing for go_router itself to pop.
  ///
  ///  1. If on Quizzes tab inside a folder/tier/search, step back through folders
  ///     first — that state, not the module's starting page, is what Back means.
  ///  2. Any other module's starting page → jump straight to Home.
  ///  3. Already on Home's starting page → close the app.
  void _handleSystemBack() {
    final isOffline = ref.read(connectivityProvider).valueOrNull == false;
    final router = GoRouter.of(context);

    // Defensive: a dialog or sheet on a branch navigator can route Back here
    // even though something is poppable.
    if (router.canPop()) {
      router.pop();
      return;
    }

    if (isOffline) {
      SystemNavigator.pop();
      return;
    }

    // If on Quizzes tab and not at root starting page, step back through folders/search/tier
    if (widget.navigationShell.currentIndex == 2) {
      final search = ref.read(quizSearchProvider);
      if (search.isNotEmpty) {
        ref.read(quizSearchProvider.notifier).state = '';
        return;
      }
      final path = ref.read(folderPathProvider);
      if (!path.isRoot) {
        ref.read(folderPathProvider.notifier).update((p) => p.pop());
        return;
      }
      final tier = ref.read(quizAccessTierProvider);
      if (tier != null) {
        ref.read(quizAccessTierProvider.notifier).state = null;
        return;
      }
    }

    if (widget.navigationShell.currentIndex != 0) {
      widget.navigationShell.goBranch(0, initialLocation: true);
      return;
    }

    SystemNavigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.disableAnimationsOf(context);
    final current = widget.navigationShell.currentIndex;
    final isOffline = ref.watch(connectivityProvider).valueOrNull == false;

    return PopScope(
      // Never let the framework pop on its own: a shell branch root has nothing
      // above it, so an unhandled Back would tear down the whole app. `_handleSystemBack`
      // decides what actually happens.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleSystemBack();
      },
      child: Scaffold(
        // The dock floats: content runs to the bottom of the screen and is seen
        // through the glass.
        extendBody: true,
        body: widget.navigationShell,
        bottomNavigationBar: isOffline
            ? null
            : SafeArea(
                top: false,
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 620),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                      child: LiquidGlass(
                        borderRadius: BorderRadius.circular(30),
                        blurSigma: AppGlass.blurBar,
                        intensity: 1.1,
                        elevation: 1.2,
                        isCardScale: false,
                        child: SizedBox(
                          height: 60,
                          child: LayoutBuilder(
                            builder: (context, constraints) {
                              final slot =
                                  constraints.maxWidth / _destinations.length;

                              return Stack(
                                children: [
                                  // The travelling selection pill.
                                  AnimatedPositioned(
                                    duration:
                                        Duration(milliseconds: still ? 0 : 340),
                                    curve: Curves.easeOutQuint,
                                    left: slot * current,
                                    top: 0,
                                    bottom: 0,
                                    width: slot,
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 6,
                                      ),
                                      child: DecoratedBox(
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            begin: Alignment.topCenter,
                                            end: Alignment.bottomCenter,
                                            colors: [
                                              AppColors.cyan
                                                  .withValues(alpha: 0.26),
                                              AppColors.indigo
                                                  .withValues(alpha: 0.16),
                                            ],
                                          ),
                                          borderRadius:
                                              BorderRadius.circular(22),
                                          border: Border.all(
                                            color: AppColors.cyan
                                                .withValues(alpha: 0.34),
                                          ),
                                          boxShadow: [
                                            BoxShadow(
                                              color: AppColors.cyan
                                                  .withValues(alpha: 0.20),
                                              blurRadius: 16,
                                              spreadRadius: -2,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                  Row(
                                    children: [
                                      for (var i = 0;
                                          i < _destinations.length;
                                          i++)
                                        Expanded(
                                          child: _TabButton(
                                            spec: _destinations[i],
                                            selected: current == i,
                                            isDisabled: false,
                                            onTap: () => _onTap(i),
                                          ),
                                        ),
                                    ],
                                  ),
                                ],
                              );
                            },
                          ),
                        ),
                      ),
                    ),
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
    this.isDisabled = false,
  });

  final _TabSpec spec;
  final bool selected;
  final bool isDisabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final color = isDisabled
        ? palette.textMuted.withValues(alpha: 0.45)
        : (selected
            ? (palette.isDark ? Colors.white : AppColors.cyan)
            : palette.textMuted);

    return Semantics(
      selected: selected,
      enabled: !isDisabled,
      button: true,
      label: spec.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 250),
          opacity: isDisabled ? 0.45 : 1.0,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedScale(
                duration: const Duration(milliseconds: 260),
                curve: Curves.easeOutBack,
                scale: selected ? 1.1 : 1.0,
                child: Icon(
                  selected ? spec.activeIcon : spec.icon,
                  size: 20,
                  color: color,
                ),
              ),
              const SizedBox(height: 3),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 220),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: color,
                          fontWeight:
                              selected ? FontWeight.w800 : FontWeight.w500,
                          fontSize: 10,
                          height: 1.1,
                        ) ??
                    const TextStyle(),
                child: Text(
                  spec.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
