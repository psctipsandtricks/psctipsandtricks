import 'package:flutter/material.dart';

/// Responsive layout utilities and breakpoint definitions for tablet & phone adaptations.
class Responsive {
  const Responsive._();

  /// Tablet breakpoint based on shortest side standard (600dp+).
  static const double tabletShortestSide = 600.0;

  /// Large tablet breakpoint (900dp+).
  static const double largeTabletShortestSide = 840.0;

  /// Maximum comfortable readable content width for wide tablet displays.
  static const double maxContentWidth = 1080.0;

  /// Maximum comfortable reading width for articles, book notes, and auth cards.
  static const double maxReadingWidth = 760.0;

  /// Maximum width for forms, dialogs, and auth cards.
  static const double maxFormWidth = 480.0;

  /// Returns true if the device is a tablet.
  static bool isTablet(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    return size.shortestSide >= tabletShortestSide;
  }

  /// Returns true if the device is in landscape orientation.
  static bool isLandscape(BuildContext context) {
    return MediaQuery.orientationOf(context) == Orientation.landscape;
  }

  /// Returns true if the device is a tablet in landscape orientation.
  static bool isTabletLandscape(BuildContext context) {
    return isTablet(context) && isLandscape(context);
  }

  /// Returns responsive horizontal page margin padding.
  static double horizontalPadding(BuildContext context) {
    if (isTabletLandscape(context)) return 40.0;
    if (isTablet(context)) return 28.0;
    return 16.0;
  }

  /// Returns an EdgeInsets with responsive horizontal padding.
  static EdgeInsets pagePadding(
    BuildContext context, {
    double top = 0.0,
    double bottom = 0.0,
  }) {
    return EdgeInsets.fromLTRB(
      horizontalPadding(context),
      top,
      horizontalPadding(context),
      bottom,
    );
  }

  /// Helper to calculate optimal grid column count across screen sizes.
  static int gridColumns(
    BuildContext context, {
    int phone = 2,
    int tabletPortrait = 3,
    int tabletLandscape = 4,
  }) {
    if (isTabletLandscape(context)) return tabletLandscape;
    if (isTablet(context)) return tabletPortrait;
    return phone;
  }

  /// Wraps a widget in a centered constraint box for larger tablet displays.
  static Widget centered({
    required Widget child,
    double maxWidth = maxContentWidth,
    Alignment alignment = Alignment.topCenter,
  }) {
    return Align(
      alignment: alignment,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}
