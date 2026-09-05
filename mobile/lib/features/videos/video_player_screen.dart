import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../data/models/library.dart';
import '../../features/pdfs/pdf_viewer_screen.dart';

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

/// A number of these lessons were uploaded with embedding turned off on
/// YouTube's side, so an in-app embedded player just shows YouTube's own
/// broken "Video unavailable" screen with no way out. Rather than gamble on
/// that per video, this screen always shows the thumbnail and sends the
/// student to the YouTube app (or browser) to actually watch it.
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
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final thumb = _thumbnailUrl;

    return Scaffold(
      appBar: GlassAppBar(
        title: Text(video.title, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          GestureDetector(
            onTap: _openOnYoutube,
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (thumb.isNotEmpty)
                    CachedNetworkImage(
                      imageUrl: thumb,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(color: palette.elevated),
                      errorWidget: (_, __, ___) =>
                          Container(color: palette.elevated),
                    )
                  else
                    Container(color: palette.elevated),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.75),
                          Colors.black.withValues(alpha: 0.05),
                        ],
                      ),
                    ),
                  ),
                  Center(
                    child: ElevatedButton.icon(
                      onPressed: _openOnYoutube,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 14,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                      icon: const Icon(Icons.play_arrow_rounded,
                          color: AppColors.red),
                      label: const Text(
                        'Watch on YouTube',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  video.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        height: 1.3,
                      ),
                ),
                if ((video.description ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    video.description!,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: palette.textSecondary,
                          height: 1.6,
                        ),
                  ),
                ],
                if ((video.pdfUrl ?? '').isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Text(
                    'Class notes',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 10),
                  PdfAttachmentTile(
                    title: video.pdfFileName ?? 'Notes for this class',
                    subtitle: 'Tap to view notes',
                    onTap: () => openPdf(
                      context,
                      url: video.pdfUrl!,
                      title: video.pdfFileName ?? video.title,
                      minimal: true,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Opens the YouTube player for [args].
Future<void> openVideo(BuildContext context, VideoPlayerArgs args) {
  return Navigator.of(context).push(
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
