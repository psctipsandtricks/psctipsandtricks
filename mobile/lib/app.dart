import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/config/app_config.dart';
import 'core/providers/theme_controller.dart';
import 'core/push/push_service.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/update/app_update_controller.dart';
import 'core/widgets/app_launch_splash.dart';
import 'features/announcements/announcement_popup.dart';
import 'features/offline/offline_gate.dart';
import 'features/offline/offline_providers.dart';
import 'features/update/update_gate.dart';

class PscStudentApp extends ConsumerStatefulWidget {
  const PscStudentApp({super.key});

  @override
  ConsumerState<PscStudentApp> createState() => _PscStudentAppState();
}

class _PscStudentAppState extends ConsumerState<PscStudentApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // After the first frame, so requesting the notification permission does not
    // land on top of the splash screen, and so the router exists by the time a
    // launch-from-tray message is routed.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(pushServiceProvider).start();
      // Fire-and-forget: the controller itself decides what, if anything, to
      // show — nothing here waits on it, so a slow or unreachable backend
      // never holds up the splash or the first frame of real content.
      ref.read(appUpdateControllerProvider.notifier).checkForUpdate();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Refresh offline leases whenever the app comes forward. Doing it here —
    // rather than only when the student opens a downloaded book — means the
    // check-in usually happens while they are online anyway, so the lock screen
    // stays rare.
    if (state == AppLifecycleState.resumed) {
      final downloads = ref.read(downloadManagerProvider.notifier);
      // Delete any downloaded book whose access window has closed. This is a
      // local check against each copy's stored validity, so it runs with or
      // without a connection; the lease re-check that follows also catches
      // server-side revocations.
      downloads.purgeExpiredDownloads();
      downloads.revalidateStale();
      // Re-checks are cheap: the controller no-ops if a check is already
      // running or the student is already looking at the blocking screen, so
      // this never doubles up or re-launches a flow that is already open.
      ref.read(appUpdateControllerProvider.notifier).checkForUpdate();
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      routerConfig: ref.watch(routerProvider),
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ref.watch(themeControllerProvider),
      builder: (context, child) {
        // Pin text scaling to a sane band: the quiz option cards and the
        // reader's chapter rail break apart past ~1.3x.
        final scale = MediaQuery.textScalerOf(context).scale(1).clamp(0.85, 1.3);
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(scale),
          ),
          child: AppLaunchSplashHost(
            child: UpdateGate(
              // Outermost of the three: a mandatory update takes over the
              // whole app, offline steering and announcements included —
              // there is nothing behind that wall worth reaching. Otherwise
              // it is invisible and everything below runs exactly as before.
              child: OfflineGate(
                // Above the router, so the notice reaches the student wherever
                // the app opened them.
                child: AnnouncementPopupHost(
                  child: child ?? const SizedBox.shrink(),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
