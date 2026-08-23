import 'package:flutter/material.dart';

/// The web platform's "cyber glass" palette, ported verbatim so the app and the
/// site read as one product. Values mirror `apps/web/src/app/globals.css`.
class AppColors {
  const AppColors._();

  // Brand accents — shared by both themes.
  static const Color cyan = Color(0xFF06B6D4);
  static const Color sky = Color(0xFF38BDF8);
  static const Color blue = Color(0xFF3B82F6);
  static const Color indigo = Color(0xFF6366F1);
  static const Color amber = Color(0xFFF59E0B);
  static const Color gold = Color(0xFFFBBF24);
  static const Color emerald = Color(0xFF10B981);
  static const Color rose = Color(0xFFF43F5E);
  static const Color red = Color(0xFFEF4444);

  // Dark surface ramp.
  static const Color darkBg = Color(0xFF060B18);
  static const Color darkCard = Color(0xFF0C152E);
  static const Color darkElevated = Color(0xFF111C3A);
  static const Color darkBorder = Color(0xFF1E2E56);
  static const Color darkInput = Color(0xFF091124);
  static const Color darkTextPrimary = Color(0xFFF8FAFC);
  static const Color darkTextSecondary = Color(0xFF94A3B8);
  static const Color darkTextMuted = Color(0xFF64748B);

  // Light surface ramp.
  static const Color lightBg = Color(0xFFF0F4F9);
  static const Color lightCard = Color(0xFFFFFFFF);
  static const Color lightElevated = Color(0xFFF8FAFC);
  static const Color lightBorder = Color(0xFFE2E8F0);
  static const Color lightInput = Color(0xFFF1F5F9);
  static const Color lightTextPrimary = Color(0xFF0F172A);
  static const Color lightTextSecondary = Color(0xFF475569);
  static const Color lightTextMuted = Color(0xFF94A3B8);

  /// The signature cyan→blue→indigo sweep used on primary CTAs and headings.
  static const LinearGradient brandGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [cyan, blue, indigo],
  );

  /// Amber sweep used for premium / paid affordances, matching the site's
  /// "gold" button variant.
  static const LinearGradient goldGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [amber, gold],
  );
}

/// Theme-aware surface tokens, reached via `Theme.of(context).extension<AppPalette>()`
/// or the `context.palette` shorthand in `app_theme.dart`.
@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({
    required this.background,
    required this.card,
    required this.elevated,
    required this.border,
    required this.input,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.isDark,
  });

  final Color background;
  final Color card;
  final Color elevated;
  final Color border;
  final Color input;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final bool isDark;

  static const AppPalette dark = AppPalette(
    background: AppColors.darkBg,
    card: AppColors.darkCard,
    elevated: AppColors.darkElevated,
    border: AppColors.darkBorder,
    input: AppColors.darkInput,
    textPrimary: AppColors.darkTextPrimary,
    textSecondary: AppColors.darkTextSecondary,
    textMuted: AppColors.darkTextMuted,
    isDark: true,
  );

  static const AppPalette light = AppPalette(
    background: AppColors.lightBg,
    card: AppColors.lightCard,
    elevated: AppColors.lightElevated,
    border: AppColors.lightBorder,
    input: AppColors.lightInput,
    textPrimary: AppColors.lightTextPrimary,
    textSecondary: AppColors.lightTextSecondary,
    textMuted: AppColors.lightTextMuted,
    isDark: false,
  );

  @override
  AppPalette copyWith({
    Color? background,
    Color? card,
    Color? elevated,
    Color? border,
    Color? input,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    bool? isDark,
  }) {
    return AppPalette(
      background: background ?? this.background,
      card: card ?? this.card,
      elevated: elevated ?? this.elevated,
      border: border ?? this.border,
      input: input ?? this.input,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      isDark: isDark ?? this.isDark,
    );
  }

  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    return AppPalette(
      background: Color.lerp(background, other.background, t)!,
      card: Color.lerp(card, other.card, t)!,
      elevated: Color.lerp(elevated, other.elevated, t)!,
      border: Color.lerp(border, other.border, t)!,
      input: Color.lerp(input, other.input, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      isDark: t < 0.5 ? isDark : other.isDark,
    );
  }
}
