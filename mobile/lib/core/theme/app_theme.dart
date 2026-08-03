import 'package:flutter/material.dart';

class AppTheme {
  // Deep Navy + Muted Gold Color Palette
  static const Color deepNavy = Color(0xFF0F172A);
  static const Color navyCard = Color(0xFF1E293B);
  static const Color mutedGold = Color(0xFFD4AF37);
  static const Color goldAccent = Color(0xFFF59E0B);
  static const Color textWhite = Color(0xFFF8FAFC);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color emeraldAccent = Color(0xFF10B981);

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: deepNavy,
      primaryColor: mutedGold,
      colorScheme: const ColorScheme.dark(
        primary: mutedGold,
        secondary: goldAccent,
        surface: navyCard,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: deepNavy,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: textWhite,
          fontSize: 20,
          fontWeight: FontWeight.bold,
        ),
      ),
      cardTheme: CardThemeData(
        color: navyCard,
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFF334155), width: 1),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: navyCard,
        selectedItemColor: mutedGold,
        unselectedItemColor: textMuted,
        type: BottomNavigationBarType.fixed,
      ),
    );
  }
}
