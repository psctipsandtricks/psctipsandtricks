import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// Every remote image in the app goes through here: one disk cache, one set of
/// placeholder and failure visuals, and memory decoding capped to the size the
/// image is actually painted at.
class AppImage extends StatelessWidget {
  const AppImage({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.radius = 0,
    this.fallbackIcon = Icons.image_rounded,
    this.alignment = Alignment.center,
  });

  final String? url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final double radius;
  final IconData fallbackIcon;

  /// Which part of the picture survives a `BoxFit.cover` crop. Portrait
  /// artwork in a landscape frame usually wants its top kept, because that is
  /// where a book cover puts its title.
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    final borderRadius = BorderRadius.circular(radius);
    final source = url?.trim() ?? '';

    if (source.isEmpty || !source.startsWith('http')) {
      return ClipRRect(borderRadius: borderRadius, child: _fallback(context));
    }

    final dpr = MediaQuery.devicePixelRatioOf(context);
    final isFiniteWidth = width != null && width!.isFinite && !width!.isNaN && width! > 0;
    final memCacheW = isFiniteWidth ? (width! * dpr).round() : null;

    return ClipRRect(
      borderRadius: borderRadius,
      child: CachedNetworkImage(
        imageUrl: source,
        width: width,
        height: height,
        fit: fit,
        alignment: alignment,
        fadeInDuration: const Duration(milliseconds: 220),
        // Decoding a 2000px cover into a 120px slot is the single biggest
        // avoidable memory cost in a catalog grid.
        memCacheWidth: memCacheW,
        placeholder: (_, __) => _placeholder(context),
        errorWidget: (_, url, error) {
          debugPrint('AppImage error loading $url: $error');
          return _fallback(context);
        },
      ),
    );
  }

  Widget _placeholder(BuildContext context) => Container(
        width: width,
        height: height,
        color: context.palette.elevated,
      );

  Widget _fallback(BuildContext context) => Container(
        width: width,
        height: height,
        decoration: const BoxDecoration(gradient: AppColors.brandGradient),
        alignment: Alignment.center,
        child: Icon(
          fallbackIcon,
          color: Colors.white.withValues(alpha: 0.75),
          size: (height != null && height!.isFinite ? height! : 48) * 0.3,
        ),
      );
}

/// Avatar with a deterministic initials fallback, so a student without a photo
/// still gets a stable, recognisable colour.
class AppAvatar extends StatelessWidget {
  const AppAvatar({
    super.key,
    this.imageUrl,
    required this.name,
    this.size = 40,
  });

  final String? imageUrl;
  final String name;
  final double size;

  static const _palette = [
    AppColors.cyan,
    AppColors.indigo,
    AppColors.amber,
    AppColors.emerald,
    AppColors.rose,
    AppColors.blue,
  ];

  String get _initials {
    final parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts[1].substring(0, 1))
        .toUpperCase();
  }

  Color get _color => _palette[name.hashCode.abs() % _palette.length];

  @override
  Widget build(BuildContext context) {
    final url = imageUrl?.trim() ?? '';
    if (url.isNotEmpty && url.startsWith('http')) {
      return AppImage(
        url: url,
        width: size,
        height: size,
        radius: size / 2,
        fallbackIcon: Icons.person_rounded,
      );
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _color.withValues(alpha: 0.85),
            _color,
          ],
        ),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: _color.withValues(alpha: 0.25),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        _initials,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: size * 0.38,
          letterSpacing: -0.5,
        ),
      ),
    );
  }
}

/// Book cover with custom or adaptive aspect ratio and rounded corners.
class BookCover extends StatelessWidget {
  const BookCover({
    super.key,
    required this.url,
    this.width = 112,
    this.aspectRatio,
    this.isPortrait = false,
  });

  final String? url;
  final double width;
  final double? aspectRatio;
  final bool isPortrait;

  @override
  Widget build(BuildContext context) {
    final heightRatio = aspectRatio ?? (isPortrait ? (4 / 3) : (9 / 16));
    return AppImage(
      url: url,
      width: width,
      height: width * heightRatio,
      radius: AppTheme.radiusMd,
      fallbackIcon: Icons.menu_book_rounded,
    );
  }
}
