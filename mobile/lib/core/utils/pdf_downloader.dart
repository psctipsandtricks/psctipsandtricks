import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme/app_colors.dart';
import 'file_saver.dart';

/// Saves a remote study PDF onto the device's public Downloads folder so the
/// student can open it from the Files app, share it, or read it with the app
/// closed. Shared by the PDF library, the standalone PDF viewer and the video
/// player's class-notes attachment.
class PdfDownloader {
  static final Dio _dio = Dio();

  static Future<void> download(
    BuildContext context, {
    required String url,
    required String title,
    String? customFileName,
  }) async {
    if (url.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No PDF URL available for download.'),
          backgroundColor: AppColors.rose,
        ),
      );
      return;
    }

    final messenger = ScaffoldMessenger.of(context);
    final fileName = _resolveFileName(customFileName, title);

    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(_progressSnack(fileName));

    File? staged;
    try {
      // 1. Pull the bytes into the app's own cache first. This never needs a
      //    permission and lets a failed transfer abort before it touches
      //    anything the student would see.
      final cacheDir = await getTemporaryDirectory();
      final stageDir = Directory('${cacheDir.path}/pdf_downloads');
      if (!await stageDir.exists()) await stageDir.create(recursive: true);
      staged = File('${stageDir.path}/$fileName');
      await _dio.download(
        url,
        staged.path,
        options: Options(responseType: ResponseType.bytes),
      );

      // 2. Hand it to the platform so it lands in the shared Downloads
      //    collection, reachable from outside the app.
      final String savedUri;
      if (Platform.isAndroid) {
        savedUri = await FileSaver.saveToDownloads(
          sourcePath: staged.path,
          fileName: fileName,
          mimeType: 'application/pdf',
        );
      } else {
        savedUri = await _saveWithPathProvider(staged, fileName);
      }

      messenger.hideCurrentSnackBar();
      messenger.showSnackBar(_successSnack(fileName, savedUri, url));
    } on PlatformException catch (e) {
      messenger.hideCurrentSnackBar();
      if (e.code == 'permission_denied') {
        messenger.showSnackBar(
          const SnackBar(
            content: Text(
              'Storage permission is needed to save PDFs to your device.',
            ),
            backgroundColor: AppColors.rose,
            duration: Duration(seconds: 4),
          ),
        );
      } else {
        await _fallbackToExternal(messenger, url, e.message ?? 'Save failed.');
      }
    } catch (e) {
      messenger.hideCurrentSnackBar();
      await _fallbackToExternal(messenger, url, '$e');
    } finally {
      try {
        await staged?.delete();
      } catch (_) {}
    }
  }

  /// Writes an already-built PDF (the quiz solutions PDF, generated entirely
  /// on-device) straight to the Downloads collection — there is no URL to
  /// fetch, so this stages the given [bytes] itself rather than downloading
  /// them, then hands off to the same platform save/open path as [download].
  static Future<void> saveBytes(
    BuildContext context, {
    required Uint8List bytes,
    required String title,
  }) async {
    final messenger = ScaffoldMessenger.of(context);
    final fileName = _resolveFileName(null, title);

    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(_progressSnack(fileName, verb: 'Preparing'));

    File? staged;
    try {
      final cacheDir = await getTemporaryDirectory();
      final stageDir = Directory('${cacheDir.path}/pdf_downloads');
      if (!await stageDir.exists()) await stageDir.create(recursive: true);
      staged = File('${stageDir.path}/$fileName');
      await staged.writeAsBytes(bytes, flush: true);

      final String savedUri;
      if (Platform.isAndroid) {
        savedUri = await FileSaver.saveToDownloads(
          sourcePath: staged.path,
          fileName: fileName,
          mimeType: 'application/pdf',
        );
      } else {
        savedUri = await _saveWithPathProvider(staged, fileName);
      }

      messenger.hideCurrentSnackBar();
      // No remote URL to fall back to if "Open" can't use the saved URI
      // directly — the file is already on disk either way.
      messenger.showSnackBar(_successSnack(fileName, savedUri, savedUri));
    } on PlatformException catch (e) {
      messenger.hideCurrentSnackBar();
      if (e.code == 'permission_denied') {
        messenger.showSnackBar(
          const SnackBar(
            content: Text(
              'Storage permission is needed to save PDFs to your device.',
            ),
            backgroundColor: AppColors.rose,
            duration: Duration(seconds: 4),
          ),
        );
      } else {
        messenger.showSnackBar(
          SnackBar(
            content: Text('Could not save the PDF: ${e.message ?? e.code}'),
            backgroundColor: AppColors.rose,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (e) {
      messenger.hideCurrentSnackBar();
      messenger.showSnackBar(
        SnackBar(
          content: Text('Could not save the PDF: $e'),
          backgroundColor: AppColors.rose,
          duration: const Duration(seconds: 4),
        ),
      );
    } finally {
      try {
        await staged?.delete();
      } catch (_) {}
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────

  static String _resolveFileName(String? custom, String title) {
    var name =
        (custom?.trim().isNotEmpty == true ? custom!.trim() : title.trim());
    name = name.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_').trim();
    if (name.isEmpty) name = 'document';
    if (!name.toLowerCase().endsWith('.pdf')) name = '$name.pdf';
    return name;
  }

  /// iOS / desktop fallback (no public Downloads collection): keep the old
  /// behaviour of dropping the file in whatever downloads-ish directory the
  /// platform exposes.
  static Future<String> _saveWithPathProvider(File staged, String fileName) async {
    final dir = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    var dest = File('${dir.path}/$fileName');
    if (await dest.exists()) {
      final stem = fileName.substring(0, fileName.length - 4);
      final stamp = DateTime.now().millisecondsSinceEpoch % 100000;
      dest = File('${dir.path}/${stem}_$stamp.pdf');
    }
    await staged.copy(dest.path);
    return Uri.file(dest.path).toString();
  }

  static Future<void> _fallbackToExternal(
    ScaffoldMessengerState messenger,
    String url,
    String reason,
  ) async {
    try {
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        messenger.showSnackBar(
          const SnackBar(
            content: Text('Opening the PDF in your browser instead…'),
            duration: Duration(seconds: 3),
          ),
        );
        return;
      }
    } catch (_) {}

    messenger.showSnackBar(
      SnackBar(
        content: Text('Could not download the PDF: $reason'),
        backgroundColor: AppColors.rose,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  static SnackBar _progressSnack(String fileName, {String verb = 'Downloading'}) =>
      SnackBar(
        content: Row(
          children: [
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2.2,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                '$verb $fileName…',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        duration: const Duration(seconds: 45),
        backgroundColor: const Color(0xFF1E293B),
      );

  static SnackBar _successSnack(String fileName, String savedUri, String url) {
    final canOpen = FileSaver.canOpen(savedUri);
    return SnackBar(
      content: Row(
        children: [
          const Icon(Icons.check_circle_rounded,
              color: AppColors.emerald, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Saved to Downloads · $fileName',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
      backgroundColor: const Color(0xFF0F172A),
      duration: const Duration(seconds: 5),
      action: SnackBarAction(
        label: 'Open',
        textColor: AppColors.cyan,
        onPressed: () async {
          if (canOpen) {
            final opened = await FileSaver.openDownloaded(
              savedUri,
              mimeType: 'application/pdf',
            );
            if (opened) return;
          }
          final uri = Uri.parse(url);
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        },
      ),
    );
  }
}
