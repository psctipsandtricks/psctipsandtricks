import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/responsive.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../data/models/library.dart';
import '../../features/pdfs/pdf_viewer_screen.dart';
import '../shell/shell_scaffold.dart';

/// What the player needs. Accepts a plain URL so both the video library and the
/// book reader can push the same screen.
class VideoPlayerArgs {
  const VideoPlayerArgs({
    required this.youtubeUrl,
    required this.title,
    this.description,
    this.pdfUrl,
    this.pdfFileName,
    this.thumbnailUrl,
  });

  final String youtubeUrl;
  final String title;
  final String? description;
  final String? pdfUrl;
  final String? pdfFileName;
  final String? thumbnailUrl;
}

/// A modern, cyber-glass lesson viewer providing rich thumbnail previews,
/// class notes access, and direct high-reliability YouTube streaming.
class VideoPlayerScreen extends StatelessWidget {
  const VideoPlayerScreen({super.key, required this.video});

  final VideoPlayerArgs video;

  String get _videoId => extractYoutubeId(video.youtubeUrl);

  String get _thumbnailUrl {
    final thumb = (video.thumbnailUrl ?? '').trim();
    if (thumb.isNotEmpty) return thumb;
    final id = _videoId;
    return id.isNotEmpty ? 'https://img.youtube.com/vi/$id/hqdefault.jpg' : '';
  }

  Future<void> _openOnYoutube() async {
    final uri = Uri.tryParse(video.youtubeUrl);
    if (uri == null) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      await launchUrl(uri, mode: LaunchMode.platformDefault);
    }
  }

  void _share(BuildContext context) {
    Clipboard.setData(ClipboardData(text: video.youtubeUrl));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Row(
          children: [
            Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
            SizedBox(width: 8),
            Text('Video link copied to clipboard!'),
          ],
        ),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        backgroundColor: AppColors.cyan,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final thumb = _thumbnailUrl;
    final hasPdf = (video.pdfUrl ?? '').isNotEmpty;
    final hasDescription = (video.description ?? '').trim().isNotEmpty;

    return Scaffold(
      appBar: GlassAppBar(
        title: Text(video.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: 'Copy link',
            icon: const Icon(Icons.share_rounded, size: 20),
            onPressed: () => _share(context),
          ),
        ],
      ),
      body: Responsive.centered(
        maxWidth: Responsive.maxContentWidth,
        child: ListView(
          padding: EdgeInsets.fromLTRB(
            Responsive.horizontalPadding(context),
            16,
            Responsive.horizontalPadding(context),
            32 + ShellScaffold.dockExtent,
          ),
          children: [
            // 1. Hero Video Stage with Glass Overlay & Glowing Play Button
            _HeroVideoCard(
              thumbnailUrl: thumb,
              onPlay: _openOnYoutube,
            ),
            const SizedBox(height: 14),

            // 2. Main CTA: Watch on YouTube Button
            _YoutubeWatchButton(onPressed: _openOnYoutube),
            const SizedBox(height: 18),

            // 3. Lesson Overview Card
            GlassCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header Row with Category Pill & Quality Pill
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.cyan.withValues(alpha: 0.12),
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusSm),
                          border: Border.all(
                            color: AppColors.cyan.withValues(alpha: 0.3),
                            width: 0.8,
                          ),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.play_lesson_rounded,
                              size: 13,
                              color: AppColors.cyan,
                            ),
                            SizedBox(width: 4.5),
                            Text(
                              'VIDEO LESSON',
                              style: TextStyle(
                                color: AppColors.cyan,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3.5),
                        decoration: BoxDecoration(
                          color: palette.elevated,
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusSm),
                          border: Border.all(
                            color: palette.border.withValues(alpha: 0.6),
                            width: 0.8,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.hd_rounded,
                              size: 14,
                              color: palette.textSecondary,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Full HD',
                              style: TextStyle(
                                color: palette.textSecondary,
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Lesson Title
                  Text(
                    video.title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                          letterSpacing: -0.3,
                          height: 1.35,
                        ),
                  ),

                  // Metadata Badges Row
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _MetaChip(
                        icon: Icons.ondemand_video_rounded,
                        label: 'YouTube Stream',
                        color: const Color(0xFFFF0000),
                      ),
                      _MetaChip(
                        icon: hasPdf
                            ? Icons.picture_as_pdf_rounded
                            : Icons.check_circle_outline_rounded,
                        label: hasPdf ? 'PDF Notes Attached' : 'Interactive Class',
                        color: hasPdf ? AppColors.rose : AppColors.emerald,
                      ),
                    ],
                  ),

                  // Description if present
                  if (hasDescription) ...[
                    const SizedBox(height: 14),
                    Divider(
                      height: 1,
                      color: palette.border.withValues(alpha: 0.6),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'About this class',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: palette.textPrimary,
                          ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      video.description!.trim(),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: palette.textSecondary,
                            height: 1.55,
                            fontSize: 13,
                          ),
                    ),
                  ],
                ],
              ),
            ),

            // 4. Class Notes Card (If attached)
            if (hasPdf) ...[
              const SizedBox(height: 18),
              Row(
                children: [
                  const Icon(
                    Icons.menu_book_rounded,
                    size: 18,
                    color: AppColors.cyan,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Class Notes & Material',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              _PdfNotesCard(
                fileName: video.pdfFileName ?? '${video.title} Notes.pdf',
                pdfUrl: video.pdfUrl!,
                videoTitle: video.title,
              ),
            ],

            // 5. Learning Companion Tip Card
            const SizedBox(height: 18),
            const _StudyTipCard(),
          ],
        ),
      ),
    );
  }
}

