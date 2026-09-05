import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/update/app_update_controller.dart';
import '../../core/widgets/glass_card.dart';

/// The full-screen wall shown when an update is mandatory and nothing can be
/// launched automatically right now — Google Play had no update to offer
/// (not installed from Play, staged rollout, no Play Services), the student
/// backed out of a mandatory immediate update, or the device has been offline
/// since a floor was last enforced.
///
/// Deliberately has no back button, no dismiss gesture, and no "Later" —
/// covers the whole screen above everything else, including the system nav,
/// so there is nothing behind it to fall back to.
class UpdateRequiredScreen extends ConsumerWidget {
  const UpdateRequiredScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appUpdateControllerProvider);
    final controller = ref.read(appUpdateControllerProvider.notifier);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final checking = state.status == UpdateGateStatus.checking ||
        state.status == UpdateGateStatus.launchingImmediate;

    return PopScope(
      canPop: false,
      child: Scaffold(
        body: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(0, -0.3),
              radius: 1.3,
              colors: isDark
                  ? const [Color(0xFF0C1938), Color(0xFF070E22), Color(0xFF040816)]
                  : const [Color(0xFFFFFFFF), Color(0xFFF8FAFC), Color(0xFFF1F5F9)],
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: AppColors.brandGradient,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.cyan.withValues(alpha: isDark ? 0.35 : 0.22),
                          blurRadius: 30,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.system_update_alt_rounded,
                      color: Colors.white,
                      size: 44,
                    ),
                  ),
                  const SizedBox(height: 28),
                  Text(
                    'Update Required',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    state.message,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          height: 1.5,
                          color: context.palette.textSecondary,
                        ),
                  ),
                  const SizedBox(height: 36),
                  GradientButton(
                    label: 'Update on Google Play',
                    icon: Icons.shop_outlined,
                    onPressed: controller.openPlayStore,
                  ),
                  const SizedBox(height: 14),
                  OutlinedButton.icon(
                    onPressed: checking ? null : controller.retry,
                    icon: checking
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh_rounded, size: 18),
                    label: Text(checking ? "Checking…" : "I've updated — check again"),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
