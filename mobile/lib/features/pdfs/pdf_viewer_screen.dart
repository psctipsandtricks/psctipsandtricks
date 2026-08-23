import 'dart:io';

import 'package:crypto/crypto.dart' as crypto;
import 'package:flutter/material.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/network/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/state_views.dart';

class PdfViewerArgs {
  const PdfViewerArgs({required this.url, required this.title});

  final String url;
  final String title;
}

/// Renders a remote PDF with the platform viewer.
///
/// The native view needs a local file, so the document is streamed to the app's
/// cache first. That download doubles as the cache: reopening the same PDF is
/// instant and works offline.
class PdfViewerScreen extends ConsumerStatefulWidget {
  const PdfViewerScreen({super.key, required this.args});

  final PdfViewerArgs args;

  @override
  ConsumerState<PdfViewerScreen> createState() => _PdfViewerScreenState();
}

class _PdfViewerScreenState extends ConsumerState<PdfViewerScreen> {
  String? _localPath;
  Object? _error;
  double _downloadProgress = 0;

  int _pageCount = 0;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _prepare();
  }

  Future<void> _prepare() async {
    setState(() {
      _error = null;
      _downloadProgress = 0;
    });

    try {
      final dir = await getApplicationCacheDirectory();
      final pdfDir = Directory('${dir.path}/pdfs');
      if (!pdfDir.existsSync()) pdfDir.createSync(recursive: true);

      // Hash the URL so two documents with the same file name never collide,
      // and so the same document always resolves to the same cached file.
      final name = crypto.md5.convert(widget.args.url.codeUnits).toString();
      final file = File('${pdfDir.path}/$name.pdf');

      if (!file.existsSync() || file.lengthSync() == 0) {
        await ref.read(apiClientProvider).download(
          widget.args.url,
          file.path,
          onProgress: (received, total) {
            if (total > 0 && mounted) {
              setState(() => _downloadProgress = received / total);
            }
          },
        );
      }

      if (mounted) setState(() => _localPath = file.path);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } catch (_) {
      if (mounted) {
        setState(() => _error =
            const ApiException('Could not open this document. Please try again.'));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.palette.background,
      appBar: AppBar(
        title: Text(
          widget.args.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          if (_pageCount > 0)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: context.palette.elevated,
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  child: Text(
                    '${_currentPage + 1} / $_pageCount',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_error != null) {
      return ErrorView(error: _error!, onRetry: _prepare);
    }
    if (_localPath == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 46,
              height: 46,
              child: CircularProgressIndicator(
                value: _downloadProgress > 0 ? _downloadProgress : null,
                strokeWidth: 3,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              _downloadProgress > 0
                  ? 'Loading document… ${(_downloadProgress * 100).round()}%'
                  : 'Loading document…',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: context.palette.textSecondary,
                  ),
            ),
          ],
        ),
      );
    }

    return PDFView(
      filePath: _localPath!,
      swipeHorizontal: false,
      autoSpacing: true,
      pageFling: false,
      pageSnap: false,
      fitPolicy: FitPolicy.WIDTH,
      nightMode: context.palette.isDark,
      backgroundColor: context.palette.background,
      onRender: (pages) => setState(() => _pageCount = pages ?? 0),
      onPageChanged: (page, _) => setState(() => _currentPage = page ?? 0),
      onError: (_) => setState(
        () => _error = const ApiException('This document could not be rendered.'),
      ),
    );
  }
}

/// Opens [url] in the full-screen PDF viewer.
Future<void> openPdf(
  BuildContext context, {
  required String url,
  required String title,
}) {
  return Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => PdfViewerScreen(args: PdfViewerArgs(url: url, title: title)),
    ),
  );
}

/// A tappable row advertising an attached PDF.
class PdfAttachmentTile extends StatelessWidget {
  const PdfAttachmentTile({
    super.key,
    required this.title,
    required this.onTap,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: palette.elevated,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(color: palette.border),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.rose.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.picture_as_pdf_rounded,
                  color: AppColors.rose, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  if (subtitle != null && subtitle!.isNotEmpty)
                    Text(
                      subtitle!,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                          ),
                    ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: palette.textMuted),
          ],
        ),
      ),
    );
  }
}
