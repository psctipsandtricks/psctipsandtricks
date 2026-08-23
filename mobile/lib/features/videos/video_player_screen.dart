import 'package:flutter/material.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
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
  });

  final String youtubeUrl;
  final String title;
  final String? description;
  final String? pdfUrl;
  final String? pdfFileName;
}

class VideoPlayerScreen extends StatefulWidget {
  const VideoPlayerScreen({super.key, required this.video});

  final VideoPlayerArgs video;

  @override
  State<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends State<VideoPlayerScreen> {
  YoutubePlayerController? _controller;

  @override
  void initState() {
    super.initState();
    final id = YoutubePlayer.convertUrlToId(widget.video.youtubeUrl);
    if (id != null) {
      _controller = YoutubePlayerController(
        initialVideoId: id,
        flags: const YoutubePlayerFlags(
          autoPlay: true,
          mute: false,
          enableCaption: true,
          forceHD: false,
        ),
      );
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final controller = _controller;

    if (controller == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Video')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Text(
              'This video link could not be read.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: palette.textSecondary,
                  ),
            ),
          ),
        ),
      );
    }

    return YoutubePlayerBuilder(
      player: YoutubePlayer(
        controller: controller,
        showVideoProgressIndicator: true,
        progressIndicatorColor: AppColors.cyan,
        progressColors: const ProgressBarColors(
          playedColor: AppColors.cyan,
          handleColor: AppColors.sky,
        ),
      ),
      builder: (context, player) => Scaffold(
        appBar: AppBar(
          title: Text(
            widget.video.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        body: ListView(
          padding: EdgeInsets.zero,
          children: [
            player,
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.video.title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          height: 1.3,
                        ),
                  ),
                  if ((widget.video.description ?? '').trim().isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      widget.video.description!,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: palette.textSecondary,
                            height: 1.6,
                          ),
                    ),
                  ],
                  if ((widget.video.pdfUrl ?? '').isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Text(
                      'Class notes',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 10),
                    PdfAttachmentTile(
                      title: widget.video.pdfFileName ?? 'Notes for this class',
                      subtitle: 'Tap to read',
                      onTap: () => openPdf(
                        context,
                        url: widget.video.pdfUrl!,
                        title: widget.video.title,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
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
    this.width = 132,
  });

  final String thumbnailUrl;
  final double width;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: SizedBox(
        width: width,
        height: width * 9 / 16,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.network(
              thumbnailUrl,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) =>
                  ColoredBox(color: context.palette.elevated),
            ),
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
}
