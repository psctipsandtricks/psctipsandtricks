import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/config/app_config.dart';
import 'core/providers/theme_controller.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class PscStudentApp extends ConsumerWidget {
  const PscStudentApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}