/// Hero 16:9 Video stage with glowing play button and cyber-glass overlay
class _HeroVideoCard extends StatelessWidget {
  const _HeroVideoCard({
    required this.thumbnailUrl,
    required this.onPlay,
  });

  final String thumbnailUrl;
  final VoidCallback onPlay;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: palette.isDark ? 0.45 : 0.12),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusLg),
            border: Border.all(
              color: palette.border.withValues(alpha: 0.8),
              width: 1.2,
            ),
          ),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // 1. Thumbnail Image
                if (thumbnailUrl.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: thumbnailUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(
                      color: palette.card,
                      child: const Center(
                        child: CircularProgressIndicator(
                          strokeWidth: 2.2,
                          color: AppColors.cyan,
                        ),
                      ),
                    ),
                    errorWidget: (_, __, ___) => Container(
                      color: palette.elevated,
                      child: const Icon(
                        Icons.smart_display_rounded,
                        size: 48,
                        color: AppColors.cyan,
                      ),
                    ),
                  )
                else
                  Container(
                    color: palette.elevated,
                    child: const Icon(
                      Icons.smart_display_rounded,
                      size: 48,
                      color: AppColors.cyan,
                    ),
                  ),

                // 2. Cinematic Vignette Overlay
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withValues(alpha: 0.35),
                        Colors.black.withValues(alpha: 0.15),
                        Colors.black.withValues(alpha: 0.65),
                      ],
                    ),
                  ),
                ),

                // 3. Top Tag Pills
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.65),
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.2),
                        width: 0.8,
                      ),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.play_arrow_rounded,
                          size: 14,
                          color: Color(0xFFFF0000),
                        ),
                        SizedBox(width: 4),
                        Text(
                          'YouTube',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // 4. Center Glowing Play Trigger
                Center(
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: onPlay,
                      customBorder: const CircleBorder(),
                      child: Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFFFF0000).withValues(alpha: 0.92),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFFF0000).withValues(alpha: 0.45),
                              blurRadius: 20,
                              spreadRadius: 2,
                            ),
                          ],
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.6),
                            width: 2,
                          ),
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.play_arrow_rounded,
                            color: Colors.white,
                            size: 38,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                // 5. Bottom Prompt
                Positioned(
                  bottom: 10,
                  left: 14,
                  right: 14,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Tap to play full video',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.85),
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          shadows: const [
                            Shadow(color: Colors.black, blurRadius: 4),
                          ],
                        ),
                      ),
                      Icon(
                        Icons.open_in_new_rounded,
                        size: 14,
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Red/Crimson gradient YouTube CTA button
class _YoutubeWatchButton extends StatelessWidget {
  const _YoutubeWatchButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 52,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color(0xFFFF0033),
            Color(0xFFD60000),
          ],
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFF0033).withValues(alpha: 0.35),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.play_circle_fill_rounded,
                color: Colors.white,
                size: 24,
              ),
              SizedBox(width: 10),
              Text(
                'Watch on YouTube',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 15.5,
                  letterSpacing: 0.2,
                ),
              ),
              SizedBox(width: 6),
              Icon(
                Icons.arrow_forward_rounded,
                color: Colors.white70,
                size: 16,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Small pill badge for metadata items
class _MetaChip extends StatelessWidget {
  const _MetaChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border.all(
          color: color.withValues(alpha: 0.25),
          width: 0.8,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// Glass card for downloading or viewing PDF class notes
class _PdfNotesCard extends StatelessWidget {
  const _PdfNotesCard({
    required this.fileName,
    required this.pdfUrl,
    required this.videoTitle,
  });

  final String fileName;
  final String pdfUrl;
  final String videoTitle;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return GlassCard(
      padding: const EdgeInsets.all(14),
      onTap: () => openPdf(
        context,
        url: pdfUrl,
        title: fileName.isNotEmpty ? fileName : videoTitle,
        minimal: true,
      ),
      child: Row(
        children: [
          // PDF Rose Glowing Icon Container
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppColors.rose.withValues(alpha: 0.2),
                  AppColors.rose.withValues(alpha: 0.08),
                ],
              ),
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(
                color: AppColors.rose.withValues(alpha: 0.35),
                width: 1,
              ),
            ),
            child: const Center(
              child: Icon(
                Icons.picture_as_pdf_rounded,
                color: AppColors.rose,
                size: 22,
              ),
            ),
          ),
          const SizedBox(width: 14),

          // PDF Name and description
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  fileName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                      ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Tap to open and read full notes',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                        fontSize: 11,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),

          // Open Pill Button
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.cyan.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              border: Border.all(
                color: AppColors.cyan.withValues(alpha: 0.35),
                width: 0.8,
              ),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.visibility_rounded,
                  size: 13,
                  color: AppColors.cyan,
                ),
                SizedBox(width: 4),
                Text(
                  'View',
                  style: TextStyle(
                    color: AppColors.cyan,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Helpful study companion tip banner
class _StudyTipCard extends StatelessWidget {
  const _StudyTipCard();

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.amber.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(
          color: AppColors.amber.withValues(alpha: 0.25),
          width: 0.8,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppColors.amber.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.lightbulb_rounded,
              color: AppColors.amber,
              size: 16,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Preparation Tip',
                  style: TextStyle(
                    color: AppColors.amber,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    letterSpacing: 0.1,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Watch the video class carefully and review the PDF notes afterwards to solidify key concepts.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                        fontSize: 11.5,
                        height: 1.45,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Opens the YouTube player for [args].
///
/// On the root navigator, not the nearest one. The video library lives inside a
/// `StatefulShellRoute` branch, and that branch's Navigator is go_router's own —
/// it is rebuilt from a declarative `pages` list every time the router notifies,
/// and the shell's Back handler pops it through `GoRouter.pop()`, which knows
/// nothing about a route pushed onto it imperatively. Pushing there is what left
/// tapping a class in the library going nowhere while the notes button beside
/// it, which has always used the root navigator, worked. `openPdf` does the
/// same thing for the same reason.
Future<void> openVideo(BuildContext context, VideoPlayerArgs args) {
  return Navigator.of(context, rootNavigator: true).push(
    MaterialPageRoute(builder: (_) => VideoPlayerScreen(video: args)),
  );
}

/// Compact 16:9 thumbnail row used across the video library.
class VideoThumbnail extends StatelessWidget {
  const VideoThumbnail({
    super.key,
    required this.thumbnailUrl,
    this.youtubeVideoId,
    this.youtubeUrl,
    this.width = 132,
  });

  final String thumbnailUrl;
  final String? youtubeVideoId;
  final String? youtubeUrl;
  final double width;

  String get _resolvedUrl {
    final thumb = thumbnailUrl.trim();
    if (thumb.isNotEmpty && thumb.startsWith('http')) {
      return thumb;
    }
    final vid = (youtubeVideoId != null && youtubeVideoId!.isNotEmpty)
        ? youtubeVideoId!
        : (youtubeUrl != null ? extractYoutubeId(youtubeUrl!) : '');
    if (vid.isNotEmpty) {
      return 'https://img.youtube.com/vi/$vid/hqdefault.jpg';
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final url = _resolvedUrl;
    final fallbackVid = (youtubeVideoId != null && youtubeVideoId!.isNotEmpty)
        ? youtubeVideoId!
        : (youtubeUrl != null ? extractYoutubeId(youtubeUrl!) : '');
    final fallbackUrl = fallbackVid.isNotEmpty
        ? 'https://i.ytimg.com/vi/$fallbackVid/hqdefault.jpg'
        : '';

    final dpr = MediaQuery.devicePixelRatioOf(context);
    final memCacheW = (width * dpr).round();

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: SizedBox(
        width: width,
        height: width * 9 / 16,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (url.isNotEmpty)
              CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                memCacheWidth: memCacheW > 0 ? memCacheW : null,
                fadeInDuration: const Duration(milliseconds: 200),
                placeholder: (_, __) => Container(
                  color: context.palette.elevated,
                ),
                errorWidget: (_, __, ___) => fallbackUrl.isNotEmpty && fallbackUrl != url
                    ? CachedNetworkImage(
                        imageUrl: fallbackUrl,
                        fit: BoxFit.cover,
                        memCacheWidth: memCacheW > 0 ? memCacheW : null,
                        placeholder: (_, __) => Container(
                          color: context.palette.elevated,
                        ),
                        errorWidget: (_, __, ___) => _fallbackContainer(context),
                      )
                    : _fallbackContainer(context),
              )
            else
              _fallbackContainer(context),
            Center(
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.55),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.play_arrow_rounded,
                    color: Colors.white, size: 18),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _fallbackContainer(BuildContext context) => Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              context.palette.elevated,
              context.palette.card,
            ],
          ),
        ),
        alignment: Alignment.center,
        child: Icon(
          Icons.smart_display_rounded,
          color: context.palette.textMuted.withValues(alpha: 0.4),
          size: 24,
        ),
      );
}
