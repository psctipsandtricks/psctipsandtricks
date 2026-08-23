import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_providers.dart';

/// Light/dark preference, persisted under the same key the website uses so a
/// student who prefers light mode there is not surprised here.
class ThemeController extends StateNotifier<ThemeMode> {
  ThemeController(this._ref) : super(_read(_ref));

  final Ref _ref;
  static const _key = 'psc_theme';

  static ThemeMode _read(Ref ref) {
    switch (ref.read(sharedPrefsProvider).getString(_key)) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  Future<void> set(ThemeMode mode) async {
    state = mode;
    final prefs = _ref.read(sharedPrefsProvider);
    if (mode == ThemeMode.system) {
      await prefs.remove(_key);
    } else {
      await prefs.setString(_key, mode == ThemeMode.dark ? 'dark' : 'light');
    }
  }

  /// Cycles the two explicit modes — what the app-bar toggle does.
  Future<void> toggle(Brightness current) => set(
        current == Brightness.dark ? ThemeMode.light : ThemeMode.dark,
      );
}

final themeControllerProvider =
    StateNotifierProvider<ThemeController, ThemeMode>(
  (ref) => ThemeController(ref),
);
