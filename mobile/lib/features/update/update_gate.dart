import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/update/app_update_controller.dart';
import '../../core/widgets/glass_card.dart';
import 'update_required_screen.dart';

/// Sits above the whole app. Three things it can do, depending on
/// [AppUpdateController]'s state:
///
///  * **Mandatory and unresolved** — replace the entire app with
///    [UpdateRequiredScreen]. Nothing underneath is reachable, by design.
///  * **A flexible update finished downloading** — leave the app fully usable
///    and float a small "restart to update" banner over it.
///  * **Anything else** — get out of the way entirely.
///
/// [checkForUpdate] is kicked off once after the first frame (so it never
/// delays the launch splash) and again on every foreground resume, both from
/// [PscStudentApp] — this widget only renders what the controller decides.
class UpdateGate extends ConsumerWidget {
  const UpdateGate({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(appUpdateControllerProvider.select((s) => s.status));

    if (status == UpdateGateStatus.mandatoryBlocked) {
      return const UpdateRequiredScreen();
    }

    return Stack(
      children: [
        child,
        if (status == UpdateGateStatus.flexibleReady)
          const Positioned(left: 0, right: 0, bottom: 0, child: _FlexibleUpdateBanner()),
      ],
    );
  }
}

class _FlexibleUpdateBanner extends ConsumerStatefulWidget {
  const _FlexibleUpdateBanner();

  @override
  ConsumerState<_FlexibleUpdateBanner> createState() => _FlexibleUpdateBannerState();
}

class _FlexibleUpdateBannerState extends ConsumerState<_FlexibleUpdateBanner> {
  bool _dismissed = false;
  bool _installing = false;

  @override
  Widget build(BuildContext context) {
    if (_dismissed) return const SizedBox.shrink();
    final palette = context.palette;

    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(14, 0, 14, 14),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: AppColors.emerald.withValues(alpha: 0.13),
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              ),
              child: const Icon(Icons.download_done_rounded, color: AppColors.emerald, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Update downloaded',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  Text(
                    'Restart the app to install the latest version.',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: palette.textMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            TextButton(
              onPressed: _installing
                  ? null
                  : () async {
                      setState(() => _installing = true);
                      await ref.read(appUpdateControllerProvider.notifier).completeFlexibleInstall();
                      // Play kills and relaunches the process on success; this
                      // only matters if that call failed and left us running.
                      if (mounted) setState(() => _installing = false);
                    },
              child: _installing
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Restart'),
            ),
            IconButton(
              tooltip: 'Dismiss',
              icon: const Icon(Icons.close_rounded, size: 18),
              onPressed: () => setState(() => _dismissed = true),
            ),
          ],
        ),
      ),
    );
  }
}
