import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/config/app_config.dart';
import 'core/providers/theme_controller.dart';
import 'core/push/push_service.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/announcements/announcement_popup.dart';
import 'features/offline/offline_gate.dart';
import 'features/offline/offline_providers.dart';

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
      ref.read(downloadManagerProvider.notifier).revalidateStale();
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
          child: OfflineGate(
            // Above the router, so the notice reaches the student wherever
            // the app opened them.
            child: AnnouncementPopupHost(
              child: child ?? const SizedBox.shrink(),
            ),
          ),
        );
      },
    );
  }
}
